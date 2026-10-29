/* Two independent single-threaded solvers. No shared-memory requirement. */
(function(root){
'use strict';
const E=root.ForgeEngine||(typeof require==='function'?require('./engine.js'):null),I=root.ForgeInventory||(typeof require==='function'?require('./inventory.js'):null);
function create({data,request,createWorker,onProgress=()=>{},workerCount=2,inventory}){
 const stock=request.options?.ownedOnly?(inventory?.byKey?inventory:I.parse(data,inventory)):null;
 if(stock)I.validateQuery(data,stock,request);else E.validateRequest(data,request);
 const started=Date.now(),workers=[],results=new Map(),responses=[],errors=[],finished=new Set(),timed=request.options?.searchMode==='time';
 let settled=false,initializing=true,remaining=0,timer,resolvePromise;
 const promise=new Promise(resolve=>{resolvePromise=resolve;});
 async function finish(reason){
  if(settled)return;settled=true;clearTimeout(timer);
  await Promise.allSettled(workers.map(w=>{try{return w.terminate();}catch{return undefined;}}));
  const sorted=[...results.values()].sort((a,b)=>E.compareResults(a,b,request.options?.resultSort||'defense'));
  resolvePromise({status:sorted.length?'feasible':'unknown',results:timed?sorted:sorted.slice(0,request.options?.limit||3),elapsedMs:Date.now()-started,workerCount:workers.length,errors,reason,domainExhausted:responses.length===workers.length&&responses.every(r=>r.domainExhausted),attempts:responses.flatMap(r=>r.attempts||[])});
 }
 function accept(result,index){
  const verified=stock?I.validateResult(data,stock,request,result):E.validateResult(data,request,result),key=E.resultIdentity(verified),previous=results.get(key);
  if(previous&&E.compareResults(verified,previous,request.options?.resultSort||'defense')>=0)return;
  results.set(key,verified);onProgress({phase:'result',result:verified,workerIndex:index});
  if(!timed&&results.size>=(request.options?.limit||3))finish('limit');
 }
 function complete(index,response,error){
  if(settled||finished.has(index))return;finished.add(index);
  if(error)errors.push('计算 '+(index+1)+'：'+error);if(response)responses.push(response);
  if(--remaining===0&&!initializing)finish('done');
 }
 for(let index=0;index<Math.max(1,Math.min(2,workerCount));index++){
  if(settled)break;let worker;
  try{
   worker=createWorker(index);workers.push(worker);remaining++;
   worker.onmessage=event=>{
    if(settled)return;const p=event.data;
    try{
     if(p.phase==='result')accept(p.result,index);
     else if(p.phase==='done'){for(const r of p.response.results)accept(r,index);complete(index,p.response);}
     else if(p.phase==='error')complete(index,null,p.message);
     else onProgress({...p,workerIndex:index});
    }catch(e){complete(index,null,'结果校验失败：'+e.message);try{worker.terminate();}catch{}}
   };
   worker.onerror=event=>complete(index,null,event.message||'求解引擎运行失败');
   worker.postMessage({data,request,...(stock?{inventory:stock.raw}:{}),execution:{profile:index===0?'balanced':'alternate',seed:index*1009}});
  }catch(e){if(worker){complete(index,null,e.message);try{worker.terminate();}catch{}}else errors.push('计算 '+(index+1)+'无法启动：'+e.message);}
 }
 initializing=false;
 if(!remaining)finish('error');
 else if(!settled)timer=setTimeout(()=>finish('deadline'),Math.max(1,Math.min(180,request.options?.seconds||45))*1000+1500);
 return {promise,cancel:()=>finish('cancel')};
}
function search(options){return create(options).promise;}
const api={create,search};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ForgePool=api;
})(globalThis);
