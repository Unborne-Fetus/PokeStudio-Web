import {findLatestBuild,downloadBuildRom,gbaFromFile,beginWebEmuHandoff} from "./rom-bridge.js";

// Connected separately from the code editor to keep all ROM transfer states
// isolated from source editing, undo, and GitHub write operations.
export function installWebEmu({repo,isRemote,modified,notify}){
 const $=id=>document.getElementById(id);
 let activeBridge=null;
 const status=(text,error=false)=>{
  const out=$("webemu-status");
  out.textContent=text;
  out.classList.toggle("error",error);
 };
 $("play-webemu").onclick=async()=>{
  if(!isRemote()||!repo.repo)return notify("Connect a ROM repository first. You can also choose a local GBA in the Web Emu dialog.","error");
  if(modified().length&&!confirm("The latest build doesn't include uncommitted changes. Play it anyway?"))return;
  // Opening the emulator must happen synchronously before the first await.
  let bridge;
  try{bridge=beginWebEmuHandoff(window)}
  catch(error){notify("Could not open Web Emu: "+error.message,"error");return}
  activeBridge=bridge;
  const dialog=$("webemu-dialog");
  if(!dialog.open)dialog.showModal();
  $("webemu-actions-link").href="https://github.com/"+repo.repo+"/actions/workflows/build-brisk-emerald.yml";
  const button=$("play-webemu");
  button.disabled=true;button.textContent="Finding ROM…";
  status("Finding the newest successful GBA build on "+repo.branch+"…");
  try{
   const {run,artifact}=await findLatestBuild(repo);
   $("webemu-actions-link").href="https://github.com/"+repo.repo+"/actions/runs/"+run.id;
   status("Found build #"+run.run_number+" ("+new Date(run.created_at).toLocaleString()+"). Downloading the GBA…");
   const rom=await downloadBuildRom(repo,artifact);
   status("Sending "+rom.name+" to the Web Emu tab…");
   await bridge.transfer(rom);
   dialog.close();
   notify("Playing the latest successful Brisk Emerald build in Web Emu.","success");
  }catch(error){
   const message=error.message||String(error);
   status(message+" Download its artifact from GitHub Actions and select the ZIP or GBA here.",true);
   bridge.fail(message);
   notify("Web Emu preload: "+message,"error");
  }finally{button.disabled=false;button.textContent="▶ Play in Web Emu"}
 };
 $("webemu-manual").onclick=()=>$("webemu-file").click();
 $("webemu-file").onchange=async event=>{
  const file=event.target.files?.[0];
  event.target.value="";
  if(!file)return;
  let bridge=activeBridge;
  if(!bridge||bridge.popup.closed){
   try{bridge=beginWebEmuHandoff(window);activeBridge=bridge}
   catch(error){status(error.message,true);return}
  }
  const dialog=$("webemu-dialog");
  if(!dialog.open)dialog.showModal();
  status("Reading "+file.name+"…");
  try{
   const rom=await gbaFromFile(file.name,await file.arrayBuffer());
   status("Sending "+rom.name+" to Web Emu…");
   await bridge.transfer(rom);
   dialog.close();
   notify("Opened "+rom.name+" in Web Emu.","success");
  }catch(error){
   status("Could not open ROM: "+error.message,true);
   notify("Web Emu: "+error.message,"error");
  }
 };
 $("webemu-close").onclick=()=>$("webemu-dialog").close();
}
