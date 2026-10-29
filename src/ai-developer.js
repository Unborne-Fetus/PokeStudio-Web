/* Level 3: owner-reviewed PokéStudio feature proposals. Never touches main directly.
 * All GitHub writes are triggered by an explicit user click and use their own
 * in-memory GitHub PAT; neither token nor network permissions go to the AI. */
import {prepareProposal,editableAIPath} from "./ai-project.js";

export const STUDIO_REPOSITORY="Unborne-Fetus/PokeStudio-Web";
const LIMIT_NEW_FILES=2;
const LIMIT_NEW_CHARS=7500;
const LIMIT_EXISTING_EDITS=4;
export function developerPath(path,creating=false){
 if(!editableAIPath(path))return false;
 const normalized=path.toLowerCase();
 if(normalized.startsWith("worker/")||normalized.startsWith(".github/")||normalized.startsWith("node_modules/"))return false;
 if(/^src\/(?:ai-|github\.js|rom-bridge\.js)/.test(normalized))return false;
 if(creating)return /^(src|test)\/[\w/-]+\.(?:js|css|json)$/.test(path);
 return /^(?:src\/[\w/-]+\.(?:js|css|json)|test\/[\w/-]+\.js|index\.html|style\.css|readme\.md)$/i.test(path);
}
export function prepareDeveloperProposal(response,sourceFiles,existingPaths){
 if(!response||!Array.isArray(response.edits)||!Array.isArray(response.creates))throw Error("AI returned an invalid feature plan.");
 if(response.edits.length>32||response.creates.length>LIMIT_NEW_FILES)throw Error("Feature proposal exceeds review limits.");
 const known=new Set(existingPaths);
 const inputs=sourceFiles.filter(f=>developerPath(f.path));
 if(inputs.length!==sourceFiles.length||new Set(inputs.map(f=>f.path)).size!==inputs.length)throw Error("Unsupported or duplicate source path.");
 if(inputs.length>LIMIT_EXISTING_EDITS)throw Error("Too many files in the feature proposal.");
 let updated=[];
 if(response.edits.length){
  const proposal=prepareProposal({edits:response.edits},inputs);
  updated=proposal.changes.map(x=>({path:x.path,before:x.before,after:x.after,created:false}));
 }
 const creations=[];
 for(const created of response.creates){
  if(!created||!developerPath(created.path,true)||known.has(created.path)||typeof created.content!=="string"||!created.content.trim()||created.content.length>LIMIT_NEW_CHARS)throw Error("AI requested an unsupported, existing or oversized new file.");
  if(creations.some(f=>f.path===created.path))throw Error("Duplicate created path.");
  if(created.path.endsWith(".json"))try{JSON.parse(created.content)}catch{throw Error("New JSON file is invalid.")}
  creations.push({path:created.path,before:null,after:created.content,created:true});
 }
 if(!updated.length&&!creations.length)throw Error("AI did not produce usable source changes.");
 return {summary:String(response.summary||"Proposed PokéStudio feature").slice(0,600),changes:[...updated,...creations]};
}
export async function publishDeveloperPR(gh,proposal,{requestTitle,nonce}={}){
 if(!gh?.token)throw Error("An authorized GitHub token is needed to create a feature pull request.");
 if(gh.repo!==STUDIO_REPOSITORY||gh.branch!=="main"||!gh.head)throw Error("Developer mode only publishes isolated branches against PokéStudio main.");
 if(!proposal||!Array.isArray(proposal.changes)||!proposal.changes.length||proposal.changes.length>LIMIT_EXISTING_EDITS+LIMIT_NEW_FILES)throw Error("Invalid feature proposal.");
 const now=await gh.request("/repos/"+STUDIO_REPOSITORY+"/git/ref/heads/main");
 if(now.object.sha!==gh.head)throw Error("PokéStudio main changed. Reconnect and regenerate the proposal.");
 const sourceSet=new Set(gh.tree.map(x=>x.path));
 for(const edit of proposal.changes){
  if(!developerPath(edit.path,!!edit.created)||typeof edit.after!=="string")throw Error("Unsafe file in proposal.");
  if(edit.created?sourceSet.has(edit.path):!sourceSet.has(edit.path))throw Error("Proposed source file changed or already exists: "+edit.path);
 }
 if(new Set(proposal.changes.map(x=>x.path)).size!==proposal.changes.length)throw Error("Duplicate feature files.");
 const marker=nonce||globalThis.crypto?.randomUUID?.()||"";
 if(!/^[a-zA-Z0-9-]{8,50}$/.test(marker))throw Error("Cannot generate a safe unique branch identifier.");
 const branch="ai-feature/"+marker.slice(0,32),base="/repos/"+STUDIO_REPOSITORY;
 // Create an isolated branch, never force-push, never merge. If anything fails
 // later, the orphan branch is safe and can be inspected/removed manually.
 await gh.request(base+"/git/refs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ref:"refs/heads/"+branch,sha:gh.head})});
 const head=await gh.request(base+"/git/commits/"+gh.head);
 const elements=[];
 for(const edit of proposal.changes){
  const blob=await gh.request(base+"/git/blobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:edit.after,encoding:"utf-8"})});
  elements.push({path:edit.path,mode:"100644",type:"blob",sha:blob.sha});
 }
 const tree=await gh.request(base+"/git/trees",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({base_tree:head.tree.sha,tree:elements})});
 const commit=await gh.request(base+"/git/commits",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:"AI feature proposal: "+String(requestTitle||"PokéStudio improvement").slice(0,75),tree:tree.sha,parents:[gh.head]})});
 await gh.request(base+"/git/refs/heads/"+branch,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({sha:commit.sha,force:false})});
 const title="AI proposal: "+String(requestTitle||"PokéStudio improvement").slice(0,90);
 const body="## Proposed feature\n"+proposal.summary+"\n\n## Modified files\n"+proposal.changes.map(c=>"- `"+c.path+"`"+(c.created?" (new)":"")).join("\n")+
  "\n\n## Safety\nGenerated code is not approved. Review the full diff and CI tests before merging. No automatic deployment. User requested this PR from the AI Developer tab.";
 const pr=await gh.request(base+"/pulls",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,body,head:branch,base:"main",draft:true})});
 return {branch,commit:commit.sha,number:pr.number,url:pr.html_url||"https://github.com/"+STUDIO_REPOSITORY+"/pull/"+pr.number};
}
