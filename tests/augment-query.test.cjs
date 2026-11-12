const {test}=require('node:test'),assert=require('node:assert/strict'),D=require('../dist/data.json'),S=require('../dist/augment-sim.js');
const row=(atoms=[],skills=[])=>({atoms:atoms.map((a,i)=>({atomId:144+i,valueIndex:0,count:1,category:20,...a})),skills,skillAdds:atoms.filter(a=>a.value>0).reduce((n,a)=>n+a.value,0),defense:100,defenseDelta:-2,slotPoints:3,cost:9,skillCost:9});
test('B档指令统计最终新增记录，原生B档及其他档不冒充B档',()=>{
 const query=S.compileQuery(D,'grade.B >= 1 AND removed = 0');assert.equal(query(row([{skillId:0,cost:9,value:1}])),true);assert.equal(query(row([{skillId:0,cost:12,value:1}])),false);assert.equal(query(row([],[{skill_id:202,level:3}])),false);assert.equal(query(row([{skillId:0,cost:9,value:1},{skillId:1,cost:-10,value:-1}])),false);
 assert.equal(S.compileQuery(D,'grade_at_least.B >= 1 AND NOT (removed > 0)')(row([{skillId:0,cost:15,value:1}])),true);assert.deepEqual(S.GRADES,{D:3,C:6,B:9,A:12,S:15});
});
test('逻辑优先级、括号、NOT与各比较符和中文别名可组合',()=>{
 const r=row([{cost:9,value:1}]);for(const text of ['(grade.B = 1 OR grade.A > 0) AND NOT removed','grade.B == 1 && !(removed != 0)','grade.B >= 1 且 删除技能 = 0','records <> 0 AND defense_delta <= -2 AND slots > 2','cost >= 9 AND added_cost = 9 AND added = 1','grade.A > 0 OR grade.B > 0 AND removed = 0'])assert.equal(S.compileQuery(D,text)(r),true,text);
 assert.equal(S.compileQuery(D,'grade.A > 0 AND (grade.B > 0 OR removed > 0)')(r),false);
});
test('扩孔查询区分原始总点数、最终实际增长与溢出，截断不改变费用及记录',()=>{
 const base=S.createContext(D,'Arm:502'),slot=(id,value,cost)=>({atomId:id,category:19,cost,value,valueIndex:0,count:1}),r=S.finalize(base,[slot(141,3,18),slot(139,1,6)],{});
 assert.equal(r.slotPoints,4);assert.equal(r.effectiveSlotPoints,2);assert.equal(r.overflowSlotPoints,2);assert.equal(r.cost,24);assert.equal(r.atoms.length,2);
 assert.ok(S.compileQuery(D,'slots = 4 AND effective_slots = 2 AND overflow_slots = 2')(r));
 assert.equal(S.compileQuery(D,'slots = 2')(r),false);assert.equal(S.compileQuery(D,'effective_slots > 2')(r),false);
});
test('按技能名称、英文名称和ID统计新增、删除与包含原生的最终等级',()=>{
 const r=row([{skillId:0,cost:15,value:1},{skillId:5,cost:-10,value:-1}],[{skill_id:0,level:3},{skill_id:5,level:2}]);
 for(const q of ['added("攻击") >= 1 AND skill("看破") >= 2','skill(0) = 3 AND removed(5) = 1',"skill('Attack Boost') = 3 AND added(攻击) = 1"] )assert.equal(S.compileQuery(D,q)(r),true,q);
 assert.equal(S.skillLevel(r,0,'final'),3);assert.equal(S.skillLevel(r,0,'added'),1);assert.equal(S.skillLevel(r,5,'removed'),1);assert.equal(S.skillLevel(r,231,'final'),0);
});
test('未知字段、损坏指令、过长或过深输入被拒绝，无法运行JS或访问对象属性',()=>{
 for(const q of ['grade.Z >= 1','skill("不存在的技能") > 0','grade.B >=','removed = 0; alert(1)','constructor.constructor("return process")()','__proto__ = 1','skill("攻击"','defense + 1 > 0','='.repeat(2001),'NOT '.repeat(40)+'removed'])assert.throws(()=>S.compileQuery(D,q),undefined,q);
 assert.equal(S.compileQuery(D,'  \n ')(row()),true);
});
test('筛选命中基于全部样本，不因保留容量不同而改变，也不改变抽选序列',()=>{
 const cfg={armorId:'Head:502',mode:'normal',count:3000,limit:1,sort:'defense',seed:234,query:'grade.B >= 1 AND removed = 0'},a=S.createBatch(D,cfg),b=S.createBatch(D,{...cfg,limit:100});while(!a.step(37)){}while(!b.step(211)){}assert.deepEqual(a.stats,b.stats);const ctx=S.createContext(D,cfg.armorId),rng=S.createRng(cfg.seed,ctx.armor.budget,cfg.mode);let expected=0;for(let i=0;i<cfg.count;i++){const r=S.roll(ctx,rng);if(r.atoms.some(a=>a.category===20&&a.cost===9&&a.value>0)&&!r.atoms.some(a=>a.category===20&&a.value<0))expected++;}assert.equal(a.stats.matches,expected);assert.ok(expected>0);assert.equal(a.keep.map.size,1);
});
test('指定技能的最终等级和新增等级均支持升降序，固定容量堆与全量排序一致',()=>{
 const ctx=S.createContext(D,'Head:502'),rng=S.createRng(8,ctx.armor.budget,'normal'),rows=Array.from({length:700},()=>S.roll(ctx,rng)),target=200,all=new Map();for(const r of rows)all.set(S.identity(r),r);
 for(const metric of ['final','added'])for(const sort of ['specificSkill','specificSkillAsc']){const kept=new S.Retained(25,sort,target,metric);rows.forEach((r,i)=>kept.add(r,i));const expected=[...all.values()].sort((a,b)=>S.compare(a,b,sort,target,metric)).slice(0,25);assert.deepEqual(kept.rows().map(S.identity),expected.map(S.identity));}
 const low=row([],[{skill_id:0,level:1}]),high=row([],[{skill_id:0,level:3}]);assert.ok(S.compare(high,low,'specificSkill',0)<0);assert.ok(S.compare(high,low,'specificSkillAsc',0)>0);
 assert.throws(()=>S.createBatch(D,{armorId:'Head:502',mode:'normal',count:1,limit:1,sort:'specificSkill',seed:1,sortSkill:-1}),/排序的技能/);
});
