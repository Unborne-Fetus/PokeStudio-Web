import {GitHubWorkspace} from "./github.js";
import {LOCAL_MODELS,browserAIAvailable,callLocalAI} from "./ai-local.js";
import {candidatePaths,contextualSource,selectFiles} from "./ai-project.js";
import {STUDIO_REPOSITORY,developerPath,prepareDeveloperProposal,publishDeveloperPR} from "./ai-developer.js";
import {createZip} from "./zip.js";

let lastDescription="",lastModel=LOCAL_MODELS[1].id;
const el=(tag,cls="",value)=>{
 const node=document.createElement(tag);if(cls)node.className=cls;
 if(value!==undefined)node.textContent=value;return node;
};
function err(node,error){node.className="warn";node.textContent=String(error?.message||error)}
function around(value,position){
 if(value.length<=9000)return value;
 const start=Math.max(0,position-300),end=Math.min(value.length,start+8500);
 return (start?"… preceding source omitted …\n":"")+value.slice(start,end)+(end<value.length?"\n… remaining source omitted …":"");
}
function downloadProposal(changes){
 const url=URL.createObjectURL(createZip(changes.map(x=>({path:x.path,value:x.after}))));
 const a=el("a");a.href=url;a.download="Pokestudio-AI-feature-proposal.zip";document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
}
export function developerPage(api,root){
 root.replaceChildren();
 const bar=el("div","visual-toolbar");bar.append(el("h2","","✧ AI Developer · Level 3 (review-only)"));root.append(bar);
 root.append(el("p","muted","Suggest a small feature for PokéStudio Web itself. The browser AI drafts source changes; approved proposals create an isolated GitHub branch and DRAFT pull request. Nothing is merged, built or deployed automatically by this tab."));
 const layout=el("div","ai-layout"),form=el("section","panel"),resultPanel=el("section","panel");
 layout.append(form,resultPanel);root.append(layout);
 const modelLabel=el("label","form-field");modelLabel.append(el("span","","Free local coding model"));
 const model=el("select");
 for(const option of LOCAL_MODELS){const item=el("option","",option.label);item.value=option.id;model.append(item)}
 model.value=lastModel;model.onchange=()=>lastModel=model.value;modelLabel.append(model);form.append(modelLabel);
 const requestLabel=el("label","form-field");requestLabel.append(el("span","","Describe the new PokéStudio feature"));
 const prompt=el("textarea");prompt.rows=5;prompt.maxLength=1200;prompt.value=lastDescription;
 prompt.placeholder="Example: Add a keyboard shortcut to open the Changes view.";
 prompt.oninput=()=>lastDescription=prompt.value;requestLabel.append(prompt);form.append(requestLabel);
 const pathsLabel=el("label","form-field");pathsLabel.append(el("span","","Source paths to inspect (optional)"));
 const paths=el("textarea");paths.rows=3;paths.placeholder="Optional: index.html, src/main.js, style.css";pathsLabel.append(paths);form.append(pathsLabel);
 form.append(el("p","muted","Changes can only target approved source paths. New files are restricted to src/ and test/. Public visitors may export proposals; publishing a PR requires a GitHub token with permission to this repository."));
 const generate=el("button","btn primary","Generate feature proposal"),progress=el("p","muted","");
 generate.type="button";form.append(generate,progress);
 const review=el("div","ai-preview-files"),summary=el("p","muted",""),actions=el("div","panel-actions");
 resultPanel.append(el("h3","","Review feature proposal"),summary,review,actions);
 const exportButton=el("button","btn","Export proposed files (ZIP)"),approve=el("label","form-check"),confirmation=el("input"),publish=el("button","btn primary","Create draft pull request");
 confirmation.type="checkbox";approve.append(confirmation,document.createTextNode("I reviewed these source changes and approve creating a draft PR (not merging)."));
 exportButton.disabled=true;publish.disabled=true;actions.append(exportButton,approve,publish);
 const resultLink=el("p","muted","");resultPanel.append(resultLink);
 let staged=null,gh=null,busy=false;
 function setBusy(value){busy=value;generate.disabled=value;exportButton.disabled=value||!staged;publish.disabled=value||!staged||!confirmation.checked}
 confirmation.onchange=()=>setBusy(busy);
 function display(){
  review.replaceChildren();summary.textContent=staged.summary+" · "+staged.changes.length+" file(s)";
  for(const change of staged.changes){
   const detail=el("details","ai-file-preview");detail.append(el("summary","",change.path+(change.created?" · new file":" · modified")));
   const grid=el("div","ai-file-compare"),before=el("div"),after=el("div");
   let first=0;
   if(!change.created)while(first<Math.min(change.before.length,change.after.length)&&change.before[first]===change.after[first])first++;
   before.append(el("h4","","Before · affected source"),el("pre","",change.created?"(new file)":around(change.before,first)));
   after.append(el("h4","","After · affected source"),el("pre","",around(change.after,first)));
   grid.append(before,after);detail.append(grid);detail.open=staged.changes.length===1;review.append(detail);
  }
  if(staged.operations?.length){
   const ops=el("details","ai-file-preview");
   ops.append(el("summary","","Review exact find/replace operations ("+staged.operations.length+")"));
   for(const op of staged.operations){
    const block=el("div","ai-operation");
    block.append(el("strong","",op.path),el("pre","ai-removal","− "+op.find),el("pre","ai-addition","+ "+op.replace));
    ops.append(block);
   }
   ops.open=true;review.append(ops);
  }
  setBusy(false);
 }
 generate.onclick=async()=>{
  if(busy)return;staged=null;confirmation.checked=false;setBusy(true);review.replaceChildren();summary.textContent="";resultLink.replaceChildren();
  if(!prompt.value.trim()){setBusy(false);return err(progress,Error("Describe the feature first."))}
  if(!browserAIAvailable()){setBusy(false);return err(progress,Error("Level 3 currently requires a WebGPU browser. A free cloud model cannot yet generate complete website features reliably."))}
  progress.className="muted";
  try{
   const instance=new GitHubWorkspace();
   instance.token=api.getToken();
   progress.textContent="Reading public PokéStudio source (main)…";
   await instance.connect(STUDIO_REPOSITORY,"main");
   const known=instance.tree.map(t=>t.path),manual=paths.value.split(/[\n,]/).map(p=>p.trim()).filter(Boolean);
   let selected;
   if(manual.length){
    selected=[...new Set(manual)];
    if(selected.length>3||selected.some(p=>!known.includes(p)||!developerPath(p)))throw Error("Choose at most three existing, approved website source files.");
   }else{
    const common=["src/main.js","index.html","style.css"].filter(p=>known.includes(p));
    const suggested=[...new Set([...candidatePaths(known,prompt.value,null,22),...common])].filter(path=>developerPath(path));
    progress.textContent="Selecting website source files…";
    const answer=await callLocalAI({phase:"select",instruction:prompt.value,paths:suggested,activePath:""},{modelId:model.value,onProgress:text=>progress.textContent=text});
    selected=selectFiles(answer,suggested).slice(0,3);
   }
   const sources=[],context=[];
   for(const path of selected){
    progress.textContent="Reading "+path+"…";
    const file=await instance.read(path);
    if(file.isBinary||typeof file.value!=="string")throw Error("Cannot edit binary website file.");
    sources.push({path,value:file.value});
    let excerpt;
    try{excerpt=contextualSource(file.value,prompt.value,2400)}
    catch{excerpt=file.value.slice(0,2400)} // New features may have no pre-existing keyword.
    context.push({path,value:excerpt});
   }
   const answer=await callLocalAI({phase:"develop",instruction:prompt.value,files:context},{modelId:model.value,onProgress:text=>progress.textContent=text});
   staged={...prepareDeveloperProposal(answer,sources,known),operations:answer.edits};gh=instance;
   progress.textContent="Feature proposal ready. Review the complete diff and export it before publishing.";
   display();
  }catch(error){staged=null;setBusy(false);err(progress,error)}
 };
 exportButton.onclick=()=>{if(staged)downloadProposal(staged.changes)};
 publish.onclick=async()=>{
  if(!staged||busy||!confirmation.checked)return;
  if(!api.getToken()){err(progress,Error("Enter a fine-grained GitHub token with Contents: write and Pull requests: write in Workspace settings."));return}
  setBusy(true);
  try{
   gh.token=api.getToken();
   progress.textContent="Publishing an isolated branch and draft PR (never main)…";
   const result=await publishDeveloperPR(gh,staged,{requestTitle:prompt.value.trim()});
   resultLink.replaceChildren(el("span","", "Created draft pull request #"+result.number+" on "+result.branch+". "));
   const link=el("a","", "Review pull request on GitHub");
   link.href=result.url;link.target="_blank";link.rel="noopener noreferrer";resultLink.append(link);
   progress.className="muted";progress.textContent="Draft PR created. CI tests and human review are required before merging or deploying.";
   staged=null;confirmation.checked=false;
  }catch(error){err(progress,error)}
  finally{setBusy(false)}
 };
 if(!api.paths().length)progress.textContent="You may request a website feature without opening a project, but browser AI and GitHub access are still needed.";
}
