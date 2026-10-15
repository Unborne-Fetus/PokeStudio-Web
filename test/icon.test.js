import test from "node:test";
import assert from "node:assert/strict";
import {iconFrameCount,removeIconBackground} from "../src/brisk-icon.js";

test("Brisk Dex icons use two vertically stacked frames",()=>{
 assert.equal(iconFrameCount(32,64),2);
 assert.equal(iconFrameCount(64,128),2);
 assert.equal(iconFrameCount(32,32),1);
 assert.equal(iconFrameCount(0,64),0);
});

test("opaque Brisk Dex palette-0 background becomes transparent without harming Pokémon pixels",()=>{
 // Four 2×2 frames' worth of real RGBA values; first pixel is palette 0.
 const bg=[98,156,131,255],sprite=[233,177,105,255],shadow=[65,65,65,255];
 const pixels=new Uint8ClampedArray([...bg,...sprite,...bg,...shadow,...bg,...sprite,...sprite,...bg]);
 const input={width:2,height:4,data:pixels};
 const converted=removeIconBackground(input);
 assert.equal(converted.frames,2);
 assert.equal(converted.removed,4);
 for(const index of [0,2,4,7])assert.equal(converted.data[index*4+3],0);
 for(const index of [1,3,5,6])assert.equal(converted.data[index*4+3],255);
 assert.deepEqual([...input.data.slice(0,4)],bg,"original pixel array is unchanged");
});

test("icons with existing transparency retain their pixels",()=>{
 const data=new Uint8ClampedArray([0,0,0,0,255,30,30,255,0,0,0,0,255,40,40,255]);
 const converted=removeIconBackground({width:2,height:2,data});
 assert.equal(converted.frames,1);
 assert.equal(converted.removed,0);
 assert.deepEqual([...converted.data],[...data]);
});

test("invalid icon data cannot silently draw both frames",()=>{
 assert.throws(()=>removeIconBackground({width:32,height:64,data:new Uint8ClampedArray(4)}));
});
