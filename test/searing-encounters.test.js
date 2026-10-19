import test from "node:test";
import assert from "node:assert/strict";
import {
 readChanges,parseSpeciesNames,parseLocationNames,parseSpeciesInput,validateChanges,
 updateTable,removeTable,updateSlot,removeSlot,updateRate,removeRate,serializeChanges
} from "../src/searing-encounter-source.js";
import {readReferenceCsv,effectiveRates,referenceErrors} from "../src/searing-reference.js";

const fresh=()=>readChanges('{"format_version":1,"edits":[]}\n');
const example={file:9,pair:0,time:"day",slots:[{set:0,slot:0,species:25,form:0}]};
test("Searing Sun's existing empty sparse override file loads without inventing game tables",()=>{
 assert.deepEqual(fresh(),{format_version:1,edits:[]});
 assert.throws(()=>readChanges('{"foo":1}'),/format_version/);
 assert.deepEqual(validateChanges(fresh()),[]);
});
test("Creating, revising and removing a sparse table preserves unrelated overrides",()=>{
 const start=updateTable(fresh(),null,example);
 assert.equal(start.edits.length,1);
 const second=updateTable(start,null,{file:10,pair:2,time:"night",rates:[{slot:0,value:30}]});
 const changed=updateTable(second,0,{...example,min_level:8,max_level:10});
 assert.equal(changed.edits[0].min_level,8);
 assert.deepEqual(changed.edits[1],second.edits[1]);
 assert.deepEqual(start.edits[0],example);
 assert.equal(readChanges(serializeChanges(changed)).edits.length,2);
 assert.deepEqual(removeTable(changed,0).edits,[second.edits[1]]);
});
test("SOS sets permit only six slots in set eight",()=>{
 const invalid={...example,slots:[{set:8,slot:6,species:25,form:0}]};
 assert.match(validateChanges({format_version:1,edits:[invalid]})[0],/6/);
 assert.deepEqual(validateChanges({format_version:1,edits:[{...example,slots:[{set:8,slot:5,species:25,form:0}]}]}),[]);
});
test("Duplicates, invalid forms, rates and levels are blocked",()=>{
 assert.match(validateChanges({format_version:1,edits:[example,example]}).join(" "),/duplicate file\/pair\/time/);
 assert.match(validateChanges({format_version:1,edits:[{...example,slots:[{set:0,slot:0,species:25,form:32}]}]}).join(" "),/form/);
 assert.match(validateChanges({format_version:1,edits:[{...example,min_level:20,max_level:10}]}).join(" "),/minimum/);
 assert.match(validateChanges({format_version:1,edits:[{...example,rates:Array.from({length:10},(_,i)=>({slot:i,value:9}))}]}).join(" "),/90%/);
 assert.match(validateChanges({format_version:1,edits:[{...example,slots:[{set:0,slot:0,species:25},{set:0,slot:0,species:12}]}]}).join(" "),/duplicate/);
});
test("Adding and removing individual slots/rates never changes others",()=>{
 const first=updateSlot(example,null,{set:8,slot:5,species:7,form:1});
 assert.equal(first.slots.length,2);
 assert.equal(example.slots.length,1);
 assert.equal(updateSlot(first,0,{set:0,slot:0,species:1}).slots[1].species,7);
 assert.equal(removeSlot(first,0).slots[0].species,7);
 const rate=updateRate(example,null,{slot:0,value:20});
 const rate2=updateRate(rate,null,{slot:1,value:80});
 assert.deepEqual(removeRate(rate2,0).rates,[{slot:1,value:80}]);
});
test("Gen 7 Pokémon names resolve to IDs including non-ASCII",()=>{
 const names=parseSpeciesNames('{"25":"Pikachu","29":"Nidoran♀","30":"Nidorina","808":"Custom","999":"Custom"}');
 assert.equal(parseSpeciesInput("Pikachu",names),25);
 assert.equal(parseSpeciesInput("25 — Pikachu",names),25);
 assert.equal(parseSpeciesInput("nidoran♀",names),29);
 assert.equal(parseSpeciesInput("1300",names),1300);
 assert.throws(()=>parseSpeciesInput("Custom",names),/ambiguous/);
 const loc=parseLocationNames('{"format_version":1,"files":{"9":{"name":"Route 1"}}}');
 assert.equal(loc.get(9),"Route 1");
});
const csv=[
 "file,location,zone_ids,pair,time,set,slot,species,species_name,form,rate,min_level,max_level",
 "9,\"Hau'oli City, Beach\",22,0,day,0,0,25,Pikachu,0,20,5,7",
 "9,\"Hau'oli City, Beach\",22,0,day,0,1,133,Eevee,0,80,5,7",
 "9,\"Hau'oli City, Beach\",22,0,day,8,5,25,Pikachu,0,,5,7"
].join("\n");
test("Local reference CSV handles quoted locations and SOS sets",()=>{
 const table=readReferenceCsv(csv).get("9:0:day");
 assert.equal(table.location,"Hau'oli City, Beach");
 assert.equal(table.slots.get("8:5").species,25);
 assert.equal(table.rates.get(0),20);
 assert.equal(table.min_level,5);
 assert.throws(()=>readReferenceCsv("wrong,data\nhello,world"),/missing/);
});
test("Original rates are checked when all ten rows are available",()=>{
 const full=["file,location,zone_ids,pair,time,set,slot,species,species_name,form,rate,min_level,max_level"];
 for(let i=0;i<10;i++)full.push("9,Route 1,12,0,day,0,"+i+",25,Pikachu,0,"+(i===0?100:0)+",5,10");
 const baseline=readReferenceCsv(full.join("\n")).get("9:0:day");
 assert.equal(effectiveRates({rates:[]},baseline).reduce((a,b)=>a+b,0),100);
 assert.deepEqual(referenceErrors({rates:[{slot:0,value:50}]},baseline),["Effective encounter rates total 50%; the game requires 0% or 100%."]);
 assert.deepEqual(referenceErrors({rates:[{slot:0,value:50},{slot:1,value:50}]},baseline),[]);
 assert.match(referenceErrors({min_level:11},baseline).join(" "),/minimum level/);
});
