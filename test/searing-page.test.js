import test from "node:test";
import assert from "node:assert/strict";
import {searingSunEncounterPage} from "../src/searing-encounters.js";
import {CHANGES_PATH,SPECIES_PATH,LOCATIONS_PATH} from "../src/searing-encounter-source.js";
import {detectProject} from "../src/project-profiles.js";

class FakeElement{
 constructor(tag){
  this.tagName=tag;this.children=[];this.parent=null;this.className="";
  this._text="";this.value="";this.hidden=false;this.style={};this.attributes={};
  this.classList={
   add:name=>{const s=new Set(this.className.split(/\s+/).filter(Boolean));s.add(name);this.className=[...s].join(" ")},
   toggle:(name,yes)=>{const s=new Set(this.className.split(/\s+/).filter(Boolean));if(yes)s.add(name);else s.delete(name);this.className=[...s].join(" ")}
  };
 }
 append(...children){for(const child of children){if(!child)continue;this.children.push(child);child.parent=this}}
 replaceChildren(...children){for(const child of this.children)child.parent=null;this.children=[];this._text="";this.append(...children)}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null}
 setAttribute(name,value){this.attributes[name]=String(value)}
 get textContent(){return this._text+this.children.map(child=>child.textContent).join("")}
 set textContent(value){this._text=String(value);this.children=[]}
}
function walk(root,match){
 return [...(match(root)?[root]:[]),...root.children.flatMap(child=>walk(child,match))];
}
function findButton(root,phrase){
 return walk(root,x=>x.tagName==="button"&&x.textContent.includes(phrase))[0];
}
function input(root,name){
 const label=walk(root,x=>x.tagName==="label"&&x.children[0]?.textContent===name)[0];
 assert.ok(label,"Missing field "+name);
 return label.children[1];
}
function fixture(){
 const data=new Map([
  [CHANGES_PATH,'{"format_version":1,"edits":[]}\n'],
  [SPECIES_PATH,'{"25":"Pikachu","133":"Eevee"}'],
  [LOCATIONS_PATH,'{"format_version":1,"files":{"9":{"name":"Route 1"}}}']
 ]);
 const api={
  paths:()=>[...data.keys(),"tools/encounters.py","README.md","data/encounters/README.md"],
  async loadRaw(path){
   if(!data.has(path))throw Error("Missing "+path);
   return {path,isBinary:false,value:data.get(path)};
  },
  changes:[],
  changeFor(path,text){data.set(path,text);this.changes.push(path)},
  notify(message){this.notice=message},
  open(path){this.opened=path},setView(view){this.view=view}
 };
 return {data,api};
}
test("Searing Sun project supports a complete encounter table save without ROM or GARC files",async()=>{
 const prior=globalThis.document,priorConfirm=globalThis.confirm;
 globalThis.document={createElement:tag=>new FakeElement(tag)};
 globalThis.confirm=()=>true;
 try{
  const {data,api}=fixture();
  assert.equal(detectProject(api.paths()).id,"searing");
  const root=new FakeElement("div");
  await searingSunEncounterPage(api,root);
  assert.ok(findButton(root,"New encounter table"));
  findButton(root,"New encounter table").onclick();
  input(root,"Encounter file ID").value="9";
  input(root,"Day/night pair index").value="0";
  input(root,"Pokémon name or ID").value="Pikachu";
  findButton(root,"Add species override").onclick();
  findButton(root,"Add table override").onclick();
  const value=JSON.parse(data.get(CHANGES_PATH));
  assert.equal(value.edits.length,1);
  assert.equal(value.edits[0].file,9);
  assert.equal(value.edits[0].pair,0);
  assert.deepEqual(value.edits[0].slots,[{set:0,slot:0,species:25,form:0}]);
  assert.deepEqual(api.changes,[CHANGES_PATH]);
  assert.match(api.notice,/staged/i);
  assert.equal(api.paths().some(path=>path.startsWith("romfs/")),false);
 }finally{
  if(prior===undefined)delete globalThis.document;else globalThis.document=prior;
  if(priorConfirm===undefined)delete globalThis.confirm;else globalThis.confirm=priorConfirm;
 }
});
