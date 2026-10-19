import test from "node:test";
import assert from "node:assert/strict";
import {GitHubWorkspace} from "../src/github.js";

test("Switching projects reads the new tree before replacing the active repository",async()=>{
 const workspace=new GitHubWorkspace();
 const calls=[];
 workspace.request=async path=>{
  calls.push(path);
  if(path==="/repos/Unborne-Fetus/Pokemon-Seared-Sun")return {default_branch:"main"};
  if(path.endsWith("/git/ref/heads/main"))return {object:{sha:"abc123"}};
  if(path.endsWith("/git/trees/abc123?recursive=1"))return {truncated:false,tree:[
   {path:"tools/encounters.py",type:"blob",sha:"tool",size:100},
   {path:"data/encounters/changes.json",type:"blob",sha:"data",size:41},
   {path:"src",type:"tree",sha:"folder"}
  ]};
  throw Error("Unexpected path "+path);
 };
 await workspace.connect("Unborne-Fetus/Pokemon-Seared-Sun","");
 assert.equal(workspace.repo,"Unborne-Fetus/Pokemon-Seared-Sun");
 assert.equal(workspace.branch,"main");
 assert.equal(workspace.head,"abc123");
 assert.deepEqual(workspace.tree.map(x=>x.path),["tools/encounters.py","data/encounters/changes.json"]);
 assert.equal(calls.length,3);
});
test("A failed new connection retains the original repository and source tree",async()=>{
 const workspace=new GitHubWorkspace();
 workspace.repo="Unborne-Fetus/Pokemon-Brisk-Emerald";workspace.branch="master";workspace.head="old";
 workspace.tree=[{path:"src/data/wild_encounters.json",sha:"original",size:100}];
 workspace.request=async path=>{
  if(path==="/repos/Unborne-Fetus/Pokemon-Seared-Sun")return {default_branch:"main"};
  if(path.endsWith("/git/ref/heads/main"))return {object:{sha:"abc123"}};
  throw Error("Permission denied or unavailable tree");
 };
 await assert.rejects(workspace.connect("Unborne-Fetus/Pokemon-Seared-Sun",""),/Permission denied/);
 assert.equal(workspace.repo,"Unborne-Fetus/Pokemon-Brisk-Emerald");
 assert.equal(workspace.branch,"master");
 assert.equal(workspace.head,"old");
 assert.deepEqual(workspace.tree.map(x=>x.sha),["original"]);
});
