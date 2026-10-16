import test from "node:test";
import assert from "node:assert/strict";
import {monIcon} from "../src/pokemon-art.js";
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

test("form variants use the same species ID selection as Trainer Studio",()=>{
 const previous=globalThis.document;
 globalThis.document=mockDOM();
 try{
  const forms={
   groups:new Map([["BULBASAUR",[{value:"BULBASAUR"},{value:"BULBASAUR_MEGA"}]]]),
   defined:new Map([["BULBASAUR_MEGA",{id:1200}]])
  };
  const node=monIcon({},"SPECIES_BULBASAUR_MEGA",true,new Map([["BULBASAUR",1]]),forms);
  assert.equal(node.children[1].src,briskSpriteUrls(1200,true).animated);
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
