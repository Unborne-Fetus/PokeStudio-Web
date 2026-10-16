import {autocomplete} from "./autocomplete.js";
import {definitions} from "./game-legal.js";
import {nationalDexIndex} from "./brisk-art.js";
import {speciesCatalog} from "./species-forms.js";
import {monIcon} from "./pokemon-art.js";
import {speciesEntries,readFields,editSpeciesField,setSpeciesField,arrayEntry,levelMoves,eggMoves,editLevelMoves,editEggMoves} from "./pokemon-source.js";

const e=(tag,cls="",text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
const button=(text,cb,cls="btn")=>{const node=e("button",cls,text);node.type="button";node.onclick=cb;return node};
const pretty=id=>String(id).replace(/^(SPECIES|MOVE|ABILITY|TYPE|EGG_GROUP|GROWTH|BODY_COLOR)_/,"").toLowerCase().split("_").map(s=>s[0]?.toUpperCase()+s.slice(1)).join(" ");
const scalar=(label,value,cb,min=0,max=255)=>{const shell=e("label","form-field");shell.append(e("span","",label));const input=e("input");input.type="number";input.min=min;input.max=max;input.step="1";input.value=value;input.onchange=()=>{const n=Number(input.value);if(!Number.isInteger(n)||n<min||n>max){input.value=value;return}cb(String(n))};shell.append(input);return shell};
const textField=(label,value,cb)=>{const shell=e("label","form-field");shell.append(e("span","",label));const input=e("input");input.value=value;input.maxLength=60;input.onchange=()=>cb(input.value);shell.append(input);return shell};
const section=(title,subtitle="")=>{const card=e("section","panel pokemon-section");card.append(e("h3","",title));if(subtitle)card.append(e("p","muted",subtitle));return card};
const validValue=(value,choices)=>choices.some(x=>x.value===value);
const dataPath="src/data/pokemon/species_info/";
const generations=Array.from({length:9},(_,i)=>dataPath+"gen_"+(i+1)+"_families.h");
const optional=async(api,path)=>{try{const f=await api.loadRaw(path);return f.isBinary?"":f.value}catch{return ""}};
function choice(label,value,options,cb){
 const opts=options.slice();
 if(value&&!validValue(value,opts))opts.unshift({value,label:pretty(value)+" (existing)"});
 return autocomplete(label,value,opts,cb,{allowCustom:false,placeholder:"Search "+label.toLowerCase()+"…"});
}
function numberField(container,fields,key,label,write,min,max){
 const val=fields.get(key)?.value;
 if(val===undefined)return;
 if(!/^\d+$/.test(val)){container.append(e("p","muted",label+": advanced formula; open Code to edit ("+val.slice(0,80)+")"));return}
 container.append(scalar(label,val,v=>write(key,v),min,max));
}
function textMacro(value){
 const m=/^_\("((?:\\.|[^"\\])*)"\)$/.exec(value||"");
 return m?m[1].replace(/\\"/g,'"').replace(/\\\\/g,"\\"):null;
}
function readPointer(fields,key){
 return /^s[A-Za-z0-9_]+$/.test(fields.get(key)?.value||"")?fields.get(key).value:null;
}
function typeOptions(header){
 const matches=[...header.matchAll(/\bTYPE_([A-Z0-9_]+)\b\s*(?:=|,)/g)].map(x=>"TYPE_"+x[1]);
 const fallback="NORMAL FIRE WATER ELECTRIC GRASS ICE FIGHTING POISON GROUND FLYING PSYCHIC BUG ROCK GHOST DRAGON DARK STEEL FAIRY".split(" ").map(x=>"TYPE_"+x);
 return [...new Set(matches.length?matches:fallback)].filter(x=>!/(?:NONE|MYSTERY|STELLAR|NUMBER|COUNT|MAX|UNKNOWN)/.test(x)).map(value=>({value,label:pretty(value)}));
}
function symbolOptions(source,prefix){
 return [...new Set([...source.matchAll(new RegExp("\\b"+prefix+"_([A-Z0-9_]+)\\b","g"))].map(m=>prefix+"_"+m[1]))]
 .filter(x=>!/(?:NONE|COUNT|MAX|NUMBER|INVALID|UNDEFINED|UNUSED|TERMINATOR)/.test(x)).map(value=>({value,label:pretty(value)}));
}
function arrayValues(value,prefix){
 const m=/^\{\s*([^{}]+)\s*\}$/.exec(value||"");
 return m?m[1].split(",").map(x=>x.trim()).filter(x=>x.startsWith(prefix+"_")):null;
}
function macroArgs(value,macro,prefix){
 const re=new RegExp("^"+macro+"\\s*\\(\\s*("+prefix+"_[A-Z0-9_]+)\\s*(?:,\\s*("+prefix+"_[A-Z0-9_]+))?\\s*\\)$");
 const match=re.exec(value||"");
 return match?[match[1],match[2]||match[1]]:null;
}
function fieldGroup(card){const group=e("div","pokemon-field-grid");card.append(group);return group}

export async function pokemonPage(api,root){
 root.replaceChildren();
 const bar=e("div","visual-toolbar");bar.append(e("div","",""));bar.firstChild.append(e("h2","","Pokémon Studio"),e("p","muted","Search Pokémon and forms, then edit stats, abilities, evolution and moves without writing C code."));root.append(bar);
 const progress=e("div","hint-card","Loading species definitions from this repository…");root.append(progress);
 const paths=new Set(api.paths()),candidate=generations.filter(x=>paths.has(x));
 const extra=[...paths].filter(x=>x.startsWith(dataPath)&&/\.h$/.test(x)&&!candidate.includes(x));
 const sourcePaths=[...candidate,...extra].filter(x=>/species_info\/.*\.h$/.test(x));
 if(!sourcePaths.length){progress.textContent="No species_info headers were found. Connect a pokeemerald-expansion source repository.";return}
 const byId=new Map();
 // Limit parallel requests to avoid hitting GitHub's unauthenticated rate limit.
 for(let i=0;i<sourcePaths.length;i+=3){
  await Promise.all(sourcePaths.slice(i,i+3).map(async path=>{
   const source=await optional(api,path);
   if(source)for(const entry of speciesEntries(source,path))byId.set(entry.id,{path,id:entry.id});
  }));
 }
 if(!root.isConnected)return;
 const [abilitiesHeader,movesHeader,pokemonHeader,itemsHeader,configHeader,speciesHeader,dexHeader]=await Promise.all([
  optional(api,"include/constants/abilities.h"),
  optional(api,"include/constants/moves.h"),
  optional(api,"include/constants/pokemon.h"),
  optional(api,"include/constants/items.h"),
  optional(api,"include/config/pokemon.h"),
  optional(api,"include/constants/species.h"),
  optional(api,"include/constants/pokedex.h")
 ]);
 if(!root.isConnected)return;
 progress.remove();
 const abilities=definitions(abilitiesHeader,"ABILITY"),moves=definitions(movesHeader,"MOVE");
 const types=typeOptions(pokemonHeader),groups=symbolOptions(pokemonHeader,"EGG_GROUP"),
       items=definitions(itemsHeader,"ITEM");
 const dex=nationalDexIndex(dexHeader),speciesForms=speciesCatalog(speciesHeader,dexHeader);
 const speciesChoices=[...byId.keys()].sort((a,b)=>pretty(a).localeCompare(pretty(b))).map(value=>({value,label:pretty(value)}));
 const roster=e("div","trainer-workspace pokemon-workspace"),browser=e("section","panel trainer-browser"),detail=e("section","trainer-detail");
 root.append(roster);roster.append(browser,detail);
 browser.append(e("h3","","POKÉMON"));
 const variantSwitcher=e("div","pokemon-shiny-switch");
 variantSwitcher.setAttribute("role","group");
 variantSwitcher.setAttribute("aria-label","Pokémon sprite appearance");
 browser.append(variantSwitcher);
 const browserVariantButtons=[],detailVariantButtons=[];
 let showShiny=false;
 function syncVariantButtons(){
  for(const [control,isShiny] of [...browserVariantButtons,...detailVariantButtons]){
   control.classList.toggle("selected",showShiny===isShiny);
   control.setAttribute("aria-pressed",String(showShiny===isShiny));
  }
 }
 function setShiny(next){
  if(showShiny===next)return;
  showShiny=next;
  syncVariantButtons();
  renderList();
 }
 for(const [label,isShiny] of [["Normal",false],["✨ Shiny",true]]){
  const control=button(label,()=>setShiny(isShiny),"pokemon-shiny-option");
  browserVariantButtons.push([control,isShiny]);
  variantSwitcher.append(control);
 }
 syncVariantButtons();
 const search=e("input");search.placeholder="Search Pokémon, species ID or form…";search.setAttribute("aria-label","Search Pokémon");browser.append(search);
 const count=e("p","muted"),list=e("div","trainer-list"),more=button("Show more",()=>{limit+=100;renderList()});browser.append(count,list,more);
 let selected=byId.has("SPECIES_BULBASAUR")?"SPECIES_BULBASAUR":speciesChoices[0]?.value,limit=100,serial=0;
 const movePaths=[...paths].filter(x=>x.startsWith("src/data/pokemon/level_up_learnsets/")&&x.endsWith(".h"));
 const cfg=/^\s*#define\s+P_LVL_UP_LEARNSETS\s+(GEN_\d+|GEN_LATEST)\b/m.exec(configHeader)?.[1];
 const activeLevelGen=cfg==="GEN_LATEST"?Math.max(0,...movePaths.map(x=>Number(/gen_(\d+)\.h$/.exec(x)?.[1])||0)):Number(cfg?.replace("GEN_",""))||9;
 let selectedLevelGen=String(activeLevelGen);
 const eggPath=paths.has("src/data/pokemon/egg_moves.h")?"src/data/pokemon/egg_moves.h":null;
 const teachPaths=[...paths].filter(x=>/\/(?:teachable_learnsets|tmhm_learnsets|tutor_learnsets)(?:\/|\.h|\.c)/.test(x));
 function renderList(){
  const term=search.value.trim().toLowerCase().replaceAll(" ","_");
  const entries=speciesChoices.filter(x=>(x.value+" "+x.label).toLowerCase().replaceAll(" ","_").includes(term));
  count.textContent=entries.length.toLocaleString()+" Pokémon / forms";
  list.replaceChildren();for(const x of entries.slice(0,limit)){
   const row=button(x.label,()=>{selected=x.value;renderList();renderDetails()},"trainer-list-item"+(x.value===selected?" active":""));
   const art=monIcon(api,x.value,showShiny,dex,speciesForms);
    art.classList.add("pokemon-list-portrait");
    const words=e("div");words.append(e("strong","",x.label),e("small","",x.value));
    row.replaceChildren(art,words);list.append(row);
  }
  more.hidden=entries.length<=limit;
 }
 search.oninput=()=>{limit=100;renderList()};
 async function renderDetails(){
  const ticket=++serial;
  detail.replaceChildren();
  const where=byId.get(selected);
  if(!where){detail.append(e("p","muted","Select a Pokémon."));return}
  const loading=e("p","muted","Loading "+pretty(selected)+"…");detail.append(loading);
  let record;
  try{record=await api.loadRaw(where.path)}
  catch(err){if(ticket===serial)loading.textContent="Can't load species file: "+err.message;return}
  if(ticket!==serial||!root.isConnected)return;
  const entry=speciesEntries(record.value).find(x=>x.id===selected);
  if(!entry){loading.textContent="Species was not found in "+where.path;return}
  const fields=readFields(entry.body);detail.replaceChildren();
  const header=e("div","panel pokemon-detail-header"),hero=e("div","pokemon-detail-hero");
  const copy=e("div","pokemon-detail-copy");
  copy.append(e("h2","",textMacro(fields.get("speciesName")?.value)||pretty(selected)),e("p","muted",selected+" · "+where.path));
  const previews=e("div","pokemon-variant-previews");
  detailVariantButtons.length=0;
  for(const [label,isShiny] of [["Normal",false],["✨ Shiny",true]]){
   const control=button("",()=>setShiny(isShiny),"pokemon-variant-card");
   control.setAttribute("aria-label","Display "+(isShiny?"shiny":"normal")+" "+pretty(selected)+" sprites in the Pokémon list");
   control.append(monIcon(api,selected,isShiny,dex,speciesForms),e("span","pokemon-variant-name",label));
   detailVariantButtons.push([control,isShiny]);previews.append(control);
  }
  hero.append(previews,copy);header.append(hero);
  const open=button("Open species code",()=>api.open(where.path));header.append(open);detail.append(header);
  syncVariantButtons();
  function write(key,value){
   try{api.changeFor(where.path,editSpeciesField(record.value,selected,key,value));
    api.notify(pretty(selected)+": updated "+key+" (not yet committed).","success");
    renderDetails();
   }catch(err){api.notify(err.message,"error")}
  }
  // API records are shared references, so changeFor updates record.value.
  const stats=section("Base stats","Values used in battle. Enter a number and leave the field to save.");
  const statGrid=fieldGroup(stats);
  for(const [key,label] of [["baseHP","HP"],["baseAttack","Attack"],["baseDefense","Defense"],["baseSpAttack","Sp. Attack"],["baseSpDefense","Sp. Defense"],["baseSpeed","Speed"]])numberField(statGrid,fields,key,label,write,1,255);
  const total=[...["baseHP","baseAttack","baseDefense","baseSpAttack","baseSpDefense","baseSpeed"]].map(k=>Number(fields.get(k)?.value)||0).reduce((a,b)=>a+b,0);
  stats.append(e("p","muted","Base stat total: "+total));detail.append(stats);
  const identity=section("Types and abilities","Choose only options defined in this project's source.");
  const ig=fieldGroup(identity),type=macroArgs(fields.get("types")?.value,"MON_TYPES","TYPE");
  if(type)type.forEach((t,i)=>ig.append(choice("Type "+(i+1),t,types,v=>{const next=type.slice();next[i]=v;write("types","MON_TYPES("+next.join(", ")+")")})));
  else if(fields.has("types"))ig.append(e("p","muted","This Pokémon uses advanced type rules. Edit them in Code mode."));
  const ab=arrayValues(fields.get("abilities")?.value,"ABILITY");
  if(ab&&ab.length>=1&&ab.length<=3){
   for(let i=0;i<ab.length;i++){const withNone=i? [{value:"ABILITY_NONE",label:"None"},...abilities]:abilities;
    ig.append(choice(i===0?"Primary ability":i===1?"Second ability":"Hidden ability",ab[i],withNone,v=>{const next=ab.slice();next[i]=v;write("abilities","{ "+next.join(", ")+" }")}))
   }
  }else if(fields.has("abilities"))ig.append(e("p","muted","Conditional abilities are read-only here; use Code mode."));
  detail.append(identity);
  const general=section("Pokédex and gameplay");
  const gg=fieldGroup(general);
  for(const [key,label,min,max] of [["catchRate","Catch rate",0,255],["expYield","Experience yield",0,1000],["height","Height (decimetres)",0,10000],["weight","Weight (hectograms)",0,100000],["eggCycles","Egg cycles",0,255],["friendship","Starting friendship",0,255],["pokemonScale","Pokédex scale",0,2000],["trainerScale","Trainer scale",0,2000]]){
   numberField(gg,fields,key,label,write,min,max)
  }
  const name=textMacro(fields.get("speciesName")?.value),category=textMacro(fields.get("categoryName")?.value);
  if(name!==null)gg.append(textField("Species display name",name,v=>write("speciesName",'_("'+v.replace(/\\/g,"\\\\").replace(/"/g,'\\"')+'")')));
  if(category!==null)gg.append(textField("Category name",category,v=>write("categoryName",'_("'+v.replace(/\\/g,"\\\\").replace(/"/g,'\\"')+'")')));
  const growth=["GROWTH_MEDIUM_FAST","GROWTH_ERRATIC","GROWTH_FLUCTUATING","GROWTH_MEDIUM_SLOW","GROWTH_FAST","GROWTH_SLOW"].map(value=>({value,label:pretty(value)}));
  if(fields.has("growthRate"))gg.append(choice("Experience growth",fields.get("growthRate").value,growth,v=>write("growthRate",v)));
  const eggs=macroArgs(fields.get("eggGroups")?.value,"MON_EGG_GROUPS","EGG_GROUP");
  if(eggs&&groups.length)eggs.forEach((value,i)=>gg.append(choice("Egg group "+(i+1),value,groups,v=>{const next=eggs.slice();next[i]=v;write("eggGroups","MON_EGG_GROUPS("+next.join(", ")+")")})));
  const gender=/^PERCENT_FEMALE\(([\d.]+)\)$/.exec(fields.get("genderRatio")?.value||"");
  if(gender){const shell=e("label","form-field");shell.append(e("span","","Female percentage"));const input=e("input");input.type="number";input.min=0;input.max=100;input.step="0.1";input.value=gender[1];input.onchange=()=>{const n=Number(input.value);if(Number.isFinite(n)&&n>=0&&n<=100)write("genderRatio","PERCENT_FEMALE("+n+")")};shell.append(input);gg.append(shell)}
  for(const key of [...fields.keys()].filter(k=>/^evYield_(HP|Attack|Defense|SpAttack|SpDefense|Speed)$/.test(k)))numberField(gg,fields,key,"EV yield: "+pretty(key.replace("evYield_","")),write,0,3);
  detail.append(general);
  const evo=section("Evolution","Simple level and item evolutions can be edited directly; complex requirements remain untouched.");
  const evoValue=fields.get("evolutions")?.value||"";
  const simple=[...evoValue.matchAll(/\{\s*(EVO_LEVEL|EVO_ITEM)\s*,\s*(\d+|ITEM_[A-Z0-9_]+)\s*,\s*(SPECIES_[A-Z0-9_]+)\s*\}/g)];
  if(simple.length){
   for(const m of simple){
    const box=e("div","pokemon-evo-row"),method=m[1],param=m[2],target=m[3];
    box.append(e("strong","",method==="EVO_LEVEL"?"Level evolution":"Item evolution"));
    const edit=(p,t)=>write("evolutions",evoValue.replace(m[0],"{"+method+", "+p+", "+t+"}"));
    if(method==="EVO_LEVEL")box.append(scalar("Required level",param,v=>edit(v,target),1,100));
    else box.append(choice("Evolution item",param,items,v=>edit(v,target)));
    box.append(choice("Evolves into",target,speciesChoices,v=>edit(param,v)));
    evo.append(box)
   }
  }else evo.append(e("p","muted",evoValue?"No simple level/item evolution here. Other methods and conditional branches can be viewed below.":"No evolution field."));
  if(evoValue){const advanced=e("details");advanced.append(e("summary","","View original evolution rules"),e("pre","source-preview",evoValue));evo.append(advanced)}
  detail.append(evo);
  const movesPanel=section("Moves and learnsets","The species header links to other files. Edits to level-up and egg moves are saved to those files, not the species header.");
  detail.append(movesPanel);
  const validMoves=moves.length?moves:symbolOptions(movesHeader,"MOVE");
  async function renderMoves(kind,pointer,candidates,parser,editor){
   const box=e("section","pokemon-move-section");box.append(e("h3","",kind));movesPanel.append(box);
   if(!pointer){box.append(e("p","muted","No "+kind.toLowerCase()+" list is linked for this form."));return}
   let located=null,source=null,found=null;
   for(const path of candidates){
    if(ticket!==serial)return;
    const text=await optional(api,path);if(!text)continue;
    const arr=arrayEntry(text,pointer);
    if(arr){located=path;source=text;found=arr;break}
   }
   if(ticket!==serial)return;
   if(!found){box.append(e("p","muted","Linked list "+pointer+" could not be located. It may use a generated file or custom format."));return}
   const link=button("Open source file",()=>api.open(located));box.append(e("p","muted",located),link);
   const rows=parser(found.body),table=e("div","pokemon-move-list");box.append(table);
   function commit(values){
    try{
     api.changeFor(located,editor(source,pointer,values));
     api.notify("Staged "+kind.toLowerCase()+" changes in "+located,"success");renderDetails();
    }catch(err){api.notify(err.message,"error")}
   }
   function draw(){
    table.replaceChildren();
    rows.forEach((row,i)=>{
     const line=e("div","pokemon-move-row");
     if(kind==="Level-up moves")line.append(scalar("Level (0 = on evolution)",row.level,v=>{rows[i]={...row,level:Number(v)};commit(rows)},0,100));
     line.append(choice("Move",kind==="Level-up moves"?row.move:row,validMoves,v=>{rows[i]=kind==="Level-up moves"?{...row,move:v}:v;commit(rows)}));
     line.append(button("Remove",()=>{rows.splice(i,1);commit(rows)}));table.append(line)
    })
   }
   draw();
   box.append(button("+ Add move",()=>{rows.push(kind==="Level-up moves"?{level:1,move:validMoves[0]?.value||"MOVE_POUND"}:validMoves[0]?.value||"MOVE_POUND");commit(rows)}));
  }
  // Prefer generation-matching level-up file, then fall back to other versions.
  const genRow=e("div","pokemon-learnset-generation");
  const genLabel=e("label","form-field");genLabel.append(e("span","","Level-up learnset version"));
  const genSelect=e("select");
  for(const path of movePaths){const match=/gen_(\d+)\.h$/.exec(path);if(!match)continue;const option=e("option","",("Generation "+match[1])+(Number(match[1])===activeLevelGen?" (configured default)":""));option.value=match[1];genSelect.append(option)}
  genSelect.value=selectedLevelGen;
  genSelect.onchange=()=>{selectedLevelGen=genSelect.value;renderDetails()};
  genLabel.append(genSelect);genRow.append(genLabel,e("p","muted","The project's configured default is Generation "+activeLevelGen+". Switching versions edits a different historical learnset file."));
  movesPanel.append(genRow);
  const sortedMoves=[...movePaths].sort((a,b)=>Number(!a.endsWith("/gen_"+selectedLevelGen+".h"))-Number(!b.endsWith("/gen_"+selectedLevelGen+".h")));
  await renderMoves("Level-up moves",readPointer(fields,"levelUpLearnset"),sortedMoves,levelMoves,editLevelMoves);
  if(ticket!==serial)return;
  if(eggPath)await renderMoves("Egg moves",readPointer(fields,"eggMoveLearnset"),[eggPath],eggMoves,editEggMoves);
  if(ticket!==serial)return;
  const teach=readPointer(fields,"teachableLearnset");
  if(teach){
   const tm=section("TM / HM / tutor moves","Teachable moves are compiled from source lists. The generated teachable_learnsets.h is not the right file to edit.");
   const learning=fields.get("teachingType")?.value||"DEFAULT_LEARNING";
   const modes=[
    {value:"DEFAULT_LEARNING",label:"Standard: listed moves + universal moves"},
    {value:"TM_ILLITERATE",label:"Restricted: no automatic universal moves"},
    {value:"ALL_TEACHABLES",label:"Can learn every available TM / tutor move"}
   ];
   tm.append(choice("TM and tutor learning behavior",learning,modes,v=>{
    try{
     api.changeFor(where.path,setSpeciesField(record.value,selected,"teachingType",v));
     api.notify("Staged TM/tutor learning behavior for "+pretty(selected),"success");renderDetails();
    }catch(err){api.notify(err.message,"error")}
   }));
   tm.append(e("p","muted","A move must also be available as a TM or tutor move. For individual compatibility, edit the Pokémon's potential teachables list (all_learnables.json) if that file is populated; the build will regenerate the final learnset."));
   const all="src/data/pokemon/all_learnables.json",special="src/data/pokemon/special_movesets.json";
   if(paths.has(all))tm.append(button("Open potential TM / tutor moves",()=>api.open(all)));
   if(paths.has(special))tm.append(button("Open universal / signature moves",()=>api.open(special)));
   if(teachPaths.length)teachPaths.slice(0,4).forEach(path=>tm.append(button("Open "+path.split("/").at(-1),()=>api.open(path))));
   detail.append(tm)
  }

  const other=section("More settings","These settings are preserved exactly. Open the original code to change graphics, animations, descriptions, and other advanced values.");
  const d=e("details");d.append(e("summary","","View all species fields"),e("pre","source-preview",entry.body.slice(0,16000)));other.append(d);detail.append(other);
 }
 renderList();renderDetails();
}
