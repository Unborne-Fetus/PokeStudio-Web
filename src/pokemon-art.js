import {selectedSpecies} from "./species-forms.js";
import {spriteId,briskSpriteUrls} from "./brisk-art.js";

// The ROM stores form art under graphics/pokemon/<base>/<form>/, and
// Brisk's custom Megas under graphics/pokemon/custom_megas/<base>/<form>/.
// Internal SPECIES_* numbers are NOT National Dex sprite numbers.
export function romFrontArt(api,species,dex=new Map()){
 if(typeof api?.hasPath!=="function"||typeof api?.assetUrl!=="function")return null;
 const name=String(species||"").replace(/^SPECIES_/,"").toUpperCase();
 const base=[...dex.keys()].filter(key=>name===key||name.startsWith(key+"_"))
   .sort((a,b)=>b.length-a.length)[0];
 if(!base)return null;
 const folder=base.toLowerCase(),form=name.slice(base.length).replace(/^_/,"").toLowerCase();
 if(!form)return null; // Keep original animated Brisk Dex sprites for base forms.
 const aliases=[form,form.replace(/^alolan?_?/,"alola"),form.replace(/^galarian?_?/,"galar"),
  form.replace(/^hisuian?_?/,"hisui"),form.replace(/^paldean?_?/,"paldea"),
  form.replace(/^gigantamax_?/,"gmax"),form.replace(/^mega_/,"mega_")];
 if(form==="shield"||form==="standard"||form==="normal")aliases.push("");
 const roots=[];
 for(const variant of [...new Set(aliases)]){
  if(variant.startsWith("mega"))roots.push("graphics/pokemon/custom_megas/"+folder+"/"+variant+"/");
  roots.push("graphics/pokemon/"+folder+"/"+(variant?variant+"/":""));
 }
 // Some custom forms use a shared root graphic even though their internal ID differs.
 for(const prefix of roots){
  for(const filename of ["anim_front.png","front_80.png","front.png"]){
   const path=prefix+filename;
   if(api.hasPath(path))return {path,normalPalette:prefix+"normal.pal",shinyPalette:prefix+"shiny.pal"};
  }
 }
 return null;
}

export function parseJascPalette(text){
 const lines=String(text||"").trim().split(/\r?\n/).map(line=>line.trim());
 if(lines[0]!=="JASC-PAL"||!Number.isInteger(Number(lines[2])))return [];
 const count=Number(lines[2]);
 if(count<=0||count>256)return [];
 const entries=lines.slice(3,3+count).map(line=>line.split(/\s+/).map(Number));
 return entries.length===count&&entries.every(x=>x.length===3&&x.every(n=>Number.isInteger(n)&&n>=0&&n<=255))?entries:[];
}
export function recolorPixels(data,normal,shiny){
 if(!normal.length||normal.length!==shiny.length)return false;
 const lookup=new Map();
 for(let i=0;i<normal.length;i++){
  const key=normal[i].join(",");
  if(!lookup.has(key))lookup.set(key,shiny[i]);
 }
 let changed=false;
 for(let i=0;i<data.length;i+=4){
  if(data[i+3]===0)continue;
  const next=lookup.get(data[i]+","+data[i+1]+","+data[i+2]);
  if(!next)continue;
  if(next[0]!==data[i]||next[1]!==data[i+1]||next[2]!==data[i+2])changed=true;
  data[i]=next[0];data[i+1]=next[1];data[i+2]=next[2];
 }
 return changed;
}
const shinyCache=new WeakMap();
function shinyRomUrl(api,art){
 let cache=shinyCache.get(api);
 if(!cache){cache=new Map();shinyCache.set(api,cache)}
 if(cache.has(art.path))return cache.get(art.path);
 const promise=(async()=>{
  if(!api.hasPath(art.normalPalette)||!api.hasPath(art.shinyPalette))return null;
  const [normal,shiny,source]=await Promise.all([
   api.loadRaw(art.normalPalette),api.loadRaw(art.shinyPalette),api.loadRaw(art.path)
  ]);
  const oldColors=parseJascPalette(normal.value),newColors=parseJascPalette(shiny.value);
  if(!oldColors.length||oldColors.length!==newColors.length||!source.isBinary||!source.bytes?.length)return null;
  if(typeof document==="undefined"||typeof Image==="undefined")return null;
  const blob=new Blob([source.bytes],{type:"image/png"});
  const blobUrl=URL.createObjectURL(blob);
  try{
   const bitmap=await new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(Error("Could not decode ROM sprite"));
    img.src=blobUrl;
   });
   const canvas=document.createElement("canvas");
   canvas.width=bitmap.naturalWidth;canvas.height=bitmap.naturalHeight;
   const context=canvas.getContext("2d",{willReadFrequently:true});
   if(!context)return null;
   context.drawImage(bitmap,0,0);
   const pixels=context.getImageData(0,0,canvas.width,canvas.height);
   if(!recolorPixels(pixels.data,oldColors,newColors))return null;
   context.putImageData(pixels,0,0);
   return canvas.toDataURL("image/png");
  }finally{URL.revokeObjectURL(blobUrl)}
 })().catch(()=>null);
 cache.set(art.path,promise);
 return promise;
}

// Shared by Trainer Studio, Pokémon Studio and Pokédex Studio.
export function monIcon(api,species,shiny=false,dex=new Map(),speciesForms=null){
 const outer=document.createElement("div");
 outer.className="mon-portrait art-frame brisk-mon-portrait";
 const placeholder=document.createElement("span");
 placeholder.className="art-placeholder";
 placeholder.textContent=String(species).replace(/^SPECIES_/,"").slice(0,2).toUpperCase();
 outer.append(placeholder);
 const rom=romFrontArt(api,species,dex);
 if(rom){
  const img=document.createElement("img");
  img.className="brisk-front-sprite";
  img.alt=(shiny?"Shiny ":"")+species+" ROM front sprite";
  img.loading="lazy";img.decoding="async";
  img.onload=()=>{placeholder.hidden=true};
  img.onerror=()=>{img.remove();placeholder.hidden=false};
  outer.append(img);
  if(!shiny){img.src=api.assetUrl(rom.path);return outer}
  // Show the real ROM form; never fall back to an unrelated species-ID GIF.
  shinyRomUrl(api,rom).then(url=>{
   if(url)img.src=url;
   else {img.title="Shiny palette could not be rendered; showing normal sprite";img.src=api.assetUrl(rom.path)}
  });
  return outer;
 }
 // When there is no matching ROM-specific form graphic, use the National Dex ID,
 // NEVER the internal enum number (e.g. 1573 for Mega Amoonguss).
 const id=spriteId(species,dex);
 const urls=briskSpriteUrls(id,shiny);
 if(!urls)return outer;
 const img=document.createElement("img");
 img.className="brisk-front-sprite";
 img.alt=(shiny?"Shiny ":"")+species+" animated front battle sprite";
 img.loading="lazy";img.decoding="async";img.src=urls.animated;
 img.onerror=()=>{if(img.dataset.fallback)return img.remove();img.dataset.fallback="1";img.src=urls.still};
 img.onload=()=>{placeholder.hidden=true};
 outer.append(img);return outer;
}
