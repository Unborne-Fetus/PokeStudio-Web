// Read-only parser for the local CSV exported by Searing Sun's tools/encounters.py.
// Never store the CSV or source encounter data in GitHub or PokéStudio drafts.
const expected=["file","location","zone_ids","pair","time","set","slot","species","species_name","form","rate","min_level","max_level"];
function csvCells(line){
 const cells=[];let cell="",quoted=false;
 for(let i=0;i<line.length;i++){
  const c=line[i];
  if(c==='"'){
   if(quoted&&line[i+1]==='"'){cell+='"';i++}
   else quoted=!quoted;
  }else if(c===","&&!quoted){cells.push(cell);cell=""}
  else cell+=c;
 }
 cells.push(cell);
 return cells;
}
export function readReferenceCsv(content){
 const source=String(content||"");
 if(source.length>28_000_000)throw Error("Reference CSV is too large to preview safely (28 MB limit).");
 const lines=source.replace(/^\uFEFF/,"").split(/\r?\n/);
 const columns=csvCells(lines.shift()||"").map(s=>s.trim());
 const positions=new Map(columns.map((name,index)=>[name,index]));
 for(const field of expected)if(!positions.has(field))throw Error("Reference CSV is missing "+field+". Export it with the current Searing Sun tools.");
 const tables=new Map();
 for(const line of lines){
  if(!line.trim())continue;
  const values=csvCells(line),field=name=>values[positions.get(name)]??"";
  const file=Number(field("file")),pair=Number(field("pair")),time=field("time");
  const set=Number(field("set")),slot=Number(field("slot"));
  if(!Number.isInteger(file)||!Number.isInteger(pair)||!["day","night"].includes(time)||
     !Number.isInteger(set)||set<0||set>8||!Number.isInteger(slot)||slot<0||slot>(set===8?5:9))
   continue;
  const key=file+":"+pair+":"+time;
  let table=tables.get(key);
  if(!table){
   table={file,pair,time,location:field("location"),rates:new Map(),slots:new Map(),
    min_level:Number(field("min_level")),max_level:Number(field("max_level"))};
   tables.set(key,table);
  }
  if(set===0&&field("rate")!==""){
   const rate=Number(field("rate"));
   if(Number.isInteger(rate)&&rate>=0&&rate<=100)table.rates.set(slot,rate);
  }
  const species=Number(field("species")),form=Number(field("form"));
  if(Number.isInteger(species)&&Number.isInteger(form))
   table.slots.set(set+":"+slot,{species,form});
 }
 if(!tables.size)throw Error("No valid encounter tables were found in the selected CSV.");
 return tables;
}
export function effectiveRates(edit,reference){
 if(!reference||reference.rates.size!==10)return null;
 const rates=Array.from({length:10},(_,i)=>reference.rates.get(i));
 if(rates.some(x=>!Number.isInteger(x)))return null;
 for(const slot of edit.rates||[])rates[slot.slot]=slot.value;
 return rates;
}
export function referenceErrors(edit,table){
 if(!table)return ["This area/pair/time is not in the imported reference CSV. Verify the table IDs locally."];
 const errors=[];
 if(table.rates.size===10){
  const rates=effectiveRates(edit,table);
  if(rates){
   const total=rates.reduce((a,b)=>a+b,0);
   if(total!==0&&total!==100)errors.push("Effective encounter rates total "+total+"%; the game requires 0% or 100%.");
  }
 }
 const low="min_level" in edit?edit.min_level:table.min_level;
 const high="max_level" in edit?edit.max_level:table.max_level;
 if(Number.isInteger(low)&&Number.isInteger(high)&&low>high)errors.push("Effective minimum level exceeds maximum.");
 return errors;
}
