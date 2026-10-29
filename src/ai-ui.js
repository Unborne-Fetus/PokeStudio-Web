import {AI_MAX_FILE_CHARS,AI_MAX_PROJECT_FILE_CHARS,AI_MAX_FILES,editableAIPath,contextualSource,candidatePaths,selectFiles,prepareProposal,validateEndpoint,callGateway} from "./ai-project.js";

let gatewayUrl="";
let gatewayAccess="";
let savedInstruction="";

const el=(tag,className="",label)=>{
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(label!==undefined)node.textContent=label;
 return node;
};
function field(label,value,placeholder="",secret=false){
 const wrapper=el("label","form-field");
 const caption=el("span","",label),input=el(secret?"input":"input");
 if(secret)input.type="password";
 input.value=value;input.placeholder=placeholder;input.autocomplete="off";
 wrapper.append(caption,input);
 return {wrapper,input};
}
function showError(node,error){node.textContent=error.message||String(error);node.className="warn";}
function reviewExcerpt(value,first){
 const start=Math.max(0,first-180),end=Math.min(value.length,first+6500);
 return (start?"… previous source omitted …\n":"")+value.slice(start,end)+(end<value.length?"\n… remaining source omitted; open Changes to inspect …":"");
}

export function aiPage(api,root){
 root.replaceChildren();
 const title=el("div","visual-toolbar"),heading=el("h2","","✦ AI Project Editor · Level 2");
 title.append(heading);root.append(title);
 root.append(el("p","muted","Ask for edits to existing project files. AI proposes exact source replacements; inspect them before applying. No commands or GitHub commits run automatically."));
 const layout=el("div","ai-layout"),form=el("section","panel"),preview=el("section","panel");
 layout.append(form,preview);root.append(layout);

 const gateway=field("AI gateway URL (HTTPS)",gatewayUrl,"https://your-worker.example.workers.dev");
 const access=field("AI gateway access token (kept in this tab only)",gatewayAccess,"Gateway access token",true);
 gateway.input.oninput=()=>gatewayUrl=gateway.input.value.trim();
 access.input.oninput=()=>gatewayAccess=access.input.value;
 form.append(gateway.wrapper,access.wrapper);
 const requestLabel=el("label","form-field");
 const requestText=el("span","","Describe your project change"),prompt=el("textarea");
 prompt.rows=6;prompt.maxLength=2000;prompt.placeholder="Example: Change this route's wild encounter rate to 10 and keep all slots.";prompt.value=savedInstruction;
 prompt.oninput=()=>savedInstruction=prompt.value;
 requestLabel.append(requestText,prompt);form.append(requestLabel);

 const pathsLabel=el("label","form-field"),pathText=el("span","","Files to edit (optional; comma or newline separated)"),pathInput=el("textarea");
 pathInput.rows=3;pathInput.placeholder="Leave blank to let AI choose from the repository. Or enter exact paths, for example data/maps/Route101/map.json";
 if(api.current()?.path)pathInput.value=api.current().path;
 pathsLabel.append(pathText,pathInput);form.append(pathsLabel);

 const consent=el("label","form-check"),check=el("input");
 check.type="checkbox";
 consent.append(check,document.createTextNode("I understand selected file contents and my request are sent to the configured AI gateway."));
 form.append(consent);
 const controls=el("div","panel-actions"),generate=el("button","btn primary","Generate proposed edits");
 generate.type="button";controls.append(generate);form.append(controls);
 const progress=el("p","muted",""),summary=el("div","ai-preview-summary");
 form.append(progress);preview.append(el("h3","","Review proposed changes"),summary);
 const previewItems=el("div","ai-preview-files"),apply=el("button","btn primary","Apply reviewed edits");
 preview.append(previewItems,apply);
 apply.type="button";apply.disabled=true;
 preview.append(el("p","muted","Applying changes adds one undoable history entry. Use Changes to compare and export/commit; GitHub is untouched until you commit."));
 let staged=null,busy=false;
 function setBusy(value){busy=value;generate.disabled=value;apply.disabled=value||!staged}
 function display(proposal,operations){
  previewItems.replaceChildren();
  summary.textContent=proposal.summary+" · "+proposal.changes.length+" file(s), "+proposal.operations+" replacement(s)";
  for(const change of proposal.changes){
   const section=el("details","ai-file-preview");
   const header=el("summary","",change.path+" · "+change.before.length+" → "+change.after.length+" characters");
   section.append(header);
   const code=el("div","ai-file-compare"),before=el("div"),after=el("div");
   let first=0;while(first<Math.min(change.before.length,change.after.length)&&change.before[first]===change.after[first])first++;
   before.append(el("h4","","Before (affected source)"),el("pre","",reviewExcerpt(change.before,first)));
   after.append(el("h4","","Proposed (affected source)"),el("pre","",reviewExcerpt(change.after,first)));
   code.append(before,after);section.append(code);previewItems.append(section);
  }
  const specific=el("details","ai-file-preview");
  specific.append(el("summary","","View exact replacement operations"));
  for(const op of operations){
   const line=el("div","ai-operation");
   line.append(el("strong","",op.path),el("pre","ai-removal","− "+op.find),el("pre","ai-addition","+ "+op.replace));
   specific.append(line);
  }
  previewItems.append(specific);specific.open=true;
  if(proposal.changes.length===1)previewItems.firstElementChild.open=true;
  apply.disabled=false;
 }
 generate.onclick=async()=>{
  if(busy)return;
  staged=null;apply.disabled=true;summary.textContent="";previewItems.replaceChildren();
  const instruction=prompt.value.trim();
  if(!instruction)return showError(progress,Error("Describe the project change first."));
  if(!check.checked)return showError(progress,Error("Consent is required before source text is sent to a gateway."));
  let endpoint;
  try{endpoint=validateEndpoint(gateway.input.value)}catch(error){return showError(progress,error)}
  setBusy(true);progress.className="muted";
  try{
   const known=api.paths().filter(path=>!path.startsWith(".git/"));
   let selected=pathInput.value.split(/[\n,]/).map(s=>s.trim()).filter(Boolean);
   if(selected.length){
    if(selected.length>AI_MAX_FILES||selected.some(path=>!known.includes(path)||!editableAIPath(path)))throw Error("Enter up to four supported, non-sensitive existing source paths as shown in Explorer.");
    selected=[...new Set(selected)];
   }else{
    const candidates=candidatePaths(known,instruction,api.current()?.path);
    if(!candidates.length)throw Error("No editable project files were found.");
    progress.textContent="Choosing relevant source files…";
    const result=await callGateway(endpoint,access.input.value,{phase:"select",instruction,paths:candidates,activePath:api.current()?.path||""});
    selected=selectFiles(result,candidates);
   }
   const sources=[],contexts=[];
   for(const path of selected){
    progress.textContent="Loading "+path+"…";
    const file=await api.loadRaw(path);
    if(file.isBinary||typeof file.value!=="string"||file.value.length>AI_MAX_PROJECT_FILE_CHARS)throw Error(path+" is binary or too large for safe AI editing (limit: "+AI_MAX_PROJECT_FILE_CHARS+" characters). Select a smaller source file.");
    sources.push({path,value:file.value});
    contexts.push({path,value:contextualSource(file.value,instruction)});
   }
   progress.textContent="Generating exact replacements for "+selected.length+" file(s)…";
   const result=await callGateway(endpoint,access.input.value,{phase:"edit",instruction,files:contexts});
   const proposal=prepareProposal(result,sources);
   staged=proposal;
   display(proposal,result.edits);
   progress.textContent="Proposal ready. Expand and review the complete source changes before applying.";
  }catch(error){showError(progress,error)}
  finally{setBusy(false)}
 };
 apply.onclick=()=>{
  if(!staged||busy)return;
  try{
   // Verify the current staged source, even if another editor changed it while AI was working.
   for(const change of staged.changes){
    const rec=api.getFile(change.path);
    if(!rec||rec.isBinary||rec.value!==change.before)throw Error("Source changed since the AI proposal: "+change.path+". Generate a new proposal to avoid overwriting other edits.");
   }
   api.applyBatch(staged.changes);
   const number=staged.changes.length;
   staged=null;apply.disabled=true;previewItems.replaceChildren();
   summary.textContent="Applied "+number+" file(s) locally. Review Changes before committing to GitHub.";
   progress.className="muted";progress.textContent="Edits applied; global Undo reverts the entire AI batch.";
   api.notify("AI edits applied locally to "+number+" file(s). No GitHub commit was made.","success");
  }catch(error){showError(progress,error)}
 };
 if(!api.paths().length){generate.disabled=true;progress.textContent="Connect to a GitHub repository or open a local project folder first."}
}
