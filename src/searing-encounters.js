import {
 CHANGES_PATH,LOCATIONS_PATH,SPECIES_PATH,readChanges,parseSpeciesNames,
 parseLocationNames,parseSpeciesInput,validateChanges,updateTable,removeTable,
 updateSlot,removeSlot,updateRate,removeRate,serializeChanges,tableKey
} from "./searing-encounter-source.js";
import {readReferenceCsv,effectiveRates,referenceErrors} from "./searing-reference.js";

const node=(tag,klass="",value)=>{const n=document.createElement(tag);if(klass)n.className=klass;if(value!==undefined)n.textContent=String(value);return n};
function btn(title,onClick,klass="btn"){const b=node("button",klass,title);b.type="button";b.onclick=onClick;return b}
function field(label,value,type="text",min=null,max=null){
 const shell=node("label","form-field"),name=node("span","",label),input=node("input");
 input.type=type;input.value=value===undefined||value===null?"":String(value);
 if(min!==null)input.min=String(min);if(max!==null)input.max=String(max);
 shell.append(name,input);return {shell,input};
}
function clone(value){return JSON.parse(JSON.stringify(value))}
function choice(label,items,current){
 const shell=node("label","form-field"),select=node("select");
 for(const [name,value] of items){
  const option=node("option","",name);option.value=String(value);select.append(option);
 }
 select.value=current;shell.append(node("span","",label),select);
 return {shell,input:select};
}
const int=(value,min,max,label)=>{
 if(String(value).trim()==="")throw Error(label+" is required.");
 const n=Number(value);
 if(!Number.isInteger(n)||n<min||n>max)throw Error(label+" must be an integer from "+min+" to "+max+".");
 return n;
};
const optLevel=(value,label)=>{
 if(String(value).trim()==="")return null;
 return int(value,1,100,label);
};
export async function searingSunEncounterPage(api,root){
 root.replaceChildren();
 const top=node("div","visual-toolbar"),caption=node("div");
 caption.append(node("h2","","Searing Sun · Gen 7 Encounters"),
  node("p","muted","Edit the sparse encounter overrides used by the USUM patch tools. Original game archives stay on your PC."));
 top.append(caption);root.append(top);
 if(!api.paths().includes(CHANGES_PATH)){
  root.append(node("div","hint-card","This project doesn't have "+CHANGES_PATH+". Connect Pokémon Searing Sun or open its repository folder."));
  return;
 }
 const loading=node("p","hint-card","Reading Searing Sun encounter overrides…");root.append(loading);
 const optional=async path=>{
  try{return (await api.loadRaw(path)).value||""}catch{return ""}
 };
 let record,names={byId:new Map(),byName:new Map()},locations=new Map(),data;
 try{
  const [raw,species,areas]=await Promise.all([
   api.loadRaw(CHANGES_PATH),
   optional(SPECIES_PATH),optional(LOCATIONS_PATH)
  ]);
  record=raw;
  data=readChanges(raw.value);
  if(species)names=parseSpeciesNames(species);
  if(areas)locations=parseLocationNames(areas);
  const errors=validateChanges(data,locations,names);
  if(errors.length)throw Error("Existing overrides need correction in Code mode: "+errors[0]);
 }catch(error){
  loading.textContent="Cannot open the Gen 7 editor: "+error.message;
  const open=btn("Open encounter JSON",()=>{api.open(CHANGES_PATH);api.setView("code")});
  root.append(open);return;
 }
 loading.remove();
 const notice=node("p","searing-note");
 const upload=btn("Load local reference.csv",()=>fileChooser.click());
 const openJson=btn("Open changes.json",()=>{api.open(CHANGES_PATH);api.setView("code")});
 const guide=btn("Read encounter guide",()=>{api.open("data/encounters/README.md");api.setView("code")});
 const refSummary=node("span","muted","No local encounter reference loaded");
 const fileChooser=node("input");fileChooser.type="file";fileChooser.accept=".csv,text/csv";fileChooser.hidden=true;
 top.append(upload,openJson,guide,refSummary,fileChooser);
 root.append(node("div","hint-card",
  "Only data/encounters/changes.json is staged in GitHub. Import reference.csv from your PC for original rates, names and table IDs; it is read only and never uploaded. After committing, run APPLY_ENCOUNTERS.bat and SAVE_CHANGES.bat on your PC to create a playable mod patch."));
 root.append(notice);
 const outer=node("div","trainer-workspace searing-workspace");
 const browser=node("section","panel trainer-browser searing-browser"),details=node("section","trainer-detail searing-details");
 outer.append(browser,details);root.append(outer);
 const search=node("input");search.type="search";search.placeholder="Search file ID, location, day/night or pair…";
 const count=node("p","muted"),list=node("div","trainer-list");
 const listTitle=node("h3","","OVERRIDDEN TABLES");
 const addTable=btn("+ New encounter table",()=>selectTable(null),"btn primary");
 const more=btn("Show more tables",()=>{listLimit+=100;renderList()});
 browser.append(listTitle,search,addTable,count,list,more);
 let selected=data.edits.length?0:null,working=null,reference=null,slotSelection=null,rateSelection=null,listLimit=100;
 const setNote=(message,error=false)=>{
  notice.textContent=message||"";
  notice.classList.toggle("error",error);
 };
 const areaName=file=>locations.get(file)||reference?.get(String(file)+":"+String(working?.pair??0)+":"+String(working?.time??"day"))?.location||"";
 const referenceFor=edit=>reference?.get(tableKey(edit))||null;
 function resetDraft(){
  working=selected===null?{file:"",pair:0,time:"day",slots:[],rates:[]}:
   clone(data.edits[selected]);
  slotSelection=null;rateSelection=null;
 }
 function selectTable(index){
  selected=index;resetDraft();renderList();renderDetail();
 }
 function chooseReference(table){
  // The original CSV stays on this PC. Stage only a sparse override with
  // its verified file/pair/time, never the original encounter contents.
  selected=null;working={file:table.file,pair:table.pair,time:table.time,slots:[],rates:[]};
  slotSelection=null;rateSelection=null;renderList();renderDetail();
 }
 function renderList(){
  list.replaceChildren();
  const q=search.value.trim().toLowerCase();
  const staged=data.edits.map((e,i)=>({e,i,staged:true}));
  const keys=new Set(staged.map(item=>tableKey(item.e)));
  const originals=reference?[...reference.values()].filter(e=>!keys.has(tableKey(e))).map(e=>({e,i:null,staged:false})):[];
  const filtered=[...staged,...originals].filter(({e})=>
   [e.file,e.pair,e.time,locations.get(e.file)||"",referenceFor(e)?.location||""]
    .join(" ").toLowerCase().includes(q));
  listTitle.textContent=reference?"ENCOUNTER TABLES":"OVERRIDDEN TABLES";
  count.textContent=filtered.length+" matching · "+data.edits.length+" staged · "+
   (reference?originals.length+" original tables":"load reference.csv to browse originals");
  if(!filtered.length)list.append(node("p","muted",q?"No matches.":"No table overrides yet. Add a table using local reference IDs."));
  for(const {e,i,staged:hasEdit} of filtered.slice(0,listLimit)){
   const name=locations.get(e.file)||referenceFor(e)?.location;
   const title="File "+e.file+" · Pair "+e.pair+" · "+e.time+(name?" · "+name:"");
   const active=hasEdit?selected===i: selected===null&&working?.file===e.file&&working?.pair===e.pair&&working?.time===e.time;
   const row=btn(title,()=>hasEdit?selectTable(i):chooseReference(e),
    "trainer-list-item searing-list-item"+(active?" active":""));
   const subtitle=node("small","muted",hasEdit
    ?(e.slots||[]).length+" species/form changes · "+(e.rates||[]).length+" rate changes"
    :"Original table · click to create sparse override");
   row.append(subtitle);list.append(row);
  }
  more.hidden=filtered.length<=listLimit;
 }
 function write(next,message){
  const text=serializeChanges(next);
  api.changeFor(CHANGES_PATH,text);
  data=next;
  api.notify(message+" — staged for GitHub review.","success");
  setNote(message+". Remember to apply the overrides using your local patch tools.");
  renderList();
 }
 if(!data.edits.length)resetDraft();
 else resetDraft();
 search.oninput=()=>{listLimit=100;renderList()};
 fileChooser.onchange=async event=>{
  const file=event.target.files?.[0];
  event.target.value="";
  if(!file)return;
  try{
   reference=readReferenceCsv(await file.text());listLimit=100;
   refSummary.textContent=reference.size.toLocaleString()+" local day/night tables loaded";
   setNote("Loaded the reference from this PC only. No encounter archive or CSV was uploaded.");
   renderList();renderDetail();
  }catch(error){
   reference=null;refSummary.textContent="Reference CSV not loaded";
   setNote("Reference import failed: "+error.message,true);
  }
 };
 function renderDetail(){
  details.replaceChildren();
  if(!working){details.append(node("p","muted","Select or create an encounter table."));return}
  const title=node("section","panel searing-panel"),header=node("h3","",selected===null?"New day/night table override":"Edit table override");
  title.append(header);
  const inputs=node("div","searing-grid");
  const file=field("Encounter file ID",working.file,"number",0,65535);
  const pair=field("Day/night pair index",working.pair,"number",0,65535);
  const time=choice("Time of day",[["Day","day"],["Night","night"]],working.time);
  const min=field("Minimum level (optional)",working.min_level,"number",1,100);
  const max=field("Maximum level (optional)",working.max_level,"number",1,100);
  inputs.append(file.shell,pair.shell,time.shell,min.shell,max.shell);
  title.append(inputs);
  const area=node("p","muted");
  title.append(area);
  function readHeader(){
   working.file=file.input.value.trim()===""?"":int(file.input.value,0,65535,"File ID");
   working.pair=int(pair.input.value,0,65535,"Pair");
   working.time=time.input.value;
   const low=optLevel(min.input.value,"Minimum level"),high=optLevel(max.input.value,"Maximum level");
   if(low===null)delete working.min_level;else working.min_level=low;
   if(high===null)delete working.max_level;else working.max_level=high;
  }
  function refreshArea(){
   const name=areaName(Number(file.input.value));
   const source=referenceFor({file:Number(file.input.value),pair:Number(pair.input.value),time:time.input.value});
   area.textContent=(name?"Location: "+name+". ":"Location not verified. ")+
    (source?"Original levels "+source.min_level+"–"+source.max_level+".":"Import your local reference.csv to verify the pair exists.");
  }
  for(const input of [file.input,pair.input,time.input])input.onchange=refreshArea;
  refreshArea();
  const actions=node("div","searing-actions");
  actions.append(btn(selected===null?"Add table override":"Save table override",()=>{
   try{
    readHeader();
    const candidate=updateTable(data,selected,clone(working));
    const warning=reference?referenceErrors(working,referenceFor(working)):[];
    if(warning.length)throw Error(warning[0]);
    write(candidate,"Saved table "+tableKey(working));
    selected=selected===null?candidate.edits.length-1:selected;
    selectTable(selected);
   }catch(error){setNote("Cannot save: "+error.message,true)}
  },"btn primary"));
  if(selected!==null)actions.append(btn("Delete table override",()=>{
   if(!confirm("Remove this encounter override from changes.json? Your extracted game archive is not affected."))return;
   const next=removeTable(data,selected);
   write(next,"Deleted table override");
   selected=next.edits.length?0:null;selectTable(selected);
  },"btn"));
  title.append(actions);
  details.append(title);

  const slots=node("section","panel searing-panel");
  slots.append(node("h3","","Species & form overrides"),node("p","muted",
   "Sets 0–7 have 10 slots (0–9). Set 8 is SOS/weather and has 6 slots (0–5). Each entry changes only the specified set/slot; other encounters stay untouched."));
  const slotList=node("div","searing-entry-list");
  const slotItems=working.slots||[];
  if(!slotItems.length)slotList.append(node("p","muted","No species/form overrides in this table."));
  slotItems.forEach((item,index)=>{
   const itemName=names.byId.get(item.species)||item.species_name||"Species unchanged";
   const orig=referenceFor(working)?.slots.get(item.set+":"+item.slot);
   const line=node("div","searing-entry-row");
   line.append(node("span","", "Set "+item.set+" · Slot "+item.slot+" → "+(item.species??"")+
    (item.species!==undefined?" · "+itemName:"")+(item.form!==undefined?" · Form "+item.form:"")+
    (orig?" (was "+orig.species+", form "+orig.form+")":"")));
   line.append(btn("Edit",()=>{try{readHeader()}catch(error){setNote(error.message,true);return}slotSelection=index;renderDetail()},"btn"));
   line.append(btn("Remove",()=>{try{readHeader();working=removeSlot(working,index);slotSelection=null;renderDetail()}catch(error){setNote(error.message,true)}},"btn"));
   slotList.append(line);
  });
  slots.append(slotList);
  const slotForm=node("div","searing-grid"),picked=slotSelection===null?null:slotItems[slotSelection];
  const set=field("Encounter set",picked?.set??0,"number",0,8);
  const slot=field("Slot",picked?.slot??0,"number",0,9);
  const speciesVal=picked?.species===undefined?(picked?.species_name||""):
   String(picked.species)+(names.byId.has(picked.species)?" — "+names.byId.get(picked.species):"");
  const species=field("Pokémon name or ID",speciesVal);
  const form=field("Form index",picked?.form??0,"number",0,31);
  // Shared datalist is native and searchable; custom Gen 7 expansion IDs are
  // accepted numerically even when they aren't in the standard names file.
  const datalist=node("datalist");datalist.id="searing-species-choices";
  for(const [number,name] of names.byId){
   const opt=node("option");opt.value=number+" — "+name;datalist.append(opt);
  }
  species.input.setAttribute("list",datalist.id);
  slotForm.append(set.shell,slot.shell,species.shell,form.shell,datalist);
  slots.append(slotForm);
  const slotActions=node("div","searing-actions");
  slotActions.append(btn(slotSelection===null?"+ Add species override":"Update species override",()=>{
   try{
    readHeader();
    const setNum=int(set.input.value,0,8,"Set"),slotNum=int(slot.input.value,0,setNum===8?5:9,"Slot");
    const speciesNum=parseSpeciesInput(species.input.value,names);
    const formNum=int(form.input.value,0,31,"Form");
    working=updateSlot(working,slotSelection,{set:setNum,slot:slotNum,species:speciesNum,form:formNum});
    slotSelection=null;
    const errors=validateChanges({format_version:1,edits:[working]},null,names);
    if(errors.length)throw Error(errors[0]);
    renderDetail();setNote("Slot changed in the editor. Click Save table override to stage it in GitHub.");
   }catch(error){setNote("Cannot update slot: "+error.message,true)}
  },"btn primary"));
  if(slotSelection!==null)slotActions.append(btn("Cancel slot edit",()=>{try{readHeader()}catch{}slotSelection=null;renderDetail()}));
  slots.append(slotActions);details.append(slots);

  const rates=node("section","panel searing-panel");
  rates.append(node("h3","","Encounter rate overrides"),node("p","muted",
   "Rates are shared across all sets. Only changed slots are saved; the complete 10-slot total must equal 0% or 100%. Load reference.csv to verify the effective total."));
  const ref=referenceFor(working);
  const rateSummary=node("p","muted");
  const effective=ref?effectiveRates(working,ref):null;
  rateSummary.textContent=effective?"Effective rates: "+effective.join(" + ")+" = "+effective.reduce((a,b)=>a+b,0)+"%":
   "Original rates are unavailable. Verify percentages with local APPLY_ENCOUNTERS.bat --dry-run.";
  rates.append(rateSummary);
  const ratesList=node("div","searing-entry-list");
  for(const [index,entry] of (working.rates||[]).entries()){
   const line=node("div","searing-entry-row");
   line.append(node("span","", "Rate slot "+entry.slot+" → "+entry.value+"%"));
   line.append(btn("Edit",()=>{try{readHeader()}catch(error){setNote(error.message,true);return}rateSelection=index;renderDetail()}));
   line.append(btn("Remove",()=>{try{readHeader();working=removeRate(working,index);rateSelection=null;renderDetail()}catch(error){setNote(error.message,true)}}));
   ratesList.append(line);
  }
  rates.append(ratesList);
  const r=rateSelection===null?null:(working.rates||[])[rateSelection];
  const rateFields=node("div","searing-grid"),rateSlot=field("Rate slot",r?.slot??0,"number",0,9),rateValue=field("Rate (%)",r?.value??0,"number",0,100);
  rateFields.append(rateSlot.shell,rateValue.shell);rates.append(rateFields);
  rates.append(btn(rateSelection===null?"+ Add rate override":"Update rate override",()=>{
   try{
    readHeader();
    working=updateRate(working,rateSelection,{
     slot:int(rateSlot.input.value,0,9,"Rate slot"),value:int(rateValue.input.value,0,100,"Rate")
    });
    rateSelection=null;
    const errors=validateChanges({format_version:1,edits:[working]},null,names);
    if(errors.length)throw Error(errors[0]);
    renderDetail();setNote("Rate updated. Click Save table override to stage it.");
   }catch(error){setNote("Cannot update rate: "+error.message,true)}
  },"btn primary"));
  details.append(rates);
  details.append(node("p","muted",
   "Commit the JSON change, then run APPLY_ENCOUNTERS.bat followed by SAVE_CHANGES.bat on the PC holding your matching USUM game extraction. This page never downloads or rebuilds Nintendo archives."));
 }
 renderList();renderDetail();
}
