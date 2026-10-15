export function createSpreadEditor(kind,raw,onSave){
 const labels=["HP","Atk","Def","SpA","SpD","Spe"];
 const max=kind==="IVs"?31:252;
 const current={};
 for(const stat of labels)current[stat]=kind==="IVs"?31:0;
 for(const match of String(raw||"").matchAll(/(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)/gi)){
  const key=labels.find(x=>x.toLowerCase()===match[2].toLowerCase());if(key)current[key]=Number(match[1]);
 }
 const root=document.createElement("section");root.className="spread-panel";
 const title=document.createElement("h3");title.textContent=kind+" — Showdown spread";
 const total=document.createElement("span");total.className="spread-total";
 const head=document.createElement("div");head.className="spread-heading";head.append(title,total);root.append(head);
 const grid=document.createElement("div");grid.className="spread-rows";root.append(grid);
 const widgets=[];
 const sum=()=>labels.reduce((n,k)=>n+current[k],0);
 function render(){total.textContent=kind==="IVs"?"31 max / stat":sum()+" / 510 EVs";for(const [key,range,number] of widgets){range.value=current[key];number.value=current[key]}}
 function update(stat,v,save){
  let next=Math.min(max,Math.max(0,Math.round(Number(v)||0)));
  if(kind==="EVs")next=Math.min(next,Math.max(0,510-(sum()-current[stat])));
  current[stat]=next;render();
  if(save)onSave(labels.map(key=>current[key]+" "+key).join(" / "))
 }
 for(const stat of labels){
  const row=document.createElement("label");row.className="spread-row";const name=document.createElement("span");name.textContent=stat;
  const range=document.createElement("input");range.type="range";range.min=0;range.max=max;range.step=1;
  const number=document.createElement("input");number.type="number";number.min=0;number.max=max;number.step=1;
  range.oninput=()=>update(stat,range.value,false);range.onchange=()=>update(stat,range.value,true);
  number.oninput=()=>update(stat,number.value,false);number.onchange=()=>update(stat,number.value,true);
  const limit=document.createElement("small");limit.textContent="/ "+max;
  row.append(name,range,number,limit);grid.append(row);widgets.push([stat,range,number])
 }
 render();return root
}
