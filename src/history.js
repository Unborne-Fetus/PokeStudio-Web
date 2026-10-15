const copy=value=>value instanceof Uint8Array?value.slice():value;
const same=(a,b)=>{
 if(a instanceof Uint8Array&&b instanceof Uint8Array){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true}
 return a===b
};
// Source and binary edits share one workspace-wide undo history.
// Consecutive text keystrokes are grouped; visual strokes/field edits are atomic.
export class EditHistory {
 constructor(limit=150){this.limit=limit;this.past=[];this.future=[]}
 record(path,before,after,{typing=false}={}){
  if(same(before,after))return false;
  const time=Date.now(),last=this.past[this.past.length-1];
  if(typing&&last?.typing&&last.path===path&&time-last.time<700){
   last.after=copy(after);last.time=time
  }else{
   this.past.push({path,before:copy(before),after:copy(after),typing,time});
   if(this.past.length>this.limit)this.past.shift()
  }
  this.future.length=0;return true
 }
 undo(){const item=this.past.pop();if(item)this.future.push(item);return item?{path:item.path,value:copy(item.before)}:null}
 redo(){const item=this.future.pop();if(item)this.past.push(item);return item?{path:item.path,value:copy(item.after)}:null}
 clear(){this.past.length=0;this.future.length=0}
 get canUndo(){return this.past.length>0}
 get canRedo(){return this.future.length>0}
}
