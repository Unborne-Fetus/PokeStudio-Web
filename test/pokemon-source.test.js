import test from "node:test";
import assert from "node:assert/strict";
import {speciesEntries,readFields,editSpeciesField,arrayEntry,levelMoves,eggMoves,editLevelMoves,editEggMoves} from "../src/pokemon-source.js";
const sample=[
"#if P_FAMILY_BULBASAUR",
"    [SPECIES_BULBASAUR] =",
"    {",
"        .baseHP = 45,",
"        .types = MON_TYPES(TYPE_GRASS, TYPE_POISON),",
"        .abilities = { ABILITY_OVERGROW, ABILITY_NONE, ABILITY_CHLOROPHYLL },",
'        .description = COMPOUND_STRING("Seed, green"),',
"        .frontAnimFrames = ANIM_FRAMES(",
"            ANIMCMD_FRAME(0, 30),",
"            ANIMCMD_FRAME(1, 30),",
"        ),",
"        .evolutions = EVOLUTION({EVO_LEVEL, 16, SPECIES_IVYSAUR}),",
"    },",
"    [SPECIES_IVYSAUR] =",
"    {",
"        .baseHP = 60,",
"        .baseAttack = 62,",
"    },",
"#endif", ""
].join("\n");
test("species selection keeps nested macro content in its own block",()=>{
 const mons=speciesEntries(sample);
 assert.deepEqual(mons.map(x=>x.id),["SPECIES_BULBASAUR","SPECIES_IVYSAUR"]);
 const fields=readFields(mons[0].body);
 assert.equal(fields.get("types").value,"MON_TYPES(TYPE_GRASS, TYPE_POISON)");
 assert.equal(fields.get("abilities").value,"{ ABILITY_OVERGROW, ABILITY_NONE, ABILITY_CHLOROPHYLL }");
 assert.equal(fields.get("description").value,'COMPOUND_STRING("Seed, green")');
 assert.match(fields.get("frontAnimFrames").value,/ANIMCMD_FRAME\(1, 30\)/);
});
test("editing a field changes only that species",()=>{
 const next=editSpeciesField(sample,"SPECIES_BULBASAUR","baseHP","55");
 assert.match(next,/\.baseHP = 55,/);
 assert.match(next,/\.baseHP = 60,/);
 assert.equal(next.replace(".baseHP = 55,", ".baseHP = 45,"),sample);
 assert.throws(()=>editSpeciesField(sample,"SPECIES_IVYSAUR","baseHP","1; bad"),/Invalid/);
});
const level=[
"static const struct LevelUpMove sBulbasaurLevelUpLearnset[] = {",
"    LEVEL_UP_MOVE(1, MOVE_TACKLE),",
"    LEVEL_UP_MOVE(7, MOVE_LEECH_SEED),",
"    LEVEL_UP_END",
"};",
"static const struct LevelUpMove sIvysaurLevelUpLearnset[] = {",
"    LEVEL_UP_MOVE(1, MOVE_TACKLE),",
"    LEVEL_UP_END",
"};"
].join("\n");
test("level moves are edited in their own array with a sentinel",()=>{
 const original=arrayEntry(level,"sBulbasaurLevelUpLearnset");
 assert.deepEqual(levelMoves(original.body),[{level:1,move:"MOVE_TACKLE"},{level:7,move:"MOVE_LEECH_SEED"}]);
 const next=editLevelMoves(level,"sBulbasaurLevelUpLearnset",[{level:1,move:"MOVE_GROWL"}]);
 assert.match(next,/LEVEL_UP_MOVE\(1, MOVE_GROWL\)/);
 assert.match(next,/sIvysaurLevelUpLearnset\[\] = \{\n    LEVEL_UP_MOVE\(1, MOVE_TACKLE\)/);
 assert.throws(()=>editLevelMoves(level,"sBulbasaurLevelUpLearnset",[{level:200,move:"MOVE_TACKLE"}]),/Levels/);
});
const egg=[
"static const u16 sBulbasaurEggMoveLearnset[] = {",
"    MOVE_CHARM,",
"    MOVE_LEAF_STORM,",
"    MOVE_UNAVAILABLE,",
"};"
].join("\n");
test("egg moves can be read and edited without removing their terminator",()=>{
 assert.deepEqual(eggMoves(arrayEntry(egg,"sBulbasaurEggMoveLearnset").body),["MOVE_CHARM","MOVE_LEAF_STORM"]);
 const next=editEggMoves(egg,"sBulbasaurEggMoveLearnset",["MOVE_TACKLE"]);
 assert.match(next,/MOVE_TACKLE,\n    MOVE_UNAVAILABLE,/);
 assert.throws(()=>editEggMoves(egg,"sBulbasaurEggMoveLearnset",["bad"]),/Invalid/);
});
