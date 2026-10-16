import {speciesEntries,readFields} from "./pokemon-source.js";

// Source-preserving Pokédex text editing. Never reformat whole species files.
const nameRx=/^g[A-Za-z0-9_]+$/;
function closingParen(text,start){
 let depth=0,quote="",line=false,block=false;
 for(let i=start;i<text.length;i++){
  const ch=text[i],next=text[i+1];
  if(line){if(ch==="\n")line=false;continue}
  if(block){if(ch==="*"&&next==="/"){block=false;i++}continue}
  if(quote){if(ch==="\\"){i++;continue}if(ch===quote)quote="";continue}
  if(ch==="/"&&next==="/"){line=true;i++;continue}
  if(ch==="/"&&next==="*"){block=true;i++;continue}
  if(ch==='"'||ch==="'"){quote=ch;continue}
  if(ch==="(")depth++;
  if(ch===")"&&--depth===0)return i;
 }
 return -1;
}

export function decodeDexExpression(expression,macro="COMPOUND_STRING"){
 const source=String(expression||"").trim();
 if(!source.startsWith(macro))return null;
 const rest=source.slice(macro.length);
 const left=/^\s*\(/.exec(rest);
 if(!left)return null;
 const open=source.length-rest.length+left[0].length-1;
 const end=closingParen(source,open);
 if(end<0||source.slice(end+1).trim())return null;
 const inner=source.slice(open+1,end);
 let cursor=0,text="",found=false;
 while(cursor<inner.length){
  const space=/^\s*/.exec(inner.slice(cursor))[0];cursor+=space.length;
  if(cursor===inner.length)break;
  if(inner[cursor]!=='"')return null;
  cursor++;found=true;let closed=false;
  while(cursor<inner.length){
   const ch=inner[cursor++];
   if(ch==='"'){closed=true;break}
   if(ch!=="\\"){text+=ch;continue}
   if(cursor>=inner.length)return null;
   const escaped=inner[cursor++];
   const dict={n:"\n",r:"\r",t:"\t",'"':'"',"\\" :"\\"};
   if(!(escaped in dict))return null;
   text+=dict[escaped];
  }
  if(!closed)return null;
 }
 return found?text:null;
}

export function encodeDexExpression(input,macro="COMPOUND_STRING"){
 if(!["COMPOUND_STRING","_"].includes(macro))throw Error("Unsupported text macro");
 const value=String(input).replace(/\r\n?/g,"\n");
 if(!value.trim())throw Error("Enter a Pokédex description before saving.");
 if(value.length>1600)throw Error("Pokédex descriptions cannot exceed 1,600 characters.");
 if(/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(value))throw Error("Remove unsupported control characters.");
 const lines=value.split("\n");
 const strings=lines.map((s,i)=>{
  const escaped=s.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\t/g,"\\t");
  return '            "'+escaped+(i<lines.length-1?"\\n":"")+'"';
 });
 return macro+"(\n"+strings.join("\n")+")";
}

export function editDexDescription(source,id,value){
 const entry=speciesEntries(source).find(x=>x.id===id);
 if(!entry)throw Error("Species "+id+" not found.");
 const field=readFields(entry.body).get("description");
 if(!field)throw Error("No editable description field for "+id+".");
 const start=entry.open+1+field.start,end=entry.open+1+field.end;
 const replacement=encodeDexExpression(value);
 return source.slice(0,start)+replacement+source.slice(end);
}

export function sharedDexEntry(source,symbol){
 if(!nameRx.test(String(symbol||"")))return null;
 const expression=new RegExp("\\bconst\\s+u8\\s+"+symbol+"\\s*\\[\\s*\\]\\s*=\\s*_\\s*\\(","g");
 const match=expression.exec(source);
 if(!match)return null;
 const open=match.index+match[0].lastIndexOf("(");
 const end=closingParen(source,open);
 if(end<0)return null;
 const begin=match.index+match[0].lastIndexOf("_");
 // Include the _ identifier in the replacement, but preserve the declaration.
 const value=source.slice(begin,end+1);
 return {symbol,start:begin,end:end+1,expression:value,text:decodeDexExpression(value,"_")};
}
export function editSharedDexText(source,symbol,text){
 const record=sharedDexEntry(source,symbol);
 if(!record)throw Error("Shared entry "+symbol+" not found.");
 if(record.text===null)throw Error("This shared entry uses advanced formatting. Open Code mode.");
 const replacement=encodeDexExpression(text,"_");
 return source.slice(0,record.start)+replacement+source.slice(record.end);
}
export function parseSimpleString(expression){
 const value=decodeDexExpression(expression,"_");
 return value===null?null:value;
}
export function encodeSimpleString(value){
 const text=String(value||"").trim();
 if(!text)throw Error("Enter a nonempty name.");
 if(text.length>40)throw Error("Name is too long (40 characters maximum).");
 if(/[\r\n\x00-\x1F]/.test(text))throw Error("Names must fit on one line.");
 return '_("'+text.replace(/\\/g,"\\\\").replace(/"/g,'\\"')+'")';
}
export function dexEntryKind(expression){
 const value=String(expression||"").trim();
 if(decodeDexExpression(value)!==null)return {kind:"inline",text:decodeDexExpression(value),symbol:null};
 if(nameRx.test(value))return {kind:"shared",text:null,symbol:value};
 return {kind:"advanced",text:null,symbol:null};
}
export function entryWarnings(text){
 const value=String(text||"");
 const lines=value.split("\n");
 const warnings=[];
 if(lines.length>4)warnings.push(lines.length+" lines: standard GBA Pokédex entries usually use 4 lines.");
 const wide=lines.map((line,i)=>({n:i+1,len:[...line].length})).filter(x=>x.len>40);
 if(wide.length)warnings.push("Long lines ("+wide.map(x=>"line "+x.n+": "+x.len).join(", ")+"). Check the in-game text box.");
 return warnings;
}
