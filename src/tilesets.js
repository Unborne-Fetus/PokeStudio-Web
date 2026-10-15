// Pokeemerald metatiles use 12 little-endian 16-bit entries per metatile.
// Tile: bits 0-9; H/V flips: 10-11; palette: 12-15. In .pal files the
// actual JASC colors are separate from grayscale/indexed tiles.png art.
export const METATILE_SIZE=24;
export const PRIMARY_METATILES=512;
export const PRIMARY_PALETTES=6;
export function parseJasc(text){
 const lines=String(text).trim().split(/\r?\n/).map(s=>s.trim());
 if(lines[0]!=="JASC-PAL")throw Error("Invalid JASC palette");
 const count=Number(lines[2]);if(!Number.isInteger(count)||count<1||count>256)throw Error("Invalid palette size");
 return lines.slice(3,3+count).map(s=>{
  const parts=s.split(/\s+/).map(Number);
  if(parts.length!==3||parts.some(n=>!Number.isFinite(n)||n<0||n>255))throw Error("Invalid RGB entry");
  return parts
 });
}
export function decodeMapWord(word){return {id:word&1023,collision:(word>>10)&3,elevation:(word>>12)&15}}
export function encodeMapWord(word,{id,collision,elevation}){
 let v=word;
 if(id!==undefined){if(!Number.isInteger(id)||id<0||id>1023)throw Error("Metatile ID must be 0–1023");v=(v&~1023)|id}
 if(collision!==undefined){if(!Number.isInteger(collision)||collision<0||collision>3)throw Error("Collision is 0–3");v=(v&~(3<<10))|(collision<<10)}
 if(elevation!==undefined){if(!Number.isInteger(elevation)||elevation<0||elevation>15)throw Error("Elevation is 0–15");v=(v&~(15<<12))|(elevation<<12)}
 return v
}
function folder(api,kind,name){
 const nameKey=String(name||"").replace(/^gTileset_/,"").replace(/[^a-z0-9]/gi,"").toLowerCase();
 const found=api.paths().find(p=>p.startsWith("data/tilesets/"+kind+"/")&&p.endsWith("/metatiles.bin")&&p.split("/")[3].replace(/[^a-z0-9]/gi,"").toLowerCase()===nameKey);
 return found?.slice(0,-"metatiles.bin".length)||""
}
async function bitmap(bytes){
 const blob=new Blob([bytes],{type:"image/png"});
 if(typeof createImageBitmap==="function")return createImageBitmap(blob);
 return await new Promise((resolve,reject)=>{
  const img=new Image(),url=URL.createObjectURL(blob);
  img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(Error("Unable to decode PNG"))};
  img.src=url;
 })
}
function pngPalette(bytes) {
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length<32||view.getUint32(0)!==0x89504e47)return null;
 let position=8;
 while(position+12<=bytes.length){
  const size=view.getUint32(position),name=String.fromCharCode(...bytes.slice(position+4,position+8));
  if(name==="PLTE"){
   const colors=[];for(let i=0;i+2<size;i+=3){const at=position+8+i;colors.push([bytes[at],bytes[at+1],bytes[at+2]])}
   return colors
  }
  position+=12+size;
 }
 return null
}
function lookupOriginal(bytes,imgData){
 const colors=pngPalette(bytes),lookup=new Map();
 if(colors)colors.forEach((c,i)=>lookup.set((c[0]<<16)|(c[1]<<8)|c[2],i));
 if(!lookup.size){
  // RGB grayscale sprites that do not have a PNG PLTE chunk.
  const pixels=imgData.data,unique=new Set();
  for(let i=0;i<pixels.length;i+=4)unique.add((pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2]);
  const sorted=[...unique].sort((a,b)=>(a&255)-(b&255));
  sorted.slice(0,16).forEach((c,i)=>lookup.set(c,i));
 }
 return lookup
}
async function loadArt(api,kind,name) {
 const base=folder(api,kind,name);if(!base)return null;
 const [raw,png]=await Promise.all([api.loadRaw(base+"metatiles.bin"),api.loadRaw(base+"tiles.png")]);
 if(!raw.isBinary||!png.isBinary||raw.bytes.length%METATILE_SIZE)throw Error("Invalid tile data in "+base);
 const img=await bitmap(png.bytes),w=img.width,h=img.height;
 const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(img,0,0);
 const pixels=ctx.getImageData(0,0,w,h),indexes=new Uint8Array(w*h),lut=lookupOriginal(png.bytes,pixels);
 const samples=pixels.data;
 for(let i=0;i<indexes.length;i++){
  const off=i*4,code=(samples[off]<<16)|(samples[off+1]<<8)|samples[off+2];
  const exact=lut.get(code);indexes[i]=exact===undefined?Math.max(0,Math.min(15,Math.round(samples[off]/17))):exact%16;
 }
 return {base,raw:raw.bytes,view:new DataView(raw.bytes.buffer,raw.bytes.byteOffset,raw.bytes.byteLength),w,h,indexes,count:raw.bytes.length/METATILE_SIZE,colored:new Map()}
}
function colorized(art,palette,slot,transparent){
 const cacheKey=slot+(transparent?":overlay":":base");if(art.colored.has(cacheKey))return art.colored.get(cacheKey);
 const sheet=document.createElement("canvas");sheet.width=art.w;sheet.height=art.h;const ctx=sheet.getContext("2d");
 const data=ctx.createImageData(art.w,art.h);
 for(let i=0;i<art.indexes.length;i++){
  const idx=art.indexes[i],rgb=palette[idx]||palette[0]||[255,0,255],at=i*4;
  data.data[at]=rgb[0];data.data[at+1]=rgb[1];data.data[at+2]=rgb[2];data.data[at+3]=(transparent&&idx===0)?0:255
 }
 ctx.putImageData(data,0,0);art.colored.set(cacheKey,sheet);return sheet
}
async function loadPalettes(api,primaryBase,secondaryBase){
 const found=api.paths(),available=new Set(found),selected=[];
 for(let i=0;i<16;i++){
  const suffix="palettes/"+String(i).padStart(2,"0")+".pal";
  const own=i<PRIMARY_PALETTES?primaryBase:secondaryBase;
  const alt=i<PRIMARY_PALETTES?secondaryBase:primaryBase;
  const path=[own+suffix,alt+suffix].find(p=>available.has(p));
  selected.push(path||null)
 }
 const result=await Promise.all(selected.map(async p=>{
  if(!p)return null;
  try{const file=await api.loadRaw(p);return parseJasc(file.value||new TextDecoder().decode(file.bytes))}catch{return null}
 }));
 return {palettes:result,paths:selected}
}
export async function createMetatileRenderer(api,layout) {
 const [primary,secondary]=await Promise.all([loadArt(api,"primary",layout.primary_tileset),loadArt(api,"secondary",layout.secondary_tileset)]);
 if(!primary&&!secondary)throw Error("The required tiles.png and metatiles.bin assets weren't found");
 const paletteInfo=await loadPalettes(api,primary?.base||"",secondary?.base||"");
 const paletteInfoLine=paletteInfo.paths.filter(Boolean).length+" JASC palettes";
 const cache=new Map();
 function draw(ctx,id,x,y,size=16){
  const art=id<PRIMARY_METATILES?primary:secondary,local=id<PRIMARY_METATILES?id:id-PRIMARY_METATILES;
  if(!art||local<0||local>=art.count)return false;
  if(!cache.has(id)){
   const cv=document.createElement("canvas");cv.width=16;cv.height=16;const c=cv.getContext("2d");
   for(let layer=0;layer<3;layer++)for(let q=0;q<4;q++){
    const entry=art.view.getUint16(local*METATILE_SIZE+layer*8+q*2,true);
    if(layer>0&&entry===0)continue;
    const tile=entry&1023,pal=(entry>>12)&15,flipX=Boolean(entry&0x400),flipY=Boolean(entry&0x800);
    const rgb=paletteInfo.palettes[pal]||[[30,20,32],[233,177,105],[245,224,193],[134,88,65]];
    const sheet=colorized(art,rgb,pal,layer>0),perRow=Math.floor(art.w/8);
    const adjusted=tile>=perRow*Math.floor(art.h/8)&&tile>=512?tile-512:tile;
    if(adjusted<0||adjusted>=perRow*Math.floor(art.h/8))continue;
    const sx=(adjusted%perRow)*8,sy=Math.floor(adjusted/perRow)*8,tx=(q%2)*8,ty=Math.floor(q/2)*8;
    c.save();c.translate(tx+(flipX?8:0),ty+(flipY?8:0));c.scale(flipX?-1:1,flipY?-1:1);c.drawImage(sheet,sx,sy,8,8,0,0,8,8);c.restore()
   }cache.set(id,cv)
  }
  ctx.imageSmoothingEnabled=false;ctx.drawImage(cache.get(id),x,y,size,size);return true
 }
 return {draw,paletteInfoLine,primary:primary?.base||"",secondary:secondary?.base||"",count:(primary?.count||0)+(secondary?.count||0)};
}
