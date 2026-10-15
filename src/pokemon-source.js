// Read and update pokeemerald-expansion C initializers without rewriting neighbors.
const speciesStart=/^[ \t]*\[(SPECIES_[A-Z0-9_]+)\]\s*=\s*\{/gm;
function closing(text,start,open="{",close="}"){
 let depth=0,quote="",line=false,block=false;
 for(let i=start;i<text.length;i++){
  const c=text[i],n=text[i+1];
  if(line){if(c==="\n")line=false;continue}
  if(block){if(c==="*"&&n==="/"){block=false;i++}continue}
  if(quote){if(c==="\\"){i++;continue}if(c===quote)quote="";continue}
  if(c==="/"&&n==="/"){line=true;i++;continue}
  if(c==="/"&&n==="*"){block=true;i++;continue}
  if(c==="\""||c==="'"){quote=c;continue}
  if(c===open)depth++;
  if(c===close&&--depth===0)return i;
 }
 return -1;
}
export function speciesEntries(source,path=""){
 const found=[];
 for(const m of source.matchAll(speciesStart)){
  const open=source.indexOf("{",m.index+m[0].indexOf("="));
  const end=closing(source,open);
  if(end<0)continue;
  found.push({id:m[1],path,start:m.index,open,end,body:source.slice(open+1,end)});
 }
 return found;
}
export function readFields(body){
 const out=new Map(),rx=/^[ \t]*\.([A-Za-z_]\w*)\s*=\s*/gm;let m;
 while((m=rx.exec(body))){
  const start=rx.lastIndex;let i=start,par=0,curly=0,square=0,quote="",line=false,block=false;
  for(;i<body.length;i++){
   const c=body[i],n=body[i+1];
   if(line){if(c==="\n")line=false;continue}
   if(block){if(c==="*"&&n==="/"){block=false;i++}continue}
   if(quote){if(c==="\\"){i++;continue}if(c===quote)quote="";continue}
   if(c==="/"&&n==="/"){line=true;i++;continue}
   if(c==="/"&&n==="*"){block=true;i++;continue}
   if(c==="\""||c==="'"){quote=c;continue}
   if(c==="(")par++;else if(c===")")par--;
   else if(c==="{")curly++;else if(c==="}")curly--;
   else if(c==="[")square++;else if(c==="]")square--;
   if(c===","&&par===0&&curly===0&&square===0)break;
  }
  if(i===body.length)continue;
  const raw=body.slice(start,i),value=raw.trim(),offset=raw.indexOf(value);
  out.set(m[1],{value,start:start+offset,end:start+offset+value.length});
  rx.lastIndex=i+1;
 }
 return out;
}
export function editSpeciesField(source,id,key,replacement){
 const entry=speciesEntries(source).find(x=>x.id===id);
 if(!entry)throw Error("Species "+id+" was not found in its source file");
 const hit=readFields(entry.body).get(key);
 if(!hit)throw Error("Field "+key+" is not defined for "+id);
 if(!replacement||/[\r\n;]/.test(replacement))throw Error("Invalid field value");
 const start=entry.open+1+hit.start,end=entry.open+1+hit.end;
 return source.slice(0,start)+replacement+source.slice(end);
}
export function arrayEntry(source,name){
 if(!/^[A-Za-z_]\w*$/.test(name))return null;
 const rx=new RegExp("\\b"+name+"\\s*\\[\\s*\\]\\s*=\\s*\\{","g"),m=rx.exec(source);
 if(!m)return null;
 const open=source.indexOf("{",m.index),end=closing(source,open);
 return end<0?null:{name,open,end,body:source.slice(open+1,end)};
}
export function replaceArrayBody(source,name,body){
 const match=arrayEntry(source,name);if(!match)throw Error("Learnset "+name+" wasn't found");
 return source.slice(0,match.open+1)+body+source.slice(match.end);
}
export function levelMoves(body){
 return [...body.matchAll(/LEVEL_UP_MOVE\s*\(\s*(\d+)\s*,\s*(MOVE_[A-Z0-9_]+)\s*\)\s*,?/g)].map(m=>({level:Number(m[1]),move:m[2]}));
}
export function eggMoves(body){
 return [...body.matchAll(/\b(MOVE_[A-Z0-9_]+)\s*,/g)].map(x=>x[1]).filter(x=>x!=="MOVE_UNAVAILABLE");
}
export function editLevelMoves(source,name,rows){
 if(!rows.every(x=>Number.isInteger(x.level)&&x.level>=1&&x.level<=100&&/^MOVE_[A-Z0-9_]+$/.test(x.move)))throw Error("Levels must be 1–100 and moves must be valid");
 const found=arrayEntry(source,name);
 if(!found||!/\bLEVEL_UP_END\b/.test(found.body))throw Error("Can't safely edit a nonstandard level-up list");
 const stripped=found.body.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,"").trim();
 if(!/^(?:LEVEL_UP_MOVE\s*\(\s*\d+\s*,\s*MOVE_[A-Z0-9_]+\s*\)\s*,?\s*)*LEVEL_UP_END\s*,?$/.test(stripped))
  throw Error("This learnset uses advanced C syntax. Edit it in Code mode.");
 const leading=found.body.match(/^\s*/)?.[0]||"\n",ending=found.body.match(/\s*$/)?.[0]||"\n";
 return replaceArrayBody(source,name,leading+rows.map(x=>"    LEVEL_UP_MOVE("+x.level+", "+x.move+"),").join("\n")+(rows.length?"\n":"")+"    LEVEL_UP_END"+ending);
}
export function editEggMoves(source,name,moves){
 if(!moves.every(x=>/^MOVE_[A-Z0-9_]+$/.test(x)))throw Error("Invalid egg move");
 const found=arrayEntry(source,name);
 if(!found||!/\bMOVE_UNAVAILABLE\b/.test(found.body))throw Error("Can't safely edit a nonstandard egg-move list");
 const stripped=found.body.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,"").trim();
 if(!/^(?:MOVE_[A-Z0-9_]+\s*,\s*)*MOVE_UNAVAILABLE\s*,?$/.test(stripped))
  throw Error("This egg-move list uses advanced C syntax. Edit it in Code mode.");
 const leading=found.body.match(/^\s*/)?.[0]||"\n",ending=found.body.match(/\s*$/)?.[0]||"\n";
 return replaceArrayBody(source,name,leading+moves.map(x=>"    "+x+",").join("\n")+(moves.length?"\n":"")+"    MOVE_UNAVAILABLE,"+ending);
}
