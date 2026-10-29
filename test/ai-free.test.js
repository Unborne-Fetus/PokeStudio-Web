import test from "node:test";
import assert from "node:assert/strict";
import {parseAIJSON,prompts,browserAIAvailable,LOCAL_MODELS,callLocalAI} from "../src/ai-local.js";
import {callFreeCloud} from "../src/ai-cloud.js";
import freeWorker,{validateFreeRequest,verifyChallenge} from "../worker/free-worker.js";

test("browser model catalog and structured output are validated without fetching modules",()=>{
 assert.ok(LOCAL_MODELS.every(m=>m.id.includes("Coder")));
 assert.equal(browserAIAvailable({navigator:{gpu:{}},isSecureContext:true}),true);
 assert.equal(browserAIAvailable({navigator:{gpu:null},isSecureContext:true}),false);
 assert.deepEqual(parseAIJSON('```json\n{"files":["a.json"]}\n```'),{files:["a.json"]});
 assert.throws(()=>parseAIJSON("hello"),/valid structured/);
 assert.throws(()=>parseAIJSON("x".repeat(50001)),/too much/);
});
test("local inference accepts injected engine and never sends source to a gateway",async()=>{
 let called;
 const result=await callLocalAI({phase:"edit",instruction:"rename",files:[{path:"x.json",value:'{"a":1}'}]},{
  modelId:LOCAL_MODELS[0].id,
  getEngine:async()=>({chat:{completions:{create:async request=>{
   called=request;return {choices:[{message:{content:'{"edits":[{"path":"x.json","find":"1","replace":"2"}]}'}}]};
  }}}})
 });
 assert.equal(result.edits[0].replace,"2");
 assert.match(called.messages[0].content,/UNTRUSTED/);
 assert.equal(called.response_format.type,"json_object");
 assert.throws(()=>prompts({phase:"delete"}),/Unsupported/);
});
test("free cloud client checks HTTPS and includes Turnstile token only on the explicit request",async()=>{
 let sent;const fetcher=async(url,options)=>{
  sent={url,options};return {ok:true,json:async()=>({edits:[]})};
 };
 await callFreeCloud("https://ai.example.workers.dev","test-token",{phase:"edit",instruction:"rename",files:[]},fetcher);
 assert.equal(sent.options.method,"POST");
 assert.equal(JSON.parse(sent.options.body).turnstileToken,"test-token");
 assert.throws(()=>callFreeCloud("https://example.org",null,{phase:"edit"}),/verification/i);
});
test("free cloud worker rejects missing configuration and unverified challenges",async()=>{
 const origin="https://unborne-fetus.github.io";
 const req=new Request("https://free.example.workers.dev",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json","CF-Connecting-IP":"192.0.2.1"},body:JSON.stringify({phase:"edit",instruction:"Change text",files:[{path:"a.json",value:"{}"}],turnstileToken:"token"})});
 const res=await freeWorker.fetch(req,{ALLOWED_ORIGIN:origin});
 assert.equal(res.status,503);
 assert.throws(()=>validateFreeRequest({phase:"edit",instruction:"test",files:[{path:".github/workflows/build.yml",value:"source"}],turnstileToken:"token"}),/non-sensitive/);
 assert.equal(await verifyChallenge("token",origin,{},async()=>{throw Error("should not be called")}),false);
});
test("free cloud worker verifies Turnstile server-side before charging inference",async()=>{
 const origin="https://unborne-fetus.github.io";let calls=0;
 const env={ALLOWED_ORIGIN:origin,TURNSTILE_SECRET_KEY:"secret",RATE_LIMITER:{limit:async()=>({success:true})},AI:{run:async()=>{
  calls++;return {response:'{"summary":"Change","edits":[{"path":"a.json","find":"1","replace":"2"}]}'};
 }}};
 const original=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,json:async()=>({success:true,hostname:"unborne-fetus.github.io",action:"pokestudio-ai"})});
 try{
  const req=new Request("https://free.example.workers.dev",{method:"POST",headers:{Origin:origin,"CF-Connecting-IP":"192.0.2.1"},
   body:JSON.stringify({phase:"edit",instruction:"Change a",files:[{path:"a.json",value:'{"a":1}'}],turnstileToken:"fake-for-test"})});
  const res=await freeWorker.fetch(req,env);
  assert.equal(res.status,200);assert.equal(calls,1);
  assert.equal((await res.json()).edits[0].replace,"2");
 }finally{globalThis.fetch=original}
});
