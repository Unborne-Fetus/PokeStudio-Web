import test from "node:test";
import assert from "node:assert/strict";
import {pokedexPage} from "../src/pokedex.js";
import {speciesEntries,readFields} from "../src/pokemon-source.js";
import {decodeDexExpression,sharedDexEntry} from "../src/pokedex-source.js";

class FakeElement {
 constructor(tag){
  this.tagName=tag;this.children=[];this.parent=null;this.className="";this._text="";
  this.value="";this.attributes={};this.dataset={};this.style={};this.hidden=false;
  this.classList={
   add:name=>{const a=new Set(this.className.split(/\s+/).filter(Boolean));a.add(name);this.className=[...a].join(" ")},
   toggle:(name,active)=>{const a=new Set(this.className.split(/\s+/).filter(Boolean));if(active)a.add(name);else a.delete(name);this.className=[...a].join(" ")}
  };
 }
 append(...nodes){for(const node of nodes)if(node){this.children.push(node);node.parent=this}}
 replaceChildren(...nodes){for(const node of this.children)node.parent=null;this.children=[];this.append(...nodes)}
 contains(node){return node===this||this.children.some(x=>x.contains(node))}
 remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null}}
 setAttribute(name,value){this.attributes[name]=String(value)}
 addEventListener(name,callback){this["on"+name]=callback}
 get textContent(){return this._text+this.children.map(x=>x.textContent).join("")}
 set textContent(value){this._text=String(value);this.children=[]}
}
function find(root,predicate,result=[]){
 if(predicate(root))result.push(root);
 for(const child of root.children)find(child,predicate,result);
 return result;
}
const speciesPath="src/data/pokemon/species_info/gen_1_families.h";
const sharedPath="src/data/pokemon/species_info/shared_dex_text.h";
const species=[
 "    [SPECIES_BULBASAUR] =",
 "    {",
 '        .speciesName = _("Bulbasaur"),',
 '        .categoryName = _("Seed"),',
 "        .natDexNum = NATIONAL_DEX_BULBASAUR,",
 "        .height = 7,",
 "        .weight = 69,",
 "        .bodyColor = BODY_COLOR_GREEN,",
 '        .description = COMPOUND_STRING("Seed sunshine."),',
 "    },",
 "    [SPECIES_PIKACHU] =",
 "    {",
 '        .speciesName = _("Pikachu"),',
 '        .categoryName = _("Mouse"),',
 "        .natDexNum = NATIONAL_DEX_PIKACHU,",
 "        .height = 4,",
 "        .weight = 60,",
 "        .bodyColor = BODY_COLOR_YELLOW,",
 "        .description = gPikachuPokedexText,",
 "    },"
].join("\n");
function fixture(){
 const data=new Map([
  [speciesPath,{value:species,isBinary:false}],
  [sharedPath,{value:'const u8 gPikachuPokedexText[] = _("Stores electricity.\\nIt can zap opponents.");',isBinary:false}],
  ["include/constants/pokedex.h",{value:"enum NationalDexOrder {\n NATIONAL_DEX_NONE,\n NATIONAL_DEX_BULBASAUR,\n NATIONAL_DEX_PIKACHU,\n};",isBinary:false}],
  ["include/constants/species.h",{value:"enum Species {\n SPECIES_NONE = 0,\n SPECIES_BULBASAUR = 1,\n SPECIES_PIKACHU = 25,\n};",isBinary:false}],
  ["include/constants/pokemon.h",{value:"enum BodyColor {\n BODY_COLOR_GREEN,\n BODY_COLOR_YELLOW,\n};",isBinary:false}]
 ]);
 const api={
  paths:()=>[...data.keys()],
  async loadRaw(path){if(!data.has(path))throw Error("Missing file "+path);return data.get(path)},
  changes:[],
  changeFor(path,source){const rec=data.get(path);if(!rec)throw Error("Unknown path "+path);rec.value=source;this.changes.push(path)},
  notify(message){this.notice=message},
  open(path){this.opened=path}
 };
 return {data,api};
}
test("Pokédex tab browses Pokémon, shows shiny art, and saves inline + shared entries",async()=>{
 const priorDoc=globalThis.document,priorConfirm=globalThis.confirm;
 globalThis.document={createElement:tag=>new FakeElement(tag)};
 globalThis.confirm=()=>true;
 try{
  const {data,api}=fixture(),root=new FakeElement("div");
  await pokedexPage(api,root);
  assert.equal(find(root,n=>n.className.includes("dex-list-item")).length,2);
  const heading=find(root,n=>n.className==="dex-hero-info")[0];
  assert.match(heading.textContent,/Bulbasaur/);
  const entry=find(root,n=>n.tagName==="textarea")[0];
  assert.equal(entry.value,"Seed sunshine.");
  entry.value="Edited description.\nA second line.";entry.oninput();
  await find(root,n=>n.tagName==="button"&&n.textContent.includes("Save entry for this Pokémon"))[0].onclick();
  const info=readFields(speciesEntries(data.get(speciesPath).value)[0].body);
  assert.equal(decodeDexExpression(info.get("description").value),"Edited description.\nA second line.");
  const shiny=find(root,n=>n.className.includes("pokemon-shiny-option")&&n.textContent.includes("Shiny"))[0];
  shiny.onclick();
  assert.ok(find(root,n=>n.tagName==="img"&&n.src?.endsWith("_front_shiny_anim.gif")).length>=2);
  const pika=find(root,n=>n.tagName==="button"&&n.attributes["aria-label"]?.includes("Pikachu"))[0];
  await pika.onclick();
  const linked=find(root,n=>n.tagName==="textarea")[0];
  assert.match(linked.value,/Stores electricity/);
  linked.value="A shared entry.\nNow with two lines.";linked.oninput();
  const saveShared=find(root,n=>n.tagName==="button"&&n.textContent.includes("Update original shared entry"))[0];
  assert.ok(saveShared);
  await saveShared.onclick();
  assert.equal(sharedDexEntry(data.get(sharedPath).value,"gPikachuPokedexText").text,"A shared entry.\nNow with two lines.");
  assert.deepEqual(api.changes,[speciesPath,sharedPath]);
 }finally{
  if(priorDoc===undefined)delete globalThis.document;else globalThis.document=priorDoc;
  if(priorConfirm===undefined)delete globalThis.confirm;else globalThis.confirm=priorConfirm;
 }
});
