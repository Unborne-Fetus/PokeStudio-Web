import test from "node:test";
import assert from "node:assert/strict";
import {cachedBuild,rememberBuild,clearCachedBuild} from "../src/rom-cache.js";

function rom(seed){
 const bytes=new Uint8Array(2048);
 bytes[0xb2]=0x96;bytes[0xa0]=seed;
 return {name:"Pokemon Brisk Emerald.gba",bytes};
}
test("Repeat launch reuses locally cached ROM for exactly the same successful artifact",async()=>{
 const repo={repo:"Unborne-Fetus/Pokemon-Brisk-Emerald",branch:"master"};
 const artifact={id:42};
 assert.equal(await cachedBuild(repo,artifact),null);
 const source=rom(1);
 await rememberBuild(repo,artifact,source);
 const matched=await cachedBuild(repo,{id:42});
 assert.equal(matched.bytes[0xa0],1);
 assert.equal((await cachedBuild(repo,{id:43})),null);
 // Selecting another branch must not accidentally boot an older branch's ROM.
 assert.equal(await cachedBuild({...repo,branch:"brisk-before-expansion-1.17"},artifact),null);
 await clearCachedBuild(repo);
 assert.equal(await cachedBuild(repo,artifact),null);
});
test("Refuses invalid cache content and allows replacing with a new build",async()=>{
 const repo={repo:"OtherOwner/OtherRepo",branch:"main"};
 const valid=rom(7);
 await rememberBuild(repo,{id:10},valid);
 await rememberBuild(repo,{id:11},rom(9));
 assert.equal((await cachedBuild(repo,{id:11})).bytes[0xa0],9);
 assert.equal(await cachedBuild(repo,{id:10}),null);
 const bad=rom(4);bad.bytes[0xb2]=0;
 assert.equal(await rememberBuild(repo,{id:12},bad),false);
 assert.equal(await cachedBuild(repo,{id:12}),null);
 await clearCachedBuild(repo);
});
