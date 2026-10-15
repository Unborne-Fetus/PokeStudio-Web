// Brisk Dex Pokémon icons are 32×64 PNG sprite sheets containing two 32×32
// frames with an opaque palette-0 background, not ordinary transparent icons.
// Clean the actual indexed-color pixels once, then animate the two real frames.
const base="https://raw.githubusercontent.com/Unborne-Fetus/Brisk-Dex/main/brisk-dex-icons/";
const mirror="https://cdn.jsdelivr.net/gh/Unborne-Fetus/Brisk-Dex@main/brisk-dex-icons/";
const cache=new Map();

export function iconFrameCount(width,height){
 if(!Number.isInteger(width)||width<=0||!Number.isInteger(height)||height<=0) return 0;
 return height===width*2?2:1
}

export function removeIconBackground(imageData){
 const {width,height,data}=imageData;
 if(!width||!height||!data||data.length!==width*height*4)throw Error("Invalid icon pixel data");
 const cleaned=new Uint8ClampedArray(data);
 const background=[data[0],data[1],data[2],data[3]];
 let removed=0;
 if(background[3]!==0){
  for(let offset=0;offset<cleaned.length;offset+=4){
   if(cleaned[offset]===background[0]&&cleaned[offset+1]===background[1]&&cleaned[offset+2]===background[2]){
    cleaned[offset+3]=0;removed++
   }
  }
 }
 return {width,height,data:cleaned,removed,frames:iconFrameCount(width,height)}
}

function toImage(blob){
 return new Promise((resolve,reject)=>{
  const objectUrl=URL.createObjectURL(blob);
  const img=new Image();
  img.onload=()=>{URL.revokeObjectURL(objectUrl);resolve(img)};
  img.onerror=()=>{URL.revokeObjectURL(objectUrl);reject(Error("Cannot decode Pokémon icon"))};
  img.src=objectUrl
 })
}

async function getIcon(id,shiny){
 const filename=id+(shiny?"_shiny":"")+".png";
 let lastError;
 for(const url of [base+filename,mirror+filename]){
  try{
   const response=await fetch(url,{mode:"cors"});
   if(!response.ok)throw Error("HTTP "+response.status);
   const img=await toImage(await response.blob());
   const canvas=document.createElement("canvas");
   canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
   const ctx=canvas.getContext("2d",{willReadFrequently:true});
   if(!ctx)throw Error("Canvas is unavailable");
   ctx.drawImage(img,0,0);
   const {data,frames,removed}=removeIconBackground(ctx.getImageData(0,0,canvas.width,canvas.height));
   const pixels=ctx.createImageData(canvas.width,canvas.height);
   pixels.data.set(data);
   ctx.putImageData(pixels,0,0);
   return {source:canvas.toDataURL("image/png"),frames,width:canvas.width,height:canvas.height,removed};
  }catch(error){lastError=error}
 }
 throw lastError||Error("Icon asset unavailable")
}

export function loadBriskIcon(id,shiny=false){
 if(!Number.isInteger(id)||id<=0)return Promise.reject(Error("Invalid species ID"));
 const key=id+(shiny?"-shiny":"-normal");
 if(!cache.has(key)){
  const task=getIcon(id,shiny).catch(err=>{cache.delete(key);throw err});
  cache.set(key,task)
 }
 return cache.get(key)
}

// Creates a crop window that ALWAYS displays just one 32×32 (or single-frame)
// region. The sprite-sheet animation is controlled by CSS on the window.
export function createBriskIcon(id,shiny=false,species="Pokémon"){
 const wrapper=document.createElement("span");
 wrapper.className="brisk-icon-window";
 wrapper.setAttribute("role","img");
 wrapper.setAttribute("aria-label",(shiny?"Shiny ":"")+species);
 const pending=document.createElement("span");
 pending.className="brisk-icon-placeholder";
 pending.textContent=String(species||"?").slice(0,2).toUpperCase();
 pending.setAttribute("aria-hidden","true");
 wrapper.append(pending);
 if(!Number.isInteger(id)||id<=0)return wrapper;
 loadBriskIcon(id,shiny).then(asset=>{
  if(!wrapper.isConnected)return;
  const image=document.createElement("img");
  image.alt="";
  image.setAttribute("aria-hidden","true");
  image.className="brisk-icon-sheet";
  image.decoding="async";
  image.src=asset.source;
  image.onload=()=>{
   wrapper.classList.add("brisk-icon-loaded");
   wrapper.classList.toggle("brisk-icon-two-frame",asset.frames===2);
   wrapper.classList.toggle("brisk-icon-single-frame",asset.frames!==2)
  };
  image.onerror=()=>image.remove();
  wrapper.append(image)
 }).catch(()=>{
  // Do not show the unprocessed PNG, whose opaque green background and two
  // stacked frames caused the original glitch. Use a readable placeholder.
  wrapper.title="No compatible Brisk Dex icon is available for "+species
 });
 return wrapper
}
