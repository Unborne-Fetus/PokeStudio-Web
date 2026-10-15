import test from "node:test";
import assert from "node:assert/strict";
import {catalog,mon,changeField,changeMeta,editMon,addMon,removeMon,shiftMon,renameMon,setMoves,replaceTrainer,monAsset,picAsset} from "../src/trainer-data.js";
import {decodeMapWord,encodeMapWord,parseJasc} from "../src/tilesets.js";
import {EditHistory} from "../src/history.js";
const sample=`/* Comments at the beginning of the trainer file */

=== TRAINER_TEST_ONE ===
Name: CASEY
Class: Cooltrainer
Pic: Leader Roxanne
Gender: Female
Music: Cool
Double Battle: No
AI: Check Viability

Persian Alola @ Leftovers
Level: 42
Ability: Fur Coat
IVs: 0 HP / 0 Atk / 0 Def / 0 SpA / 0 SpD / 0 Spe
- Fake Out
- Knock Off

Garchomp
Level: 45
Shiny: Yes
- Earthquake

=== TRAINER_TEST_TWO ===
Name: GRUNT
Pic: Aqua Grunt M

Zubat
Level: 12
`;
test("read trainer catalog and two Pokémon",()=>{
 const list=catalog(sample);assert.equal(list.length,2);
 assert.equal(list[0].meta.Name,"CASEY");assert.equal(list[0].pokemon.length,2);
 assert.equal(list[0].pokemon[0].species,"Persian Alola");
 assert.equal(list[0].pokemon[0].held,"Leftovers");
 assert.deepEqual(list[0].pokemon[0].moves,["Fake Out","Knock Off"]);
 assert.equal(list[0].pokemon[1].fields.Shiny,"Yes")
});
test("localized metadata and Pokémon updates preserve other trainer blocks",()=>{
 const first=catalog(sample)[0],modified=replaceTrainer(sample,first.id,changeMeta(first.raw,"Pic","Cynthia"));
 assert.equal(catalog(modified)[0].meta.Pic,"Cynthia");
 assert.equal(modified.slice(catalog(modified)[1].start),sample.slice(catalog(sample)[1].start));
 const local=editMon(catalog(modified)[0].raw,0,s=>changeField(s,"Level",61));
 assert.equal(catalog(local)[0].pokemon[0].fields.Level,"61");
 assert.equal(catalog(local)[0].pokemon[1].fields.Level,"45")
});
test("team add/remove/reorder and moves",()=>{
 const first=catalog(sample)[0];
 const added=addMon(first.raw);assert.equal(catalog(added)[0].pokemon.length,3);
 const removed=removeMon(added,2);assert.equal(catalog(removed)[0].pokemon.length,2);
 const shifted=shiftMon(removed,0,1);assert.equal(catalog(shifted)[0].pokemon[0].species,"Garchomp");
 const changed=editMon(shifted,0,block=>setMoves(renameMon(block,"Rayquaza","Life Orb"),["Dragon Ascent","Extreme Speed"]));
 assert.equal(catalog(changed)[0].pokemon[0].species,"Rayquaza");
 assert.deepEqual(catalog(changed)[0].pokemon[0].moves,["Dragon Ascent","Extreme Speed"])
});
test("trainer artwork paths match repository conventions",()=>{
 assert.equal(monAsset("Persian Alola"),"persian/alola");
 assert.equal(monAsset("SPECIES_PIKACHU"),"pikachu");
 assert.equal(picAsset("Leader Roxanne"),"leader_roxanne");
 assert.equal(picAsset("Aqua Grunt M"),"aqua_grunt_m")
});
test("map bitfield encoding preserves unrelated properties",()=>{
 const first=encodeMapWord(0,{id:513,collision:2,elevation:9});
 assert.deepEqual(decodeMapWord(first),{id:513,collision:2,elevation:9});
 assert.deepEqual(decodeMapWord(encodeMapWord(first,{id:9})),{id:9,collision:2,elevation:9});
 assert.deepEqual(decodeMapWord(encodeMapWord(first,{collision:1})),{id:513,collision:1,elevation:9});
 assert.deepEqual(decodeMapWord(encodeMapWord(first,{elevation:3})),{id:513,collision:2,elevation:3});
 assert.throws(()=>encodeMapWord(first,{id:1024}))
});
test("JASC palette parser reads real expansion palette lines",()=>{
 const palette=parseJasc("JASC-PAL\n0100\n3\n24 41 82\n255 255 255\n222 230 238\n");
 assert.deepEqual(palette,[[24,41,82],[255,255,255],[222,230,238]])
});
test("global history groups keystrokes and handles visual binary changes",()=>{
 const h=new EditHistory(20);
 h.record("script.c","","a",{typing:true});
 h.record("script.c","a","ab",{typing:true});
 assert.equal(h.past.length,1);
 const before=new Uint8Array([0,1]),after=new Uint8Array([3,4]);
 h.record("map.bin",before,after);
 after[0]=99;assert.equal(h.undo().value[0],0);
 assert.deepEqual([...h.redo().value],[3,4]);
 assert.equal(h.undo().path,"map.bin");
 assert.equal(h.undo().value,"");
 assert.equal(h.canUndo,false);
 assert.equal(h.canRedo,true)
});

import {trainerDropdownOptions,optionsWithCurrent} from "../src/trainer-options.js";
test("trainer dropdowns populate project-defined labels with distinct values",()=>{
 const trainers=[
  {meta:{Pic:"Leader Roxanne",Class:"Leader",Music:"Female",AI:"Check Viability",Gender:"Female","Double Battle":"No"}},
  {meta:{Pic:"Aqua Grunt M",Class:"Team Aqua",Music:"Aqua",AI:"Basic Trainer",Gender:"Male","Double Battle":"Yes"}},
  {meta:{Pic:"Leader Roxanne",Class:"Leader",Music:"Female",AI:"Check Viability"}}
 ];
 const list=trainerDropdownOptions(trainers,["graphics/trainers/front_pics/leader_roxanne.png"]);
 assert.deepEqual(list.Class.map(o=>o.value),["Leader","Team Aqua"]);
 assert.deepEqual(list.Music.map(o=>o.value),["Aqua","Female"]);
 assert.deepEqual(list.AI.map(o=>o.value),["Basic Trainer","Check Viability"]);
 assert.equal(list.Pic.find(o=>o.value==="Leader Roxanne").hasSprite,true);
 assert.deepEqual(list.Gender.map(o=>o.value),["Male","Female"]);
 assert.deepEqual(list["Double Battle"].map(o=>o.value),["No","Yes"])
});
test("nonstandard trainer dropdown values are preserved rather than overwritten",()=>{
 const dropdowns=trainerDropdownOptions([{meta:{AI:"Basic Trainer"}}]);
 assert.equal(optionsWithCurrent(dropdowns.AI,"Omniscient").at(0).value,"Omniscient");
 assert.equal(optionsWithCurrent(dropdowns.AI,"Basic Trainer").length,1);
 assert.equal(optionsWithCurrent(dropdowns.Gender,"").at(0).value,"")
});

import {isPlaceholderTrainer,pokemonChoiceLists,searchSuggestions,itemNamesFromHeader,ballNamesFromHeader} from "../src/autocomplete-data.js";
test("placeholder trainer entries are hidden by ID only and never removed from source",()=>{
 const sampleText=`=== TRAINER_NONE ===
Name:
Pic: Hiker

=== TRAINER_DUMMY_1 ===
Name: PLACEHOLDER
Pic: Hiker

=== TRAINER_GRUNT_AQUA_HIDEOUT_2 ===
Name: GRUNT
Pic: Aqua Grunt M

Blastoise
Level: 37
`;
 const all=catalog(sampleText),visible=all.filter(t=>!isPlaceholderTrainer(t));
 assert.deepEqual(visible.map(t=>t.id),["TRAINER_GRUNT_AQUA_HIDEOUT_2"]);
 const updated=replaceTrainer(sampleText,visible[0].id,changeMeta(visible[0].raw,"Name","ARCHIE"));
 assert.ok(updated.includes("=== TRAINER_GRUNT_AQUA_HIDEOUT_2 ===\nName: ARCHIE"));
 assert.ok(updated.startsWith("=== TRAINER_NONE ==="));
 assert.ok(updated.includes("=== TRAINER_DUMMY_1 ==="));
 assert.equal(updated.includes("=== TRAINER_ARCHIE ==="),false)
});
test("nature, held item, ball, Tera suggestion menus filter partial matches",()=>{
 const headers={items:"ITEM_POKE_BALL = 1,\nITEM_DIVE_BALL = 2,\nITEM_LEFTOVERS = 3,\nITEM_CHOICE_SCARF = 4,",pokemon:""};
 const choices=pokemonChoiceLists([{pokemon:[{held:"Eviolite",fields:{"Tera Type":"Fire",Nature:"Adamant",Ball:"Dive"}}]}],headers);
 assert.ok(choices.Nature.includes("Adamant"));
 assert.ok(choices["Tera Type"].includes("Fire"));
 assert.ok(choices.Ball.includes("Dive"));
 assert.ok(choices["Held item"].includes("Leftovers"));
 assert.ok(choices["Held item"].includes("Eviolite"));
 assert.equal(searchSuggestions(choices.Nature,"ada")[0].value,"Adamant");
 assert.equal(searchSuggestions(choices["Held item"],"left")[0].value,"Leftovers");
 assert.equal(searchSuggestions(choices.Ball,"div")[0].value,"Dive");
 assert.equal(searchSuggestions(choices["Tera Type"],"ste")[0].value,"Steel");
});
