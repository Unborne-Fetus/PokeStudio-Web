/* Optional ZERO-PAYMENT Cloudflare Workers AI fallback (separate from private OpenAI gateway).
 * Production requires Cloudflare free plan, Turnstile validation and a rate-limit binding.
 * No anonymous, unauthenticated inference endpoint is exposed. */
import {editableAIPath} from "../src/ai-project.js";
import {prompts} from "../src/ai-prompts.js";

const reply=(data,status,origin)=>new Response(JSON.stringify(data),{status,headers:{
 "Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin",
 ...(origin?{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS"}:{})
}});
export async function verifyChallenge(token,origin,env,fetcher=fetch){
 if(!env.TURNSTILE_SECRET_KEY||!token||token.length>2048)return false;
 try{
  const response=await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:token})
  });
  if(!response.ok)return false;
  const check=await response.json();
  return check.success===true&&check.hostname===new URL(origin).hostname&&check.action==="pokestudio-ai";
 }catch{return false}
}
export function validateFreeRequest(body){
 if(!body||body.phase!=="edit"||typeof body.instruction!=="string"||!body.instruction.trim()||body.instruction.length>1200)throw Error("Request must be a short project edit.");
 if(!Array.isArray(body.files)||!body.files.length||body.files.length>2)throw Error("Select one or two source files for the free cloud model.");
 if(new Set(body.files.map(x=>x.path)).size!==body.files.length)throw Error("Duplicate source paths.");
 for(const f of body.files)if(!f||!editableAIPath(f.path)||typeof f.value!=="string"||f.value.length>9000)throw Error("Only small non-sensitive text excerpts are supported.");
 if(typeof body.turnstileToken!=="string"||!body.turnstileToken||body.turnstileToken.length>2048)throw Error("A fresh verification token is required.");
}
export default {
 async fetch(request,env){
  const origin=request.headers.get("Origin")||"",allowed=String(env.ALLOWED_ORIGIN||"").replace(/\/$/,"");
  if(!allowed||origin!==allowed)return reply({error:"Origin not allowed."},403);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{
   "Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Max-Age":"600","Vary":"Origin"
  }});
  if(request.method!=="POST")return reply({error:"Method not allowed."},405,origin);
  if(!env.AI||!env.RATE_LIMITER||!env.TURNSTILE_SECRET_KEY)return reply({error:"Free AI fallback has not been configured."},503,origin);
  try{
   const raw=await request.text();
   if(raw.length>22500)throw Error("Source context is too large.");
   const body=JSON.parse(raw);
   validateFreeRequest(body);
   const ip=request.headers.get("CF-Connecting-IP");
   if(!ip)return reply({error:"Trusted client address missing."},403,origin);
   const allowedRate=await env.RATE_LIMITER.limit({key:ip});
   if(!allowedRate.success)return reply({error:"Free cloud request limit reached. Try local AI."},429,origin);
   if(!(await verifyChallenge(body.turnstileToken,origin,env)))return reply({error:"Verification failed or expired. Complete a new challenge."},403,origin);
   const messages=prompts(body);
   const result=await env.AI.run("@cf/meta/llama-3.2-3b-instruct",{messages,max_tokens:1800,temperature:0.1});
   const response=String(result?.response||"").trim();
   const cleaned=response.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
   let parsed;
   try{parsed=JSON.parse(cleaned)}catch{return reply({error:"Cloud model did not return valid structured edits. Try again with a narrower request."},422,origin)}
   if(!parsed||!Array.isArray(parsed.edits))return reply({error:"Cloud model returned an invalid proposal."},422,origin);
   return reply(parsed,200,origin);
  }catch(error){return reply({error:String(error?.message||"Free inference failed").slice(0,220)},400,origin)}
 }
};
