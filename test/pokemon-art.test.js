import test from "node:test";
import assert from "node:assert/strict";
import {monIcon,romFrontArt,parseJascPalette,recolorPixels} from "../src/pokemon-art.js";
import {briskSpriteUrls} from "../src/brisk-art.js";

function mockDOM(){
 return {createElement(tag){
  return {tagName:tag,children:[],className:"",dataset:{},hidden:false,
   append(...nodes){this.children.push(...nodes)},
   remove(){this.removed=true}
  };
 }};
}

test("Pokémon sprites use distinct animated normal and shiny assets, with matching fallback images",()=>{
 const previous=globalThis.document;
 globalThis.document=mockDOM();
 try{
  const dex=new Map([["BULBASAUR",1]]);
  const normal=monIcon({},"SPECIES_BULBASAUR",false,dex);
  const shiny=monIcon({},"SPECIES_BULBASAUR",true,dex);
  const normalImage=normal.children.find(x=>x.tagName==="img");
  const shinyImage=shiny.children.find(x=>x.tagName==="img");
  assert.equal(normalImage.src,briskSpriteUrls(1,false).animated);
  assert.equal(shinyImage.src,briskSpriteUrls(1,true).animated);
  assert.notEqual(normalImage.src,shinyImage.src);
  assert.equal(normalImage.className,"brisk-front-sprite");
  assert.equal(shinyImage.loading,"lazy");
  shinyImage.onerror();
  assert.equal(shinyImage.src,briskSpriteUrls(1,true).still);
  shinyImage.onerror();
  assert.equal(shinyImage.removed,true);
  assert.equal(shiny.children[0].hidden,false);
  normalImage.onload();
  assert.equal(normal.children[0].hidden,true);
 }finally{
  if(previous===undefined)delete globalThis.document;
  else globalThis.document=previous;
 }
});

test("form variants never use the internal species enum ID as a Brisk Dex sprite number",()=>{
 const previous=globalThis.document;
 globalThis.document=mockDOM();
 try{
  const forms={
   groups:new Map([["BULBASAUR",[{value:"BULBASAUR"},{value:"BULBASAUR_MEGA"}]]]),
   defined:new Map([["BULBASAUR_MEGA",{id:1200}]])
  };
  const node=monIcon({},"SPECIES_BULBASAUR_MEGA",true,new Map([["BULBASAUR",1]]),forms);
  assert.equal(node.children[1].src,briskSpriteUrls(1,true).animated);
 }finally{
  if(previous===undefined)delete globalThis.document;
  else globalThis.document=previous;
 }
});

test("missing sprite identifiers keep a readable placeholder",()=>{
 const previous=globalThis.document;
 globalThis.document=mockDOM();
 try{
  const node=monIcon({},"SPECIES_UNKNOWN",false,new Map());
  assert.equal(node.children.length,1);
  assert.equal(node.children[0].textContent,"UN");
 }finally{
  if(previous===undefined)delete globalThis.document;
  else globalThis.document=previous;
 }
});


test("different form layouts resolve to matching ROM art rather than unrelated GIFs",()=>{
 const assets=new Set([
  "graphics/pokemon/aegislash/anim_front.png",
  "graphics/pokemon/aegislash/blade/anim_front.png",
  "graphics/pokemon/custom_megas/amoonguss/mega/front_80.png"
 ]);
 const api={hasPath:path=>assets.has(path),assetUrl:path=>"https://example.test/"+path};
 const dex=new Map([["AEGISLASH",681],["AMOONGUSS",591],["BULBASAUR",1]]);
 assert.equal(romFrontArt(api,"SPECIES_AEGISLASH_BLADE",dex).path,"graphics/pokemon/aegislash/blade/anim_front.png");
 assert.equal(romFrontArt(api,"SPECIES_AEGISLASH_SHIELD",dex).path,"graphics/pokemon/aegislash/anim_front.png");
 assert.equal(romFrontArt(api,"SPECIES_AMOONGUSS_MEGA",dex).path,"graphics/pokemon/custom_megas/amoonguss/mega/front_80.png");
 assert.equal(romFrontArt(api,"SPECIES_BULBASAUR",dex),null);
 const previous=globalThis.document;
 globalThis.document=mockDOM();
 try{
  const mega=monIcon(api,"SPECIES_AMOONGUSS_MEGA",false,dex);
  assert.equal(mega.children[1].src,"https://example.test/graphics/pokemon/custom_megas/amoonguss/mega/front_80.png");
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous}
});
test("JASC palettes recolor normal RGB pixels to shiny while preserving transparent pixels",()=>{
 const normal=parseJascPalette("JASC-PAL\n0100\n2\n255 172 205\n0 0 0\n");
 const shiny=parseJascPalette("JASC-PAL\n0100\n2\n232 96 152\n0 0 0\n");
 const rgba=new Uint8ClampedArray([255,172,205,255,255,172,205,0]);
 assert.equal(recolorPixels(rgba,normal,shiny),true);
 assert.deepEqual([...rgba],[232,96,152,255,255,172,205,0]);
});
