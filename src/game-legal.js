// Move and ability names are sourced directly from the connected game's constants.
// Only canonical definitions (not aliases or NONE/count sentinels) are suggested.
const prettify=id=>id.toLowerCase().split("_").map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(" ");
export function definitions(header,prefix){
 const rx=new RegExp("^\\s*"+prefix+"_([A-Z0-9_]+)\\s*=\\s*(\\d+)\\s*,?","gm"),out=[],seen=new Set();
 for(const m of String(header||"").matchAll(rx)){
  if(m[1]==="NONE"||/COUNT|MAX|NUM|END|UNUSED|PLACEHOLDER|INVALID|DUMMY/.test(m[1]))continue;
  const id=Number(m[2]);if(!Number.isInteger(id)||id<1||seen.has(id))continue;
  seen.add(id);out.push({value:prefix+"_"+m[1],label:prettify(m[1]),id})
 }
 return out
}
export function normalizeChoice(value,choices){
 const normalized=String(value||"").trim().toLowerCase().replace(/[^a-z0-9]/g,"");
 return choices.find(c=>c.value.toLowerCase().replace(/[^a-z0-9]/g,"")===normalized||c.label.toLowerCase().replace(/[^a-z0-9]/g,"")===normalized)||null
}
export function legalExisting(value,choices){
 const found=normalizeChoice(value,choices);
 return found?found.value:null
}
