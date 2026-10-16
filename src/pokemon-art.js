import {spriteId,briskSpriteUrls} from "./brisk-art.js";

// Source ROM files are the authority for alternate forms and custom Megas.
// GitHub's recursive tree can be truncated; do not require hasPath() to list
// a graphic before trying its real raw URL.
function baseAndForm(species,dex){
 const name=String(species||"").replace(/^SPECIES_/,"").toUpperCase();
 const base=[...dex.keys()].filter(key=>name===key||name.startsWith(key+"_")).sort((a,b)=>b.length-a.length)[0];
 return base?{base:base.toLowerCase(),form:name.slice(base.length).replace(/^_/,"").toLowerCase()}:null;
}
function formFolders(name){
 const forms=[name];
 const aliases=[
  [ /^alolan?_?/,"alola" ],[/^galarian?_?/,"galar" ],
  [/^hisuian?_?/,"hisui" ],[/^paldean?_?/,"paldea" ],
  [/^gigantamax_?/,"gmax" ],[/^mega_female$/,"mega_f" ],[/^mega_male$/,"mega_m" ]
 ];
 for(const [pattern,replacement] of aliases){const alt=name.replace(pattern,replacement);if(alt!==name)forms.push(alt)}
 if(name==="shield"||name==="standard"||name==="normal")forms.push("");
 if(name==="10"||name==="10_percent")forms.push("10_percent");
 if(name==="50")forms.push("");
 return [...new Set(forms)];
}
function candidateFiles(folder,form){
 const choices=[];
 for(const suffix of formFolders(form)){
  if(suffix.startsWith("mega"))choices.push("graphics/pokemon/custom_megas/"+folder+"/"+suffix+"/");
  choices.push("graphics/pokemon/"+folder+"/"+(suffix?suffix+"/":""));
 }
 return [...new Set(choices)].flatMap(prefix=>{
  const files=prefix.includes("/custom_megas/")?["front_80.png","front.png","anim_front.png"]:["anim_front.png","front.png","front_80.png"];
  return files.map(filename=>({
   path:prefix+filename,normalPalette:prefix+"normal.pal",shinyPalette:prefix+"shiny.pal"
  }));
 });
}
export function romFrontArt(api,species,dex=new Map()){
 if(typeof api?.assetUrl!=="function")return null;
 const info=baseAndForm(species,dex);
 if(!info?.form)return null;
 const options=candidateFiles(info.base,info.form);
 // Known local files are preferred; on remote workspaces, try the canonical
 // paths even when api.hasPath cannot see them because the tree is truncated.
 const known=options.filter(c=>api.hasPath?.(c.path));
 const remote=Boolean(api.assetUrl(options[0]?.path)?.startsWith("http"));
 const candidates=known.length?[...known,...options.filter(c=>!known.includes(c))]:(remote?options:[]);
 return candidates.length?{...candidates[0],candidates}:null;
}
export function parseJascPalette(text){
 const lines=String(text||"").trim().split(/\r?\n/).map(s=>s.trim());
 const count=Number(lines[2]);
 if(lines[0]!=="JASC-PAL"||!Number.isInteger(count)||count<=0||count>256)return [];
 const colors=lines.slice(3,3+count).map(line=>line.split(/\s+/).map(Number));
 return colors.length===count&&colors.every(c=>c.length===3&&c.every(n=>Number.isInteger(n)&&n>=0&&n<=255))?colors:[];
}
export function recolorPixels(pixels,regular,shiny){
 if(!regular.length||regular.length!==shiny.length)return false;
 const map=new Map();
 for(let i=0;i<regular.length;i++){
  const key=regular[i].join(",");
  if(!map.has(key))map.set(key,shiny[i]);
 }
 let changed=false;
 for(let i=0;i<pixels.length;i+=4){
  if(!pixels[i+3])continue;
  const color=map.get(pixels[i]+","+pixels[i+1]+","+pixels[i+2]);
  if(!color)continue;
  if(color.some((n,j)=>n!==pixels[i+j]))changed=true;
  pixels[i]=color[0];pixels[i+1]=color[1];pixels[i+2]=color[2];
 }
 return changed;
}
async function paletteFor(api,path){
 // Read directly from public raw GitHub for truncated Git trees. No PAT is
 // added to these URLs; local workspaces continue to use loadRaw.
 const url=api.assetUrl(path);
 if(url&&/^https:\/\//.test(url)){
  const response=await fetch(url,{mode:"cors"});
  if(!response.ok)throw Error("Palette HTTP "+response.status);
  return parseJascPalette(await response.text());
 }
 if(api.hasPath?.(path)&&api.loadRaw){
  const file=await api.loadRaw(path);
  return parseJascPalette(file.value);
 }
 return [];
}
const palettes=new Map();
async function palettePair(api,entry){
 const key=api.assetUrl(entry.normalPalette)+"|"+api.assetUrl(entry.shinyPalette);
 if(!palettes.has(key))palettes.set(key,Promise.all([
  paletteFor(api,entry.normalPalette),paletteFor(api,entry.shinyPalette)
 ]).catch(()=>[[],[]]));
 return palettes.get(key);
}
export function spriteFrameSize(width,height){
 // Many expansion anim_front.png assets are 64x128 or 80x160: two vertically
 // stacked frames. Use the first frame rather than squeezing both into a card.
 if(width>0&&height>=width*1.7&&height<=width*4.1)return {width,height:Math.floor(height/2)};
 return {width,height};
}
async function renderRomFrame(image,entry,shiny,api){
 const dimensions=spriteFrameSize(image.naturalWidth,image.naturalHeight);
 if(!dimensions.width||!dimensions.height)return null;
 const canvas=document.createElement("canvas");
 canvas.width=dimensions.width;canvas.height=dimensions.height;
 const ctx=canvas.getContext("2d",{willReadFrequently:shiny});
 if(!ctx)return null;
 ctx.drawImage(image,0,0,dimensions.width,dimensions.height,0,0,dimensions.width,dimensions.height);
 if(shiny){
  const [normal,alternate]=await palettePair(api,entry);
  if(!normal.length||normal.length!==alternate.length)return null;
  const data=ctx.getImageData(0,0,dimensions.width,dimensions.height);
  if(!recolorPixels(data.data,normal,alternate))return null;
  ctx.putImageData(data,0,0);
 }
 return canvas.toDataURL("image/png");
}
function imageNode(species,shiny){
 const img=document.createElement("img");
 img.className="brisk-front-sprite";
 img.alt=(shiny?"Shiny ":"")+String(species).replace(/^SPECIES_/,"")+" front sprite";
 img.loading="lazy";img.decoding="async";
 return img;
}
function fallbackArt(outer,placeholder,species,shiny,dex){
 const urls=briskSpriteUrls(spriteId(species,dex),shiny);
 if(!urls)return;
 const img=imageNode(species,shiny);
 img.title="A unique form graphic was not found; showing the base Pokémon instead.";
 img.src=urls.animated;
 img.onload=()=>{placeholder.hidden=true};
 img.onerror=()=>{if(img.dataset.fallback){img.remove();placeholder.hidden=false;return}img.dataset.fallback="1";img.src=urls.still};
 outer.append(img);
}
export function monIcon(api,species,shiny=false,dex=new Map(),speciesForms=null){
 const outer=document.createElement("div");
 outer.className="mon-portrait art-frame brisk-mon-portrait";
 const placeholder=document.createElement("span");
 placeholder.className="art-placeholder";
 placeholder.textContent=String(species).replace(/^SPECIES_/,"").slice(0,2).toUpperCase();
 outer.append(placeholder);
 const rom=romFrontArt(api,species,dex);
 if(!rom){
  fallbackArt(outer,placeholder,species,shiny,dex);
  return outer;
 }
 const image=imageNode(species,shiny);
 image.crossOrigin="anonymous";
 let index=0,finished=false;
 const next=()=>{
  if(finished)return;
  if(index>=rom.candidates.length){
   finished=true;image.remove();fallbackArt(outer,placeholder,species,shiny,dex);return;
  }
  image.src=api.assetUrl(rom.candidates[index].path);
 };
 image.onerror=()=>{index++;next()};
 image.onload=async()=>{
  const match=index,entry=rom.candidates[match];
  if(!entry||finished)return;
  // The source asset itself is always displayed first, even if palette
  // conversion or a network fetch fails. This avoids blank shiny previews.
  placeholder.hidden=true;
  if(!image.dataset.processed){
   image.dataset.processed="1";
   try{
    const processed=await renderRomFrame(image,entry,shiny,api);
    if(index!==match||finished)return;
    if(processed){
     image.onload=null;
     image.onerror=()=>{image.remove();placeholder.hidden=false};
     image.src=processed;
    }else if(shiny)image.title="Shiny palette unavailable; showing normal form art.";
   }catch{
    if(shiny)image.title="Shiny palette unavailable; showing normal form art.";
   }
  }
 };
 outer.append(image);next();
 return outer;
}
