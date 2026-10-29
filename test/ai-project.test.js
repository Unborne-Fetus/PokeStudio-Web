import test from "node:test";
import assert from "node:assert/strict";
import {candidatePaths,selectFiles,prepareProposal,validateEndpoint,callGateway} from "../src/ai-project.js";
import {EditHistory} from "../src/history.js";
import worker from "../worker/ai-worker.js";

test("candidate selection favors active and relevant editable text, not binary",()=>{
 const list=["data/maps/Route101/map.json","graphics/sprites/pikachu.png","README.md","src/data/trainers.party"];
 const ranked=candidatePaths(list,"change the Route101 map encounter",list[0]);
 assert.equal(ranked[0],list[0]);
 assert.ok(!ranked.includes(list[1]));
 assert.deepEqual(selectFiles({files:[list[0]]},ranked),[list[0]]);
 assert.throws(()=>selectFiles({files:[".github/workflows/unlisted.yml"]},ranked),/unsupported/);
 assert.throws(()=>selectFiles({files:[]},ranked),/unsupported/);
});
test("patch plans only apply unique literal replacements to supplied paths",()=>{
 const files=[{path:"data/maps/Test/map.json",value:'{"music":"MUS_A","weather":"NONE"}\n'}];
 const p=prepareProposal({summary:"Switch music",edits:[{path:files[0].path,find:'"music":"MUS_A"',replace:'"music":"MUS_B"'}]},files);
 assert.equal(JSON.parse(p.changes[0].after).music,"MUS_B");
 assert.equal(files[0].value.includes("MUS_A"),true);
 assert.equal(p.operations,1);
});
test("multiple source patches are staged atomically and undo as a single item",()=>{
 const files=[{path:"a.json",value:'{"x":1}\n'},{path:"b.json",value:'{"x":2}\n'}];
 const p=prepareProposal({edits:[
  {path:"a.json",find:"1",replace:"3"},
  {path:"b.json",find:"2",replace:"4"}
 ]},files);
 const history=new EditHistory();
 assert.equal(history.recordBatch(p.changes),true);
 assert.equal(history.past.length,1);
 const undone=history.undo().batch;
 assert.deepEqual(undone.map(edit=>edit.value),files.map(file=>file.value));
 const redone=history.redo().batch;
 assert.deepEqual(redone.map(edit=>JSON.parse(edit.value).x),[3,4]);
});
test("patch validator fails closed on hallucinations and ambiguous or malformed edits",()=>{
 const source=[{path:"test.json",value:'{"a":1,"b":1}\n'}];
 const valid=(edits)=>prepareProposal({edits},source);
 assert.throws(()=>valid([{path:"other.json",find:"x",replace:"y"}]),/unsupported path/);
 assert.throws(()=>valid([{path:"test.json",find:"1",replace:"2"}]),/multiple times/);
 assert.throws(()=>valid([{path:"test.json",find:"missing",replace:"2"}]),/not found/);
 assert.throws(()=>valid([{path:"test.json",find:'"a":1',replace:'"a":'}]),/invalid JSON/);
 assert.throws(()=>valid([{path:"test.json",find:"",replace:"2"}]),/safety limits/);
 assert.throws(()=>valid([{path:"test.json",find:'"a":1',replace:'"a":1'}]),/no changes/);
});
test("AI gateway only accepts HTTPS and loopback development endpoints",()=>{
 assert.equal(validateEndpoint("https://sample.workers.dev"),"https://sample.workers.dev/");
 assert.ok(validateEndpoint("http://localhost:8787").startsWith("http://localhost"));
 assert.throws(()=>validateEndpoint("http://example.com"),/HTTPS/);
 assert.throws(()=>validateEndpoint("https://user:pass@example.com"),/HTTPS/);
});
test("AI gateway does not leak a GitHub credential in request body",async()=>{
 let sent;
 const fetcher=async(url,options)=>{sent={url,options};return {ok:true,json:async()=>({files:["a.json"]})}};
 await callGateway("https://ai.example.com","TEMP_ACCESS",{phase:"select",instruction:"Update text",paths:["a.json"]},fetcher);
 assert.equal(sent.options.headers["X-PokeStudio-Access"],"TEMP_ACCESS");
 assert.ok(!sent.options.body.includes("TEMP_ACCESS"));
 assert.ok(!sent.options.body.includes("github"));
});
test("worker rejects other origins and missing access tokens without calling a model",async()=>{
 const env={ALLOWED_ORIGIN:"https://unborne-fetus.github.io",OPENAI_API_KEY:"unit-test",STUDIO_ACCESS_TOKEN:"testing"};
 const offsite=new Request("https://worker.example.com",{method:"POST",headers:{"Origin":"https://evil.example.com"}});
 assert.equal((await worker.fetch(offsite,env)).status,403);
 const publicRequest=new Request("https://worker.example.com",{method:"POST",headers:{"Origin":env.ALLOWED_ORIGIN}});
 assert.equal((await worker.fetch(publicRequest,env)).status,401);
});
