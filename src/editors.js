/* Source-aware graphical editors. No game data is reinterpreted on disk unless a field is edited. */
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const btn=(label,onClick,cls="btn")=>{const b=el("button",cls,label);b.type="button";b.onclick=onClick;return b};
const option=(label,value)=>{const o=document.createElement("option");o.value=value;o.textContent=label;return o};
const field=(name,value,onChange,type="text")=>{const l=el("label","form-field"),t=el("span","",name),input=el("input");input.type=type;input.value=String(value??"");input.addEventListener("change",()=>onChange(type==="number"?Number(input.value):input.value));l.append(t,input);return l};
const booleanField=(name,value,onChange)=>{const l=el("label","form-check"),input=el("input");input.type="checkbox";input.checked=Boolean(value);input.onchange=()=>onChange(input.checked);l.append(input,document.createTextNode(name));return l};
const panel=(title)=>{const p=el("div","panel");p.append(el("h3","",title));return p};
const help=(text)=>el("p","muted",text);
function parse(record){if(!record||record.isBinary)return null;try{return JSON.parse(record.value)}catch{return null}}
function saveObject(api,path,data){api.changeFor(path,JSON.stringify(data,null,2)+"\n")}
function toolbar(root,title,subtitle){const bar=el("div","visual-toolbar"),head=el("div");head.append(el("h2","",title),help(subtitle));bar.append(head);root.append(bar);return bar}
function pick(root,values,selected,onChange){const select=el("select");for(const [text,value] of values)select.append(option(text,value));select.value=selected;select.onchange=()=>onChange(select.value);root.append(select);return select}
export async function renderVisual(view,api,root){
 root.replaceChildren();const rec=api.current();if(!rec){root.append(el("div","empty-editor","Open a file from the Explorer to use the visual editor."));return}
 if(view==="map")return renderMap(api,root,rec);
 if(view==="encounters")return renderEncounters(api,root,rec);
 if(view==="data")return renderInspector(api,root,rec);
}
export async function renderMap(api,root,rec){
 const isMap=rec.path.endsWith("/map.json")&&parse(rec)?.object_events;
 if(!isMap){root.append(el("div","hint-card","Choose a data/maps/<name>/map.json file to edit the map metadata and events. You can click Maps in the sidebar to browse."));return}
 const map=parse(rec);if(!map){root.append(help("Invalid map JSON. Fix it in Code mode."));return}
 const initialPath=rec.path,bar=toolbar(root,map.name||map.id,"Visual event editor • source file: "+initialPath);
 const paths=api.paths().filter(p=>p.startsWith("data/maps/")&&p.endsWith("/map.json"));
 const sel=pick(bar,paths.map(p=>[p.split("/")[2],p]),initialPath,p=>api.open(p));
 const sp=el("span","spacer");bar.append(sp,btn("Code ↗",()=>api.setView("code")));
 const wrap=el("div","visual-grid"),left=panel("Event placement and metatile grid"),right=panel("Event properties");root.append(wrap);wrap.append(left,right);
 const tools=el("div","visual-toolbar"),modeSelect=el("select"),types=[["Objects / NPCs","object_events"],["Warps","warp_events"],["Coord triggers","coord_events"],["Background events","bg_events"]];
 for(const [label,key] of types)modeSelect.append(option(label,key));tools.append(modeSelect);
 const zoom=el("input");zoom.type="range";zoom.min="12";zoom.max="40";zoom.value="24";zoom.title="Map zoom";zoom.style.width="90px";
 tools.append(el("span","muted","Zoom"),zoom);
 const paintToggle=btn("Paint metatiles: off",()=>{painting=!painting;paintToggle.textContent="Paint metatiles: "+(painting?"on":"off");draw()});
 tools.append(paintToggle);left.append(tools);
 const canvasShell=el("div","canvas-shell"),canvas=el("canvas");canvasShell.append(canvas);left.append(canvasShell);
 const notes=el("div","tile-legend","Objects: cyan · Warps: amber · Coord events: pink · Background events: purple. Drag events to move them. Toggle Paint metatiles to edit raw map.bin IDs.");left.append(notes);
 const editTools=el("div","visual-toolbar"),tileInput=el("input");tileInput.type="number";tileInput.min="0";tileInput.max="1023";tileInput.value="0";tileInput.style.width="82px";tileInput.title="Metatile index (0–1023)";editTools.append(el("span","muted","Metatile ID"),tileInput);left.append(editTools);
 const tilesNote=el("div","warn","Loading binary layout…");left.append(tilesNote);
 const meta=panel("Map properties");left.append(meta);
 const keys=["music","weather","map_type","region_map_section","battle_scene"];
 for(const key of keys){if(key in map)meta.append(field(key,map[key],value=>{map[key]=value;saveObject(api,initialPath,map)}))}
 for(const key of ["requires_flash","allow_cycling","allow_escaping","allow_running","show_map_name"]){if(key in map)meta.append(booleanField(key,map[key],value=>{map[key]=value;saveObject(api,initialPath,map)}))}
 const connections=panel("Connections");left.append(connections);
 for(const c of map.connections||[]){const row=el("div","item-row",c.direction+" → "+c.map+" (offset "+c.offset+")");connections.append(row)}
 let layout,bin,tiles,selected=-1,painting=false,dragging=false,dragged=false,scale=24;
 let w=32,h=20;
 function group(){return map[modeSelect.value]||[]}
 function draw(){
  scale=Number(zoom.value);canvas.width=w*scale;canvas.height=h*scale;
  const ctx=canvas.getContext("2d");if(!ctx)return;
  ctx.fillStyle="#152f43";ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const id=tiles?tiles[y*w+x]&1023:0;
   const hue=(id*67)%360;ctx.fillStyle=tiles?'hsl('+hue+' 27% '+(24+(id%7))+'%)':((x+y)%2?"#1e3749":"#223c50");
   ctx.fillRect(x*scale,y*scale,scale,scale);
   if(tiles&&scale>=25){ctx.fillStyle="#d7e7f1";ctx.font="9px monospace";ctx.fillText(String(id),x*scale+2,y*scale+10)}
  }
  ctx.strokeStyle="#acc7dd20";ctx.lineWidth=.5;
  for(let x=0;x<=w;x++){ctx.beginPath();ctx.moveTo(x*scale,0);ctx.lineTo(x*scale,h*scale);ctx.stroke()}
  for(let y=0;y<=h;y++){ctx.beginPath();ctx.moveTo(0,y*scale);ctx.lineTo(w*scale,y*scale);ctx.stroke()}
  const colors={object_events:"#69d8fa",warp_events:"#f9bd5c",coord_events:"#f38cb5",bg_events:"#c4a4ff"};
  for(const key of Object.keys(colors))for(let i=0;i<(map[key]||[]).length;i++){
    const ev=map[key][i],x=Number(ev.x),y=Number(ev.y);if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=w||y>=h)continue;
    ctx.fillStyle=colors[key];ctx.fillRect(x*scale+3,y*scale+3,scale-6,scale-6);
    ctx.fillStyle="#07131d";ctx.font="bold "+Math.max(10,scale*.48)+"px sans-serif";ctx.textAlign="center";ctx.fillText(key==="object_events"?"N":key==="warp_events"?"W":key==="coord_events"?"C":"B",x*scale+scale/2,y*scale+scale*.68);ctx.textAlign="left";
    if(key===modeSelect.value&&i===selected){ctx.strokeStyle="#fff";ctx.lineWidth=3;ctx.strokeRect(x*scale+1,y*scale+1,scale-2,scale-2)}
  }
 }
 function updateDetail(){
  right.replaceChildren(el("h3","","Event properties"));const key=modeSelect.value,events=group();
  const actions=el("div","panel-actions");
  actions.append(btn("+ Add event",()=>{
   const ev=key==="object_events"?{graphics_id:"OBJ_EVENT_GFX_YOUNGSTER",x:0,y:0,elevation:3,movement_type:"MOVEMENT_TYPE_FACE_DOWN",movement_range_x:0,movement_range_y:0,trainer_type:"TRAINER_TYPE_NONE",trainer_sight_or_berry_tree_id:"0",script:"0x0",flag:"0"}:key==="warp_events"?{x:0,y:0,elevation:0,dest_map:"MAP_LITTLEROOT_TOWN",dest_warp_id:"0"}:key==="coord_events"?{type:"trigger",x:0,y:0,elevation:0,var:"VAR_TEMP_0",var_value:"0",script:"0x0"}:{type:"sign",x:0,y:0,elevation:0,player_facing_dir:"DIR_NORTH",script:"0x0"};
   if(!map[key])map[key]=[];map[key].push(ev);selected=map[key].length-1;saveObject(api,initialPath,map);updateDetail();draw()
  }));
  if(selected>=0&&events[selected])actions.append(btn("Delete selected",()=>{if(!confirm("Remove selected event?"))return;events.splice(selected,1);selected=-1;saveObject(api,initialPath,map);updateDetail();draw()}));
  right.append(actions);
  const list=el("div","item-list");events.forEach((event,i)=>{
    const name=key==="object_events"?(event.graphics_id||event.local_id||"NPC"):key==="warp_events"?(event.dest_map||"Warp"):key==="coord_events"?"Trigger "+i:"Background "+i;
    const item=btn("#"+(i+1)+" "+name+" ("+event.x+","+event.y+")",()=>{selected=i;updateDetail();draw()},"item-row"+(i===selected?" active":""));list.append(item)
  });right.append(list);
  if(selected<0||!events[selected]){right.append(help("Select an event on the map or add a new one."));return}
  const event=events[selected];right.append(el("h4","","Selected event"));
  for(const key of Object.keys(event)){
   const v=event[key];if(v===null||Array.isArray(v)||typeof v==="object")continue;
   right.append(typeof v==="boolean"?booleanField(key,v,value=>{event[key]=value;saveObject(api,initialPath,map);draw()}):field(key,v,value=>{event[key]=value;saveObject(api,initialPath,map);draw();if(key==="x"||key==="y")updateDetail()},typeof v==="number"?"number":"text"));
  }
 }
 function coords(e){const rect=canvas.getBoundingClientRect();return {x:Math.floor((e.clientX-rect.left)*(canvas.width/rect.width)/scale),y:Math.floor((e.clientY-rect.top)*(canvas.height/rect.height)/scale)}}
 function putTile(x,y){if(!tiles||x<0||y<0||x>=w||y>=h)return;const id=Number(tileInput.value);if(!Number.isInteger(id)||id<0||id>1023)return;const i=y*w+x;tiles[i]=(tiles[i]&~1023)|id;draw()}
 canvas.onpointerdown=e=>{
  const {x,y}=coords(e);if(x<0||y<0||x>=w||y>=h)return;
  if(painting){if(!tiles){api.notify("Map layout is not available; cannot paint tiles.","error");return}dragging=true;putTile(x,y);canvas.setPointerCapture(e.pointerId);return}
  const index=group().findIndex(ev=>Number(ev.x)===x&&Number(ev.y)===y);
  if(index>=0){selected=index;dragging=true;dragged=false;canvas.setPointerCapture(e.pointerId);updateDetail();draw()}else{selected=-1;updateDetail();draw()}
 };
 canvas.onpointermove=e=>{if(!dragging)return;const {x,y}=coords(e);if(painting){putTile(x,y);return}if(selected>=0&&x>=0&&y>=0&&x<w&&y<h){group()[selected].x=x;group()[selected].y=y;dragged=true;draw()}};
 canvas.onpointerup=()=>{if(!dragging)return;dragging=false;if(painting&&tiles&&bin){const bytes=new Uint8Array(tiles.length*2);const data=new DataView(bytes.buffer);tiles.forEach((val,i)=>data.setUint16(i*2,val,true));api.changeBytesFor(bin.path,bytes)}else if(dragged){saveObject(api,initialPath,map);updateDetail()}};
 zoom.oninput=draw;modeSelect.onchange=()=>{selected=-1;updateDetail();draw()};updateDetail();draw();
 try{
  const layouts=await api.loadRaw("data/layouts/layouts.json");if(!root.isConnected||!api.isCurrent(initialPath))return;
  const obj=parse(layouts);layout=obj?.layouts?.find(l=>l.id===map.layout);if(!layout)throw Error("Layout "+map.layout+" was not found");
  w=Number(layout.width);h=Number(layout.height);if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>200000)throw Error("Unsupported map dimensions");
  const raw=await api.loadRaw(layout.blockdata_filepath);if(!api.isCurrent(initialPath))return;
  if(!raw.isBinary||raw.bytes.length!==w*h*2)throw Error("Map binary length does not match layout dimensions");
  bin={...raw,path:layout.blockdata_filepath};tiles=new Uint16Array(w*h);const data=new DataView(raw.bytes.buffer,raw.bytes.byteOffset,raw.bytes.byteLength);for(let i=0;i<tiles.length;i++)tiles[i]=data.getUint16(i*2,true);
  tilesNote.className="tile-legend";tilesNote.textContent="Layout: "+w+" × "+h+" • "+layout.blockdata_filepath+" • Raw metatile IDs. Native tileset artwork rendering is not yet supported; painting preserves existing collision/elevation bits.";
  draw()
 }catch(err){tilesNote.className="warn";tilesNote.textContent="Event editing is available, but map.bin could not be loaded: "+err.message;draw()}
}
export function renderEncounters(api,root,rec){
 const data=parse(rec);if(!data?.wild_encounter_groups){root.append(el("div","hint-card","Open src/data/wild_encounters.json for the expansion encounter editor."));return}
 const groups=data.wild_encounter_groups;
 const maps=[];for(let g=0;g<groups.length;g++)for(let i=0;i<(groups[g].encounters||[]).length;i++){const e=groups[g].encounters[i];maps.push({g,i,map:e.map||"Unknown",record:e})}
 const bar=toolbar(root,"Wild encounter editor",maps.length+" encounter definitions across "+groups.length+" groups · exact species and slot order preserved");
 let filtered=maps,chosen=maps[0]||null;
 const search=el("input");search.placeholder="Find MAP_ROUTE101…";search.style.minWidth="220px";bar.append(search);
 const select=el("select");select.style.maxWidth="280px";bar.append(select);
 function fillSelect(){select.replaceChildren();for(const e of filtered.slice(0,1000))select.append(option(e.map+(groups[e.g].label?" ["+groups[e.g].label+"]":""),e.g+":"+e.i));if(chosen&&filtered.includes(chosen))select.value=chosen.g+":"+chosen.i}
 const section=el("div");root.append(section);
 function render(){
  section.replaceChildren();if(!chosen){section.append(help("No map matches this filter."));return}
  const e=chosen.record,area=el("div","visual-grid"),left=panel("Encounter tables — "+e.map),right=panel("Map entry");area.append(left,right);section.append(area);
  for(const [key,value] of Object.entries(e)){
   if(key.endsWith("_mons")&&value&&Array.isArray(value.mons)){
     const subsection=panel(key.replaceAll("_"," "));left.append(subsection);
     subsection.append(field("Encounter rate",value.encounter_rate,v=>{value.encounter_rate=v;saveObject(api,rec.path,data)},"number"));
     const outer=el("div","table-scroll"),table=el("table","data-table"),header=el("tr");
     for(const t of ["Slot","Species","Minimum level","Maximum level",""])header.append(el("th","",t));table.append(header);
     value.mons.forEach((mon,index)=>{
      const row=el("tr");row.append(el("td","",String(index+1)));
      const species=el("input","species-input");species.value=String(mon.species||"");species.onchange=()=>{mon.species=species.value;saveObject(api,rec.path,data)};const sc=el("td");sc.append(species);row.append(sc);
      for(const prop of ["min_level","max_level"]){const cell=el("td"),input=el("input");input.type="number";input.min="1";input.max="100";input.value=mon[prop]??1;input.onchange=()=>{mon[prop]=Number(input.value);saveObject(api,rec.path,data)};cell.append(input);row.append(cell)}
      const actions=el("td");actions.append(btn("×",()=>{if(!confirm("Remove encounter slot "+(index+1)+"? This may break fixed slot-count configurations."))return;value.mons.splice(index,1);saveObject(api,rec.path,data);render()},"subtle"));row.append(actions);table.append(row)
     });outer.append(table);subsection.append(outer);
     subsection.append(el("p","muted","Existing slot counts are preserved while editing cells. Changing the number of slots can require corresponding engine configuration changes."));
    }
  }
  for(const [k,v] of Object.entries(e)){if(typeof v==="string"||typeof v==="number")right.append(field(k,v,x=>{e[k]=x;saveObject(api,rec.path,data)},typeof v==="number"?"number":"text"))}
  right.append(help("Brisk Emerald uses 25 land slots and 11 water slots. PokéStudio does not automatically rebalance encounter percentages."));
 }
 search.oninput=()=>{filtered=maps.filter(e=>e.map.toLowerCase().includes(search.value.toLowerCase()));chosen=filtered[0]||null;fillSelect();render()};
 select.onchange=()=>{const [g,i]=select.value.split(":").map(Number);chosen=maps.find(e=>e.g===g&&e.i===i)||null;render()};
 fillSelect();render()
}
export function renderInspector(api,root,rec){
 if(rec.path.endsWith(".party"))return renderTrainerFile(api,root,rec);
 const data=parse(rec);if(!data){root.append(el("div","hint-card","Choose a valid JSON file for the structured inspector, or a trainers.party file for the trainer block editor."));return}
 toolbar(root,"Structured JSON inspector","Edit primitive values while retaining all unrecognized keys and structures.");
 const filter=el("input");filter.placeholder="Filter keys…";filter.style.width="min(450px,100%)";root.append(filter);
 const content=el("div","panel");content.style.marginTop="12px";root.append(content);
 function display(){content.replaceChildren();let count=0;function walk(node,path,depth){
   if(count>300){return}for(const [key,value] of Object.entries(node)){
     if(count++>300){content.append(help("Showing first 300 properties. Filter to narrow results."));return}
     const full=[...path,key],label="  ".repeat(depth)+key;
     if(typeof value==="object"&&value!==null){if(depth>=3||Array.isArray(value)&&value.length>60){content.append(el("div","muted",label+" • "+(Array.isArray(value)?value.length+" entries":"object")));continue}const details=el("details");details.open=depth<1;const sum=el("summary","",label+" "+(Array.isArray(value)?"["+value.length+"]":"{}"));details.append(sum);details.style.paddingLeft=(depth*11)+"px";const holder=el("div");details.append(holder);content.append(details);const old=content;content=holder;walk(value,full,depth+1);content=old}
     else if(typeof value==="boolean")content.append(booleanField(label,value,x=>{node[key]=x;saveObject(api,rec.path,data)}));
     else content.append(field(label,value??"",x=>{node[key]=x;saveObject(api,rec.path,data)},typeof value==="number"?"number":"text"));
   }
  }walk(data,[],0)
 }
 // Limit inspector work on giant JSON and retain the original structure.
 filter.oninput=()=>{const q=filter.value.toLowerCase().trim();if(!q)return display();content.replaceChildren();let displayed=0;
  function scan(obj,path=[]){if(displayed>=150)return;for(const [key,value] of Object.entries(obj)){if(displayed>=150)return;const pathName=[...path,key].join(".");if(value!==null&&typeof value==="object"){scan(value,[...path,key]);continue}if(!pathName.toLowerCase().includes(q))continue;displayed++;content.append(typeof value==="boolean"?booleanField(pathName,value,x=>{obj[key]=x;saveObject(api,rec.path,data)}):field(pathName,value??"",x=>{obj[key]=x;saveObject(api,rec.path,data)},typeof value==="number"?"number":"text"))}}
  scan(data)
 };display()
}
function renderTrainerFile(api,root,rec){
 const text=rec.value;const rx=/^===\s*(TRAINER_[A-Z0-9_]+)\s*===\s*$/gm;const matches=[...text.matchAll(rx)];
 toolbar(root,"Trainer party editor",matches.length+" trainers · preserves source syntax and unchanged trainers");
 if(!matches.length){root.append(help("No trainer blocks found. Edit this file in Code mode."));return}
 const bar=el("div","visual-toolbar"),filter=el("input");filter.placeholder="Find trainer ID…";bar.append(filter);
 const select=el("select");select.style.maxWidth="410px";bar.append(select);root.append(bar);
 const editor=el("textarea");editor.spellcheck=false;editor.style.width="100%";editor.style.height="min(62vh,650px)";editor.style.font="13px/1.6 ui-monospace,Consolas,monospace";root.append(editor);
 const actions=el("div","panel-actions");root.append(actions);
 let selected=0;
 function renderOptions(){select.replaceChildren();matches.forEach((m,i)=>{if(m[1].toLowerCase().includes(filter.value.toLowerCase()))select.append(option(m[1],String(i)))});if(!select.options.length)return;selected=Number(select.value||select.options[0].value);renderBlock()}
 function renderBlock(){if(!matches[selected])return;const begin=matches[selected].index,end=matches[selected+1]?.index??text.length;editor.value=text.slice(begin,end).trimEnd()+"\n"}
 filter.oninput=renderOptions;select.onchange=()=>{selected=Number(select.value);renderBlock()};
 actions.append(btn("Apply selected trainer block",()=>{
   const begin=matches[selected]?.index,end=matches[selected+1]?.index??text.length;
   if(begin==null)return;const updated=text.slice(0,begin)+editor.value.trimEnd()+"\n\n"+text.slice(end);
   api.changeFor(rec.path,updated);api.notify("Trainer block edited. Reopen the trainer inspector to refresh offsets.","success");api.setView("code")
 },"btn primary"));
 actions.append(btn("Go to code",()=>api.setView("code")));renderOptions()
}
