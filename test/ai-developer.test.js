import test from "node:test";
import assert from "node:assert/strict";
import {developerPath,prepareDeveloperProposal,publishDeveloperPR,STUDIO_REPOSITORY} from "../src/ai-developer.js";
import {prompts} from "../src/ai-local.js";

test("Level 3 path allowlist excludes CI, worker, auth and dependency configuration",()=>{
 for(const path of [".github/workflows/deploy.yml","worker/ai-worker.js","src/github.js","src/ai-project.js","package.json","src/.env","src/private_key.js"])
  assert.equal(developerPath(path),false,path);
 assert.equal(developerPath("src/main.js"),true);
 assert.equal(developerPath("index.html"),true);
 assert.equal(developerPath("src/new-panel.js",true),true);
 assert.equal(developerPath("index.html",true),false);
});
test("Level 3 accepts reviewed literal edits and bounded new modules",()=>{
 const source=[{path:"src/demo.js",value:'export const caption="old";\n'}];
 const result=prepareDeveloperProposal({summary:"Add widget",edits:[
  {path:"src/demo.js",find:'caption="old"',replace:'caption="new"'}
 ],creates:[{path:"src/widget.js",content:"export const widget=true;\n"}]},source,["src/demo.js"]);
 assert.equal(result.changes.length,2);
 assert.equal(result.changes[0].after,'export const caption="new";\n');
 assert.equal(result.changes[1].created,true);
 assert.equal(result.changes[1].path,"src/widget.js");
});
test("Level 3 rejects collisions, unauthorized created paths and empty results",()=>{
 const source=[{path:"src/demo.js",value:"const x=1;\n"}];
 const response=creates=>({summary:"x",edits:[],creates});
 assert.throws(()=>prepareDeveloperProposal(response([{path:"src/demo.js",content:"data"}]),source,["src/demo.js"]),/existing/);
 assert.throws(()=>prepareDeveloperProposal(response([{path:".github/workflows/unsafe.yml",content:"data"}]),source,[]),/unsupported/);
 assert.throws(()=>prepareDeveloperProposal(response([]),source,[]),/usable/);
 assert.throws(()=>prepareDeveloperProposal({edits:[{path:"src/demo.js",find:"missing",replace:"x"}],creates:[]},source,[]),/not found/);
});
test("AI website prompt requires structured, minimal proposal instead of arbitrary shell actions",()=>{
 const messages=prompts({phase:"develop",instruction:"Create a shortcut",files:[{path:"src/main.js",value:"const x=1;"}]});
 assert.match(messages[0].content,/Reply ONLY JSON/);
 assert.match(messages[0].content,/no|never|No/i);
});
test("Level 3 GitHub workflow only pushes to an isolated ai-feature branch and drafts a PR",async()=>{
 const calls=[],gh={repo:STUDIO_REPOSITORY,branch:"main",head:"baseline",token:"fake",tree:[{path:"src/demo.js"}],
  request:async(path,options={})=>{
   calls.push({path,method:options.method||"GET",data:options.body?JSON.parse(options.body):null});
   if(path.endsWith("/git/ref/heads/main"))return {object:{sha:"baseline"}};
   if(path.endsWith("/git/commits/baseline"))return {tree:{sha:"base-tree"}};
   if(path.endsWith("/git/blobs"))return {sha:"new-blob"};
   if(path.endsWith("/git/trees"))return {sha:"new-tree"};
   if(path.endsWith("/git/commits"))return {sha:"new-commit"};
   if(path.endsWith("/pulls"))return {number:10,html_url:"https://github.com/Unborne-Fetus/PokeStudio-Web/pull/10"};
   return {};
  }
 };
 const changes={summary:"New button",changes:[{path:"src/demo.js",before:"old",after:"new",created:false},{path:"src/panel.js",before:null,after:"export const panel=true;",created:true}]};
 const result=await publishDeveloperPR(gh,changes,{nonce:"unit-test-1234",requestTitle:"Add toolbar button"});
 assert.equal(result.branch,"ai-feature/unit-test-1234");
 assert.equal(result.number,10);
 const refs=calls.filter(c=>c.method==="POST"&&c.path.endsWith("/git/refs"));
 assert.equal(refs.length,1);
 assert.equal(refs[0].data.ref,"refs/heads/ai-feature/unit-test-1234");
 const updated=calls.find(c=>c.method==="PATCH");
 assert.ok(updated.path.endsWith("/git/refs/heads/ai-feature/unit-test-1234"));
 assert.equal(updated.data.force,false);
 const pr=calls.find(c=>c.path.endsWith("/pulls"));
 assert.equal(pr.data.draft,true);assert.equal(pr.data.base,"main");
 assert.ok(!calls.some(c=>c.method!=="GET"&&c.path.endsWith("/git/refs/heads/main")));
});
test("Level 3 refuses publishing without permission or after the base branch moved",async()=>{
 const proposal={summary:"test",changes:[{path:"src/demo.js",after:"new",created:false}]};
 const gh={repo:STUDIO_REPOSITORY,branch:"main",head:"old",token:"fake",tree:[{path:"src/demo.js"}],request:async()=>({object:{sha:"new"}})};
 await assert.rejects(()=>publishDeveloperPR(gh,proposal,{nonce:"valid-nonce"}),/changed/);
 gh.token="";
 await assert.rejects(()=>publishDeveloperPR(gh,proposal,{nonce:"valid-nonce"}),/authorized/);
});
