import {validateEndpoint} from "./ai-project.js";
let scriptPromise;
export function loadTurnstile(doc=document){
 if(doc.defaultView?.turnstile)return Promise.resolve(doc.defaultView.turnstile);
 if(scriptPromise)return scriptPromise;
 scriptPromise=new Promise((resolve,reject)=>{
  const tag=doc.createElement("script");tag.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";tag.async=true;
  tag.onload=()=>doc.defaultView?.turnstile?resolve(doc.defaultView.turnstile):reject(Error("Verification widget failed to load."));
  tag.onerror=()=>reject(Error("Could not load the free-cloud verification challenge."));
  doc.head.append(tag);
 }).catch(error=>{scriptPromise=null;throw error});
 return scriptPromise;
}
export async function requestChallenge(container,siteKey,loader=loadTurnstile){
 if(!siteKey)throw Error("Free cloud needs the owner's public Turnstile site key.");
 const widget=await loader();
 return new Promise((resolve,reject)=>{
  container.replaceChildren();
  let widgetId;
  const complete=token=>{
   // Do not remove the widget here; tokens may become invalid if the
   // challenge is reset before the request finishes.
   resolve({token,cleanup:()=>{if(widgetId!==undefined)widget.remove(widgetId);container.replaceChildren()}});
  };
  try{
   widgetId=widget.render(container,{sitekey:siteKey,action:"pokestudio-ai",
    callback:complete,"error-callback":()=>reject(Error("Verification failed.")),
    "expired-callback":()=>reject(Error("Verification expired. Try again."))});
  }catch(error){reject(error)}
 });
}
export async function callFreeCloud(endpoint,turnstileToken,payload,fetcher=fetch){
 const url=validateEndpoint(endpoint);
 if(payload.phase!=="edit")throw Error("Free cloud only accepts project edit requests.");
 if(!turnstileToken)throw Error("Free cloud verification is required.");
 const response=await fetcher(url,{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({...payload,turnstileToken}),cache:"no-store"});
 let result;
 try{result=await response.json()}catch{throw Error("Free cloud returned an unreadable response.")}
 if(!response.ok)throw Error(typeof result.error==="string"?result.error:"Free AI request failed (HTTP "+response.status+").");
 return result;
}
