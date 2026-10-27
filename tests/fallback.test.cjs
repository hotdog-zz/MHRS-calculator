const {test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('../dist/engine.js'),C=require('../dist/config.js'),M=require('../dist/mod.js');let highs;
const data=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../dist/data.json')));
before(async()=>{highs=await require('../dist/vendor/highs.js')({locateFile:f=>path.resolve(__dirname,'../dist/vendor',f)});});
function fixture(budget=10){return {skills:[{id:0,name:'目标',max:7,cost:3}],weapons:[{id:'weapon',slots:[],defense:0}],armors:E.PARTS.map((part,i)=>({id:part,name:part,part,rank:'Master',sex:'Both',defense:100,resistances:{},skills:i?[{skill_id:0,level:1}]:[],slots:[],pool:i?0:6,budget:i?0:budget})),atoms:[...data.atoms.filter(a=>a.pool===6&&[59,60,69,70,71,72,73,74,75,76].includes(a.id)),{pool:6,id:144,category:20,cost:3,values:[{value:1,value_index:0,weight:100}]}],decorations:[],fixedCharms:[]};}
function q(level=4){return {weaponId:'weapon',skills:[{id:0,level}],options:{defenseFallback:true,noCharm:true,searchMode:'time',resultSort:'defense',seconds:3,limit:1}};}
function solve(d,r,emptyFree=false){const m=E.buildModel(d,r,d.armors,[{id:'none',name:'无',empty:true,skills:[],slots:[]}]);if(emptyFree)for(const p of m.pieces)for(const v of p.numeric||[])if(!v.fallback)m.lp.constraint([[1,v.n]],'=',0);const raw=highs.solve(m.lp.text(),{output_flag:false,time_limit:2});return {m,raw,result:raw.Status==='Optimal'?E.validateResult(d,r,E.reconstruct(m,raw,d,r)):null};}
test('所有Pool逐预算与原始抽选表核对：最高可负担cost、同cost专用优先、普通取最大值',()=>{
 // Independent expected tiers from the raw game tables (cost, maximum DEF).
 const tiers={1:[[1,3],[2,4],[3,6],[4,7],[5,11],[10,20],[15,31],[20,40]],2:[[1,2],[2,3],[3,4],[4,6],[5,8],[10,16],[14,24],[18,32]],3:[[1,2],[2,3],[3,4],[4,6],[5,9],[8,13],[12,20],[16,26]],4:[[1,1],[2,3],[3,4],[4,5],[5,7],[7,10],[10,14],[14,20]],5:[[1,1],[2,2],[3,3],[4,4],[5,6],[6,8],[9,12],[12,16]],6:[[1,1],[2,1],[3,2],[4,2],[3,4],[5,6],[7,8],[10,12]]};
 for(const pool of new Set(data.atoms.map(a=>a.pool)))for(let r=0;r<=90;r++){
  const actual=E.fallbackEffect(data,pool,r);if(r===0){assert.equal(actual,null);continue;}
  const table=tiers[pool===13?6:(pool-1)%6+1],ids=[69,70,71,72,73,74,75,76];
  const candidates=table.map(([cost,value],i)=>({id:ids[i],cost,value})).filter(a=>a.cost<=r);
  const maxCost=Math.max(...candidates.map(a=>a.cost)),best=candidates.filter(a=>a.cost===maxCost);
  const expected=best.find(a=>[70,71,72].includes(a.id))||best[0];
  assert.equal(actual.atomId,expected.id,`pool=${pool}, R=${r}`);assert.equal(actual.cost,maxCost);assert.equal(actual.value,expected.value);
  const actualRaw=data.atoms.find(a=>a.pool===pool&&a.id===expected.id);assert.ok(actualRaw.values.some(v=>v.value_index===actual.valueIndex&&v.value===expected.value&&v.weight>0));
 }
});
test('Pool6阈值回归：剩余1补偿、3优先专用、5/7/10普通最大值、高预算只补一条',()=>{
 const expected=[[0,null,0,0],[1,69,1,1],[2,70,2,1],[3,71,3,2],[4,72,4,2],[5,74,5,6],[6,74,5,6],[7,75,7,8],[9,75,7,8],[10,76,10,12],[60,76,10,12]];
 for(const [r,id,cost,value] of expected){const a=E.fallbackEffect(data,6,r);assert.equal(a?.atomId??null,id);assert.equal(a?.cost??0,cost);assert.equal(a?.value??0,value);}
});
test('模型逐预算选择补偿且防御优化包含末条，不增加技能或新增上限计数',()=>{
 for(let budget=0;budget<=20;budget++){
  const d=fixture(budget);const request=q();request.options.augmentLimits={head:0};const {raw,result}=solve(d,request,true);assert.equal(raw.Status,'Optimal');const p=result.pieces.find(p=>p.part==='head'),e=E.fallbackEffect(d,6,budget);
  assert.equal(p.fallback.before,budget);assert.equal(p.fallback.after,budget-(e?.cost||0));assert.equal(p.finalDefense,100+(e?.value||0));assert.equal(p.skillAdds,0);assert.equal(p.additions,0);assert.equal(p.fallback.freeRecords,0);
  if(e){assert.equal(p.atoms.at(-1).fallback,true);const encoded=M.encodeAtoms(d,p,p.atoms);assert.equal(encoded[6].Id,e.atomId);assert.ok(encoded.slice(0,6).every(a=>a.Id===0));}
 }
});
test('开启时最多六条自由效果，关闭时仍允许七条；禁用炼化不执行补偿',()=>{
 const d=fixture(30);d.atoms=d.atoms.filter(a=>a.id===144||[69,70,71,72].includes(a.id));const request=q(11);assert.equal(solve(d,request).raw.Status,'Infeasible');
 request.options.defenseFallback=false;assert.equal(solve(d,request).raw.Status,'Optimal');
 request.skills=[{id:0,level:4}];request.options.defenseFallback=true;request.options.augment=false;const r=solve(d,request).result;assert.ok(r.pieces.every(p=>p.records===0&&p.fallback===null));
});
test('固定记录可推断补偿，拒绝缺失/错误补偿及伪造标记，负面记录不阻止推断',()=>{
 const d=fixture(),request=q(),effect=E.fallbackEffect(d,6,13);const atoms=[{atomId:59,value:-6,valueIndex:0,attribute:'defense',count:1},{...effect}];delete atoms[1].cost;
 const p=E.evaluateArmor(d,request,{id:'head',atoms});assert.equal(p.fallback.before,13);assert.equal(p.fallback.after,3);assert.equal(p.atoms.at(-1).fallback,true);assert.equal(p.fallback.freeRecords,1);
 assert.equal(p.atoms.at(-1).atomId,76);assert.equal(p.atoms.at(-1).value,12);
 assert.throws(()=>E.evaluateArmor(d,request,{id:'head',atoms:[]}),/兜底冲突/);
 assert.throws(()=>E.evaluateArmor(d,request,{id:'head',atoms:[atoms[0],{atomId:72,value:2,valueIndex:0,count:1,fallback:true}]}),/兜底冲突/);
 assert.throws(()=>E.evaluateArmor(d,request,{id:'head',atoms:[atoms[0],{atomId:76,value:8,valueIndex:0,count:1,fallback:true}]}),/兜底冲突/);
 assert.throws(()=>E.evaluateArmor(d,request,{id:'head',atoms:[{atomId:70,value:1,valueIndex:0,count:1}]}),/兜底冲突/);
 assert.throws(()=>E.evaluateArmor(d,request,{id:'head',atoms:[{atomId:72,value:2,valueIndex:0,count:2,fallback:true}]}),/兜底冲突/);
 request.options.fixedArmors={head:{id:'head',atoms}};E.validateRequest(d,request);const r=solve(d,request).result;assert.equal(r.pieces.find(p=>p.part==='head').fallback.before,13);
});
test('独立校验拒绝移除末条，旧配置默认关闭，条件分享保留开关与末条标记',()=>{
 const d=fixture();const request=q(),v=solve(d,request,true).result;const bad=structuredClone(v);bad.armors.find(a=>a.id==='head').atoms=[];assert.throws(()=>E.validateResult(d,request,bad),/兜底冲突/);
 const legacy=structuredClone(request);delete legacy.options.defenseFallback;assert.equal(C.normalize(d,legacy).options.defenseFallback,false);
 request.options.fixedArmors={head:v.armors.find(a=>a.id==='head')};const restored=C.normalize(d,C.payload(d,request));assert.equal(restored.options.defenseFallback,true);assert.ok(restored.options.fixedArmors.head.atoms.some(a=>a.fallback===true));E.validateRequest(d,restored);
});
test('防御兜底也参与抵消检测：自由防御-12加末条+12必须拒绝',()=>{
 const d=fixture(),request=q(),effect=E.fallbackEffect(d,6,15);delete effect.cost;
 assert.throws(()=>E.evaluateArmor(d,request,{id:'head',atoms:[{atomId:60,value:-12,valueIndex:0,count:1},effect]}),e=>e.code==='DEFENSE_CANCELLED');
});
test('真实数据搜索开启兜底，逐件验证及Mod导出往返保留第七条',async()=>{
 const request={weaponId:'LongSword:302',skills:[{id:0,level:7},{id:5,level:7},{id:6,level:3}],options:{sex:'MaleOnly',seconds:10,limit:1,defenseFallback:true}};
 const response=await E.search(data,request,highs);assert.equal(response.status,'feasible',JSON.stringify(response.attempts));const r=response.results[0];assert.ok(r.pieces.every(p=>!p.pool||(p.fallback.freeRecords<=6&&p.records<=7)));
 const template=JSON.parse(fs.readFileSync(path.resolve(__dirname,'mod-template.json')));const bow=data.weapons.find(w=>w.id===M.equipmentFromGame(template.inventoryList[0].IdVal));request.weaponId=bow.id;
 // Real export uses a same-type template and a freshly verified weapon request.
 const candidate={...r,weaponId:bow.id};candidate.decorations=[];
 const exportRequest={...request,skills:[{id:0,level:1}]};const verified=E.validateResult(data,exportRequest,candidate);
 const out=M.exportLoadout(data,template,verified,exportRequest,E,{index:1,name:'兜底验证'}).payload;
 verified.pieces.forEach((p,i)=>{if(p.fallback?.effect)assert.equal(out.inventoryList[i+1].CustomBuildup[6].Id,p.fallback.effect.atomId);});
 M.parse(data,out);
});
