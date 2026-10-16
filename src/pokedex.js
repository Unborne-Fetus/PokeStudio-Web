import {speciesEntries,readFields,editSpeciesField} from "./pokemon-source.js";
import {nationalDexIndex} from "./brisk-art.js";
import {speciesCatalog} from "./species-forms.js";
import {monIcon} from "./pokemon-art.js?rev=form-canvas-5";
import {autocomplete} from "./autocomplete.js";
import {decodeDexExpression,encodeSimpleString,parseSimpleString,dexEntryKind,editDexDescription,sharedDexEntry,editSharedDexText,entryWarnings} from "./pokedex-source.js";

const make=(tag,className="",text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node};
const button=(label,handler,className="btn")=>{const el=make("button",className,label);el.type="button";el.onclick=handler;return el};
const pretty=token=>String(token||"").replace(/^(SPECIES|NATIONAL_DEX|BODY_COLOR)_/,"").toLowerCase().split("_").map(s=>s[0]?.toUpperCase()+s.slice(1)).join(" ");
const optional=async(api,path)=>{try{const file=await api.loadRaw(path);return file.isBinary?"":file.value}catch{return ""}};
const dexDir="src/data/pokemon/species_info/";
const sharedPath=dexDir+"shared_dex_text.h";
const pad=id=>id>0?"#"+String(id).padStart(4,"0"):"No National Dex number";
function panel(title,subtitle=""){
 const root=make("section","panel dex-section");
 root.append(make("h3","",title));
 if(subtitle)root.append(make("p","muted",subtitle));
 return root;
}
function field(label,content,helpText=""){
 const shell=make("label","form-field dex-form-field");
 shell.append(make("span","",label),content);
 if(helpText)shell.append(make("small","muted",helpText));
 return shell;
}
function textInput(label,value,onChange,maxLength=30,helpText=""){
 const input=make("input");input.type="text";input.value=value;input.maxLength=maxLength;
 input.onchange=()=>onChange(input.value);
 return field(label,input,helpText);
}
function numberInput(label,value,onChange,min=0,max=65535,step=1,helpText=""){
 const input=make("input");input.type="number";input.min=String(min);input.max=String(max);
 input.step=String(step);input.value=String(value);
 input.onchange=()=>{
  const next=Number(input.value);
  if(!Number.isFinite(next)||next<min||next>max||Math.abs(next/step-Math.round(next/step))>0.00001){
   input.value=String(value);return;
  }
  onChange(next);
 };
 return field(label,input,helpText);
}
function choice(label,value,choices,commit,helpText=""){
 const options=choices.slice();
 if(value&&!options.some(x=>x.value===value))options.unshift({value,label:pretty(value)+" (current)"});
 const node=autocomplete(label,value,options,commit,{allowCustom:false,placeholder:"Search available "+label.toLowerCase()+"…"});
 if(helpText)node.append(make("small","muted",helpText));
 return node;
}
function sourceNames(index){
 return [...index.values()].sort((a,b)=>(a.num||99999)-(b.num||99999)||a.name.localeCompare(b.name));
}
export async function pokedexPage(api,root){
 root.replaceChildren();
 const page=make("div","pokedex-page");root.append(page);
 const bar=make("div","visual-toolbar");
 const title=make("div");
 title.append(make("h2","","Pokédex Studio"),make("p","muted","Write entries and edit Pokédex details visually. Source files are staged only when you save."));
 bar.append(title);page.append(bar);
 const progress=make("div","hint-card","Reading species and Pokédex information from the connected project…");page.append(progress);
 const paths=new Set(api.paths());
 const genPaths=Array.from({length:9},(_,i)=>dexDir+"gen_"+(i+1)+"_families.h").filter(p=>paths.has(p));
 const extras=[...paths].filter(p=>p.startsWith(dexDir)&&p.endsWith(".h")&&!genPaths.includes(p)&&!p.endsWith("shared_dex_text.h")&&!p.endsWith("shared_front_pic_anims.h"));
 const sourcePaths=[...genPaths,...extras];
 if(!sourcePaths.length){progress.textContent="No species_info files found. Connect a pokeemerald-expansion project.";return}
 const [dexHeader,speciesHeader,colorsHeader,sharedText]=await Promise.all([
  optional(api,"include/constants/pokedex.h"),
  optional(api,"include/constants/species.h"),
  optional(api,"include/constants/pokemon.h"),
  paths.has(sharedPath)?optional(api,sharedPath):Promise.resolve("")
 ]);
 if(!root.contains(page))return;
 const dex=nationalDexIndex(dexHeader),forms=speciesCatalog(speciesHeader,dexHeader);
 const colorNames=[...new Set([...colorsHeader.matchAll(/\bBODY_COLOR_[A-Z0-9_]+\b/g)].map(x=>x[0]))];
 const colors=colorNames.map(value=>({value,label:pretty(value)}));
 const dexChoices=[...dex.entries()].filter(([,id])=>id>0).map(([name,id])=>({value:"NATIONAL_DEX_"+name,label:pad(id)+" · "+pretty(name)}));
 const records=new Map();
 for(let i=0;i<sourcePaths.length;i+=3){
  await Promise.all(sourcePaths.slice(i,i+3).map(async path=>{
   const raw=await optional(api,path);
   if(!raw)return;
   for(const entry of speciesEntries(raw,path)){
    const fields=readFields(entry.body);
    const label=parseSimpleString(fields.get("speciesName")?.value) || pretty(entry.id);
    const category=parseSimpleString(fields.get("categoryName")?.value)||"";
    const national=fields.get("natDexNum")?.value||"";
    const num=dex.get(national.replace(/^NATIONAL_DEX_/,""))||0;
    records.set(entry.id,{id:entry.id,path,name:label,category,national,num,description:fields.get("description")?.value||""});
   }
  }));
  if(!root.contains(page))return;
 }
 if(!records.size){progress.textContent="No named Pokémon species were found in these source files.";return}
 progress.remove();
 const layout=make("div","trainer-workspace dex-workspace");
 const browser=make("section","panel trainer-browser dex-browser");
 const detail=make("div","trainer-detail dex-detail");
 layout.append(browser,detail);page.append(layout);
 browser.append(make("h3","","POKÉDEX"));
 const switcher=make("div","pokemon-shiny-switch");
 switcher.setAttribute("role","group");switcher.setAttribute("aria-label","Pokédex artwork variant");
 browser.append(switcher);
 const switchButtons=[];
 let shiny=false,selected=records.has("SPECIES_BULBASAUR")?"SPECIES_BULBASAUR":sourceNames(records)[0].id,limit=100,serial=0;
 const drafts=new Map();
 for(const [label,isShiny] of [["Normal",false],["✨ Shiny",true]]){
  const control=button(label,()=>{if(shiny===isShiny)return;shiny=isShiny;paintSwitcher();renderList()},"pokemon-shiny-option");
  control.setAttribute("aria-pressed",String(!isShiny));
  switchButtons.push([control,isShiny]);switcher.append(control);
 }
 function paintSwitcher(){
  for(const [btn,isShiny] of switchButtons){
   btn.classList.toggle("selected",isShiny===shiny);
   btn.setAttribute("aria-pressed",String(isShiny===shiny));
  }
 }
 paintSwitcher();
 const search=make("input");
 search.type="search";search.placeholder="Search name, number, category, or form…";
 search.setAttribute("aria-label","Search Pokédex entries");
 browser.append(search);
 const count=make("p","muted"),list=make("div","trainer-list"),more=button("Show more entries",()=>{limit+=100;renderList()},"btn");
 browser.append(count,list,more);
 function renderList(){
  const term=search.value.trim().toLowerCase();
  const visible=sourceNames(records).filter(r=>[r.name,pretty(r.id),r.id,r.category,String(r.num),pad(r.num)].join(" ").toLowerCase().includes(term));
  count.textContent=visible.length.toLocaleString()+" Pokémon / forms";
  list.replaceChildren();
  for(const record of visible.slice(0,limit)){
   const row=button("",()=>{selected=record.id;renderList();return renderDetails()},"trainer-list-item dex-list-item"+(selected===record.id?" active":""));
   row.setAttribute("aria-label",pad(record.num)+" "+record.name);
   const art=monIcon(api,record.id,shiny,dex,forms);art.classList.add("pokemon-list-portrait");
   const copy=make("div","dex-list-copy");
   copy.append(make("strong","",record.name),make("small","",pad(record.num)+" · "+pretty(record.id)));
   if(drafts.has(record.id)&&drafts.get(record.id)!==null)copy.append(make("small","dex-unsaved","Unstaged entry text"));
   row.append(art,copy);list.append(row);
  }
  more.hidden=visible.length<=limit;
 }
 search.oninput=()=>{limit=100;renderList()};
 function metric(fields,key,label,scale,onSave,description){
  const raw=fields.get(key)?.value;
  if(raw===undefined)return null;
  if(!/^\d+$/.test(raw))return make("p","muted",label+" uses a formula: "+raw);
  const amount=Number(raw)/scale;
  return numberInput(label,amount,n=>onSave(key,String(Math.round(n*scale))),0,scale===10?6553.5:65535,scale===10?0.1:1,description);
 }
 async function renderDetails(){
  const ticket=++serial,chosen=selected;
  detail.replaceChildren(make("div","hint-card","Loading "+pretty(chosen)+"…"));
  const record=records.get(chosen);
  if(!record)return;
  let file;
  try{file=await api.loadRaw(record.path)}
  catch(err){if(ticket===serial)detail.replaceChildren(make("p","muted","Could not load species source: "+err.message));return}
  if(ticket!==serial||!root.contains(page))return;
  const entry=speciesEntries(file.value).find(e=>e.id===chosen);
  if(!entry){detail.replaceChildren(make("p","muted","Could not find "+chosen+" in "+record.path));return}
  const fields=readFields(entry.body);
  const currentName=parseSimpleString(fields.get("speciesName")?.value);
  const currentCategory=parseSimpleString(fields.get("categoryName")?.value);
  const currentNatDex=fields.get("natDexNum")?.value||"";
  const currentNumber=dex.get(currentNatDex.replace(/^NATIONAL_DEX_/,""))||0;
  const desc=dexEntryKind(fields.get("description")?.value);
  let currentText=desc.text,sharedRecord=null;
  if(desc.kind==="shared"&&sharedText){
   const shared=await api.loadRaw(sharedPath).catch(()=>null);
   if(ticket!==serial||!root.contains(page))return;
   if(shared&&!shared.isBinary)sharedRecord=sharedDexEntry(shared.value,desc.symbol);
   if(sharedRecord?.text!==null&&sharedRecord)currentText=sharedRecord.text;
  }
  detail.replaceChildren();
  const head=make("section","panel dex-hero");
  const previews=make("div","pokemon-variant-previews");
  const heroButtons=[];
  for(const [label,isShiny] of [["Normal",false],["✨ Shiny",true]]){
   const control=button(" ",()=>{shiny=isShiny;paintSwitcher();renderList();syncHero()},"pokemon-variant-card");
   control.replaceChildren(monIcon(api,chosen,isShiny,dex,forms),make("span","pokemon-variant-name",label));
   control.setAttribute("aria-label","Show "+label+" Pokémon art in the list");
   previews.append(control);heroButtons.push([control,isShiny]);
  }
  function syncHero(){
   for(const [control,isShiny] of heroButtons){
    control.classList.toggle("selected",shiny===isShiny);
    control.setAttribute("aria-pressed",String(shiny===isShiny));
   }
  }
  syncHero();
  const heroInfo=make("div","dex-hero-info");
  heroInfo.append(make("span","dex-number",pad(currentNumber)),make("h2","",currentName||pretty(chosen)),make("p","muted",currentCategory?currentCategory+" Pokémon":pretty(chosen)));
  const pathNote=make("p","muted dex-path",record.path);
  const source=button("Open source code",()=>api.open(record.path));
  heroInfo.append(pathNote,source);
  head.append(previews,heroInfo);detail.append(head);

  function saveField(key,expression){
   try{
    const next=editSpeciesField(file.value,chosen,key,expression);
    api.changeFor(record.path,next);
    const changed=readFields(speciesEntries(next).find(x=>x.id===chosen).body);
    record.name=parseSimpleString(changed.get("speciesName")?.value)||record.name;
    record.category=parseSimpleString(changed.get("categoryName")?.value)||record.category;
    record.national=changed.get("natDexNum")?.value||record.national;
    record.num=dex.get(record.national.replace(/^NATIONAL_DEX_/,""))||0;
    api.notify("Staged Pokédex "+key+" change for "+record.name+". Review changes to commit.","success");
    renderList();renderDetails();
   }catch(err){api.notify("Cannot change "+key+": "+err.message,"error")}
  }
  const basics=panel("Pokédex information","These fields affect the in-game Pokédex and read directly from this Pokémon's species header.");
  const fieldsGrid=make("div","dex-field-grid");
  if(currentName!==null)fieldsGrid.append(textInput("Display name",currentName,v=>{
   if([...v].length>12){api.notify("This project's Pokémon names may not fit more than 12 characters. Use a shorter name.","error");return}
   try{saveField("speciesName",encodeSimpleString(v))}catch(err){api.notify(err.message,"error")}
  },12,"Changing the name also affects other places that display this species."));
  else fieldsGrid.append(make("p","muted","Display name uses advanced source syntax; open Code mode to edit."));
  if(currentCategory!==null)fieldsGrid.append(textInput("Category",currentCategory,v=>{
   if([...v].length>20){api.notify("Category must be 20 characters or fewer.","error");return}
   try{saveField("categoryName",encodeSimpleString(v))}catch(err){api.notify(err.message,"error")}
  },20,'For example: "Seed", "Flame", or "Mouse".'));
  else fieldsGrid.append(make("p","muted","Category is defined by an advanced expression."));
  for(const [key,label] of [["height","Height (m)"],["weight","Weight (kg)"]]){
   const el=metric(fields,key,label,10,saveField,"Displayed height / weight, not battle stats.");
   if(el)fieldsGrid.append(el);
  }
  const color=fields.get("bodyColor")?.value;
  if(color&&colors.length)fieldsGrid.append(choice("Pokédex color",color,colors,v=>saveField("bodyColor",v),"Used by Pokédex color sorting."));
  basics.append(fieldsGrid);detail.append(basics);

  const description=panel("Pokédex entry","Edit the description as normal text. Each new line becomes an in-game line break when you save.");
  detail.append(description);
  if(desc.kind==="shared")description.append(make("p","muted","This Pokémon references shared text ("+desc.symbol+"). Saving for this Pokémon creates its own entry without changing the shared definition."));
  const editable=currentText!==null;
  if(!editable){
   description.append(make("div","hint-card","This entry uses advanced C text or an unavailable shared definition. Its source will be preserved. Use Code mode to edit it."));
   if(desc.kind==="shared"&&paths.has(sharedPath))description.append(button("Open shared text source",()=>api.open(sharedPath)));
  }else{
   const box=make("textarea","dex-entry-input");
   box.rows=6;box.maxLength=1600;box.spellcheck=true;
   box.setAttribute("aria-label","Pokédex description");
   box.value=drafts.has(chosen)?drafts.get(chosen):currentText;
   description.append(field("Description",box,"Press Enter to insert a new line. Changes are not staged until you press Save entry."));
   const previewArea=make("div","dex-entry-preview"),previewLabel=make("h4","","In-game text preview"),preview=make("p","dex-entry-paragraph");
   previewArea.append(previewLabel,preview);description.append(previewArea);
   const count=make("p","muted dex-text-count"),warning=make("div","dex-warnings");
   description.append(count,warning);
   function updatePreview(){
    preview.textContent=box.value||"Pokédex entry preview";
    const lines=box.value.split("\n");
    count.textContent=[...box.value].length+" characters · "+lines.length+" lines";
    warning.replaceChildren();
    for(const message of entryWarnings(box.value))warning.append(make("p","dex-warning",message));
   }
   box.oninput=()=>{drafts.set(chosen,box.value);updatePreview()};
   updatePreview();
   const actions=make("div","dex-entry-actions");
   const save=button("Save entry for this Pokémon",()=>{
    try{
     const next=editDexDescription(file.value,chosen,box.value);
     api.changeFor(record.path,next);drafts.delete(chosen);
     record.description="COMPOUND_STRING";
     api.notify("Staged a unique Pokédex entry for "+record.name+".","success");
     renderList();renderDetails();
    }catch(err){api.notify("Unable to save entry: "+err.message,"error")}
   },"btn primary");
   actions.append(save);
   if(desc.kind==="shared"&&sharedRecord&&sharedRecord.text!==null&&paths.has(sharedPath)){
    const linked=button("Update original shared entry",async()=>{
     const others=[...records.values()].filter(r=>r.description===desc.symbol).length;
     const note="Change original shared entry "+desc.symbol+" in shared_dex_text.h?"+
      (others>1?" "+others+" Pokémon/forms reference this text.":"")+
      " This can affect every Pokémon using that shared entry.";
     if(!confirm(note))return;
     try{
      const sourceFile=await api.loadRaw(sharedPath);
      const next=editSharedDexText(sourceFile.value,desc.symbol,box.value);
      api.changeFor(sharedPath,next);drafts.delete(chosen);
      api.notify("Staged updated shared Pokédex text for "+desc.symbol+".","success");
      renderList();renderDetails();
     }catch(err){api.notify("Shared text edit failed: "+err.message,"error")}
    });
    actions.append(linked);
   }
   description.append(actions);
   if(desc.kind==="shared"&&paths.has(sharedPath))description.append(button("Open original shared text file",()=>api.open(sharedPath),"subtle"));
  }

  const placement=panel("Pokédex display settings","Optional: adjust how this Pokémon is positioned in the Pokédex. These settings do not change battle sprites.");
  const layoutGrid=make("div","dex-field-grid");
  for(const [key,label,helpText] of [
   ["pokemonScale","Pokédex Pokémon scale","Controls the size in the Pokédex display."],
   ["pokemonOffset","Pokédex vertical offset","Moves the sprite in the Pokédex display."],
   ["trainerScale","Trainer comparison scale","Controls the human comparison preview."],
   ["trainerOffset","Trainer comparison offset","Moves the comparison figure."]
  ]){
   const val=fields.get(key)?.value;
   if(val===undefined)continue;
   if(/^-?\d+$/.test(val))layoutGrid.append(numberInput(label,Number(val),n=>saveField(key,String(n)),key.endsWith("Offset")?-128:0,key.endsWith("Offset")?127:65535,1,helpText));
   else layoutGrid.append(make("p","muted",label+" uses custom code; left unchanged."));
  }
  const advanced=make("details","dex-advanced"),summary=make("summary","","Show Pokédex display positioning");
  advanced.append(summary,layoutGrid);placement.append(advanced);detail.append(placement);

  const assign=panel("National Pokédex assignment","Changing this selects an existing National Dex identity for this form. It does not renumber the entire National Pokédex.");
  assign.append(make("p","muted",currentNatDex?currentNatDex+" · "+pad(currentNumber):"No National Dex reference in this form."));
  if(fields.has("natDexNum")&&dexChoices.length){
   assign.append(choice("National Dex identity",currentNatDex,dexChoices,v=>saveField("natDexNum",v),"Use with care: different forms usually share their base species number."));
  }
  if(paths.has("include/constants/pokedex.h"))assign.append(button("View National Dex constants",()=>api.open("include/constants/pokedex.h")));
  detail.append(assign);
  const footer=make("p","muted dex-bottom-note","Source changes are kept locally and can be reviewed, exported, or committed using PokéStudio's existing controls. The normal/shiny switch only changes the preview artwork.");
  detail.append(footer);
 }
 renderList();
 await renderDetails();
}
