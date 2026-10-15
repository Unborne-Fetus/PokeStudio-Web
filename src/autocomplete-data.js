// Source-derived suggestions for pokeemerald-expansion trainer editing.
export const NATURES="Hardy Lonely Brave Adamant Naughty Bold Docile Relaxed Impish Lax Timid Hasty Serious Jolly Naive Modest Mild Quiet Bashful Rash Calm Gentle Sassy Careful Quirky".split(" ");
export const TYPES="Normal Fighting Flying Poison Ground Rock Bug Ghost Steel Fire Water Grass Electric Psychic Ice Dragon Dark Fairy Stellar".split(" ");
const normalize=s=>String(s||"").trim();
const unique=values=>[...new Set(values.map(normalize).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:"base",numeric:true}));
const tidy=s=>s.toLowerCase().split("_").map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(" ");
export const isPlaceholderTrainer=trainer=>{
 const id=typeof trainer==="string"?trainer:trainer.id||"";
 return /^TRAINER_(?:NONE|DUMMY(?:_[A-Z0-9]+)*|PLACEHOLDER(?:_[A-Z0-9]+)*|UNUSED(?:_[A-Z0-9]+)*)$/.test(id);
};
export function itemNamesFromHeader(header){
 const entries=[...String(header||"").matchAll(/\bITEM_([A-Z][A-Z0-9_]*)\s*(?:=|,)/g)].map(m=>tidy(m[1]));
 return unique(entries.filter(x=>x!=="None"));
}
export function ballNamesFromHeader(header){
 const full=itemNamesFromHeader(header).filter(s=>/ Ball$/.test(s));
 return unique(full.map(s=>s.slice(0,-5)).concat(["Poke","Great","Ultra","Master","Dive","Premier"]));
}
export function natureNamesFromHeader(header){
 const defs=[...String(header||"").matchAll(/\bNATURE_([A-Z][A-Z_]+)\s*(?:=|\d|\()/g)].map(m=>tidy(m[1]));
 const legal=new Set(NATURES);return unique([...NATURES,...defs.filter(v=>legal.has(v))])
}
export function typeNamesFromHeader(header){
 const defs=[...String(header||"").matchAll(/\bTYPE_([A-Z][A-Z_]+)\s*(?:=|,|\d)/g)].map(m=>tidy(m[1]));
 const legal=new Set(TYPES);return unique([...TYPES,...defs.filter(v=>legal.has(v))])
}
export function pokemonChoiceLists(catalog,headers={}){
 const allMons=catalog.flatMap(tr=>tr.pokemon||[]);
 return {
  "Nature":unique([...natureNamesFromHeader(headers.pokemon),...allMons.map(m=>m.fields?.Nature)]),
  "Tera Type":unique([...typeNamesFromHeader(headers.pokemon),...allMons.map(m=>m.fields?.["Tera Type"])]),
  "Ball":unique([...ballNamesFromHeader(headers.items),...allMons.map(m=>m.fields?.Ball)]),
  "Held item":unique([...itemNamesFromHeader(headers.items),...allMons.map(m=>m.held)])
 };
}
export function searchSuggestions(options,term,limit=30){
 const q=normalize(term).toLowerCase();
 const list=options.map(x=>typeof x==="string"?{value:x,label:x}:x);
 return list.filter(entry=>(entry.label||entry.value).toLowerCase().includes(q)||String(entry.value).toLowerCase().includes(q))
 .sort((a,b)=>{
  const va=a.value.toLowerCase(),vb=b.value.toLowerCase();
  const pa=va===q?0:va.startsWith(q)?1:2,pb=vb===q?0:vb.startsWith(q)?1:2;
  return pa-pb||va.localeCompare(vb,undefined,{numeric:true,sensitivity:"base"})
 }).slice(0,limit)
}
