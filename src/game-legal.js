// Canonical game-defined constants; aliases and sentinels are excluded.
const prettify=id=>id.toLowerCase().split("_").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
export function definitions(header,prefix){
 const rx=new RegExp("^\\s*"+prefix+"_([A-Z0-9_]+)\\s*=\\s*([^,\\n]+)","gm");
 const choices=[],seenNames=new Set(),seenIds=new Set();
 for(const match of String(header||"").matchAll(rx)){
  const name=match[1],expression=match[2].split("//")[0].trim();
  if(name==="NONE"||/COUNT|MAX|NUM|END|UNUSED|PLACEHOLDER|INVALID|DUMMY/.test(name))continue;
  // Exact aliases to another move/ability duplicate an existing entry.
  if(new RegExp("^"+prefix+"_[A-Z0-9_]+$").test(expression))continue;
  const id=/^\d+$/.test(expression)?Number(expression):null;
  if(id!==null&&(id<1||seenIds.has(id)))continue;
  const value=prefix+"_"+name;if(seenNames.has(value))continue;
  seenNames.add(value);if(id!==null)seenIds.add(id);
  choices.push({value,label:prettify(name),id});
 }
 return choices
}
export function normalizeChoice(value,choices){
 const normalized=String(value||"").trim().toLowerCase().replace(/[^a-z0-9]/g,"");
 return choices.find(c=>c.value.toLowerCase().replace(/[^a-z0-9]/g,"")===normalized||c.label.toLowerCase().replace(/[^a-z0-9]/g,"")===normalized)||null
}
export function legalExisting(value,choices){return normalizeChoice(value,choices)?.value||null}
