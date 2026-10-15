// Reuse Brisk Dex animated front sprite assets, with distinct shiny GIFs.
// National IDs are taken from the connected ROM's NationalDexOrder.
export function nationalDexIndex(header){
 const part=String(header).split("enum NationalDexOrder")[1]?.split("};")[0]||"";
 const names=[...part.matchAll(/\bNATIONAL_DEX_([A-Z0-9_]+)\b\s*(?:=\s*(\d+))?\s*,/g)];
 const out=new Map();let current=-1;
 for(const [,key,number] of names){if(number!==undefined)current=Number(number);else current++;if(key!=="NONE")out.set(key,current)}
 return out;
}
export function spriteId(species,index){
 const raw=String(species||"").replace(/^SPECIES_/,"").toUpperCase().replace(/[^A-Z0-9_ ]/g,"").replace(/[ -]/g,"_");
 const keys=[raw,raw.replace(/_(ALOLA|GALARIAN|GALAR|HISUI|PALDEA|MEGA|GMAX|ATTACK|DEFENSE|SPEED|ORIGIN|THERIAN|Z)($|_.*)/,"")];
 for(const key of keys){const found=index.get(key);if(found)return found}
 return null
}
export function briskSpriteUrls(id,shiny=false){
 if(!Number.isInteger(id)||id<1)return null;
 const suffix=shiny?"_front_shiny_anim.gif":"_front_anim.gif";
 const staticName=shiny?"_front_shiny.png":"_front.png";
 const base="https://raw.githubusercontent.com/Unborne-Fetus/Brisk-Dex/main/brisk-dex-sprites/"+id;
 return {animated:base+suffix,still:base+staticName}
}
