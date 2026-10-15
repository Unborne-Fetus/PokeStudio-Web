import test from "node:test";
import assert from "node:assert/strict";
import {GitHubWorkspace,textPath,binaryPath,b64ToBytes,bytesToB64} from "../src/github.js";
import {createZip} from "../src/zip.js";

test("source paths and map binary files have the correct classification",()=>{
 assert.equal(textPath("data/maps/Route101/map.json"),true);
 assert.equal(textPath("src/data/trainers.party"),true);
 assert.equal(binaryPath("data/layouts/Route101/map.bin"),true);
 assert.equal(textPath("data/layouts/Route101/map.bin"),false);
});

test("binary data survives the GitHub base64 transform",()=>{
 const data=new Uint8Array([0,1,127,255,8,9,80,100,32,0]);
 assert.deepEqual(b64ToBytes(bytesToB64(data)),data);
});

test("multi-file ZIP produces headers for source and binary entries",async()=>{
 const blob=createZip([{path:"data/maps/Route101/map.json",value:"{}\n"},{path:"data/layouts/Route101/map.bin",bytes:new Uint8Array([0,1,255,128])}]);
 const bytes=new Uint8Array(await blob.arrayBuffer());
 const view=new DataView(bytes.buffer);
 assert.equal(view.getUint32(0,true),0x04034b50);
 assert.equal(view.getUint32(bytes.length-22,true),0x06054b50);
 assert.equal(view.getUint16(bytes.length-12,true),2);
 assert.equal(view.getUint16(bytes.length-14,true),2);
});

test("commits must abort when the remote branch moved",async()=>{
 const gh=new GitHubWorkspace();
 gh.repo="example/pokemon";gh.branch="main";gh.head="old";gh.token="TEST_PLACEHOLDER";
 gh.request=async(path)=>{
  if(path.includes("/git/ref/heads/main"))return {object:{sha:"new"}};
  throw Error("No other requests should be issued");
 };
 await assert.rejects(()=>gh.commit([{path:"README.md",value:"changed",isBinary:false}],"Update"),/changed/);
});

test("an unchanged HEAD produces one atomic multi-file tree commit",async()=>{
 const gh=new GitHubWorkspace();
 gh.repo="example/pokemon";gh.branch="main";gh.head="old";gh.token="TEST_PLACEHOLDER";
 const calls=[];
 gh.request=async(path,options={})=>{
  calls.push([path,options.method||"GET",options.body&&JSON.parse(options.body)]);
  if(path.endsWith("/git/ref/heads/main"))return {object:{sha:"old"}};
  if(path.endsWith("/git/commits/old"))return {tree:{sha:"base-tree"}};
  if(path.endsWith("/git/blobs"))return {sha:"newblob"+calls.length};
  if(path.endsWith("/git/trees"))return {sha:"newtree"};
  if(path.endsWith("/git/commits"))return {sha:"newcommit"};
  if(path.includes("/git/refs/heads/main"))return {ref:"refs/heads/main"};
  throw Error("Unexpected path "+path);
 };
 const sha=await gh.commit([{path:"src/test.c",value:"int test;\n",isBinary:false},{path:"data/map.bin",bytes:new Uint8Array([0,1]),isBinary:true}],"Update");
 assert.equal(sha,"newcommit");
 assert.equal(calls.filter(c=>c[0].endsWith("/git/blobs")).length,2);
 const tree=calls.find(c=>c[0].endsWith("/git/trees"))[2];
 assert.equal(tree.base_tree,"base-tree");
 assert.deepEqual(tree.tree.map(x=>x.path),["src/test.c","data/map.bin"]);
 assert.equal(calls.at(-1)[1],"PATCH");
});
