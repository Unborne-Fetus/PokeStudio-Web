/* GitHub repository access and atomic multi-file commits. No credentials are persisted. */
const API="https://api.github.com";
export const textPath=path=>/\.(c|h|s|inc|json|json5|txt|md|pory|event|cfg|ini|mk|yml|yaml|py|js|css|html|party|toml|sh|bat|gitignore|gitattributes|asm|ld|map)$/i.test(path)||/(^|\/)(Makefile|CMakeLists.txt|Dockerfile|LICENSE|README)$/.test(path);
export const binaryPath=path=>/\.(bin|png|jpg|jpeg|gif|bmp|webp|pal|4bpp|8bpp|lz|gbapal)$/i.test(path);
export function bytesToB64(bytes){let out="";for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out)}
export function b64ToBytes(str){const decoded=atob(str.replace(/\s/g,""));const bytes=new Uint8Array(decoded.length);for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);return bytes}
function pathEncode(path){return path.split("/").map(encodeURIComponent).join("/")}
export class GitHubWorkspace{
 constructor(){this.repo="";this.branch="";this.head="";this.tree=[];this.token=""}
 async request(path,opts={}){
  const headers={"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",...opts.headers};
  if(this.token)headers.Authorization="Bearer "+this.token;
  const response=await fetch(API+path,{...opts,headers,cache:"no-store"});
  if(!response.ok){let message;try{const err=await response.json();message=err.message}catch{}throw Error("GitHub "+response.status+": "+(message||response.statusText))}
  return response.status===204?{}:await response.json();
 }
 async connect(repo,branch=""){
  if(!/^[\w.-]+\/[\w.-]+$/.test(repo))throw Error("Repository must be owner/name");
  const meta=await this.request("/repos/"+repo);this.repo=repo;this.branch=branch||meta.default_branch;
  await this.refresh();return this;
 }
 async refresh(){
  if(!this.repo)throw Error("No repository connected");
  const ref=await this.request("/repos/"+this.repo+"/git/ref/heads/"+pathEncode(this.branch));
  this.head=ref.object.sha;
  const tree=await this.request("/repos/"+this.repo+"/git/trees/"+encodeURIComponent(this.head)+"?recursive=1");
  this.tree=(tree.tree||[]).filter(item=>item.type==="blob").map(item=>({path:item.path,sha:item.sha,size:item.size||0}));
  this.truncated=Boolean(tree.truncated);
  return this.tree;
 }
 lookup(path){return this.tree.find(item=>item.path===path)}
 async read(path,sha=null){
  const entry=sha?{sha}:this.lookup(path);if(!entry)throw Error("Not found in repository: "+path);
  const knownBinary=binaryPath(path)&&!textPath(path);
  if(!this.token){const url="https://raw.githubusercontent.com/"+this.repo+"/"+pathEncode(this.branch)+"/"+pathEncode(path);const resp=await fetch(url,{cache:"no-store"});if(!resp.ok)throw Error("Could not read "+path+" (HTTP "+resp.status+")");if(knownBinary)return {bytes:new Uint8Array(await resp.arrayBuffer()),sha:entry.sha,isBinary:true};return {value:await resp.text(),sha:entry.sha,isBinary:false}}
  const blob=await this.request("/repos/"+this.repo+"/git/blobs/"+entry.sha);
  const bytes=b64ToBytes(blob.content||"");return knownBinary?{bytes,sha:entry.sha,isBinary:true}:{value:new TextDecoder().decode(bytes),sha:entry.sha,isBinary:false};
 }
 async commit(changed,message){
  if(!this.token)throw Error("Set a fine-grained GitHub token in Workspace settings to commit.");
  if(!changed.length)throw Error("No files have changed.");
  if(!this.repo||!this.branch||!this.head)throw Error("Connect to a repository first.");
  const base="/repos/"+this.repo;
  const live=await this.request(base+"/git/ref/heads/"+pathEncode(this.branch));
  if(live.object.sha!==this.head)throw Error("The remote branch has changed. Export edits, then reconnect and review before committing.");
  const headCommit=await this.request(base+"/git/commits/"+live.object.sha);
  const elements=[];
  for(const file of changed){
   const blob=await this.request(base+"/git/blobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(file.isBinary?{content:bytesToB64(file.bytes),encoding:"base64"}:{content:file.value,encoding:"utf-8"})});
   elements.push({path:file.path,mode:"100644",type:"blob",sha:blob.sha});
  }
  const tree=await this.request(base+"/git/trees",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({base_tree:headCommit.tree.sha,tree:elements})});
  const commit=await this.request(base+"/git/commits",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message,tree:tree.sha,parents:[this.head]})});
  await this.request(base+"/git/refs/heads/"+pathEncode(this.branch),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({sha:commit.sha,force:false})});
  this.head=commit.sha;return commit.sha;
 }
}