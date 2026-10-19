// Searing Sun's Gen 7 editor writes ONLY sparse data/encounters/changes.json.
// The actual pk3DS GARC and per-area encounter rates remain local on the PC.
// Do not guess omitted slots, original rates, or available table pair IDs.
export const CHANGES_PATH="data/encounters/changes.json";
export const LOCATIONS_PATH="data/encounters/locations.json";
export const SPECIES_PATH="data/encounters/species_names_gen7.json";

const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
const isObject=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const id=e=>String(e.file)+":"+String(e.pair)+":"+String(e.time);
export const tableKey=id;

export function readChanges(raw){
 const value=JSON.parse(raw);
 if(!isObject(value)||value.format_version!==1||!Array.isArray(value.edits))
  throw Error('Expected {"format_version":1,"edits":[]} in '+CHANGES_PATH);
 return value;
}
export function parseSpeciesNames(raw){
 const values=JSON.parse(raw),byId=new Map(),byName=new Map();
 if(!isObject(values))throw Error("Species names must be a JSON object");
 for(const [rawId,name] of Object.entries(values)){
  const number=Number(rawId);
  if(!integer(number,0,2047)||typeof name!=="string")continue;
  byId.set(number,name);
  const key=name.trim().toLowerCase();
  if(!byName.has(key))byName.set(key,[]);
  byName.get(key).push(number);
 }
 return {byId,byName};
}
export function parseLocationNames(raw){
 const value=JSON.parse(raw);
 if(!isObject(value)||value.format_version!==1||!isObject(value.files))throw Error("Invalid Searing Sun location data");
 const names=new Map();
 for(const [id,meta] of Object.entries(value.files)){
  const num=Number(id);
  if(integer(num,0,65535)&&isObject(meta))names.set(num,typeof meta.name==="string"?meta.name:"");
 }
 return names;
}
export function parseSpeciesInput(value,names){
 const raw=String(value).trim();
 const candidate=/^(\d{1,4})(?:\s*[-—:]\s*.*)?$/.exec(raw);
 if(candidate){
  const n=Number(candidate[1]);
  if(integer(n,0,2047))return n;
 }
 const values=names?.byName?.get(raw.toLowerCase())||[];
 if(values.length===1)return values[0];
 if(values.length>1)throw Error("This Pokémon name is ambiguous; enter its numeric species ID.");
 throw Error("Enter a valid Gen 7 species number (0–2047) or a known Pokémon name.");
}
export function validateChanges(data,locations=null,names=null){
 const errors=[];
 if(!isObject(data)||data.format_version!==1||!Array.isArray(data.edits))return ["Missing format_version: 1 or edits array."];
 const seen=new Set();
 data.edits.forEach((e,i)=>{
  const tag="Table "+(i+1);
  if(!isObject(e)){errors.push(tag+" must be an object.");return}
  if(!integer(e.file,0,65535))errors.push(tag+": file must be a non-negative integer.");
  if(!integer(e.pair,0,65535))errors.push(tag+": pair must be a non-negative integer.");
  if(!["day","night"].includes(e.time))errors.push(tag+": time must be day or night.");
  const key=id(e);
  if(seen.has(key))errors.push(tag+": duplicate file/pair/time table.");
  seen.add(key);
  for(const f of ["min_level","max_level"])if(f in e&&!integer(e[f],1,100))errors.push(tag+": "+f+" must be 1–100.");
  if(integer(e.min_level,1,100)&&integer(e.max_level,1,100)&&e.min_level>e.max_level)
   errors.push(tag+": minimum level exceeds maximum.");
  if("location" in e){
   if(typeof e.location!=="string"||!e.location.trim())errors.push(tag+": location must be a nonempty string.");
   else if(locations?.has(e.file)&&locations.get(e.file)){
    // Location is a readable assertion; never use an invented label to override the file number.
    // The Python resolver accepts aliases; trust the numeric ID if the exact label was imported.
   }
  }
  if("rates" in e&&!Array.isArray(e.rates))errors.push(tag+": rates must be an array.");
  if("slots" in e&&!Array.isArray(e.slots))errors.push(tag+": slots must be an array.");
  const rates=new Set();
  if(Array.isArray(e.rates)){
   for(const rate of e.rates){
    if(!isObject(rate)||!integer(rate.slot,0,9)||!integer(rate.value,0,100)){errors.push(tag+": rate slot must be 0–9 and percentage 0–100.");continue}
    if(rates.has(rate.slot))errors.push(tag+": duplicate rate slot "+rate.slot+".");
    rates.add(rate.slot);
   }
   // The full rate sum depends on uncommitted, locally stored game data.
   // Only validate when the override explicitly provides all ten values.
   if(rates.size===10){
    const total=e.rates.reduce((sum,r)=>sum+(r.value||0),0);
    if(total!==0&&total!==100)errors.push(tag+": ten rate overrides must total 0% or 100% (got "+total+"%).");
   }
  }
  const slots=new Set();
  if(Array.isArray(e.slots)){
   for(const slot of e.slots){
    if(!isObject(slot)||!integer(slot.set,0,8)||!integer(slot.slot,0,slot.set===8?5:9)){
     errors.push(tag+": sets 0–7 have 10 slots; set 8 (SOS) has 6.");continue;
    }
    const key=slot.set+":"+slot.slot;
    if(slots.has(key))errors.push(tag+": duplicate set/slot "+key+".");
    slots.add(key);
    if(!("species" in slot)&&!("species_name" in slot)&&!("form" in slot))
     errors.push(tag+": each slot must override species or form.");
    if("species" in slot&&!integer(slot.species,0,2047))errors.push(tag+": species must be 0–2047.");
    if("form" in slot&&!integer(slot.form,0,31))errors.push(tag+": form must be 0–31.");
    if("species_name" in slot){
     const named=names?.byName?.get(String(slot.species_name).trim().toLowerCase())||[];
     if(typeof slot.species_name!=="string"||!slot.species_name.trim())errors.push(tag+": species_name must be nonempty.");
     else if(names&&named.length!==1)errors.push(tag+": unknown or ambiguous species_name "+slot.species_name+".");
     else if(named.length===1&&"species" in slot&&named[0]!==slot.species)
      errors.push(tag+": species ID and species_name disagree.");
    }
   }
  }
 });
 return errors;
}
export function updateTable(data,index,edit){
 const next={...data,edits:data.edits.slice()};
 if(index===null||index===undefined)next.edits.push(edit);
 else{
  if(!integer(index,0,next.edits.length-1))throw Error("Invalid encounter table index.");
  next.edits[index]=edit;
 }
 const errors=validateChanges(next);
 if(errors.length)throw Error(errors[0]);
 return next;
}
export function removeTable(data,index){
 if(!integer(index,0,data.edits.length-1))throw Error("Invalid encounter table index.");
 return {...data,edits:data.edits.filter((_,i)=>i!==index)};
}
export function updateSlot(table,index,entry){
 const next={...table,slots:[...(table.slots||[])]};
 if(index===null||index===undefined)next.slots.push(entry);
 else if(integer(index,0,next.slots.length-1))next.slots[index]=entry;
 else throw Error("Invalid slot index.");
 return next;
}
export function removeSlot(table,index){
 if(!integer(index,0,(table.slots||[]).length-1))throw Error("Invalid slot index.");
 return {...table,slots:table.slots.filter((_,i)=>i!==index)};
}
export function updateRate(table,index,entry){
 const next={...table,rates:[...(table.rates||[])]};
 if(index===null||index===undefined)next.rates.push(entry);
 else if(integer(index,0,next.rates.length-1))next.rates[index]=entry;
 else throw Error("Invalid rate index.");
 return next;
}
export function removeRate(table,index){
 if(!integer(index,0,(table.rates||[]).length-1))throw Error("Invalid rate index.");
 return {...table,rates:table.rates.filter((_,i)=>i!==index)};
}
export function serializeChanges(data){
 const errors=validateChanges(data);
 if(errors.length)throw Error(errors[0]);
 return JSON.stringify(data,null,2)+"\n";
}
