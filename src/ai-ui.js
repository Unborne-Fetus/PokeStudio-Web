import {AI_MAX_FILE_CHARS,AI_MAX_PROJECT_FILE_CHARS,AI_MAX_FILES,editableAIPath,contextualSource,candidatePaths,selectFiles,prepareProposal,assertUnchanged,validateEndpoint,callGateway} from "./ai-project.js";
import {LOCAL_MODELS,browserAIAvailable,callLocalAI} from "./ai-local.js";
import {FREE_AI_GATEWAY_URL,TURNSTILE_SITE_KEY} from "./ai-config.js";
import {requestChallenge,callFreeCloud} from "./ai-cloud.js";

let gatewayUrl="";
let gatewayAccess="";
let savedInstruction="";
let selectedBackend="local",selectedModel=LOCAL_MODELS[1].id;

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

 const backend=el("label","form-field"),backendCaption=el("span","","AI engine"),backendSelect=el("select");
 for(const [value,label] of [["local","Free · browser AI (no key)"],["cloud","Free · cloud fallback (if configured)"],["private","Private · owner-operated gateway"]]){
  const option=el("option","",label);option.value=value;
  if(value==="cloud"&&(!FREE_AI_GATEWAY_URL||!TURNSTILE_SITE_KEY))option.disabled=true;
  backendSelect.append(option);
 }
 backendSelect.value=selectedBackend;
 if(backendSelect.selectedIndex<0){selectedBackend="local";backendSelect.value="local"}
 backend.append(backendCaption,backendSelect);form.append(backend);
 const modelField=el("label","form-field"),modelCaption=el("span","","Browser model"),modelSelect=el("select");
 for(const model of LOCAL_MODELS){const option=el("option","",model.label);option.value=model.id;modelSelect.append(option)}
 modelSelect.value=selectedModel;modelSelect.onchange=()=>{selectedModel=modelSelect.value};
 modelField.append(modelCaption,modelSelect);form.append(modelField);
 const engineNote=el("p","muted",""),challengeSlot=el("div","ai-challenge");
 const gateway=field("Private gateway URL (HTTPS)",gatewayUrl,"https://your-worker.example.workers.dev");
 const access=field("AI gateway access token (kept in this tab only)",gatewayAccess,"Gateway access token",true);
 gateway.input.oninput=()=>gatewayUrl=gateway.input.value.trim();
 access.input.oninput=()=>gatewayAccess=access.input.value;
 form.append(gateway.wrapper,access.wrapper,engineNote,challengeSlot);
 function syncBackend(){
  selectedBackend=backendSelect.value;
  modelField.hidden=selectedBackend!=="local";
  gateway.wrapper.hidden=access.wrapper.hidden=selectedBackend!=="private";
  engineNote.textContent=selectedBackend==="local"
   ?(browserAIAvailable()?"Runs on your GPU; downloads and caches a large model on first use. No project source goes to an inference provider.":"WebGPU not available on this device. Use a supported secure browser or enable the optional free cloud gateway.")
   :selectedBackend==="cloud"?"Cloudflare's free allocation is limited. A fresh anti-abuse check is required, and only one request is sent; source text leaves this browser."
   :"Owner-operated gateway; model charges may apply. Source text is sent only with consent.";
 }
 backendSelect.onchange=syncBackend;syncBackend();
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
 const consentText=document.createTextNode("I agree to send the selected source text and my request to the chosen AI service.");
 consent.append(check,consentText);
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
  const mode=backendSelect.value;
  if(mode!=="local"&&!check.checked)return showError(progress,Error("Consent is required before source text is sent to a cloud service."));
  let endpoint="";
  try{if(mode==="private")endpoint=validateEndpoint(gateway.input.value);
   if(mode==="cloud")endpoint=validateEndpoint(FREE_AI_GATEWAY_URL);
   if(mode==="local"&&!browserAIAvailable())throw Error("This browser cannot run WebGPU AI. Use a compatible device or a configured free cloud option.");
  }catch(error){return showError(progress,error)}
  const generateAI=(payload)=>mode==="local"?callLocalAI(payload,{modelId:modelSelect.value,onProgress:text=>progress.textContent=text}):
   callGateway(endpoint,access.input.value,payload);
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
    if(mode==="cloud"){
     // Free inference uses one Turnstile token per request; choose locally to avoid
     // sending the entire repository index or spending a second quota request.
     selected=candidates.slice(0,2);
     progress.textContent="Using likely files: "+selected.join(", ")+". Enter explicit paths if these are incorrect.";
    }else{
     const result=await generateAI({phase:"select",instruction,paths:candidates.slice(0,mode==="local"?35:240),activePath:api.current()?.path||""});
     selected=selectFiles(result,candidates);
    if(mode==="local")selected=selected.slice(0,2);
    }
   }
   if((mode==="local"||mode==="cloud")&&selected.length>2)throw Error("Free AI supports up to two selected source files per request. Choose fewer paths.");
   const sources=[],contexts=[];
   for(const path of selected){
    progress.textContent="Loading "+path+"…";
    const file=await api.loadRaw(path);
    if(file.isBinary||typeof file.value!=="string"||file.value.length>AI_MAX_PROJECT_FILE_CHARS)throw Error(path+" is binary or too large for safe AI editing (limit: "+AI_MAX_PROJECT_FILE_CHARS+" characters). Select a smaller source file.");
    sources.push({path,value:file.value});
    contexts.push({path,value:contextualSource(file.value,instruction,mode==="local"?2800:mode==="cloud"?8000:AI_MAX_FILE_CHARS)});
   }
   progress.textContent="Generating exact replacements for "+selected.length+" file(s)…";
   let result;
   if(mode==="cloud"){
    if(contexts.length>2)throw Error("Free cloud accepts at most two files. Enter fewer paths.");
    progress.textContent="Complete the free-cloud verification below…";
    const challenge=await requestChallenge(challengeSlot,TURNSTILE_SITE_KEY);
    try{progress.textContent="Requesting free cloud edits…";
     result=await callFreeCloud(endpoint,challenge.token,{phase:"edit",instruction,files:contexts});
    }finally{challenge.cleanup()}
   }else result=await generateAI({phase:"edit",instruction,files:contexts});
   const proposal=prepareProposal(result,sources);
   staged=proposal;
   display(proposal,result.edits);
   progress.textContent="Proposal ready. Review all replacement operations before applying. No changes were committed.";
  }catch(error){showError(progress,error)}
  finally{setBusy(false)}
 };
 apply.onclick=()=>{
  if(!staged||busy)return;
  try{
   assertUnchanged(staged,api.getFile);
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
