import {prompts} from "./ai-prompts.js";
export {prompts};
/* Level 2 browser-native inference. No API key, no user source sent to an inference server.
 * A downloaded WebLLM model/library is cached by the browser; never preload at page startup. */
const WEBLLM_CDN="https://esm.run/@mlc-ai/web-llm@0.2.86";
export const LOCAL_MODELS=[
 {id:"Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC",label:"Coder 0.5B · lower memory (~1 GB GPU)"},
 {id:"Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",label:"Coder 1.5B · balanced (~1.6 GB GPU)"},
 {id:"Qwen2.5-Coder-0.5B-Instruct-q4f32_1-MLC",label:"Coder 0.5B · compatibility mode (~1.1 GB GPU)"},
 {id:"Qwen2.5-Coder-1.5B-Instruct-q4f32_1-MLC",label:"Coder 1.5B · compatibility mode (~1.9 GB GPU)"},
 {id:"Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC",label:"Coder 3B · better edits (~2.5 GB GPU)"}
];
let enginePromise=null,loadedModel="";
export function browserAIAvailable(environment=globalThis){
 return Boolean(environment.navigator?.gpu&&environment.isSecureContext);
}
export function parseAIJSON(content){
 const text=String(content||"").trim();
 if(text.length>50000)throw Error("AI returned too much text.");
 try{return JSON.parse(text)}catch{}
 const stripped=text.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
 try{return JSON.parse(stripped)}catch{throw Error("Local AI did not return valid structured edits. Try a narrower request or different model.")}
}
export async function getLocalEngine(modelId,report=()=>{},imports=url=>import(url)){
 if(!LOCAL_MODELS.some(model=>model.id===modelId))throw Error("Unsupported local AI model.");
 if(!browserAIAvailable())throw Error("Local AI requires a secure browser with WebGPU. Use Chrome/Edge with compatible graphics hardware or configure the optional cloud fallback.");
 if(!enginePromise||loadedModel!==modelId){
  loadedModel=modelId;
  enginePromise=(async()=>{
   report("Loading the browser AI library…");
   const lib=await imports(WEBLLM_CDN);
   if(!lib.prebuiltAppConfig?.model_list?.some(model=>model.model_id===modelId))throw Error("Selected model is not in the pinned WebLLM catalog.");
   return lib.CreateMLCEngine(modelId,{initProgressCallback:progress=>{
    const percentage=Math.round(100*(Number(progress?.progress)||0));
    report("Downloading/loading "+modelId+": "+percentage+"% · "+String(progress?.text||"").slice(0,120));
   }});
  })().catch(error=>{enginePromise=null;loadedModel="";throw error});
 }
 return enginePromise;
}
export async function callLocalAI(payload,{modelId=LOCAL_MODELS[1].id,onProgress=()=>{},getEngine=getLocalEngine}={}){
 const engine=await getEngine(modelId,onProgress);
 onProgress("Generating "+(payload.phase==="select"?"file selection":payload.phase==="develop"?"PokéStudio feature proposal":"source edits")+" locally…");
 const result=await engine.chat.completions.create({messages:prompts(payload),temperature:0,max_tokens:payload.phase==="select"?350:payload.phase==="develop"?1800:1600,response_format:{type:"json_object"}});
 return parseAIJSON(result?.choices?.[0]?.message?.content);
}
