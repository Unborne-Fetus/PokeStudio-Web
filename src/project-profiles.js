// Detect the actual repository layout, not its display name.
// Other projects remain usable through Code, JSON Inspector, Changes, and GitHub commits.
export const PROJECT_PRESETS=[
 {name:"Pokémon Brisk Emerald",repo:"Unborne-Fetus/Pokemon-Brisk-Emerald"},
 {name:"Pokémon Searing Sun",repo:"Unborne-Fetus/Pokemon-Seared-Sun"}
];
export const PROJECT_PROFILES={
 emerald:{
  id:"emerald",name:"pokeemerald-expansion",description:"GBA source project · maps, trainers, Pokémon, Pokédex and wild encounters",
  views:["code","map","trainers","pokemon","pokedex","encounters","data","sprites","changes"],
  encounterLabel:"◈ Encounters",quick:[
   {label:"🗺 Maps",path:"data/maps/"},
   {label:"🌿 Wild encounters",path:"src/data/wild_encounters.json"},
   {label:"⚔ Trainers",view:"trainers"},
   {label:"◉ Pokémon editor",view:"pokemon"},
   {label:"▤ Pokédex editor",view:"pokedex"},
   {label:"📋 Species & items",path:"src/data/"},
   {label:"⚙ Config",path:"include/config/"}
  ],canPlayWebEmu:true
 },
 searing:{
  id:"searing",name:"USUM / pk3DS patch project",description:"3DS patch-based project · edit sparse wild encounters and source/JSON files",
  views:["code","encounters","data","changes"],encounterLabel:"◈ Gen 7 Encounters",
  quick:[
   {label:"🌿 Gen 7 encounters",view:"encounters"},
   {label:"📝 Encounter overrides",path:"data/encounters/changes.json"},
   {label:"📍 Encounter locations",path:"data/encounters/locations.json"},
   {label:"📗 Encounter guide",path:"data/encounters/README.md"},
   {label:"🔧 Patch scripts",path:"tools/"}
  ],canPlayWebEmu:false
 },
 generic:{
  id:"generic",name:"General source project",description:"GitHub source workspace · text files, JSON inspector, review and commits",
  views:["code","data","changes"],encounterLabel:"◈ Encounters",
  quick:[{label:"📄 Project README",path:"README.md"},{label:"📁 Browse data",path:"data/"},{label:"⚙ Config",path:"config/"}],
  canPlayWebEmu:false
 }
};
export function detectProject(paths){
 const set=paths instanceof Set?paths:new Set(paths||[]);
 if(set.has("data/encounters/changes.json")&&set.has("tools/encounters.py"))return PROJECT_PROFILES.searing;
 if(set.has("include/constants/species.h")&&(
  set.has("src/data/trainers.party")||[...set].some(x=>x.startsWith("src/data/pokemon/species_info/"))
 ))return PROJECT_PROFILES.emerald;
 return PROJECT_PROFILES.generic;
}
export function presetForRepo(repo){
 return PROJECT_PRESETS.find(p=>p.repo.toLowerCase()===String(repo||"").trim().toLowerCase())||null;
}
export function supportsView(profile,view){
 return profile.views.includes(view);
}
