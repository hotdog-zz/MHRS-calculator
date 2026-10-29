const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/engine.js'),P=require('../dist/search-pool.js');
function fixture(){
 const data={skills:[{id:0,name:'目标',max:7,cost:3}],weapons:[{id:'weapon',slots:[],defense:0}],armors:E.PARTS.map((part,i)=>({id:part,name:part,part,rank:'Master',sex:'Both',defense:100,resistances:{fire:0,water:0,thunder:0,ice:0,dragon:0},skills:i===0?[{skill_id:0,level:1}]:[],slots:[],pool:1,budget:5})),atoms:[{pool:1,id:69,category:13,cost:1,values:[{value:1,value_index:0,weight:100}]}],decorations:[],fixedCharms:[]};
 const request={weaponId:'weapon',skills:[{id:0,level:1}],options:{seconds:1,limit:1,noCharm:true,searchMode:'count',resultSort:'defense'}};
 const result=extra=>E.validateResult(data,request,{weaponId:'weapon',armors:data.armors.map((a,i)=>({id:a.id,atoms:i===0&&extra?[{atomId:69,value:1,valueIndex:0,count:extra}]:[]})),charm:{id:'none',name:'无',empty:true,skills:[],slots:[]},decorations:[]});
 return {data,request,result};
}
function factory(plans,created){return index=>{
 const worker={index,terminated:false,terminate(){this.terminated=true;},postMessage(message){this.message=message;queueMicrotask(()=>plans[index](worker,p=>worker.onmessage?.({data:p})));}};created.push(worker);return worker;
};}
test('双Worker使用互补配置，达到全局数量时停止两个引擎并忽略迟到结果',async()=>{
 const {data,request,result}=fixture(),created=[],events=[];
 const out=await P.search({data,request,createWorker:factory([(w,send)=>send({phase:'result',result:result(1)}),(w,send)=>send({phase:'result',result:result(2)})],created),onProgress:p=>events.push(p)});
 assert.equal(created.length,2);assert.equal(out.results.length,1);assert.equal(out.reason,'limit');assert.ok(created.every(w=>w.terminated));assert.equal(events.length,1);
 assert.equal(created[0].message.execution.profile,'balanced');assert.equal(created[1].message.execution.profile,'alternate');assert.notEqual(created[0].message.execution.seed,created[1].message.execution.seed);
});
test('限时模式合并重复组合时只保留更好结果，不因单Worker结束而终止另一Worker',async()=>{
 const {data,request,result}=fixture(),created=[];request.options.searchMode='time';
 const out=await P.search({data,request,createWorker:factory([(w,send)=>{send({phase:'result',result:result(1)});send({phase:'done',response:{results:[result(1)],domainExhausted:false}});},(w,send)=>{assert.equal(w.terminated,false);send({phase:'result',result:result(3)});send({phase:'result',result:result(2)});send({phase:'done',response:{results:[result(2)],domainExhausted:false}});}],created)});
 assert.equal(out.results.length,1);assert.equal(out.results[0].defense,503);assert.ok(created.every(w=>w.terminated));
});
test('一个Worker报错或无法创建时另一个继续，非法结果不进入合并结果',async()=>{
 const {data,request,result}=fixture();
 for(const failStart of [false,true]){
  const created=[],make=factory([(w,send)=>send({phase:'result',result:{...result(1),decorations:[{id:'invalid',count:1}]}}),(w,send)=>send({phase:'done',response:{results:[result(2)],domainExhausted:true}})],created);
  const out=await P.search({data,request,createWorker:index=>{if(failStart&&index===0)throw new Error('不可用');return make(index);}});
  assert.equal(out.results.length,1);assert.equal(out.results[0].defense,502);assert.ok(out.errors.length);assert.ok(created.every(w=>w.terminated));
 }
});
test('主动停止同时销毁两个Worker，保留已经通过校验的结果',async()=>{
 const {data,request,result}=fixture(),created=[];request.options.searchMode='time';
 const job=P.create({data,request,createWorker:factory([(w,send)=>send({phase:'result',result:result(1)}),()=>{}],created)});
 await new Promise(resolve=>setImmediate(resolve));await job.cancel();const out=await job.promise;
 assert.equal(out.reason,'cancel');assert.equal(out.results.length,1);assert.ok(created.every(w=>w.terminated));
});
