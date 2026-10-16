import {speciesCatalog,selectedSpecies,speciesIdentifier} from "./species-forms.js";
import {createSpreadEditor} from "./spread-editor.js";
import {autocomplete} from "./autocomplete.js";
import {definitions,normalizeChoice} from "./game-legal.js";
import {STAT_NAMES,readSpread,applySpread,spreadTotal,spreadText,spreadIsValid} from "./stat-spreads.js";
import {nationalDexIndex} from "./brisk-art.js";
import {monIcon} from "./pokemon-art.js?rev=form-canvas-5";
import {isPlaceholderTrainer,pokemonChoiceLists} from "./autocomplete-data.js";
import {DROPDOWN_FIELDS,trainerDropdownOptions,optionsWithCurrent} from "./trainer-options.js";
import {catalog,mon,fields,changeMeta,changeField,editMon,addMon,removeMon,shiftMon,renameMon,setMoves,replaceTrainer,monAsset,picAsset} from "./trainer-data.js";
const dom=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x};
const button=(text,callback,cls="btn")=>{const e=dom("button",cls,text);e.type="button";e.onclick=callback;return e};
const prop=(title,value,fn,type="text")=>{const label=dom("label","form-field");label.append(dom("span","",title));const input=dom("input");input.type=type;input.value=String(value??"");input.onchange=()=>fn(type==="number"?Number(input.value):input.value);label.append(input);return label};
function art(api,path,className,title){const outer=dom("div",className+" art-frame");const letter=dom("span","art-placeholder",(title||"?").slice(0,2).toUpperCase());outer.append(letter);if(api.hasPath(path)){const img=dom("img","pixel-art");img.alt=title;img.loading="lazy";img.src=api.assetUrl(path);img.onerror=()=>img.remove();outer.append(img)}return outer}
function portrait(api,pic){return art(api,"graphics/trainers/front_pics/"+picAsset(pic)+".png","trainer-portrait",pic)}
const categories=["Name","Class","Pic","Gender","Music","AI","Items","Double Battle","Battle Type","Mugshot"];
const monFields=["Level","Ability","Nature","Ball","Tera Type","Happiness","IVs","EVs","Shiny","Gigantamax","Dynamax Level"];
// Using a dedicated page avoids treating a Showdown-like party as a wall of raw text.
export async function trainerPage(api,root){
 root.replaceChildren();
 const splash=dom("div","visual-toolbar"),intro=dom("div");
 intro.append(dom("h2","","Trainer Studio"),dom("p","muted","Search trainers, edit teams and battle settings with source-aware controls. Changes are staged until committed."));
 splash.append(intro);root.append(splash);
 const status=dom("div","hint-card","Loading src/data/trainers.party…");root.append(status);
 const path="src/data/trainers.party";let file;
 try{file=await api.loadRaw(path);if(file.isBinary)throw Error("Trainer file is not text")}
 catch(err){status.textContent="Unable to load trainer data: "+err.message;return}
 if(!root.isConnected)return;
 status.remove();
 const trainers=catalog(file.value);
 const headers={};
 await Promise.all([["items","include/constants/items.h"],["pokemon","include/constants/pokemon.h"],["ai","include/constants/battle_ai.h"],["moves","include/constants/moves.h"],["abilities","include/constants/abilities.h"],["dex","include/constants/pokedex.h"],["species","include/constants/species.h"]].map(async ([key,fileName])=>{
  try{headers[key]=(await api.loadRaw(fileName)).value||""}catch{headers[key]=""}
 }));
 if(!root.isConnected)return;
 const pokemonOptions=pokemonChoiceLists(trainers,headers);
 const validMoves=definitions(headers.moves,"MOVE"),validAbilities=definitions(headers.abilities,"ABILITY");
 const dex=nationalDexIndex(headers.dex);
 const speciesForms=speciesCatalog(headers.species,headers.dex);
 const editable=trainers.filter(t=>!isPlaceholderTrainer(t));
 const dropdowns=trainerDropdownOptions(trainers,api.paths(),headers.ai);
 if(!trainers.length){root.append(dom("div","warn","No trainer definitions were recognized in this project."));return}
 const layout=dom("div","trainer-workspace"),browser=dom("section","panel trainer-browser"),details=dom("section","trainer-detail");
 root.append(layout);layout.append(browser,details);
 const search=dom("input");search.placeholder="Search ID, name, class or Pokémon…";search.setAttribute("aria-label","Find trainer");browser.append(dom("h3","","TRAINERS"),search);
 const browserCount=dom("p","muted");browser.append(browserCount);
 const list=dom("div","trainer-list");browser.append(list);
 let selected=editable.find(t=>t.pokemon.length)||editable[0],chosenMon=0,offset=0;
 const addMore=button("Show more trainers",()=>{offset+=80;renderList()},"btn");
 browser.append(addMore);
 const index=editable.map(t=>({trainer:t,search:[t.id,t.meta.Name,t.meta.Class,...t.pokemon.map(m=>m.species)].join(" ").toLowerCase()}));
 function renderList(){
  const match=index.filter(t=>t.search.includes(search.value.trim().toLowerCase()));list.replaceChildren();
  browserCount.textContent=match.length.toLocaleString()+" trainer(s)";
  for(const item of match.slice(0,offset+80)){
   const t=item.trainer,b=button(" ",()=>{selected=t;chosenMon=0;renderList();renderDetails()},"trainer-list-item"+(selected.id===t.id?" active":""));
   b.textContent="";
   b.append(portrait(api,t.meta.Pic||"Hiker"));
   const words=dom("div");words.append(dom("strong","",t.meta.Name||t.id.replace("TRAINER_","").replaceAll("_"," ")));
   words.append(dom("small","",t.id+" · "+(t.meta.Class||"Trainer")));b.append(words);
   b.append(dom("span","trainer-team-count",String(t.pokemon.length)));list.append(b)
  }
  addMore.hidden=match.length<=offset+80
 }
 function apply(change){
  try{
   const updated=change(selected.raw);const source=replaceTrainer(file.value,selected.id,updated);
   api.changeFor(path,source);
   selected.raw=updated;
   const parsed=catalog(updated)[0];selected.meta=parsed.meta;selected.pokemon=parsed.pokemon;
   api.notify("Staged changes to "+selected.id+" — Ctrl+Z to undo.","success");
   return true
  }catch(err){api.notify("Trainer edit failed: "+err.message,"error");return false}
 }
 function editHeader(name,value){if(apply(raw=>changeMeta(raw,name,value))){renderList();renderDetails()}}
 function editMonField(index,key,value){if(apply(raw=>editMon(raw,index,block=>changeField(block,key,value))))renderDetails()}
 function renderDetails(){
  details.replaceChildren();
  const head=dom("section","panel trainer-heading"),hero=dom("div","trainer-hero");
  hero.append(portrait(api,selected.meta.Pic||"Hiker"));
  const label=dom("div","trainer-heading-copy");label.append(dom("span","eyebrow",selected.id));
  label.append(dom("h2","",selected.meta.Name||"Unnamed trainer"));
  label.append(dom("p","muted",(selected.meta.Class||"Pokémon Trainer")+" · "+selected.pokemon.length+"/6 Pokémon"));
  hero.append(label);head.append(hero);
  const headBar=dom("div","trainer-header-fields");
  for(const key of categories){
   const value=selected.meta[key]??"";
   if(!DROPDOWN_FIELDS.includes(key)){headBar.append(prop(key,value,next=>editHeader(key,next)));continue}
   const label=autocomplete(key,value,optionsWithCurrent(dropdowns[key]||[],value),next=>editHeader(key,next),{allowCustom:!["Gender","Double Battle"].includes(key)});
   if(key==="Pic"){
    const preview=dom("div","trainer-pic-select-preview");
    preview.append(portrait(api,value||"Hiker"));
    label.append(preview)
   }
   headBar.append(label)
  }
  head.append(dom("h3","","Trainer settings"),headBar);
  details.append(head);
  const team=dom("section","panel");details.append(team);
  const teamBar=dom("div","visual-toolbar"),title=dom("div");title.append(dom("h3","","Pokémon team"),dom("p","muted","Select a Pokémon to edit its build."));teamBar.append(title);
  const filler=dom("span","spacer");teamBar.append(filler,button("+ Add Pokémon",()=>{
   if(apply(addMon)){chosenMon=selected.pokemon.length-1;renderDetails()}
  },"btn primary"));team.append(teamBar);
  const cards=dom("div","team-grid");team.append(cards);
  selected.pokemon.forEach((pokemon,i)=>{
   const card=button("",()=>{chosenMon=i;renderDetails()},"team-card"+(i===chosenMon?" active":""));
   const top=dom("div","team-card-top");top.append(monIcon(api,pokemon.species,pokemon.fields.Shiny==="Yes",dex,speciesForms));
   const info=dom("div");info.append(dom("strong","",pokemon.species.replace(/^SPECIES_/,"").replaceAll("_"," ")));
   info.append(dom("small","","Lv. "+(pokemon.fields.Level||"100")+(pokemon.fields.Shiny==="Yes"?" · ✨ Shiny":"")));
   top.append(info);card.append(top);
   const bottom=dom("p","muted",(pokemon.held?"Held: "+pokemon.held+" · ":"")+(pokemon.fields.Ability||"Default ability"));card.append(bottom);
   cards.append(card)
  });
  if(selected.pokemon.length===0)team.append(dom("div","hint-card","This trainer currently has no Pokémon. Use Add Pokémon to create a party member."));
  if(chosenMon>=selected.pokemon.length)chosenMon=Math.max(0,selected.pokemon.length-1);
  const pokemon=selected.pokemon[chosenMon];if(!pokemon)return;
  const editPanel=dom("section","panel pokemon-detail");details.append(editPanel);
  const editBar=dom("div","visual-toolbar");editBar.append(dom("h3","","Edit Pokémon #"+(chosenMon+1)));
  editBar.append(dom("span","spacer"));
  editBar.append(button("↑",()=>{if(apply(raw=>shiftMon(raw,chosenMon,-1))){chosenMon=Math.max(0,chosenMon-1);renderDetails()}},"btn"));
  editBar.append(button("↓",()=>{if(apply(raw=>shiftMon(raw,chosenMon,1))){chosenMon=Math.min(selected.pokemon.length-1,chosenMon+1);renderDetails()}},"btn"));
  editBar.append(button("Remove",()=>{
   if(confirm("Remove "+pokemon.species+" from "+selected.id+"?")&&apply(raw=>removeMon(raw,chosenMon)))renderDetails()
  },"btn"));editPanel.append(editBar);
  const lead=dom("div","pokemon-lead");lead.append(monIcon(api,pokemon.species,pokemon.fields.Shiny==="Yes",dex,speciesForms));
  const leadInputs=dom("div","pokemon-lead-fields");
  const choice=selectedSpecies(pokemon.species,speciesForms);
  if(choice){
   leadInputs.append(autocomplete("Species",choice.base,speciesForms.choices,value=>{
    const next=speciesForms.groups.has(value)?value:speciesForms.choices.find(c=>c.label===value)?.value;
    if(!next)return api.notify("Choose a valid species from this project.","error");
    if(apply(raw=>editMon(raw,chosenMon,b=>renameMon(b,speciesIdentifier(next,next,speciesForms),pokemon.held,pokemon.gender))))renderDetails()
   },{allowCustom:false,placeholder:"Search Pokémon species…"}));
   const variants=speciesForms.groups.get(choice.base)||[];
   leadInputs.append(autocomplete("Form",choice.form,variants,value=>{
    const next=variants.find(v=>v.value===value||v.label===value)?.value;
    if(!next)return api.notify("That form is not defined for "+choice.base,"error");
    if(apply(raw=>editMon(raw,chosenMon,b=>renameMon(b,speciesIdentifier(choice.base,next,speciesForms),pokemon.held,pokemon.gender))))renderDetails()
   },{allowCustom:false,placeholder:"Search valid forms…"}));
  }else{
   leadInputs.append(prop("Species / form (unsupported identifier)",pokemon.species,v=>api.notify("Unknown species; select a defined species in source to enable form editing.","error")));
  }
  leadInputs.append(autocomplete("Held item",pokemon.held,pokemonOptions["Held item"],v=>{
   if(apply(raw=>editMon(raw,chosenMon,b=>renameMon(b,pokemon.species,v,pokemon.gender))))renderDetails()
  },{placeholder:"Search held items…"}));
  const gender=dom("label","form-field");gender.append(dom("span","","Gender"));
  const genderSelect=dom("select");for(const [label,value] of [["Unspecified",""],["Male","M"],["Female","F"]]){const o=dom("option","",label);o.value=value;genderSelect.append(o)}genderSelect.value=pokemon.gender;
  genderSelect.onchange=()=>{if(apply(raw=>editMon(raw,chosenMon,b=>renameMon(b,pokemon.species,pokemon.held,genderSelect.value))))renderDetails()};
  gender.append(genderSelect);leadInputs.append(gender);lead.append(leadInputs);editPanel.append(lead);
  const form=dom("div","pokemon-form");
  for(const key of monFields.filter(k=>k!=="IVs"&&k!=="EVs")){
   if(key==="Shiny"||key==="Gigantamax"){
    const label=dom("label","form-check"),input=dom("input");input.type="checkbox";input.checked=pokemon.fields[key]==="Yes";input.onchange=()=>editMonField(chosenMon,key,input.checked?"Yes":"No");label.append(input,document.createTextNode(key));form.append(label)
   } else {
    if(key==="Ability")form.append(autocomplete(key,pokemon.fields.Ability??"",validAbilities,v=>{
     const choice=normalizeChoice(v,validAbilities);if(!choice){api.notify("Unknown ability in this game","error");return}
     editMonField(chosenMon,key,choice.value);
    },{allowCustom:false,placeholder:"Search defined abilities…"}));
    else if(["Nature","Ball","Tera Type"].includes(key))form.append(autocomplete(key,pokemon.fields[key]??"",pokemonOptions[key],v=>editMonField(chosenMon,key,v),{placeholder:"Search "+key.toLowerCase()+"…"}));
    else if(key==="Dynamax Level"){
     const dynamax=dom("label","form-field");dynamax.append(dom("span","","Dynamax Level (0–10)"));
     const input=dom("input");input.type="number";input.min="0";input.max="10";input.step="1";input.value=pokemon.fields[key]??"0";
     input.onchange=()=>{
      const value=Math.round(Number(input.value));
      if(!Number.isFinite(value)||value<0||value>10){api.notify("Dynamax Level must be an integer from 0 to 10.","error");input.value=pokemon.fields[key]??"0";return}
      editMonField(chosenMon,key,value===0?"":String(value));
     };dynamax.append(input);form.append(dynamax)
    }
    else form.append(prop(key,pokemon.fields[key]??"",v=>editMonField(chosenMon,key,v),["Level","Happiness"].includes(key)?"number":"text"));
   }
  }
  editPanel.append(form);
  for(const kind of ["IVs","EVs"])editPanel.append(createSpreadEditor(kind,pokemon.fields[kind],v=>editMonField(chosenMon,kind,v)));
  const moveTitle=dom("h3","","Moves (up to four)");editPanel.append(moveTitle);
  const moves=dom("div","moves-grid");
  for(let i=0;i<4;i++)moves.append(autocomplete("Move "+(i+1),pokemon.moves[i]||"",validMoves,v=>{
   const choice=v?normalizeChoice(v,validMoves):null;
   if(v&&!choice){api.notify("Unknown move in this game","error");return}
   const updated=pokemon.moves.slice();updated[i]=choice?.value||"";
   if(apply(raw=>editMon(raw,chosenMon,b=>setMoves(b,updated))))renderDetails()
  },{allowCustom:false,placeholder:"Search defined moves…"}));
  editPanel.append(moves);
  const note=dom("p","muted","Absent fields use the project's default behavior. Moves, trainer AI and ability names must be valid for the connected expansion version.");editPanel.append(note);
  const advanced=dom("details","trainer-advanced");advanced.append(dom("summary","","View selected trainer's raw source block"));
  const pre=dom("pre","source-preview",selected.raw.slice(0,14000));advanced.append(pre);details.append(advanced);
 }
 search.oninput=()=>{offset=0;renderList()};
 renderList();renderDetails();
}
