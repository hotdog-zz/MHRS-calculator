const {test,before}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');
const E=require('../dist/engine.js'),C=require('../dist/config.js');let highs;
before(async()=>{highs=await require('../dist/vendor/highs.js')({locateFile:f=>path.resolve(__dirname,'../dist/vendor',f)});});
function fixture(){return {skills:[{id:0,name:'目标',max:7,cost:3},{id:1,name:'可删除原生',max:7,cost:6}],weapons:[{id:'weapon',slots:[],defense:0}],armors:E.PARTS.map((part,i)=>({id:part,name:part,part,rank:'Master',sex:'Both',defense:100,resistances:{},skills:i===0?[{skill_id:1,level:1}]:[],slots:[],pool:i===0?1:0,budget:i===0?30:0})),atoms:[{pool:1,id:144,category:20,cost:3,values:[{value:1,value_index:0,weight:100}]},{pool:1,id:149,category:20,cost:-10,values:[{value:-1,value_index:0,weight:100}]},{pool:1,id:139,category:19,cost:6,values:[{value:1,value_index:0,weight:100}]},{pool:1,id:141,category:19,cost:18,values:[{value:3,value_index:0,weight:100}]}],decorations:[],fixedCharms:[]};}
const query=()=>({weaponId:'weapon',skills:[{id:0,level:2}],options:{noCharm:true,sex:'MaleOnly',seconds:2,limit:1}});
const none={id:'none',name:'无',empty:true,skills:[],slots:[]};
function solve(d,q){const m=E.buildModel(d,q,d.armors,[none]);const raw=highs.solve(m.lp.text(),{output_flag:false,time_limit:1});return {m,raw};}
test('逐件新增上限约束模型：技能每级计一条，删除不占新增额度',()=>{
 const d=fixture(),q=query();q.options.augmentLimits={head:1};assert.equal(solve(d,q).raw.Status,'Infeasible');
 q.options.augmentLimits.head=2;const {m,raw}=solve(d,q);assert.equal(raw.Status,'Optimal');const r=E.validateResult(d,q,E.reconstruct(m,raw,d,q));assert.equal(r.pieces[0].additions,2);
 q.options.augmentLimits.head=1;assert.throws(()=>E.validateResult(d,q,r),/新增技能与孔位词条超过上限/);
});
test('孔位＋3计一条，重复＋1计多条，负面词条不计新增',()=>{
 const d=fixture(),q=query();q.options.augmentLimits={head:2};
 const p={id:'head',atoms:[{atomId:149,skillId:1,value:-1,count:1},{atomId:144,skillId:0,value:1,count:1},{atomId:141,value:3,count:1}]};
 const v=E.evaluateArmor(d,q,p);assert.equal(v.records,3);assert.equal(v.additions,2);assert.equal(v.skillAdds,1);assert.equal(v.slotAdds,1);assert.deepEqual(v.slots,[1,1,1]);
 p.atoms[2]={atomId:139,value:1,count:2};assert.throws(()=>E.evaluateArmor(d,q,p),/超过上限/);
});
test('固定防具连同非目标炼化原样进入模型，独立校验拒绝改动',async()=>{
 const d=fixture(),q=query();q.skills=[{id:0,level:1}];const fixed={id:'head',atoms:[{atomId:149,skillId:1,value:-1,count:1},{atomId:144,skillId:0,value:1,count:1},{atomId:141,value:3,count:1}]};q.options.fixedArmors={head:fixed};
 const r=await E.search(d,q,highs);assert.equal(r.results.length,1);assert.equal(E.atomSignature(r.results[0].armors[0].atoms),E.atomSignature(fixed.atoms));assert.equal(r.results[0].pieces[0].slotAdds,1);
 const bad=structuredClone(r.results[0]);bad.armors[0].atoms.pop();assert.throws(()=>E.validateResult(d,q,bad),/固定防具或炼化被改变/);
 q.options.rank='Master';q.options.fixedArmors.chest=fixed;assert.throws(()=>E.validateRequest(d,q),/部位不符/);
});
test('限时模式忽略数量上限、扩展候选范围，唯一组合耗尽时提前结束',async()=>{
 const d=fixture(),q=query();d.atoms=[];d.armors[0].pool=0;d.armors[0].skills=[{skill_id:0,level:2}];
 for(let i=1;i<35;i++)d.armors.push({...d.armors[0],id:'head'+i,name:'头'+i,defense:100+i});q.options.searchMode='time';q.options.limit=1;q.options.seconds=4;
 const r=await E.search(d,q,highs);assert.equal(r.results.length,35,JSON.stringify(r.attempts));assert.equal(r.domainExhausted,true);assert.ok(r.results.length>q.options.limit);assert.equal(new Set(r.results.map(x=>x.armors.map(a=>a.id).join('|'))).size,35);assert.equal(r.results[0].defense,535);
});
test('固定非最优护石不被最大等级或孔位候选代替，真实数据完整往返',async()=>{
 const d=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../dist/data.json'))),q={weaponId:'LongSword:302',skills:[{id:0,level:1}],options:{seconds:5,limit:1,sex:'MaleOnly'}};
 const c=E.generateCharms(d,q.skills).find(c=>!c.fixed);const lower=structuredClone(c),method=d.melding.methods[c.method],row=method.skills.find(s=>(s.skillId>=10000?s.skillId-10000+200:s.skillId)===c.skills[0].skill_id);const level=[...row.first,...row.missed].find(x=>x.weight>0&&x.level<c.skills[0].level)?.level;
 if(level)lower.skills[0].level=level;E.validateCharm(d,lower);q.options.fixedCharm=lower;
 const r=await E.search(d,q,highs);assert.equal(r.status,'feasible');assert.equal(E.charmSignature(r.results[0].charm),E.charmSignature(lower));
 q.options.fixedArmors=Object.fromEntries(r.results[0].pieces.map(p=>[p.part,{id:p.id,atoms:p.atoms}]));q.options.searchMode='time';q.options.limit=1;
 const copied=C.normalize(d,C.payload(d,q));E.validateRequest(d,copied);const again=await E.search(d,copied,highs);assert.equal(again.results.length,1);assert.equal(again.domainExhausted,true);assert.equal(E.charmSignature(again.results[0].charm),E.charmSignature(lower));
});
test('排序按基础防御和技能添加等级，孔位词条不混入技能等级',()=>{
 const a={defense:600,records:5,skillAdds:3,armors:[]},b={defense:500,records:2,skillAdds:1,armors:[]};assert.ok(E.compareResults(a,b,'defense')<0);assert.ok(E.compareResults(a,b,'skillsAsc')>0);assert.ok(E.compareResults(a,b,'skillsDesc')<0);
});
test('新条件白名单往返：固定记录与上限保留，额外账户字段丢弃',()=>{
 const d=fixture(),q=query();q.options.fixedArmors={head:{id:'head',secret:'PRIVATE',atoms:[{atomId:144,skillId:0,value:1,count:1,secret:'PRIVATE'}]}};q.options.augmentLimits={head:1};q.options.searchMode='time';q.options.resultSort='skillsAsc';q.options.secret='PRIVATE';
 const p=C.payload(d,q),r=C.normalize(d,p);assert.ok(!JSON.stringify(p).includes('PRIVATE'));assert.equal(r.options.fixedArmors.head.atoms[0].skillId,0);assert.equal(r.options.augmentLimits.head,1);assert.equal(r.options.searchMode,'time');assert.equal(r.options.resultSort,'skillsAsc');
 assert.throws(()=>C.normalize(d,{...q,options:{augmentLimits:{head:-1}}}),/上限/);
});
test('五件防具全固定时，限时模式仍可枚举不同护石',async()=>{
 const d=fixture(),q=query();d.armors[0].skills=[{skill_id:0,level:2}];d.armors[0].pool=0;
 d.melding={methods:{x:{pattern:'AlchemyHaki',tableIndex:0,skills:[0,1].map(skillId=>({skillId,grade:'S',firstPickWeight:1,secondPickWeight:1,first:[{level:1,weight:100}],missed:[],second:[{level:1,weight:100}]}))}},meldingTables:{secondSkill:{param:[{skill1Grade:'S',probabilityList:[0]}]}},quriousSlots:[{slots:[2],weight:100}]};
 q.options.noCharm=false;q.options.searchMode='time';q.options.fixedArmors=Object.fromEntries(d.armors.map(a=>[a.part,{id:a.id,atoms:[]}])) ;
 const r=await E.search(d,q,highs);assert.equal(r.results.length,2);assert.notEqual(E.charmSignature(r.results[0].charm),E.charmSignature(r.results[1].charm));assert.equal(r.domainExhausted,true);
});

test('新增技能cost只合计正向技能，包含重复等级，排除孔位与删除，并可双向排序分享',async()=>{
 const d=fixture(),q=query();q.skills=[{id:0,level:2}];
 const fixed={id:'head',atoms:[{atomId:149,skillId:1,value:-1,count:1},{atomId:144,skillId:0,value:1,count:2},{atomId:141,value:3,count:1}]};
 q.options.fixedArmors={head:fixed};q.options.resultSort='skillCostAsc';
 const v=E.evaluateArmor(d,q,fixed);assert.equal(v.cost,14);assert.equal(v.skillAddCost,6);
 const response=await E.search(d,q,highs);assert.equal(response.results[0].skillAddCost,6);assert.equal(response.results[0].pieces[0].skillAddCost,6);
 const a={defense:600,records:5,skillAdds:1,skillAddCost:15,armors:[]},b={defense:500,records:2,skillAdds:2,skillAddCost:6,armors:[]};
 assert.ok(E.compareResults(a,b,'skillCostAsc')>0);assert.ok(E.compareResults(a,b,'skillCostDesc')<0);
 assert.ok(E.compareResults({...a,skillAddCost:6},b,'skillCostAsc')<0);
 for(const sort of ['skillCostAsc','skillCostDesc']){q.options.resultSort=sort;assert.equal(C.normalize(d,C.payload(d,q)).options.resultSort,sort);}
});
test('限时排序直接改变MILP目标：高防御与低技能cost选择不同装备，五种方向均生效',()=>{
 const d=fixture(),q=query();q.skills=[{id:0,level:1}];d.armors[0].skills=[{skill_id:0,level:1}];
 d.armors.push({...d.armors[0],id:'higher',name:'高防御',defense:200,skills:[]});
 q.options.searchMode='time';
 const expected={defense:'higher',skillCostAsc:'head',skillCostDesc:'higher',skillsAsc:'head',skillsDesc:'higher'};
 for(const [order,id] of Object.entries(expected)){
  q.options.resultSort=order;const {m,raw}=solve(d,q);assert.equal(raw.Status,'Optimal');const r=E.validateResult(d,q,E.reconstruct(m,raw,d,q));assert.equal(r.pieces.find(p=>p.part==='head').id,id,order);
  if(order==='skillCostAsc')assert.equal(r.skillAddCost,0);
  if(order==='skillCostDesc')assert.equal(r.skillAddCost,21);
  if(order==='skillsDesc')assert.equal(r.skillAdds,7);
 }
 q.options.searchMode='count';q.options.resultSort='defense';const count=solve(d,q);assert.equal(E.reconstruct(count.m,count.raw,d,q).armors[0].id,'head');
 const n=fixture(),t=query();n.armors[0].skills=[{skill_id:0,level:2}];n.atoms.push({pool:1,id:73,category:13,cost:1,values:[{value:20,value_index:0,weight:100}]});t.options.searchMode='time';t.options.resultSort='defense';const numeric=solve(n,t);const v=E.validateResult(n,t,E.reconstruct(numeric.m,numeric.raw,n,t));assert.equal(v.defense,641);
 assert.equal(new Set(numeric.m.lp.objective.map(x=>x[1])).size,numeric.m.lp.objective.length);
});
