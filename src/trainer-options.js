// Build trainer dropdowns from actual syntax values in the connected project's trainers.party.
// Existing values are never silently changed, including custom expansion definitions.
export const DROPDOWN_FIELDS=["Pic","Gender","Class","Music","AI","Double Battle"];
const ordered=(items)=>[...new Set(items.filter(v=>typeof v==="string"&&v.trim()).map(v=>v.trim()))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:"base"}));
export function trainerDropdownOptions(trainers,paths=[]){
 const result={};
 for(const key of ["Pic","Class","Music","AI"]){
  result[key]=ordered(trainers.map(t=>t.meta?.[key]));
 }
 // Include only sprite names confirmed by trainer definitions; do not assume
 // every filename is a valid Pic identifier for trainerproc.
 const sprites=new Set(paths.filter(p=>p.startsWith("graphics/trainers/front_pics/")&&p.endsWith(".png")));
 result.Pic=result.Pic.map(name=>({value:name,label:name,hasSprite:sprites.has("graphics/trainers/front_pics/"+slug(name)+".png")}));
 for(const key of ["Class","Music","AI"])result[key]=result[key].map(v=>({value:v,label:v}));
 result.Gender=[{value:"Male",label:"Male"},{value:"Female",label:"Female"}];
 result["Double Battle"]=[{value:"No",label:"No — Single battle"},{value:"Yes",label:"Yes — Double battle"}];
 return result;
}
function slug(s){return String(s).trim().toLowerCase().replace(/[^a-z0-9 _-]/g,"").replace(/[ -]+/g,"_")}
export function optionsWithCurrent(options,current){
 const value=String(current??"");
 const result=options.slice();
 if(!result.some(o=>o.value===value))result.unshift({value,label:value?value+" (existing custom value)":"Unspecified"});
 return result;
}
