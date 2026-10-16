import test from "node:test";
import assert from "node:assert/strict";
import {speciesEntries,readFields} from "../src/pokemon-source.js";
import {decodeDexExpression,encodeDexExpression,editDexDescription,sharedDexEntry,editSharedDexText,parseSimpleString,encodeSimpleString,dexEntryKind,entryWarnings} from "../src/pokedex-source.js";

const species=[
 '    [SPECIES_BULBASAUR] =',
 '    {',
 '        .speciesName = _("Bulbasaur"),',
 '        .categoryName = _("Seed"),',
 '        .height = 7,',
 '        .weight = 69,',
 '        .description = COMPOUND_STRING(',
 '            "It loves the warm sun.\\n"',
 '            "A bulb grows on its back."),',
 '    },',
 '    [SPECIES_PIKACHU] =',
 '    {',
 '        .description = gPikachuPokedexText,',
 '    },',
 ''
].join("\n");
const shared=[
 'const u8 gPikachuPokedexText[] = _(',
 '    "Electricity flows\\n"',
 '    "through its cheeks.");',
 'const u8 gEeveePokedexText[] = _("Unchanged.");',
 ''
].join("\n");

test("reads multiline inline Pokédex descriptions and formats line breaks",()=>{
 const expr=readFields(speciesEntries(species)[0].body).get("description").value;
 assert.equal(decodeDexExpression(expr),"It loves the warm sun.\nA bulb grows on its back.");
 assert.equal(decodeDexExpression(encodeDexExpression('A "quoted" word.\nNew line.')),'A "quoted" word.\nNew line.');
 assert.equal(decodeDexExpression('COMPOUND_STRING("a\\\\b")'),"a\\b");
 assert.equal(decodeDexExpression('COMPOUND_STRING("advanced\\p")'),null);
});
test("replaces only one species description, retaining formatting and neighboring Pokémon",()=>{
 const next=editDexDescription(species,"SPECIES_BULBASAUR","A new original entry.\nSecond sentence.");
 assert.equal(next.slice(next.indexOf("[SPECIES_PIKACHU]")),species.slice(species.indexOf("[SPECIES_PIKACHU]")));
 const body=speciesEntries(next).find(x=>x.id==="SPECIES_BULBASAUR").body;
 assert.equal(decodeDexExpression(readFields(body).get("description").value),"A new original entry.\nSecond sentence.");
 assert.throws(()=>editDexDescription(species,"SPECIES_NOT_DEFINED","Oops"),/not found/);
 assert.throws(()=>editDexDescription(species,"SPECIES_BULBASAUR",""),/description/);
});
test("loads and edits shared Pokédex text without modifying adjacent definitions",()=>{
 const original=sharedDexEntry(shared,"gPikachuPokedexText");
 assert.equal(original.text,"Electricity flows\nthrough its cheeks.");
 const next=editSharedDexText(shared,"gPikachuPokedexText","A shiny new entry.\nTwo lines.");
 assert.equal(sharedDexEntry(next,"gPikachuPokedexText").text,"A shiny new entry.\nTwo lines.");
 assert.equal(next.slice(next.indexOf("const u8 gEevee")),shared.slice(shared.indexOf("const u8 gEevee")));
 assert.throws(()=>editSharedDexText(shared,"gUnknownPokedexText","Hi"),/not found/);
});
test("handles names and advanced entry types safely",()=>{
 assert.equal(parseSimpleString('_("Seed")'),"Seed");
 assert.equal(parseSimpleString(encodeSimpleString('Pokémon "Star"')),'Pokémon "Star"');
 assert.equal(dexEntryKind("gPikachuPokedexText").kind,"shared");
 assert.equal(dexEntryKind("COMPOUND_STRING(\"Hi\")").kind,"inline");
 assert.equal(dexEntryKind("SPECIAL_DEX_MACRO(...)").kind,"advanced");
 assert.throws(()=>encodeSimpleString("Hi\nThere"),/one line/);
 assert.throws(()=>encodeDexExpression("Text\0control"),/control/);
});
test("reports layout warnings without forbidding longer user text",()=>{
 assert.deepEqual(entryWarnings("Short\nlines"),[]);
 assert.equal(entryWarnings("a\nb\nc\nd\ne").length,1);
 assert.match(entryWarnings("A".repeat(42))[0],/Long lines/);
});
