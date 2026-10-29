import test from "node:test";
import assert from "node:assert/strict";
import {PROJECT_PRESETS,detectProject,presetForRepo,supportsView} from "../src/project-profiles.js";

const brisk=[
 "include/constants/species.h",
 "src/data/trainers.party",
 "src/data/pokemon/species_info/gen_1_families.h",
 "src/data/wild_encounters.json"
];
const searing=[
 "README.md",
 "data/encounters/changes.json",
 "data/encounters/locations.json",
 "data/encounters/species_names_gen7.json",
 "tools/encounters.py"
];
test("Emerald source repositories keep their complete visual editors",()=>{
 const profile=detectProject(brisk);
 assert.equal(profile.id,"emerald");
 for(const view of ["code","ai","map","trainers","pokemon","pokedex","encounters","data","sprites","changes"])
  assert.equal(supportsView(profile,view),true);
 assert.ok(profile.canPlayWebEmu);
});
test("Searing Sun patch projects open the genuine Gen 7 encounter editor",()=>{
 const profile=detectProject(searing);
 assert.equal(profile.id,"searing");
 for(const view of ["code","ai","encounters","data","changes"])
  assert.equal(supportsView(profile,view),true);
 for(const view of ["map","pokemon","pokedex","trainers","sprites"])
  assert.equal(supportsView(profile,view),false);
 assert.equal(profile.canPlayWebEmu,false);
 assert.match(profile.encounterLabel,/Gen 7/);
});
test("Unknown projects still support general GitHub source edits and commits",()=>{
 assert.equal(detectProject(["README.md","config/settings.json"]).id,"generic");
 assert.deepEqual(detectProject([]).views,["code","ai","data","changes"]);
 assert.equal(detectProject(new Set(searing)).id,"searing");
});
test("Known project presets use real repositories; custom names are accepted",()=>{
 assert.equal(presetForRepo("unborne-fetus/pokemon-brisk-emerald").repo,PROJECT_PRESETS[0].repo);
 assert.equal(presetForRepo("Unborne-Fetus/Pokemon-Seared-Sun").repo,PROJECT_PRESETS[1].repo);
 assert.equal(presetForRepo("unborne-fetus/unlisted-rom-hack"),null);
});
