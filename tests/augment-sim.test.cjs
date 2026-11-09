const {test}=require('node:test'),assert=require('node:assert/strict'),D=require('../dist/data.json'),S=require('../dist/augment-sim.js');
function context(mode='normal',pool=6){return S.createContext(D,D.armors.find(a=>a.pool===pool).id,mode);}
function effect(ctx,id,extra={}){const r=ctx.byId.get(id),v=r.values[0];return {atomId:id,category:r.category,cost:r.cost,value:v.value,valueIndex:v.value_index,count:1,...([13,14,15].includes(r.category)?{attribute:r.category===13?'defense':S.ELEMENTS[Math.floor((id-89)/10)]}:{}),...extra};}
test('13张类别表及123种技能均可用；固定专用词条不进入普通候选',()=>{
 assert.equal(D.augmentationLottery.length,13);assert.equal(D.skills.filter(s=>s.cost!=null).length,123);
 const c=context();assert.deepEqual(c.categories,[40,30,10,20]);assert.ok(c.byId.has(61)&&c.byId.has(70));assert.ok(![...c.ordinary.values()].flat().some(r=>[61,70,71,72,91,101,111,121,131].includes(r.id)));
 assert.deepEqual(context('normal',13).categories,[49,39,12,0]);assert.throws(()=>context('skills',13),/不支持/);
});
test('同种子重现；加权抽选保留权重，并不预先过滤超预算结果',()=>{
 const c=context(),a=S.createRng(123,c.armor.budget,'normal'),b=S.createRng(123,c.armor.budget,'normal');assert.deepEqual(Array.from({length:20},()=>a.next()),Array.from({length:20},()=>b.next()));
 const rows=[{weight:1,id:1},{weight:3,id:2}];assert.deepEqual([0,1,2,3].map(n=>S.weighted(rows,{int:()=>n}).id),[1,2,2,2]);
 const r=S.roll(c,S.createRng(1,10,'normal'),{trace:true,draw:()=>({effect:{...effect(c,76),cost:99}})});assert.equal(r.attempts,50);assert.equal(r.atoms.length,0);assert.equal(r.termination,'failures');assert.ok(r.trace.every(t=>t.reason==='budget'));
});
test('固定步骤、收尾优先级、源表同cost优先及非最大取值',()=>{
 const c=context(),rng={int:()=>0},normal0=S.draw(c,{step:0,records:[],cost:0},rng),normal1=S.draw(c,{step:1,records:[],cost:0},rng);assert.equal(normal0.effect.category,13);assert.equal(normal1.effect.category,20);
 const skill=context('skills'),slot=context('slots');assert.equal(S.draw(skill,{step:0,records:[],cost:0},rng).effect.value,-1);assert.equal(S.draw(skill,{step:1,records:[],cost:0},rng).effect.value,-7);assert.ok([9,12,15].includes(S.draw(skill,{step:2,records:[],cost:0},rng).effect.cost));
 assert.equal(S.draw(slot,{step:1,records:[],cost:0},rng).effect.atomId,61);assert.ok([1,2].includes(S.draw(slot,{step:2,records:[],cost:0},rng).effect.value));
 const closing=S.draw(c,{step:0,records:Array(6).fill({}),cost:c.armor.budget-3},rng);assert.equal(closing.effect.atomId,71);assert.equal(closing.effect.fallback,true);
 const variable=S.draw(c,{step:0,records:Array(6).fill({}),cost:0},rng);assert.equal(variable.effect.value,8);assert.equal(variable.effect.atomId,76);
});
test('相消撤销记录与cost，六条收尾抵消后继续，严格先付费用再相消',()=>{
 const source=context('normal',2),native=D.skills.find(s=>s.cost===3&&s.max>=3),armor={...source.armor,id:'test',budget:18,skills:[{skill_id:native.id,level:3}]},c=S.createContext({...D,armors:[armor]},'test');
 const seq=[effect(c,59),effect(c,149,{skillId:native.id}),effect(c,89,{value:-1,valueIndex:0}),effect(c,100),effect(c,148,{skillId:0}),effect(c,148,{skillId:0}),effect(c,73,{value:6,valueIndex:0,fallback:true}),effect(c,144,{skillId:D.skills.find(s=>s.cost===3&&s.id!==native.id).id})];let i=0;
 const r=S.roll(c,{int:()=>0},{trace:true,draw:()=>({effect:seq[i++]})});assert.equal(r.attempts,8);assert.equal(r.atoms.length,6);assert.equal(r.cost,18);assert.equal(r.termination,'budget');assert.ok(!r.atoms.some(a=>a.category===13));assert.equal(r.trace[6].cancelled,2);assert.equal(r.trace[7].cancelled,0);
 seq[7]=effect(c,144,{skillId:native.id});i=0;const restarted=S.roll(c,{int:()=>0},{draw:()=>({effect:seq[i++]})});assert.equal(restarted.restarts,1);assert.equal(restarted.atoms.length,0);assert.equal(restarted.termination,'failures');
 const stop=S.roll(source,{int:()=>0},{trace:true,draw:()=>({effect:{...effect(source,76),cost:source.armor.budget}})});assert.equal(stop.attempts,1);assert.equal(stop.termination,'budget');
 const first=effect(source,59),expensive={...effect(source,74),value:6,cost:99};let step=0;const paid=S.roll(source,{int:()=>0},{trace:true,draw:()=>({effect:step++===0?first:expensive})});assert.equal(paid.trace[1].reason,'budget');assert.equal(paid.atoms.length,1);
});
test('技能相消只删最早相反记录；普通耐性与特化耐性分组不同',()=>{
 const c=context(),add=effect(c,144,{skillId:1}),del=effect(c,149,{skillId:1});assert.deepEqual(S.cancelRecords([add,{...add,valueIndex:3}],del).map(r=>r.valueIndex),[3]);
 const a=effect(c,91),b=effect(c,94,{value:7});assert.equal(S.cancelRecords([a],b).length,2);
 const minus=effect(c,89),plus=effect(c,94,{value:1});assert.equal(S.cancelRecords([minus],plus).length,0);
});
test('技能特化第三步的技能检查失败重试，超预算则正常推进',()=>{
 const c=context('skills'),skill=D.skills.find(s=>s.cost===9);c.native=new Map([[skill.id,skill.max]]);const steps=[];let retries=0;
 const r=S.roll(c,{int:()=>0},{draw:(_,state)=>{steps.push(state.step);if(state.step<2)return {reason:'empty'};if(state.step===2){retries++;return {third:true,effect:effect(c,146,{skillId:skill.id,...(retries===3?{cost:99}:{})})};}return {effect:effect(c,76)};}});
 assert.deepEqual(steps,[0,1,2,2,2,3]);assert.equal(r.termination,'budget');assert.equal(r.atoms.length,1);
});
test('容量计算按外来新增记录计数，满容量可继续增加已引入技能，删除不释放原生种类',()=>{
 const base=context(),native=[...base.native.keys()],foreign=D.skills.filter(s=>s.cost===3&&!base.native.has(s.id)).slice(0,5),a=effect(base,144,{skillId:foreign[0].id});
 const records=Array.from({length:5-base.native.size},()=>a);assert.equal(S.validateEffect(base,records,{...a,skillId:foreign[1].id}),'skill');assert.equal(S.validateEffect(base,records,a),null);
 const empty=S.cancelRecords([effect(base,149,{skillId:native[0]})],effect(base,144,{skillId:native[0]}));assert.equal(empty.length,0);
});
test('各Pool和四模式抽选满足记录、预算、技能与抵消规则；稳定型只产生正面变化',()=>{
 for(const pool of [1,2,3,4,5,6,13])for(const mode of Object.keys(S.MODES)){
  if(pool===13&&['skills','slots'].includes(mode))continue;const c=context(mode,pool),rng=S.createRng(98,c.armor.budget,mode);
  for(let i=0;i<100;i++){const r=S.roll(c,rng);assert.ok(r.atoms.length<=7);assert.ok(r.cost<=c.armor.budget);for(const s of r.skills)assert.ok(s.level>=0&&s.level<=c.skills.get(s.skill_id).max);assert.ok(c.native.size+new Set(r.atoms.filter(a=>a.category===20&&a.value>0&&!c.native.has(a.skillId)).map(a=>a.skillId)).size<=5);
   const defense=r.atoms.filter(a=>a.category===13);if(defense.length)assert.notEqual(defense.reduce((n,a)=>n+a.value,0),0);if(r.atoms.length===7)assert.ok(defense.length);if(mode==='stable')assert.ok(r.atoms.every(a=>a.value>0&&a.category!==20));
  }
 }
});
test('固定容量堆与全量排序逐项一致，保留项频次准确，不随批量次数增长',()=>{
 const c=context(),rng=S.createRng(9,c.armor.budget,'normal'),rows=Array.from({length:700},()=>S.roll(c,rng));rows.push(...rows.slice(0,150),...rows.slice(0,150));
 for(const sort of ['defense','defenseAsc','slots','slotsAsc','skills','skillsAsc','skillCost','skillCostAsc']){
  const all=new Map(),keep=new S.Retained(15,sort);rows.forEach((r,i)=>{const key=S.identity(r);if(all.has(key))all.get(key).count++;else all.set(key,{...r,key,count:1});keep.add(r,i);assert.ok(keep.map.size<=15&&keep.heap.length<=15);});
  const expected=[...all.values()].sort((a,b)=>S.compare(a,b,sort)).slice(0,15);assert.deepEqual(keep.rows().map(r=>[r.key,r.count]),expected.map(r=>[r.key,r.count]));
 }
});
test('分批大小不影响种子和结果，所有统计覆盖完整样本',()=>{
 const c=context(),config={armorId:c.armor.id,mode:'normal',count:1200,limit:30,sort:'skills',seed:42},a=S.createBatch(D,config),b=S.createBatch(D,config);while(!a.step(37)){}while(!b.step(199)){}assert.deepEqual(a.keep.rows(),b.keep.rows());assert.deepEqual(a.stats,b.stats);assert.equal(a.stats.completed,1200);assert.equal(a.stats.matches,1200);assert.equal(Object.values(a.stats.terminations).reduce((n,x)=>n+x),1200);assert.ok(a.keep.map.size<=30);
 assert.throws(()=>S.createBatch(D,{...config,count:1e8}),/次数/);assert.throws(()=>S.createBatch(D,{...config,limit:100000}),/保留数量/);
});
test('目标命中按所有样本的单件最终技能统计，计入原生等级而非保留列表',()=>{
 const c=context('stable'),native=c.armor.skills.find(s=>s.level<D.skills.find(k=>k.id===s.skill_id).max),cfg={armorId:c.armor.id,mode:'stable',count:500,limit:1,sort:'defense',seed:3,targetSkill:native.skill_id,targetLevel:native.level},a=S.createBatch(D,cfg),b=S.createBatch(D,{...cfg,targetLevel:native.level+1});while(!a.step()){}while(!b.step()){}assert.equal(a.stats.matches,500);assert.equal(b.stats.matches,0);assert.equal(a.keep.map.size,1);
});
