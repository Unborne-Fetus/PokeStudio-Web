// Expansion trainers.party helper. Edits only one named trainer block.
export function catalog(text) {
 const hits=[...text.matchAll(/^===\s*(TRAINER_[A-Z0-9_]+)\s*===\s*$/gm)];
 return hits.map((m,i)=>{const start=m.index,end=hits[i+1]?.index??text.length,raw=text.slice(start,end);const chunks=raw.trimEnd().split(/\r?\n[ \t]*\r?\n/);return {id:m[1],start,end,raw,meta:fields(chunks[0]),pokemon:chunks.slice(1).filter(c=>c.trim()&&!/^\s*\/\*/.test(c)).map(mon)}});
}
export function fields(text){const obj={};for(const line of text.split(/\r?\n/)){const m=line.match(/^([A-Za-z][\w -]*):\s*(.*)$/);if(m)obj[m[1]]=m[2].trim()}return obj}
export function mon(block){
 const lines=block.trim().split(/\r?\n/),lead=lines[0]||"",held=lead.match(/\s+@\s+(.+)$/),base=held?lead.slice(0,held.index):lead;
 const gender=base.match(/\s+\(([MF])\)$/),bare=gender?base.slice(0,gender.index):base,paren=bare.match(/\((SPECIES_[A-Z0-9_]+)\)/);
 return {raw:block,species:(paren?paren[1]:bare).trim(),gender:gender?.[1]||"",held:held?.[1]?.trim()||"",fields:fields(lines.slice(1).join("\n")),moves:lines.filter(l=>/^\s*-\s+/.test(l)).map(l=>l.replace(/^\s*-\s+/,"").trim())}
}
const eol=raw=>raw.includes("\r\n")?"\r\n":"\n";
const chunks=raw=>raw.trimEnd().split(/\r?\n[ \t]*\r?\n/);
const join=(parts,raw)=>parts.join(eol(raw)+eol(raw))+eol(raw)+eol(raw);
export function changeField(raw,key,value){
 const lines=raw.split(/\r?\n/),idx=lines.findIndex((line,i)=>i>0&&line.startsWith(key+":"));
 if(value==null||String(value).trim()===""){if(idx>=0)lines.splice(idx,1)}
 else if(idx>=0)lines[idx]=key+": "+String(value).trim();
 else {const move=lines.findIndex(l=>/^\s*-\s+/.test(l));lines.splice(move<0?lines.length:move,0,key+": "+String(value).trim())}
 return lines.join(eol(raw))
}
export function changeMeta(raw,key,value){const parts=chunks(raw);const lines=parts[0].split(/\r?\n/),idx=lines.findIndex(l=>l.startsWith(key+":"));
 if(value==null||String(value).trim()===""){if(idx>=0)lines.splice(idx,1)}
 else if(idx>=0)lines[idx]=key+": "+String(value).trim();else lines.push(key+": "+String(value).trim());
 parts[0]=lines.join(eol(raw));return join(parts,raw)
}
export function editMon(raw,index,fn){const parts=chunks(raw);if(!parts[index+1])throw Error("Pokémon slot missing");parts[index+1]=fn(parts[index+1]);return join(parts,raw)}
export function addMon(raw){const parts=chunks(raw);if(parts.length>=7)throw Error("A trainer can only have six Pokémon");parts.push("Pikachu"+eol(raw)+"Level: 30");return join(parts,raw)}
export function removeMon(raw,index){const parts=chunks(raw);parts.splice(index+1,1);return join(parts,raw)}
export function shiftMon(raw,index,step){const parts=chunks(raw),target=index+step;if(target<0||target>=parts.length-1)return raw;[parts[index+1],parts[target+1]]=[parts[target+1],parts[index+1]];return join(parts,raw)}
export function renameMon(raw,name,held="",gender=""){const lines=raw.split(/\r?\n/);lines[0]=name.trim()+(gender?" ("+gender+")":"")+(held.trim()?" @ "+held.trim():"");return lines.join(eol(raw))}
export function setMoves(raw,moves){const lines=raw.split(/\r?\n/).filter(l=>!/^\s*-\s+/.test(l));for(const move of moves.slice(0,4))if(move.trim())lines.push("- "+move.trim());return lines.join(eol(raw))}
export function replaceTrainer(source,id,newBlock){
 const found=catalog(source).find(t=>t.id===id);if(!found)throw Error("Unknown trainer "+id);
 if(!newBlock.startsWith("=== "+id+" ==="))throw Error("Trainer ID cannot be changed through this form");
 return source.slice(0,found.start)+newBlock+source.slice(found.end)
}
export function monAsset(species){
 let s=String(species).replace(/^SPECIES_/,"").toLowerCase().replace(/♀/g,"_f").replace(/♂/g,"_m").replace(/[^a-z0-9 _-]/g,"").replace(/[ -]+/g,"_");
 const f=s.match(/^(.+?)_(alola|galar|hisui|paldea|mega|gmax|attack|defense|speed|origin|therian)$/);
 return f?f[1]+"/"+f[2]:s
}
export function picAsset(pic){return String(pic).trim().toLowerCase().replace(/[^a-z0-9 _-]/g,"").replace(/[ -]+/g,"_")}
