import test from "node:test";
import assert from "node:assert/strict";
import {isTotemSpecies} from "../src/species-visibility.js";
import {speciesEntries,readFields} from "../src/pokemon-source.js";

test("Totem forms are hidden regardless of where TOTEM occurs in the ID",()=>{
 for(const id of [
  "SPECIES_RATICATE_ALOLA_TOTEM",
  "SPECIES_GUMSHOOS_TOTEM",
  "SPECIES_MIMIKYU_TOTEM_DISGUISED",
  "SPECIES_MIMIKYU_BUSTED_TOTEM",
  "SPECIES_MAROWAK_ALOLA_TOTEM",
  "SPECIES_TOTEM_CUSTOM"
 ])assert.equal(isTotemSpecies(id),true,id);
});
test("Ordinary forms and custom Megas stay visible",()=>{
 for(const id of [
  "SPECIES_AEGISLASH_BLADE",
  "SPECIES_AEGISLASH_SHIELD",
  "SPECIES_AMOONGUSS_MEGA",
  "SPECIES_MIMIKYU_BUSTED",
  "SPECIES_RATICATE_ALOLA",
  "SPECIES_TOTEMLESS"
 ])assert.equal(isTotemSpecies(id),false,id);
});
test("The ROM isTotem flag also hides custom Totems without TOTEM in their names",()=>{
 const source=[
  "[SPECIES_GUMSHOOS] = { .isTotem = FALSE, },",
  "[SPECIES_SPECIAL_VARIANT] = { .isTotem = TRUE, },",
  "[SPECIES_RIBOMBEE_TOTEM] = { .isTotem = TRUE, },",
  "[SPECIES_RIBOMBEE] = { .baseHP = 60, },"
 ].join("\n");
 const shown=speciesEntries(source).filter(entry=>!isTotemSpecies(entry.id,readFields(entry.body))).map(entry=>entry.id);
 assert.deepEqual(shown,["SPECIES_GUMSHOOS","SPECIES_RIBOMBEE"]);
 // This is strictly a browser filter: the underlying species text is unchanged.
 assert.match(source,/SPECIES_SPECIAL_VARIANT/);
});
