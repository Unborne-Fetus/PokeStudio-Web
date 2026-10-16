import {selectedSpecies} from "./species-forms.js";
import {spriteId,briskSpriteUrls} from "./brisk-art.js";

// Shared by Trainer Studio and Pokémon Studio. Use animated front battle sprites,
// not the two-frame icon spritesheets (whose frames must be cropped separately).
export function monIcon(api,species,shiny=false,dex=new Map(),speciesForms=null){
 const form=speciesForms?selectedSpecies(species,speciesForms):null;
 const exact=form?speciesForms.defined.get(form.form)?.id:null;
 const id=exact||spriteId(species,dex);
 const outer=document.createElement("div");
 outer.className="mon-portrait art-frame brisk-mon-portrait";
 const urls=briskSpriteUrls(id,shiny);
 const placeholder=document.createElement("span");
 placeholder.className="art-placeholder";
 placeholder.textContent=String(species).replace(/^SPECIES_/,"").slice(0,2).toUpperCase();
 outer.append(placeholder);
 if(!urls)return outer;
 const img=document.createElement("img");
 img.className="brisk-front-sprite";
 img.alt=(shiny?"Shiny ":"")+species+" animated front battle sprite";
 img.loading="lazy";
 img.decoding="async";
 img.src=urls.animated;
 img.onerror=()=>{if(img.dataset.fallback)return img.remove();img.dataset.fallback="1";img.src=urls.still};
 img.onload=()=>{placeholder.hidden=true};
 outer.append(img);
 return outer;
}
