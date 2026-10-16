// GitHub Actions ROM artifact retrieval + direct Web Emu browser handoff.
// Tokens are used only for GitHub API calls and never sent to Web Emu.
export const WEB_EMU_URL="https://unborne-fetus.github.io/Web-Emu/";
const MIN_GBA=192,MAX_GBA=32*1024*1024,MAX_ARCHIVE=70*1024*1024;
const workflow="build-brisk-emerald.yml";
const text=new TextDecoder();
function ensureRom(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.byteLength<MIN_GBA||bytes.byteLength>MAX_GBA)
  throw Error("Not a supported GBA image (expected 192 bytes to 32 MiB).");
 // The GBA header's fixed value is 0x96 at 0xB2, used by gbafix and the emulator.
 if(bytes[0xb2]!==0x96)throw Error("GBA header failed validation. Choose a compiled .gba ROM.");
 return bytes;
}
function fileName(name){
 const safe=String(name||"Pokemon Brisk Emerald.gba").split(/[/\\]/).at(-1);
 return /^[\w .()'-]+\.gba$/i.test(safe)?safe:"Pokemon Brisk Emerald.gba";
}
export function bytesAreZip(bytes){
 return bytes.length>=4&&bytes[0]===0x50&&bytes[1]===0x4b&&bytes[2]===0x03&&bytes[3]===0x04;
}
export async function gbaFromFile(name,buffer){
 const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
 if(bytes.byteLength>MAX_ARCHIVE)throw Error("ROM or artifact ZIP is larger than 70 MiB.");
 if(bytesAreZip(bytes))return gbaFromArtifactZip(bytes);
 return {name:fileName(name),bytes:ensureRom(bytes)};
}
// Central-directory-based ZIP reader; GitHub Actions artifact ZIPs may include
// data descriptors so the local header alone is not sufficient.
export async function gbaFromArtifactZip(input){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 if(bytes.byteLength>MAX_ARCHIVE)throw Error("Artifact ZIP exceeds the 70 MiB safety limit.");
 if(!bytesAreZip(bytes))throw Error("Artifact response is not a ZIP (GitHub authentication or browser redirect may have failed).");
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const u16=pos=>view.getUint16(pos,true),u32=pos=>view.getUint32(pos,true);
 let eocd=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
  if(u32(i)===0x06054b50&&i+22+u16(i+20)<=bytes.length){eocd=i;break}
 }
 if(eocd<0)throw Error("ZIP central directory not found.");
 const count=u16(eocd+10),start=u32(eocd+16),size=u32(eocd+12);
 if(!count||count>1000||start+size>bytes.length)throw Error("Invalid ZIP directory.");
 let offset=start,chosen=null;
 for(let i=0;i<count;i++){
  if(offset+46>bytes.length||u32(offset)!==0x02014b50)throw Error("Invalid ZIP entry header.");
  const flags=u16(offset+8),method=u16(offset+10),crc=u32(offset+16),compressed=u32(offset+20),uncompressed=u32(offset+24);
  const nameSize=u16(offset+28),extra=u16(offset+30),comment=u16(offset+32),local=u32(offset+42),end=offset+46+nameSize+extra+comment;
  if(end>bytes.length)throw Error("Incomplete ZIP directory.");
  const name=text.decode(bytes.subarray(offset+46,offset+46+nameSize));
  if(/(?:^|\/)[^/]+\.gba$/i.test(name)){
   if(chosen)throw Error("Artifact ZIP contains multiple GBA files.");
   chosen={name,flags,method,crc,compressed,uncompressed,local};
  }
  offset=end;
 }
 if(!chosen)throw Error("This ZIP has no .gba file.");
 if(chosen.flags&1)throw Error("Encrypted ZIP artifacts are not supported.");
 if(chosen.uncompressed>MAX_GBA||chosen.uncompressed<MIN_GBA)throw Error("The GBA in this artifact has an invalid size.");
 if(chosen.local+30>bytes.length||u32(chosen.local)!==0x04034b50)throw Error("ROM local ZIP header is invalid.");
 const dataStart=chosen.local+30+u16(chosen.local+26)+u16(chosen.local+28);
 if(dataStart+chosen.compressed>bytes.length)throw Error("ROM ZIP entry is truncated.");
 const packed=bytes.subarray(dataStart,dataStart+chosen.compressed);
 let uncompressed;
 if(chosen.method===0)uncompressed=new Uint8Array(packed);
 else if(chosen.method===8){
  if(typeof DecompressionStream==="undefined")throw Error("ZIP decompression is unsupported in this browser. Extract the ZIP and select the .gba file.");
  try{
   const deflate=new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
   uncompressed=new Uint8Array(await new Response(deflate).arrayBuffer());
  }catch{throw Error("Unable to decompress the artifact ZIP. Extract it and choose the .gba file.")}
 }else throw Error("Unsupported artifact ZIP compression format.");
 if(uncompressed.length!==chosen.uncompressed)throw Error("ROM length does not match the ZIP directory.");
 if(crc32(uncompressed)!==chosen.crc)throw Error("ZIP ROM checksum verification failed.");
 return {name:fileName(chosen.name),bytes:ensureRom(uncompressed)};
}
const crctable=Array.from({length:256},(_,i)=>{let x=i;for(let j=0;j<8;j++)x=x&1?0xedb88320^(x>>>1):x>>>1;return x>>>0});
function crc32(bytes){let x=0xffffffff;for(const b of bytes)x=crctable[(x^b)&255]^(x>>>8);return (x^0xffffffff)>>>0}

export function selectArtifact(runs,all,branch){
 const byId=new Map((all||[]).filter(a=>a&&!a.expired&&a.name==="Pokemon-Brisk-Emerald").map(a=>[a.workflow_run?.id,a]));
 for(const run of runs||[]){
  if(run.conclusion!=="success"||run.head_branch!==branch)continue;
  const artifact=byId.get(run.id);
  if(artifact)return {run,artifact};
 }
 return null;
}
export async function findLatestBuild(workspace){
 if(!workspace.repo||!workspace.branch)throw Error("Connect to a ROM repository first.");
 if(!workspace.token)throw Error("A GitHub token with Actions: Read permission is required for build artifacts.");
 const base="/repos/"+workspace.repo;
 const runs=(await workspace.request(base+"/actions/workflows/"+workflow+"/runs?status=success&branch="+encodeURIComponent(workspace.branch)+"&per_page=35")).workflow_runs||[];
 for(const run of runs){
  if(run.conclusion!=="success"||run.head_branch!==workspace.branch)continue;
  const artifacts=(await workspace.request(base+"/actions/runs/"+run.id+"/artifacts?per_page=100")).artifacts||[];
  const artifact=artifacts.find(item=>item.name==="Pokemon-Brisk-Emerald"&&!item.expired);
  if(artifact)return {run,artifact};
 }
 throw Error("No unexpired successful Brisk Emerald GBA artifact was found for "+workspace.branch+". Build the ROM first, then try again.");
}
export async function downloadBuildRom(workspace,artifact){
 if(!artifact?.id)throw Error("No build artifact is selected.");
 // GitHub responds with a redirect to a short-lived download URL. Some
 // browsers block CORS on that redirect; callers must offer local ZIP fallback.
 let response;
 try{
  response=await fetch("https://api.github.com/repos/"+workspace.repo+"/actions/artifacts/"+artifact.id+"/zip",{
   headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+workspace.token},
   cache:"no-store",mode:"cors"
  });
 }catch{
  throw Error("Your browser blocked GitHub's artifact download redirect. Download the artifact from Actions, then select its ZIP here.");
 }
 if(!response.ok)throw Error("GitHub artifact download failed (HTTP "+response.status+"). Check Actions permission or whether it expired.");
 const length=Number(response.headers.get("Content-Length")||0);
 if(length>MAX_ARCHIVE)throw Error("Artifact ZIP is too large.");
 const buffer=await response.arrayBuffer();
 return gbaFromArtifactZip(buffer);
}
export function beginWebEmuHandoff(host=window,emuUrl=WEB_EMU_URL){
 const url=new URL(emuUrl,host.location.href);
 if(url.origin!==host.location.origin)throw Error("Web Emu handoff requires the same trusted GitHub Pages origin.");
 const nonce=host.crypto?.randomUUID?.()||Array.from(host.crypto.getRandomValues(new Uint32Array(4))).join("-");
 url.searchParams.set("pokestudio",nonce);
 // Window opening MUST be synchronous inside the user's click handler.
 const popup=host.open(url.href,"_blank");
 if(!popup)throw Error("The browser blocked Web Emu. Allow popups for this site and retry.");
 // Same-origin BroadcastChannel survives cross-origin-opener policy isolation.
 // The nonce ensures two simultaneous emulator sessions never interfere.
 const channel=typeof host.BroadcastChannel==="function"?new host.BroadcastChannel("pokestudio-webemu-"+nonce):null;
 let ready=false,queued=null,resolvePending=null,rejectPending=null,finished=false,expiry,submitted=false,lastFailure=null;
 const deliver=message=>{
  if(channel)channel.postMessage(message);
  else if(!popup.closed)popup.postMessage(message,url.origin);
 };
 const send=()=>{
  if(!ready||!queued||submitted||finished||(!channel&&popup.closed))return;
  submitted=true;
  const data=queued.bytes.slice().buffer;
  const message={type:"pokestudio:rom",nonce,name:queued.name,rom:data};
  // BroadcastChannel performs a structured clone; window messages transfer.
  if(channel)channel.postMessage(message);
  else popup.postMessage(message,url.origin,[data]);
 };
 const receive=data=>{
  if(!data||data.nonce!==nonce)return;
  if(data.type==="webemu:ready"){
   ready=true;
   if(queued)send();
   else if(lastFailure)deliver({type:"pokestudio:failed",nonce,message:lastFailure});
  }else if(data.type==="webemu:received"){
   if(resolvePending){resolvePending();resolvePending=null;rejectPending=null;queued=null}
  }else if(data.type==="webemu:error"){
   if(rejectPending){rejectPending(Error(String(data.message||"Web Emu could not open the ROM")));resolvePending=null;rejectPending=null;queued=null}
  }
 };
 const listener=event=>{
  if(event.source!==popup||event.origin!==url.origin)return;
  receive(event.data);
 };
 host.addEventListener("message",listener);
 if(channel)channel.onmessage=event=>receive(event.data);
 expiry=host.setTimeout(()=>{
  if(rejectPending)rejectPending(Error("Web Emu did not complete the handoff. Retry or open the ROM manually."));
  dispose();
 },10*60*1000);
 function dispose(){
  if(finished)return;
  finished=true;host.removeEventListener("message",listener);host.clearTimeout(expiry);
  channel?.close();
 }
 return {
  popup,
  isAvailable:()=>!finished&&Boolean(channel||!popup.closed),
  async transfer(rom){
   if(finished||(!channel&&popup.closed))throw Error("Web Emu has closed. Click Play in Web Emu again.");
   if(resolvePending)throw Error("A ROM transfer is already in progress.");
   queued={name:fileName(rom.name),bytes:ensureRom(rom.bytes)};
   lastFailure=null;submitted=false;
   return new Promise((resolve,reject)=>{
    resolvePending=()=>{dispose();resolve()};
    rejectPending=reject;
    if(ready)send();
   });
  },
  fail(message){
   lastFailure=String(message).slice(0,240);
   if(ready)deliver({type:"pokestudio:failed",nonce,message:lastFailure});
  },
  dispose
 };
}
