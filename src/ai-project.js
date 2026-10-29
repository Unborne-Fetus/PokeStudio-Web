import {textPath} from "./github.js";

export const AI_MAX_FILES=4;
export const AI_MAX_FILE_CHARS=14000;
const AI_MAX_EDITS=32;

const words=value=>String(value||"").toLowerCase().match(/[a-z0-9_]+/g)||[];

export function candidatePaths(paths,instruction,currentPath=null,limit=240){
 const keys=new Set(words(instruction).filter(word=>word.length>2));
 return [...new Set(paths)].filter(path=>textPath(path)&&!path.startsWith(".git/"))
  .map(path=>{
   const lower=path.toLowerCase(),parts=new Set(words(path));
   let score=path===currentPath?100:0;
   for(const key of keys)if(parts.has(key))score+=10;else if(lower.includes(key))score+=3;
   if(lower==="readme.md"||lower.endsWith("/readme.md"))score-=8;
   return {path,score};
  }).sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path)).slice(0,limit).map(v=>v.path);
}

export function selectFiles(response,offered){
 if(!response||!Array.isArray(response.files))throw Error("AI did not return a list of files.");
 const allowed=new Set(offered),paths=[...new Set(response.files)];
 if(!paths.length||paths.length>AI_MAX_FILES||paths.some(p=>typeof p!=="string"||!allowed.has(p)))throw Error("AI selected unsupported files. Choose paths explicitly and try again.");
 return paths;
}

export function validateEndpoint(value){
 let url;
 try{url=new URL(String(value||"").trim())}catch{throw Error("Enter a valid AI gateway URL in settings.")}
 const localhost=["localhost","127.0.0.1","[::1]"].includes(url.hostname);
 if((url.protocol!=="https:"&&!(url.protocol==="http:"&&localhost))||url.username||url.password||url.hash)throw Error("AI gateway must be HTTPS (or localhost for development), without credentials in its URL.");
 return url.href;
}

export function prepareProposal(response,sourceFiles){
 if(!response||!Array.isArray(response.edits))throw Error("AI returned no structured edits.");
 if(!response.edits.length||response.edits.length>AI_MAX_EDITS)throw Error("AI returned an unsupported number of edits.");
 const originals=new Map();
 for(const file of sourceFiles){
  if(!file||typeof file.path!=="string"||typeof file.value!=="string"||file.value.length>AI_MAX_FILE_CHARS)throw Error("Unsupported or oversized source file.");
  if(originals.has(file.path))throw Error("Duplicate source path.");
  originals.set(file.path,file.value);
 }
 if(originals.size>AI_MAX_FILES)throw Error("Too many source files.");
 const modified=new Map(originals);
 for(const edit of response.edits){
  if(!edit||typeof edit.path!=="string"||!modified.has(edit.path)||typeof edit.find!=="string"||typeof edit.replace!=="string")throw Error("AI edit has an unsupported path or operation.");
  if(edit.find.length===0||edit.find.length>8000||edit.replace.length>12000)throw Error("AI edit exceeds safety limits.");
  const value=modified.get(edit.path);
  const index=value.indexOf(edit.find);
  if(index<0)throw Error("AI search text was not found in "+edit.path+". No changes were applied.");
  if(value.indexOf(edit.find,index+edit.find.length)!==-1)throw Error("AI edit is ambiguous in "+edit.path+"; matching text occurs multiple times.");
  const updated=value.slice(0,index)+edit.replace+value.slice(index+edit.find.length);
  if(updated.length>AI_MAX_FILE_CHARS*2)throw Error("Proposed file is too large.");
  modified.set(edit.path,updated);
 }
 const changes=[];
 for(const [path,after] of modified){
  const before=originals.get(path);
  if(after===before)continue;
  if(path.endsWith(".json"))try{JSON.parse(after)}catch(error){throw Error("AI produced invalid JSON in "+path+": "+error.message)}
  changes.push({path,before,after});
 }
 if(!changes.length)throw Error("AI proposal makes no changes.");
 return {summary:typeof response.summary==="string"?response.summary.slice(0,800):"Proposed source changes",changes,operations:response.edits.length};
}

export async function callGateway(endpoint,token,payload,fetcher=fetch){
 const url=validateEndpoint(endpoint);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),60000);
 try{
  const headers={"Content-Type":"application/json"};
  if(token)headers["X-PokeStudio-Access"]=token;
  const response=await fetcher(url,{method:"POST",headers,body:JSON.stringify(payload),signal:controller.signal,cache:"no-store"});
  if(!response.ok){
   let message="HTTP "+response.status;
   try{const error=await response.json();if(typeof error.error==="string")message=error.error.slice(0,250)}catch{}
   throw Error("AI gateway: "+message);
  }
  return await response.json();
 }catch(error){if(error.name==="AbortError")throw Error("AI request timed out; no edits were applied.");throw error}
 finally{clearTimeout(timer)}
}
