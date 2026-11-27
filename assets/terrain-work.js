/** Cooperative CPU work; the generated data is unchanged between sync/async use. */
export const yieldTerrainWork=()=>globalThis.scheduler?.yield?globalThis.scheduler.yield():
  new Promise(resolve=>setTimeout(resolve,0));

export function finishTerrainWork(iterator){
  let step=iterator.next();while(!step.done)step=iterator.next();return step.value;
}

export async function runTerrainWork(iterator,{budgetMs=4,yieldTask=yieldTerrainWork,onSlice}={}){
  let started=performance.now(),step=iterator.next();
  while(!step.done){
    const spent=performance.now()-started;
    if(spent>=budgetMs){onSlice?.(spent);await yieldTask();started=performance.now();}
    step=iterator.next();
  }
  onSlice?.(performance.now()-started);return step.value;
}

/** A layer is installed once, only for the current request, after readiness/pass. */
export class TerrainNavigation{
  begin(name){
    if(this.active)this.active.cancelled=true;
    return this.active={name,token:Symbol(name),ready:false,passed:false,committed:false,cancelled:false};
  }
  current(job){return this.active===job&&!job.cancelled;}
  ready(job,assets){if(this.current(job)){job.assets=assets;job.ready=true;}}
  pass(job){if(this.current(job))job.passed=true;}
  commit(job){
    if(!this.current(job)||!job.ready||!job.passed||job.committed)return null;
    job.committed=true;return job.assets;
  }
  cancel(){if(this.active)this.active.cancelled=true;this.active=null;}
}
