/* Preview pokeemerald tileset artwork. Map cells are 16-bit little-endian
   metatile IDs. Each source metatile has three sets of four 8x8 tiles.
   This is a browser preview, not a fully color-accurate Porymap renderer. */
function matchTilesetPath(api,kind,name){
 const paths=api.paths();const logical=String(name||"").replace(/^gTileset_/,"").toLowerCase().replace(/[^a-z0-9]/g,"");
 const choices=paths.filter(p=>p.startsWith("data/tilesets/"+kind+"/")&&p.endsWith("/metatiles.bin"));
 const selected=choices.find(p=>p.split("/")[3].replace(/[^a-z0-9]/gi,"").toLowerCase()===logical);
 return selected?.replace(/metatiles\.bin$/,"")||null;
}
async function imageFromBytes(bytes){
 const blob=new Blob([bytes],{type:"image/png"});
 if("createImageBitmap" in window)return createImageBitmap(blob);
 return new Promise((resolve,reject)=>{const u=URL.createObjectURL(blob),img=new Image();img.onload=()=>{URL.revokeObjectURL(u);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(u);reject(Error("Cannot decode tile PNG"))};img.src=u});
}
async function fetchTileset(api,kind,name){
 const path=matchTilesetPath(api,kind,name);if(!path)return null;
 const [metatiles,art]=await Promise.all([api.loadRaw(path+"metatiles.bin"),api.loadRaw(path+"tiles.png")]);
 if(!metatiles.isBinary||!art.isBinary)throw Error("Tileset assets were not decoded as binary");
 if(metatiles.bytes.byteLength%24!==0)throw Error("Unexpected metatile entry size");
 const bitmap=await imageFromBytes(art.bytes);return {path,data:metatiles.bytes,bitmap,count:metatiles.bytes.length/24};
}
function artTile(ctx,tileset,entry,tx,ty){
 const tile=entry&0x03ff,flipX=Boolean(entry&0x0400),flipY=Boolean(entry&0x0800);
 const tileColumns=Math.floor(tileset.bitmap.width/8),tileRows=Math.floor(tileset.bitmap.height/8);
 if(tileColumns<1)return;let local=tile;
 if(local>=tileColumns*tileRows&&local>=512)local-=512;
 if(local<0||local>=tileColumns*tileRows)return;
 const sx=(local%tileColumns)*8,sy=Math.floor(local/tileColumns)*8;
 ctx.save();ctx.translate(tx+(flipX?8:0),ty+(flipY?8:0));ctx.scale(flipX?-1:1,flipY?-1:1);
 ctx.drawImage(tileset.bitmap,sx,sy,8,8,0,0,8,8);ctx.restore();
}
export async function createMetatileRenderer(api,layout){
 const [primary,secondary]=await Promise.all([
  fetchTileset(api,"primary",layout.primary_tileset),
  fetchTileset(api,"secondary",layout.secondary_tileset)
 ]);
 if(!primary&&!secondary)throw Error("No tileset PNG and metatile binaries found");
 const cache=new Map(),dviews=[primary,secondary].map(t=>t?new DataView(t.data.buffer,t.data.byteOffset,t.data.byteLength):null);
 function draw(ctx,id,x,y,size){
  const source=id<512?primary:secondary,index=id<512?id:id-512;
  if(!source||index>=source.count||index<0)return false;
  if(!cache.has(id)){
   const v=id<512?dviews[0]:dviews[1];const canvas=document.createElement("canvas");canvas.width=16;canvas.height=16;
   const c=canvas.getContext("2d");if(!c)return false;
   const base=index*24;
   // Three tile layers, each holding a 2x2 grid.
   for(let pass=0;pass<3;pass++)for(let q=0;q<4;q++){const value=v.getUint16(base+(pass*4+q)*2,true);if(value===0&&pass>0)continue;artTile(c,source,value,(q%2)*8,Math.floor(q/2)*8)}
   cache.set(id,canvas)
  }
  ctx.drawImage(cache.get(id),x,y,size,size);return true
 }
 return {draw,primary:primary?.path||"",secondary:secondary?.path||"",clear:()=>cache.clear()}
}
