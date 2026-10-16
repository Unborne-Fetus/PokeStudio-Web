// Cache one successful GBA per repository/branch for faster repeat launches.
// No GitHub credentials are stored, and artifact IDs prevent serving stale ROMs.
const DB_NAME="PokeStudioWebEmuCache";
const DB_VERSION=1;
const STORE="latest-build";
const memory=new Map();
let opening=null;
function cacheKey(workspace){
 return String(workspace?.repo||"")+":"+String(workspace?.branch||"");
}
function database(){
 if(opening)return opening;
 if(typeof indexedDB==="undefined")return Promise.resolve(null);
 opening=new Promise(resolve=>{
  try{
   const request=indexedDB.open(DB_NAME,DB_VERSION);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE)};
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>resolve(null);
   request.onblocked=()=>resolve(null);
  }catch{resolve(null)}
 });
 return opening;
}
async function readStored(key){
 const db=await database();
 if(!db)return null;
 return new Promise(resolve=>{
  try{
   const request=db.transaction(STORE,"readonly").objectStore(STORE).get(key);
   request.onsuccess=()=>resolve(request.result||null);
   request.onerror=()=>resolve(null);
  }catch{resolve(null)}
 });
}
async function writeStored(key,record){
 const db=await database();
 if(!db)return false;
 return new Promise(resolve=>{
  try{
   const request=db.transaction(STORE,"readwrite").objectStore(STORE).put(record,key);
   request.onsuccess=()=>resolve(true);
   request.onerror=()=>resolve(false);
  }catch{resolve(false)}
 });
}
async function deleteStored(key){
 const db=await database();
 if(!db)return;
 await new Promise(resolve=>{
  try{
   const request=db.transaction(STORE,"readwrite").objectStore(STORE).delete(key);
   request.onsuccess=()=>resolve();
   request.onerror=()=>resolve();
  }catch{resolve()}
 });
}
function valid(record,artifactId){
 if(!record||record.artifactId!==artifactId||typeof record.name!=="string"||
    !/\.gba$/i.test(record.name))return false;
 const bytes=record.bytes instanceof Uint8Array?record.bytes:
  record.bytes instanceof ArrayBuffer?new Uint8Array(record.bytes):null;
 return Boolean(bytes&&bytes.length>=192&&bytes.length<=32*1024*1024&&bytes[0xb2]===0x96);
}
export async function cachedBuild(workspace,artifact){
 const key=cacheKey(workspace),artifactId=Number(artifact?.id);
 if(!artifactId)return null;
 let record=memory.get(key);
 if(!record||record.artifactId!==artifactId)record=await readStored(key);
 if(!valid(record,artifactId))return null;
 memory.set(key,record);
 return {name:record.name,bytes:record.bytes instanceof Uint8Array?record.bytes:new Uint8Array(record.bytes)};
}
export async function rememberBuild(workspace,artifact,rom){
 const key=cacheKey(workspace),artifactId=Number(artifact?.id);
 const record={artifactId,name:rom?.name,bytes:rom?.bytes};
 if(!artifactId||!valid(record,artifactId))return false;
 memory.set(key,record);
 // Store a cloned ArrayBuffer; don't mutate the bytes being handed to Web Emu.
 return writeStored(key,{artifactId,name:rom.name,bytes:rom.bytes.slice().buffer});
}
export async function clearCachedBuild(workspace){
 const key=cacheKey(workspace);
 memory.delete(key);
 await deleteStored(key);
}
