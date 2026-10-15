import {createMetatileRenderer,decodeMapWord,encodeMapWord} from "./tilesets.js";
const E=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const button=(name,fn,cls="btn")=>{const b=E("button",cls,name);b.type="button";b.onclick=fn;return b};
const opt=(label,value)=>{const e=E("option","",label);e.value=value;return e};
const prop=(name,value,fn,type="text")=>{const label=E("label","form-field");label.append(E("span","",name));const input=E("input");input.type=type;input.value=String(value??"");input.onchange=()=>fn(type==="number"?Number(input.value):input.value);label.append(input);return label};
const EVENT_TYPES=[["NPCs and objects","object_events"],["Warps","warp_events"],["Triggers","coord_events"],["Signs / background","bg_events"]];
let lastMode="appearance",lastType="object_events",lastTile=0;
export async function mapStudio(api,root,rec){
 root.replaceChildren();
 if(!rec||!rec.path.endsWith("/map.json")){root.append(E("div","hint-card","Open a map's data/maps/<map>/map.json file to start the map studio. Click Maps under Quick open."));return}
 let map;try{map=JSON.parse(rec.value)}catch{root.append(E("div","warn","Map JSON is invalid; fix it in Code mode."));return}
 if(!map.layout){root.append(E("div","warn","This JSON has no map layout reference."));return}
 const path=rec.path;const isCurrent=()=>root.isConnected&&api.isCurrent(path);
 const header=E("div","visual-toolbar"),title=E("div");title.append(E("h2","",map.name||map.id),E("p","muted","Map Studio · "+path));header.append(title);
 const maps=api.paths().filter(p=>p.startsWith("data/maps/")&&p.endsWith("/map.json"));
 const mapPicker=E("select");mapPicker.className="map-picker";for(const p of maps)mapPicker.append(opt(p.split("/")[2],p));mapPicker.value=path;mapPicker.onchange=()=>api.open(mapPicker.value);header.append(mapPicker,E("span","spacer"),button("View source ↗",()=>api.setView("code")));
 root.append(header);
 const modes=E("div","map-modes"),stage=E("div","map-stage"),left=E("section","panel map-main"),right=E("section","panel map-inspector");
 stage.append(left,right);root.append(modes,stage);
 const canvasBox=E("div","canvas-shell map-canvas-shell"),canvas=E("canvas");canvasBox.append(canvas);
 const tools=E("div","visual-toolbar map-tools");left.append(tools,canvasBox);
 const foot=E("p","tile-legend");left.append(foot);
 let mode=lastMode,layout=null,renderer=null,words=null,wordPath=null,w=32,h=20,scale=24,painting=false,dragging=false,eventDragging=false,eventChanged=false,selectedEvent=-1,eventType=lastType,showGrid=true;
 const mapProps=E("details","map-properties"),mapSummary=E("summary","","Map settings & connections");mapProps.append(mapSummary);left.append(mapProps);
 const general=E("div","map-property-grid");
 mapProps.append(general);
 for(const key of ["music","weather","map_type","region_map_section","battle_scene","requires_flash","allow_cycling","allow_escaping","allow_running","show_map_name"]){
  if(!(key in map))continue;
  if(typeof map[key]==="boolean"){
   const lab=E("label","form-check"),input=E("input");input.type="checkbox";input.checked=map[key];input.onchange=()=>{map[key]=input.checked;saveMap()};lab.append(input,document.createTextNode(key));general.append(lab);
  }else general.append(prop(key,map[key],v=>{map[key]=v;saveMap()}))
 }
 const connectionBox=E("div","map-connections");mapProps.append(connectionBox);
 for(const con of map.connections||[]){const line=E("div","item-row",con.direction+" → "+con.map+" ("+con.offset+")");connectionBox.append(line)}
 function saveMap(){api.changeFor(path,JSON.stringify(map,null,2)+"\n")}
 function saveWords(){if(!wordPath||!words)return;const bytes=new Uint8Array(words.length*2),view=new DataView(bytes.buffer);words.forEach((v,i)=>view.setUint16(i*2,v,true));api.changeBytesFor(wordPath,bytes)}
 function gridPoint(e){const rect=canvas.getBoundingClientRect();const px=(e.clientX-rect.left)*(canvas.width/rect.width),py=(e.clientY-rect.top)*(canvas.height/rect.height);return {x:Math.floor(px/scale),y:Math.floor(py/scale)}}
 function eventList(){return map[eventType]||[]}
 const eventColors={object_events:"#faaf6e",warp_events:"#e3d36e",coord_events:"#e88eae",bg_events:"#b994df"};
 function draw(){
  canvas.width=w*scale;canvas.height=h*scale;const ctx=canvas.getContext("2d");if(!ctx)return;
  ctx.fillStyle="#342337";ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const word=words?words[y*w+x]:0,{id,collision,elevation}=decodeMapWord(word),px=x*scale,py=y*scale;
   let painted=false;if(renderer&&words)painted=renderer.draw(ctx,id,px,py,scale);
   if(!painted){ctx.fillStyle=words?`hsl(${(id*27+12)%360} 32% ${32+(id%6)*5}%)`:(x+y)%2?"#493347":"#51384e";ctx.fillRect(px,py,scale,scale)}
   if(mode==="collision"){
    if(collision){ctx.fillStyle=["transparent","#ef6078aa","#f1a554aa","#ad8ce9aa"][collision];ctx.fillRect(px,py,scale,scale)}
    ctx.font=Math.max(10,Math.floor(scale*.48))+"px monospace";ctx.fillStyle="#ffffff";ctx.textAlign="center";ctx.fillText(String(elevation),px+scale/2,py+scale*.67);
    ctx.textAlign="left"
   }
  }
  if(showGrid){ctx.strokeStyle="#f7e9db42";ctx.lineWidth=.55;for(let x=0;x<=w;x++){ctx.beginPath();ctx.moveTo(x*scale,0);ctx.lineTo(x*scale,h*scale);ctx.stroke()}for(let y=0;y<=h;y++){ctx.beginPath();ctx.moveTo(0,y*scale);ctx.lineTo(w*scale,y*scale);ctx.stroke()}}
  if(mode==="events"){
   for(const [kind,items] of Object.entries(map))if(eventColors[kind]&&Array.isArray(items)){
    items.forEach((ev,i)=>{const x=Number(ev.x),y=Number(ev.y);if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=w||y>=h)return;
      const px=x*scale,py=y*scale;
      ctx.fillStyle=eventColors[kind];ctx.strokeStyle=eventType===kind&&selectedEvent===i?"#fff6e5":"#2a1a20";ctx.lineWidth=eventType===kind&&selectedEvent===i?3:1.5;
      ctx.beginPath();ctx.roundRect(px+2,py+2,Math.max(5,scale-4),Math.max(5,scale-4),3);ctx.fill();ctx.stroke();
      ctx.font="bold "+Math.max(10,scale*.5)+"px system-ui";ctx.fillStyle="#30202a";ctx.textAlign="center";ctx.fillText(kind==="object_events"?"N":kind==="warp_events"?"W":kind==="coord_events"?"T":"S",px+scale/2,py+scale*.68);ctx.textAlign="left"
    })
   }
  }
 }
 function redrawModes(){
  modes.replaceChildren();
  for(const [name,key,sub] of [["Appearance","appearance","Paint tiles"],["Collision","collision","Walkability & elevation"],["Events","events","NPCs, warps & scripts"]]){
   const b=button(name,()=>{mode=key;lastMode=key;redrawModes();redrawControls();draw()},"map-mode"+(mode===key?" active":""));b.append(E("small","",sub));modes.append(b)
  }
 }
 let tileInput,collisionInput,elevationInput,brushType;
 function redrawControls(){
  tools.replaceChildren();right.replaceChildren();
  const zoom=E("input");zoom.type="range";zoom.min="12";zoom.max="42";zoom.value=scale;zoom.title="Map zoom";zoom.style.width="110px";
  tools.append(E("span","muted","Zoom"),zoom);
  const zoomText=E("span","muted",String(scale)+"px");tools.append(zoomText);
  zoom.oninput=()=>{scale=Number(zoom.value);zoomText.textContent=String(scale)+"px";draw()};
  const grid=E("label","form-check"),gridInput=E("input");gridInput.type="checkbox";gridInput.checked=showGrid;gridInput.onchange=()=>{showGrid=gridInput.checked;draw()};grid.append(gridInput,document.createTextNode("Grid"));tools.append(grid);
  if(mode==="appearance"){
   tools.append(E("span","muted","Brush"));
   tileInput=E("input");tileInput.type="number";tileInput.min="0";tileInput.max="1023";tileInput.value=lastTile;tileInput.style.width="82px";tools.append(tileInput);
   tileInput.onchange=()=>{lastTile=Math.max(0,Math.min(1023,Number(tileInput.value)||0));tileInput.value=lastTile;renderPalette()};
   const eye=button("⌖ Pick",()=>{brushType="pick";updateBrushLabel()});const paint=button("✎ Paint",()=>{brushType="paint";updateBrushLabel()});
   brushType=brushType||"paint";function updateBrushLabel(){eye.classList.toggle("active",brushType==="pick");paint.classList.toggle("active",brushType==="paint")}
   tools.append(paint,eye);updateBrushLabel();
   right.append(E("h3","","Metatile palette"),E("p","muted","Select a block to paint on the map. Tile painting preserves collision and elevation."));
   const pagination=E("div","visual-toolbar"),page=E("input");page.type="number";page.min="0";page.max="15";page.value=Math.floor(lastTile/64);page.style.width="65px";page.title="Palette page (64 tiles)";
   const prev=button("←",()=>{page.value=Math.max(0,Number(page.value)-1);renderPalette()}),next=button("→",()=>{page.value=Math.min(15,Number(page.value)+1);renderPalette()});
   pagination.append(prev,E("span","muted","Page"),page,E("span","muted","/ 15"),next);right.append(pagination);
   const gallery=E("div","metatile-gallery");right.append(gallery);
   page.onchange=()=>{page.value=Math.max(0,Math.min(15,Number(page.value)||0));renderPalette()};
   function renderPalette(){
    gallery.replaceChildren();
    const base=Number(page.value)*64;
    for(let id=base;id<base+64;id++){
     const btn=button("",()=>{lastTile=id;tileInput.value=id;renderPalette()},"metatile-choice"+(lastTile===id?" active":""));
     const preview=E("canvas");preview.width=32;preview.height=32;const cx=preview.getContext("2d");cx.imageSmoothingEnabled=false;
     if(!(renderer&&renderer.draw(cx,id,0,0,32))){cx.fillStyle="#684450";cx.fillRect(0,0,32,32)}
     btn.append(preview,E("small","",String(id)));gallery.append(btn)
    }
   }renderPalette();
   foot.textContent="Appearance: click a tile in the palette, then drag to paint. Pick samples a tile from the map. Changes are staged in map.bin.";
  }
  if(mode==="collision"){
   tools.append(E("span","muted","Collision"));collisionInput=E("select");
   for(const [label,num] of [["Passable · 0",0],["Blocked · 1",1],["Type 2",2],["Type 3",3]])collisionInput.append(opt(label,String(num)));tools.append(collisionInput);
   tools.append(E("span","muted","Elevation"));elevationInput=E("input");elevationInput.type="number";elevationInput.min="0";elevationInput.max="15";elevationInput.value="3";elevationInput.style.width="65px";tools.append(elevationInput);
   right.append(E("h3","","Collision editor"),E("p","muted","Paint collision and elevation values directly into the upper six bits of each metatile. The appearance ID stays unchanged."));
   const key=E("div","collision-legend");
   for(const [name,color] of [["Passable","#413040"],["Collision 1","#ef6078"],["Collision 2","#f1a554"],["Collision 3","#ad8ce9"]]){const row=E("div","legend-line");const swatch=E("span","legend-swatch");swatch.style.background=color;row.append(swatch,E("span","",name));key.append(row)}right.append(key);
   right.append(E("div","hint-card","The number on each cell shows elevation (0–15). You can paint collision and elevation together. These correspond to map.bin bitfields, not metatile behavior attributes."));
   foot.textContent="Collision: drag to paint both selected collision and elevation. Colors represent collision values; the numbered overlay represents elevation.";
  }
  if(mode==="events"){
   const events=E("select");for(const [label,key] of EVENT_TYPES)events.append(opt(label,key));events.value=eventType;
   events.onchange=()=>{eventType=events.value;lastType=eventType;selectedEvent=-1;buildEvents();draw()};tools.append(events);
   right.append(E("h3","","Event editor"));buildEvents();
   foot.textContent="Events: select and drag markers to reposition them. Edit their properties on the right. Changes update the map JSON.";
  }draw()
 }
 function paintCell(x,y){if(!words||x<0||y<0||x>=w||y>=h)return;
  const i=y*w+x,old=words[i],props=mode==="appearance"?{id:lastTile}:{collision:Number(collisionInput.value),elevation:Math.max(0,Math.min(15,Number(elevationInput.value)||0))};
  words[i]=encodeMapWord(old,props);draw()
 }
 function buildEvents(){
  if(mode!=="events")return;
  right.replaceChildren(E("h3","","Event editor"));
  const select=E("select");for(const [label,key] of EVENT_TYPES)select.append(opt(label,key));select.value=eventType;
  select.onchange=()=>{eventType=select.value;lastType=eventType;selectedEvent=-1;buildEvents();draw()};right.append(select);
  const list=E("div","event-item-list"),events=eventList();
  const actions=E("div","panel-actions");
  actions.append(button("+ Add event",()=>{
   const item=eventType==="object_events"?{graphics_id:"OBJ_EVENT_GFX_YOUNGSTER",x:0,y:0,elevation:3,movement_type:"MOVEMENT_TYPE_FACE_DOWN",movement_range_x:0,movement_range_y:0,trainer_type:"TRAINER_TYPE_NONE",trainer_sight_or_berry_tree_id:"0",script:"0x0",flag:"0"}
    :eventType==="warp_events"?{x:0,y:0,elevation:0,dest_map:"MAP_LITTLEROOT_TOWN",dest_warp_id:"0"}
    :eventType==="coord_events"?{type:"trigger",x:0,y:0,elevation:0,var:"VAR_TEMP_0",var_value:"0",script:"0x0"}
    :{type:"sign",x:0,y:0,elevation:0,player_facing_dir:"BG_EVENT_PLAYER_FACING_ANY",script:"0x0"};
   if(!map[eventType])map[eventType]=[];map[eventType].push(item);selectedEvent=map[eventType].length-1;saveMap();buildEvents();draw()
  },"btn primary"));
  if(selectedEvent>=0&&events[selectedEvent])actions.append(button("Delete",()=>{
   if(!confirm("Delete this "+eventType.replaceAll("_"," ")+" entry?"))return;
   events.splice(selectedEvent,1);selectedEvent=-1;saveMap();buildEvents();draw()
  }));right.append(actions);
  events.forEach((e,i)=>{
   const name=e.graphics_id||e.dest_map||e.script||e.type||"Event";
   list.append(button((i+1)+". "+name+" ("+e.x+","+e.y+")",()=>{selectedEvent=i;buildEvents();draw()},"event-item"+(i===selectedEvent?" active":"")))
  });right.append(list);
  const event=events[selectedEvent];if(!event){right.append(E("p","muted","Choose an event on the map, or add one."));return}
  right.append(E("h4","","Selected event"));
  for(const [key,value] of Object.entries(event)){
   if(value===null||typeof value==="object")continue;
   right.append(prop(key,value,v=>{event[key]=v;saveMap();if(key==="x"||key==="y")buildEvents();draw()},typeof value==="number"?"number":"text"))
  }
  if(event.script&&event.script!=="0x0")right.append(button("Open source explorer",()=>api.setView("code")));
 }
 canvas.onpointerdown=e=>{
  const {x,y}=gridPoint(e);if(x<0||y<0||x>=w||y>=h)return;
  if(mode==="events"){
   const list=eventList(),hit=list.findIndex(ev=>Number(ev.x)===x&&Number(ev.y)===y);
   selectedEvent=hit;eventDragging=hit>=0;eventChanged=false;
   if(eventDragging)canvas.setPointerCapture(e.pointerId);
   buildEvents();draw();return
  }
  if(!words){api.notify("The map layout is not loaded yet.","error");return}
  if(mode==="appearance"&&brushType==="pick"){lastTile=decodeMapWord(words[y*w+x]).id;redrawControls();return}
  painting=true;canvas.setPointerCapture(e.pointerId);paintCell(x,y)
 };
 canvas.onpointermove=e=>{
  const {x,y}=gridPoint(e);
  if(mode==="events"&&eventDragging&&selectedEvent>=0){
   if(x<0||y<0||x>=w||y>=h)return;
   const item=eventList()[selectedEvent];if(!item||item.x===x&&item.y===y)return;
   item.x=x;item.y=y;eventChanged=true;draw();return
  }
  if(painting)paintCell(x,y)
 };
 canvas.onpointerup=()=>{
  if(painting){painting=false;saveWords();api.notify("Map changes staged. Use Ctrl+Z to undo.","success")}
  if(eventDragging){eventDragging=false;if(eventChanged){eventChanged=false;saveMap();buildEvents();api.notify("Event moved. Use Ctrl+Z to undo.","success")}}
 };
 canvas.onpointercancel=canvas.onpointerup;
 redrawModes();redrawControls();
 try{
  const layoutFile=await api.loadRaw("data/layouts/layouts.json");if(!isCurrent())return;
  layout=JSON.parse(layoutFile.value).layouts?.find(l=>l.id===map.layout);if(!layout)throw Error("Layout not found: "+map.layout);
  w=Number(layout.width);h=Number(layout.height);if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>200000)throw Error("Invalid layout dimensions");
  wordPath=layout.blockdata_filepath;
  const binary=await api.loadRaw(wordPath);if(!isCurrent())return;
  if(!binary.isBinary||binary.bytes.length!==w*h*2)throw Error("Unexpected map.bin file length");
  const data=new DataView(binary.bytes.buffer,binary.bytes.byteOffset,binary.bytes.byteLength);
  words=new Uint16Array(w*h);for(let i=0;i<words.length;i++)words[i]=data.getUint16(i*2,true);
  api.notify("Loaded "+w+"×"+h+" map; loading colors and tiles…");draw();
  try{renderer=await createMetatileRenderer(api,layout);if(!isCurrent())return;
   api.notify("Loaded "+renderer.paletteInfoLine+" and tileset art for "+map.name+".","success");redrawControls()
  }catch(err){api.notify("Color tileset renderer unavailable: "+err.message+"; numeric/colored tile fallback is active.","error")}
 }catch(err){api.notify("Map events can be edited, but layout failed: "+err.message,"error")}
}
