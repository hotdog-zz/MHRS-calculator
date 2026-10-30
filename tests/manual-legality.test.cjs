const {test,before}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const E=require('../dist/engine.js'),C=require('../dist/config.js'),M=require('../dist/mod.js'),data=require('../dist/data.json');let highs;
before(async()=>{highs=await require('../dist/vendor/highs.js')({locateFile:f=>path.resolve(__dirname,'../dist/vendor',f)});});
const query=(fallback=false)=>({weaponId:'DualBlades:481',skills:[{id:16,level:1}],options:{sex:'MaleOnly',augment:true,deleteSkills:true,defenseFallback:fallback,noCharm:true,seconds:5,limit:1}});
function atom(id,count=1,extra={}){const r=data.atoms.find(a=>a.pool===6&&a.id===id),v=r.values[0];return {atomId:id,value:v.value,valueIndex:v.value_index,count,...extra};}
const evaluate=(atoms,fallback=false)=>E.evaluateArmor(data,query(fallback),{id:'Head:502',atoms});
test('专用兜底合计次数包含count与跨行、跨ID，预算用尽和开关均不能绕过',()=>{
 for(const enabled of [false,true])for(const atoms of [[atom(70,5)],[atom(70),atom(70)],[atom(70),atom(71)]])assert.throws(()=>evaluate(atoms,enabled),/最多出现1次/);
 assert.throws(()=>evaluate([atom(70)]),/需要开启/);
 assert.throws(()=>evaluate([atom(70),atom(60),atom(76,1,{value:12,valueIndex:2,fallback:true})],true),/收尾|兜底冲突/);
 assert.doesNotThrow(()=>evaluate([atom(69,2)]));
});
test('其他模式专用词条和伪造兜底标记在统一校验层拒绝',()=>{
 assert.throws(()=>evaluate([atom(61)]),/其他炼化模式/);assert.equal(E.isOrdinaryAtom(data.atoms.find(a=>a.pool===6&&a.id===61)),false);
 assert.throws(()=>evaluate([atom(69,1,{fallback:true})]),/需要开启/);
 assert.throws(()=>evaluate([atom(69,2,{fallback:true})],true),/只能标记1条/);
 assert.throws(()=>evaluate([atom(69,1,{fallback:true}),atom(76,1,{value:12,valueIndex:2,fallback:true})],true),/只能标记1条/);
});
test('手动孔位合计可以溢出，保留原记录与cost，最终饱和444',()=>{
 const deletion={atomId:149,skillId:200,value:-1,count:2};
 const p=evaluate([atom(139,5),deletion]);assert.deepEqual(p.slots,[4,4,4]);assert.equal(p.cost,10);assert.equal(p.records,7);
 assert.deepEqual(evaluate([atom(139,4),deletion]).slots,[4,4,4]);
});
test('技能、孔位和数值词条字段在保存前校验，补全索引并规范显示属性',()=>{
 assert.throws(()=>evaluate([atom(144,1,{skillId:16,valueIndex:99})]),/ValueIndex/);
 assert.throws(()=>evaluate([atom(139,1,{valueIndex:99})]),/ValueIndex/);
 assert.throws(()=>evaluate([atom(69,1,{skillId:16})]),/非技能词条/);
 const input=[{atomId:73,value:4,count:1,attribute:'fire'}],p=evaluate(input);
 assert.equal(p.atoms[0].valueIndex,2);assert.equal(p.atoms[0].attribute,'defense');assert.deepEqual(M.encodeAtoms(data,p,p.atoms)[0],{Id:73,SkillId:0,ValueIndex:2});assert.equal(input[0].attribute,'fire');
});
test('自动模型自由候选剔除专用词条，专用兜底只由补偿选择器提供',()=>{
 const armor=data.armors.find(a=>a.id==='Head:502'),none={id:'none',empty:true,skills:[],slots:[]};
 for(const enabled of [false,true]){const m=E.buildModel(data,query(enabled),[armor],[none]),numeric=m.pieces[0].numeric;assert.ok(numeric.filter(n=>!n.fallback).every(n=>![61,70,71,72].includes(n.atom)));assert.equal(numeric.some(n=>n.fallback),enabled);}
});
function fixture(){return {skills:[{id:0,name:'目标',max:7,cost:3}],weapons:[{id:'weapon',slots:[]}],armors:E.PARTS.map((part,i)=>({id:part,name:part,part,rank:'Master',sex:'Both',defense:100,slots:[],resistances:{},skills:[],pool:i?0:1,budget:i?0:10})),atoms:[{pool:1,id:144,category:20,cost:3,values:[{value:1,value_index:0,weight:100}]}],decorations:[],fixedCharms:[]};}
test('仅固定装备仍能搜索炼化；固定空炼化与旧配置严格保留；错误装备不可替换',async()=>{
 const d=fixture(),q={weaponId:'weapon',skills:[{id:0,level:2}],options:{noCharm:true,seconds:2,limit:1,fixedArmors:{head:{id:'head'}}}};
 const r=await E.search(d,q,highs);assert.equal(r.status,'feasible');assert.equal(r.results[0].armors[0].id,'head');assert.equal(r.results[0].pieces[0].levels[0],2);
 const copied=C.normalize(d,C.payload(d,q));assert.deepEqual(copied.options.fixedArmors.head,{id:'head'});E.validateRequest(d,copied);
 q.options.fixedArmors.head.atoms=[];assert.equal((await E.search(d,q,highs)).status,'unknown');assert.deepEqual(C.normalize(d,C.payload(d,q)).options.fixedArmors.head.atoms,[]);
 const fixed=structuredClone(r.results[0].armors[0]);q.options.fixedArmors.head=fixed;assert.equal((await E.search(d,q,highs)).status,'feasible');
 q.options.fixedArmors.head={id:'head'};const other={...d.armors[0],id:'other'};d.armors.push(other);const bad=structuredClone(r.results[0]);bad.armors[0].id='other';assert.throws(()=>E.validateResult(d,q,bad),/固定防具/);
});
