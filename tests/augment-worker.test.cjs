const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{Worker}=require('node:worker_threads'),D=require('../dist/data.json'),S=require('../dist/augment-sim.js');
function offlineWorker(){const html=fs.readFileSync(path.resolve(__dirname,'../../deliverables/SunbreakForge.html'),'utf8'),match=html.match(/<script id="embeddedAugmentWorker"[^>]*>([\s\S]*?)<\/script>/);assert.ok(match);const source=Buffer.from(match[1].trim(),'base64').toString();assert.ok(!source.includes('importScripts('));return new Worker("const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;globalThis.fetch=()=>{throw Error('No network')};globalThis.postMessage=m=>parentPort.postMessage(m);parentPort.on('message',data=>self.onmessage({data}));\n"+source,{eval:true});}
const cfg={armorId:'Head:502',mode:'normal',count:1000,limit:100,sort:'skills',seed:42};
function until(worker,type,inspect=()=>{}){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(Error('Worker timeout'));},15000),error=e=>{cleanup();reject(e);},message=m=>{try{inspect(m);if(m.type==='error')throw Error(m.message);if(m.type===type){cleanup();resolve(m);}}catch(e){cleanup();reject(e);}};function cleanup(){clearTimeout(timer);worker.off('message',message);worker.off('error',error);}worker.on('message',message);worker.on('error',error);});}
test('离线模拟Worker不加载HiGHS，页面消息最多25组并可分页恢复完整保留结果',async()=>{
 const worker=offlineWorker();try{const ready=until(worker,'done',m=>assert.ok(m.rows.length<=25));worker.postMessage({type:'start',data:D,config:cfg});const r=await ready;assert.equal(r.stats.completed,1000);assert.ok(r.total<=100);assert.ok(r.rows.length<=25);
  const batch=S.createBatch(D,cfg);while(!batch.step()){}assert.deepEqual(r.stats,batch.stats);assert.deepEqual(r.rows,batch.keep.rows().slice(0,25));
  const page=until(worker,'page');worker.postMessage({type:'page',page:1});assert.deepEqual((await page).rows,batch.keep.rows().slice(25,50));
  const frequency=until(worker,'page');worker.postMessage({type:'page',page:0,sort:'frequency'});assert.deepEqual((await frequency).rows,batch.keep.rows().sort((a,b)=>b.count-a.count||S.compare(a,b,cfg.sort)).slice(0,25));
  const ascending=until(worker,'page');worker.postMessage({type:'page',page:0,sort:'defenseAsc'});assert.deepEqual((await ascending).rows,batch.keep.rows().sort((a,b)=>S.compare(a,b,'defenseAsc')).slice(0,25));
  const reset=until(worker,'done');worker.postMessage({type:'start',data:D,config:{...cfg,count:12,limit:1}});const next=await reset;assert.equal(next.stats.completed,12);assert.equal(next.total,1);
 }finally{await worker.terminate();}
});
test('大批量抽选可以停止，停止后仍可分页，未完成次数不计入统计',async()=>{
 const worker=offlineWorker();try{const progress=until(worker,'progress',m=>assert.ok(m.rows.length<=25));worker.postMessage({type:'start',data:D,config:{...cfg,count:10000000}});await progress;
  const stopped=until(worker,'stopped');worker.postMessage({type:'stop'});const r=await stopped;assert.ok(r.stats.completed>0&&r.stats.completed<10000000);assert.equal(r.stats.matches,r.stats.completed);assert.ok(r.total<=100);
  const page=until(worker,'page');worker.postMessage({type:'page',page:0});assert.equal((await page).stats.completed,r.stats.completed);worker.postMessage({type:'clear'});
 }finally{await worker.terminate();}
});
test('离线Worker编译命中指令，按指定技能等级保留并重新排序，错误查看条件不丢结果',async()=>{
 const worker=offlineWorker(),config={...cfg,count:3000,sort:'specificSkill',sortSkill:200,sortSkillMetric:'final',query:'grade.B >= 1 AND removed = 0'};try{
  const done=until(worker,'done');worker.postMessage({type:'start',data:D,config});const r=await done,b=S.createBatch(D,config);while(!b.step()){}assert.equal(r.stats.matches,b.stats.matches);assert.deepEqual(r.rows,b.keep.rows().slice(0,25));
  const page=until(worker,'page');worker.postMessage({type:'page',sort:'specificSkillAsc',skill:0,skillMetric:'added'});assert.deepEqual((await page).rows,b.keep.rows().sort((a,b)=>S.compare(a,b,'specificSkillAsc',0,'added')).slice(0,25));
  const invalid=until(worker,'viewError');worker.postMessage({type:'page',sort:'specificSkill',skill:-1,skillMetric:'final'});assert.match((await invalid).message,/排序技能/);
  const retained=until(worker,'page');worker.postMessage({type:'page',sort:'retained'});assert.equal((await retained).stats.completed,3000);
 }finally{await worker.terminate();}
});
