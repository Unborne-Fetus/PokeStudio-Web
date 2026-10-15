import {searchSuggestions} from "./autocomplete-data.js";
// Searchable combobox. Selecting a suggestion or confirming a typed value commits
// once; filtering never mutates game files.
export function autocomplete(labelText,value,options,onCommit,{placeholder="",allowCustom=true}={}){
 const shell=document.createElement("label");shell.className="form-field autocomplete-field";
 const title=document.createElement("span");title.textContent=labelText;shell.append(title);
 const wrap=document.createElement("div");wrap.className="autocomplete-wrap";shell.append(wrap);
 const input=document.createElement("input");input.type="text";input.value=String(value??"");
 input.placeholder=placeholder||"Type to search…";input.autocomplete="off";input.setAttribute("role","combobox");
 input.setAttribute("aria-autocomplete","list");input.setAttribute("aria-expanded","false");input.setAttribute("aria-label",labelText);
 wrap.append(input);
 const menu=document.createElement("div");menu.className="autocomplete-menu";menu.setAttribute("role","listbox");menu.hidden=true;wrap.append(menu);
 let visible=[],highlight=0,hasFocus=false;
 function close(){menu.hidden=true;input.setAttribute("aria-expanded","false");}
 function commit(chosen){
  const final=String(chosen??"").trim();const exact=options.find(entry=>String(typeof entry==="string"?entry:entry.value).toLowerCase()===final.toLowerCase()||String(typeof entry==="string"?entry:entry.label).toLowerCase()===final.toLowerCase());
  const normalized=exact?String(typeof exact==="string"?exact:exact.value):final;
  if(!allowCustom&&!exact&&normalized){input.value=String(value??"");close();return}
  input.value=normalized;close();
  if(normalized!==String(value??"")){value=normalized;onCommit(normalized)}
 }
 function paint(){
  menu.replaceChildren();visible=searchSuggestions(options,input.value,36);highlight=Math.min(highlight,Math.max(visible.length-1,0));
  if(!visible.length){const message=document.createElement("div");message.className="autocomplete-empty";message.textContent=allowCustom?"No match — press Enter to use custom value":"No matching choices";menu.append(message)}
  visible.forEach((entry,i)=>{
   const item=document.createElement("button");item.type="button";item.setAttribute("role","option");
   item.className="autocomplete-option"+(highlight===i?" highlighted":"");
   item.textContent=entry.label||entry.value;item.title=entry.value;
   item.onpointerdown=e=>e.preventDefault();item.onclick=()=>commit(entry.value);
   menu.append(item)
  });
  menu.hidden=false;input.setAttribute("aria-expanded","true");
 }
 input.addEventListener("focus",()=>{hasFocus=true;highlight=0;paint()});
 input.addEventListener("input",()=>{highlight=0;paint()});
 input.addEventListener("keydown",e=>{
  if(e.key==="ArrowDown"){e.preventDefault();if(menu.hidden)paint();else{highlight=Math.min(visible.length-1,highlight+1);paint()} }
  else if(e.key==="ArrowUp"){e.preventDefault();highlight=Math.max(0,highlight-1);paint()}
  else if(e.key==="Enter"){e.preventDefault();if(!menu.hidden&&visible.length&&input.value.trim()&&highlight>=0)commit(visible[highlight].value);else commit(input.value)}
  else if(e.key==="Tab"){commit(input.value)}
  else if(e.key==="Escape"){input.value=String(value??"");close()}
 });
 input.addEventListener("blur",()=>{hasFocus=false;setTimeout(()=>{if(!hasFocus){if(document.activeElement?.closest?.(".autocomplete-menu")!==menu)commit(input.value)}},80)});
 return shell;
}
