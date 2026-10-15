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
