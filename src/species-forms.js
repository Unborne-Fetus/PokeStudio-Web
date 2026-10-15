// Enumerate only forms actually defined by the connected pokeemerald-expansion fork.
export function speciesCatalog(header,dexHeader=""){
 const raw=[...String(header).matchAll(/\bSPECIES_([A-Z0-9_]+)\s*=\s*(\d+)\s*,?/g)].map(m=>({name:m[1],id:Number(m[2])})).filter(x=>x.id>0);
 const defined=new Map(raw.map(x=>[x.name,x]));
 // National Dex entries are the base species identifiers; forms are their suffixes.
 const dex=[...String(dexHeader).matchAll(/\bNATIONAL_DEX_([A-Z0-9_]+)\b\s*(?:=\s*\d+)?\s*,/g)].map(m=>m[1]);
 const base=dex.filter(name=>defined.has(name)),baseSort=[...base].sort((a,b)=>b.length-a.length);
 const groups=new Map(base.map(name=>[name,[{label:"Default",value:name}]]));
 for(const form of raw){
  if(groups.has(form.name))continue;
  const root=baseSort.find(name=>form.name.startsWith(name+"_"));
  if(!root)continue;
  const suffix=form.name.slice(root.length+1);
  groups.get(root).push({label:suffix.toLowerCase().split("_").map(w=>w[0].toUpperCase()+w.slice(1)).join(" "),value:form.name});
 }
 const choices=base.map(name=>({value:name,label:name.toLowerCase().split("_").map(w=>w[0].toUpperCase()+w.slice(1)).join(" ")}));
 return {groups,choices,defined}
}
export function selectedSpecies(source,catalog){
 const cleaned=String(source||"").replace(/^SPECIES_/,"").trim().toUpperCase().replace(/[ -]/g,"_");
 if(catalog.groups.has(cleaned))return {base:cleaned,form:cleaned};
 for(const [root,variants] of catalog.groups){if(variants.some(f=>f.value===cleaned))return {base:root,form:cleaned}}
 return null
}
export function speciesIdentifier(base,form,catalog){
 const variants=catalog.groups.get(base)||[];
 if(!variants.some(v=>v.value===form))throw Error("Form is not defined for "+base);
 return "SPECIES_"+form
}
