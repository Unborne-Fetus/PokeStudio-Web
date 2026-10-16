import test from "node:test";
import assert from "node:assert/strict";
import {createZip} from "../src/zip.js";
import {gbaFromArtifactZip,gbaFromFile,findLatestBuild,beginWebEmuHandoff,selectArtifact} from "../src/rom-bridge.js";

function exampleGba(){
 const bytes=new Uint8Array(2048);
 bytes[0xb2]=0x96;bytes[0xa0]=0x42;return bytes;
}
test("Extracts the original GBA from the Actions ZIP with a verified checksum",async()=>{
 const original=exampleGba();
 const archive=await createZip([{path:"Pokemon Brisk Emerald.gba",bytes:original}]).arrayBuffer();
 const result=await gbaFromArtifactZip(archive);
 assert.equal(result.name,"Pokemon Brisk Emerald.gba");
 assert.deepEqual([...result.bytes],[...original]);
 assert.equal((await gbaFromFile("Brisk.gba",original)).bytes.length,2048);
 const damaged=new Uint8Array(archive);
 damaged[damaged.indexOf(0x42)]=0x43;
 await assert.rejects(gbaFromArtifactZip(damaged),/checksum|GBA header|not a ZIP/i);
});
test("Rejects invalid game files or unrelated ZIPs",async()=>{
 await assert.rejects(gbaFromFile("wrong.gba",new Uint8Array(2048)),/header/);
 const zip=await createZip([{path:"readme.txt",value:"Not a GBA"}]).arrayBuffer();
 await assert.rejects(gbaFromArtifactZip(zip),/no .gba/i);
});
test("Prefers a recent successful build with a nonexpired ROM artifact",async()=>{
 const runs=[
  {id:6,conclusion:"success",head_branch:"master"},
  {id:5,conclusion:"success",head_branch:"master"}
 ];
 const artifacts=[
  {id:77,name:"Pokemon-Brisk-Emerald",expired:false,workflow_run:{id:5}},
  {id:99,name:"Pokemon-Brisk-Emerald",expired:true,workflow_run:{id:6}}
 ];
 assert.equal(selectArtifact(runs,artifacts,"master").artifact.id,77);
 const queries=[];
 const repo={
  repo:"Unborne-Fetus/Pokemon-Brisk-Emerald",branch:"master",token:"private-token",
  async request(query){
   queries.push(query);
   if(query.includes("/runs?"))return {workflow_runs:runs};
   if(query.includes("/runs/6/"))return {artifacts:[artifacts[1]]};
   if(query.includes("/runs/5/"))return {artifacts:[artifacts[0]]};
   throw Error("Unexpected request "+query);
  }
 };
 assert.equal((await findLatestBuild(repo)).run.id,5);
 assert.equal(queries.length,3);
});
test("ROM handoff rejects other origins and sends bytes but no GitHub token",async()=>{
 const listeners=new Map(),out=[];
 const popup={closed:false,postMessage(data,origin,transfer){out.push({data,origin,transfer})}};
 const host={
  location:{origin:"https://unborne-fetus.github.io",href:"https://unborne-fetus.github.io/PokeStudio-Web/"},
  crypto:{randomUUID:()=>"123e4567-e89b-12d3-a456-426614174000"},
  open:()=>popup,
  addEventListener:(name,cb)=>listeners.set(name,cb),
  removeEventListener:name=>listeners.delete(name),
  setTimeout:()=>1,clearTimeout:()=>{}
 };
 const bridge=beginWebEmuHandoff(host);
 const pending=bridge.transfer({name:"Brisk.gba",bytes:exampleGba()});
 const message=listeners.get("message");
 message({source:popup,origin:"https://malicious.example",data:{type:"webemu:ready",nonce:"123e4567-e89b-12d3-a456-426614174000"}});
 assert.equal(out.length,0);
 message({source:popup,origin:host.location.origin,data:{type:"webemu:ready",nonce:"123e4567-e89b-12d3-a456-426614174000"}});
 assert.equal(out[0].data.type,"pokestudio:rom");
 assert.equal(out[0].data.rom.byteLength,2048);
 assert.equal(JSON.stringify(out).includes("private-token"),false);
 message({source:popup,origin:host.location.origin,data:{type:"webemu:received",nonce:"123e4567-e89b-12d3-a456-426614174000"}});
 await pending;
 assert.equal(listeners.has("message"),false);
});
