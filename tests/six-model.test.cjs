const {test,before}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const E=require('../dist/engine.js'),D=require('../dist/data.json');let highs;
before(async()=>{highs=await require('../dist/vendor/highs.js')({locateFile:f=>path.resolve(__dirname,'../dist/vendor',f)});});
const atom=(id,extra={})=>{const raw=D.atoms.find(a=>a.pool===6&&a.id===id),v=raw.values[0];return {atomId:id,value:v.value,valueIndex:v.value_index,count:1,...extra};};
function fixture(){const head=D.armors.find(a=>a.id==='Head:502');return {data:{...D,weapons:[{id:'weapon',slots:[],defense:0}],decorations:[],armors:[head,...E.PARTS.slice(1).map(part=>({...D.armors.find(a=>a.part===part),pool:0,budget:0,skills:[],slots:[],sex:'Both'}))]},request:{weaponId:'weapon',skills:[{id:12,level:1}],options:{augment:true,deleteSkills:true,defenseFallback:true,noCharm:true,searchMode:'time',resultSort:'unusedSlotsDesc',seconds:3,limit:1}}};}
const none={id:'none',empty:true,skills:[],slots:[]};
test('六条模型没有收尾或连续失败辅助变量，只保留普通词条',()=>{
 const {data,request}=fixture(),m=E.buildModel(data,request,data.armors,[none]);assert.ok(m.pieces[0].postFallback);assert.ok(m.lp.vars.every(v=>!v.n.startsWith('finish_')&&!v.n.startsWith('fail_')));assert.ok(m.pieces[0].numeric.every(v=>!v.fallback));
});
test('混合策略：数量模式六条；限时防御包含收尾；其他限时目标六条',()=>{
 for(const searchMode of ['count','time'])for(const resultSort of ['defense','unusedSlotsDesc','skillsAsc','skillsDesc','skillCostAsc','skillCostDesc']){
  const {data,request}=fixture();Object.assign(request.options,{searchMode,resultSort});const m=E.buildModel(data,request,data.armors,[none]),p=m.pieces[0],full=searchMode==='time'&&resultSort==='defense';
  assert.equal(p.postFallback,!full,searchMode+':'+resultSort);assert.equal(!!p.fallbackSelectors,full);assert.equal(p.numeric.some(n=>n.fallback),full);
  if(full){const objective=new Map(m.lp.objective.map(([v,n])=>[n,v]));for(const n of p.numeric.filter(n=>n.fallback))assert.ok(Math.abs(objective.get(n.n)+n.value)<0.001,'收尾防御必须进入目标');}
 }
 const {data,request}=fixture();request.options.defenseFallback=false;const m=E.buildModel(data,request,data.armors,[none]);assert.equal(m.pieces[0].postFallback,false);assert.equal(m.pieces[0].fallbackSelectors,undefined);
});
test('时限模式的短结果也补普通防御直至合法结束，并保留求解器原始自由解用于热启动',()=>{
 const {data,request}=fixture(),m=E.buildModel(data,request,data.armors,[none]),p=m.pieces[0];
 for(const e of p.edits)m.lp.constraint([[1,e.n]],'=',e.sign>0?1:0);for(const e of p.numeric)m.lp.constraint([[1,e.n]],'=',0);for(const c of p.choices)m.lp.constraint([[1,c.n]],'=',c.points===0?1:0);
 const raw=highs.solve(m.lp.text(),{output_flag:false,time_limit:2}),r=E.validateResult(data,request,E.reconstruct(m,raw,data,request)),head=r.pieces[0];assert.equal(raw.Status,'Optimal');assert.equal(head.fallback.termination,'budget');assert.ok(head.records>1);assert.equal(head.levels[12],1);assert.equal(r._freeArmors[0].atoms.length,1);assert.ok(E.modelSeed(data,m,r));
});
test('六条收尾取消时改用同条目的其他合法roll，不接受零防御和',()=>{
 const {data,request}=fixture();request.skills=[{id:17,level:1},{id:10,level:1},{id:12,level:1}];
 const free=[atom(60),atom(145,{skillId:17}),atom(146,{skillId:10}),atom(149,{skillId:200}),atom(144,{skillId:12}),atom(90)];
 const p=E.evaluateArmor(data,request,E.finishFreeArmor(data,request,{id:'Head:502',atoms:free}));assert.equal(p.records,7);assert.equal(p.fallback.effect.value,10);assert.equal(p.finalDefense,123);
});
test('兜底相消先重选已有防御roll：保留收尾+6，把自由+6改为+5',()=>{
 const {data,request}=fixture();request.skills=[{id:17,level:1},{id:12,level:1}];
 const free=[atom(60),atom(74,{value:6,valueIndex:2}),atom(145,{skillId:17}),atom(144,{skillId:12}),atom(89,{count:2})],before=structuredClone(free);
 const out=E.finishFreeArmor(data,request,{id:'Head:502',atoms:free}),p=E.evaluateArmor(data,request,out);
 assert.deepEqual(free,before);assert.equal(p.records,7);assert.equal(p.cost,10);assert.equal(p.finalDefense,124);assert.equal(p.fallback.effect.value,6);assert.equal(p.fallback.before,5);
 const rerolled=p.atoms.find(a=>a.atomId===74&&!a.fallback);assert.equal(rerolled.value,5);assert.equal(rerolled.valueIndex,1);assert.equal(p.atoms.filter(a=>a.fallback).length,1);
 const encoded=require('../dist/mod.js').encodeAtoms(data,p,p.atoms);assert.deepEqual(encoded.filter(a=>a.Id===74).map(a=>a.ValueIndex).sort(),[1,2]);
 for(const id of [12,17])assert.equal(p.levels[id],1);assert.deepEqual(p.slots,data.armors[0].slots);
});
test('不发生防御相消时保持已有防御取值，不擅自改写有效构型',()=>{
 const {data,request}=fixture();request.skills=[{id:17,level:1},{id:12,level:1}];
 const free=[atom(60),atom(74,{value:4,valueIndex:0}),atom(145,{skillId:17}),atom(144,{skillId:12}),atom(89,{count:2})],p=E.evaluateArmor(data,request,E.finishFreeArmor(data,request,{id:'Head:502',atoms:free}));
 assert.equal(p.atoms.find(a=>a.atomId===74&&!a.fallback).value,4);assert.equal(p.fallback.effect.value,6);assert.equal(p.finalDefense,123);assert.equal(p.cost,10);
});
test('重复防御记录能逐条重选，条目ID、数量和费用不变，取最高合法防御',()=>{
 const {data,request}=fixture();request.skills=[{id:12,level:1},{id:10,level:1}];
 data.atoms=data.atoms.map(a=>a.pool===6&&a.id===60?{...a,values:[{value:-10,value_index:0,weight:100}]}:a.pool===6&&a.id===69?{...a,values:[{value:3,value_index:0,weight:50},{value:4,value_index:1,weight:50}]}:a);
 const free=[atom(60,{value:-10}),atom(69,{value:4,valueIndex:1,count:2}),atom(144,{skillId:12}),atom(146,{skillId:10}),atom(89)],p=E.evaluateArmor(data,request,E.finishFreeArmor(data,request,{id:'Head:502',atoms:free}));
 assert.equal(p.records,7);assert.equal(p.cost,10);assert.equal(p.finalDefense,124);assert.deepEqual(p.atoms.filter(a=>a.atomId===69).map(a=>a.value).sort(),[3,4]);assert.equal(p.fallback.effect.atomId,71);assert.equal(p.fallback.effect.value,2);
});
test('所有防御取值均无法修复时只排除具体组合，同件防具仍可继续搜索',()=>{
 const {data,request}=fixture();data.atoms=data.atoms.map(a=>a.pool===6&&a.id===74?{...a,values:a.values.filter(v=>v.value===5)}:a);const ids=D.skills.filter(s=>s.cost===3&&s.id!==200).slice(0,3).map(s=>s.id);request.skills=ids.map(id=>({id,level:1}));
 const m=E.buildModel(data,request,data.armors,[none]),p=m.pieces[0],fixed=[];
 for(const e of p.edits)fixed.push([e.n,e.sign>0?1:0]);
 for(const e of p.numeric)fixed.push([e.n,e.atom===59||e.atom===74&&e.value===5||e.atom===89&&e.value===-1?1:0]);
 for(const c of p.choices)fixed.push([c.n,c.points===0?1:0]);
 const text=m.lp.text().replace('Subject To\n','Subject To\n'+fixed.map(([n,v],i)=>' force_'+i+': '+n+' = '+v+'\n').join(''));
 const bad=highs.solve(text,{output_flag:false,time_limit:2});assert.equal(bad.Status,'Optimal');assert.throws(()=>E.reconstruct(m,bad,data,request),e=>e.code==='POST_FALLBACK_INVALID');
 assert.equal(E.excludeFreePattern(m,'Head:502',bad),true);assert.equal(E.excludeFreePattern(m,'Head:502',bad),false);
 const good=highs.solve(m.lp.text(),{output_flag:false,time_limit:2});assert.equal(good.Status,'Optimal');const r=E.validateResult(data,request,E.reconstruct(m,good,data,request));assert.equal(r.pieces[0].id,'Head:502');assert.ok(r.verified);
});
test('久爱腕甲保留技能增删时，空孔目标主动使用两条减12防御换出311',()=>{
 const armor=D.armors.find(a=>a.id==='Arm:506'),others=E.PARTS.filter(part=>part!=='arm').map(part=>D.armors.find(a=>a.part===part&&a.seriesId===502)),data={...D,decorations:[],weapons:[{id:'weapon',slots:[],defense:0}]};
 const request={weaponId:'weapon',skills:[{id:0,level:3},{id:205,level:1},{id:208,level:1},{id:47,level:1}],options:{sex:'FemaleOnly',augment:true,deleteSkills:true,defenseFallback:true,noCharm:true,searchMode:'time',resultSort:'unusedSlotsDesc',fixedArmors:Object.fromEntries(others.map(a=>[a.part,{id:a.id,atoms:[]}]))}},m=E.buildModel(data,request,[armor,...others],[none]),p=m.pieces.find(p=>p.a.id===armor.id);
 for(const e of p.edits)m.lp.constraint([[1,e.n]],'=',e.sign<0&&e.skill===231||e.sign>0&&[208,47].includes(e.skill)?1:0);
 const raw=highs.solve(m.lp.text(),{output_flag:false,time_limit:2});assert.equal(raw.Status,'Optimal');const r=E.validateResult(data,request,E.reconstruct(m,raw,data,request)),arm=r.pieces.find(p=>p.id===armor.id);assert.deepEqual(arm.slots,[3,1,1]);assert.equal(arm.records,6);assert.equal(arm.cost,10);assert.equal(arm.finalDefense,98);assert.equal(arm.fallback.termination,'budget');
});
