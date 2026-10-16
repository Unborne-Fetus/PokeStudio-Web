// Visibility policy for visual species browsers only.
// Never delete Totem definitions from the ROM or change their trainer references.
export function isTotemSpecies(speciesId, fields=null){
 const id=String(speciesId||"").replace(/^SPECIES_/,"").toUpperCase();
 if(/(?:^|_)TOTEM(?:_|$)/.test(id))return true;
 const flag=fields?.get?.("isTotem")?.value;
 return String(flag||"").trim()==="TRUE";
}
