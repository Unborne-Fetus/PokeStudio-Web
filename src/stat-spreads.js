// Trainer Showdown-style stat codec. Always serialize all six stats.
export const STAT_NAMES=["HP","Atk","Def","SpA","SpD","Spe"];
const DEFAULT_IV=31,DEFAULT_EV=0;
export function readSpread(source="",kind="IVs"){
 const values=Object.fromEntries(STAT_NAMES.map(stat=>[stat,kind==="IVs"?DEFAULT_IV:DEFAULT_EV]));
 for(const part of String(source).split("/")){const m=part.trim().match(/^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/i);if(!m)continue;
  const stat=STAT_NAMES.find(s=>s.toLowerCase()===m[2].toLowerCase());values[stat]=Number(m[1]);
 }return values
}
export function applySpread(values,stat,value,kind){
 if(!STAT_NAMES.includes(stat))throw Error("Unknown stat "+stat);
 const max=kind==="IVs"?31:252,old=values[stat]||0;
 const next=Math.min(max,Math.max(0,Math.round(Number(value)||0))),out={...values,[stat]:next};
 if(kind==="EVs"){const used=STAT_NAMES.reduce((sum,key)=>sum+(key===stat?0:(out[key]||0)),0);out[stat]=Math.min(next,Math.max(0,510-used))}
 return out
}
export function spreadTotal(values){return STAT_NAMES.reduce((sum,s)=>sum+(Number(values[s])||0),0)}
export function spreadText(values,kind){
 return STAT_NAMES.map(s=>String(Math.min(kind==="IVs"?31:252,Math.max(0,values[s]||0)))+" "+s).join(" / ")
}
export function spreadIsValid(values,kind){
 return STAT_NAMES.every(s=>Number.isInteger(values[s])&&values[s]>=0&&values[s]<=(kind==="IVs"?31:252))&&(kind==="IVs"||spreadTotal(values)<=510)
}
