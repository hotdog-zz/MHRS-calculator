/* Skill extension analysis. Separate objectives; ordinary search is unchanged. */
(function(root){
'use strict';
const E=root.ForgeEngine||(typeof require==='function'?require('./engine.js'):null),I=root.ForgeInventory||(typeof require==='function'?require('./inventory.js'):null),M=root.ForgeMod||(typeof require==='function'?require('./mod.js'):null);
const clone=x=>JSON.parse(JSON.stringify(x)),sum=a=>a.reduce((s,n)=>s+n,0);
const recipeCache=new WeakMap();
function configuration(data,request,config={}){
 const ids=config.skills??data.skills.map(s=>s.id);
 if(!Array.isArray(ids)||!ids.length||ids.length>data.skills.length||new Set(ids).size!==ids.length)throw new Error('请选择有效且不重复的关注技能');
 const base=new Map(request.skills.map(s=>[s.id,s.level]));
 for(const id of ids)if(!data.skills.some(s=>s.id===id))throw new Error('关注技能不存在');
 const skills=ids.filter(id=>base.get(id)!==data.skills.find(s=>s.id===id).max);
 if(!skills.length)throw new Error('所选技能均已达到目标等级上限，请选择其他技能');
 const seconds=Number(config.seconds??90),limit=Number(config.limit??60);
 if(!Number.isFinite(seconds)||seconds<1||seconds>360||!Number.isInteger(limit)||limit<1||limit>270)throw new Error('分析时限须为1至360秒，扩展组上限须为1至270');
 return {skills,seconds,limit};
}
function vector(data,request,result,ids){
 const base=new Map(request.skills.map(s=>[s.id,s.level]));
 return Object.fromEntries(ids.map(id=>[id,Math.max(0,Math.min(result.totals[id]||0,data.skills.find(s=>s.id===id).max)-(base.get(id)||0))]));
}
function key(v){return JSON.stringify(Object.entries(v).filter(([,n])=>n>0).sort((a,b)=>+a[0]-+b[0]));}
function dominates(a,b){return Object.keys({...a,...b}).every(id=>(a[id]||0)>=(b[id]||0));}
function insert(frontier,entry){
 const same=frontier.findIndex(e=>key(e.vector)===key(entry.vector));
 if(same>=0){if(E.compareResults(entry.result,frontier[same].result,'defense')>=0)return false;frontier[same]=entry;return true;}
 if(frontier.some(e=>dominates(e.vector,entry.vector)))return false;
 for(let i=frontier.length-1;i>=0;i--)if(dominates(entry.vector,frontier[i].vector))frontier.splice(i,1);
 frontier.push(entry);return true;
}
const R=root.ForgeResourceTemplates||(typeof require==='function'?require('./resource-templates.js'):null);
const {recipes,recipe,resourceKey,retain,resourceGroups,candidateSkills,materialize,substitutions,completePlan,costProfiles,promote,groupCovers,matchesGroup,groupProfile}=R;
function cut(model,values){
 const witnesses=[];
 for(const v of model.extensionVars){const threshold=(values[v.id]||0)+1;if(threshold>v.max)continue;const z=model.lp.variable('extension_improve');model.lp.constraint([[1,v.n],[-threshold,z]],'>=',0);witnesses.push([1,z]);}
 model.lp.constraint(witnesses,'>=',1);
}
function resourcePattern(model,raw){
 const get=n=>Math.round(raw.Values?raw.Values[model.lp.indices.get(n)]||0:raw.Columns?.[n]?.Primal||0),names=new Set();
 for(const p of model.pieces)if(get(p.x)){names.add(p.x);for(const v of [...p.edits||[],...p.numeric||[],...p.choices||[]])if(!v.fallback)names.add(v.n);}
 for(const c of model.charms)if(get(c.n))names.add(c.n);for(const d of model.decos)names.add(d.n);
 return [...names].map(n=>[n,get(n)]);
}
function cutResource(model,pattern){
 const witnesses=[];for(const [n,value] of pattern){const ub=model.lp.vars[model.lp.indices.get(n)].ub;if(value<ub){const z=model.lp.variable('resource_more');model.lp.constraint([[1,n],[-(value+1),z]],'>=',0);witnesses.push([1,z]);}if(value>0){const z=model.lp.variable('resource_less');model.lp.constraint([[1,n],[ub-value+1,z]],'<=',ub);witnesses.push([1,z]);}}
 model.lp.constraint(witnesses,'>=',1);
}
function build(data,request,ids,armors,charms,direction='levels'){
 const base=new Map(request.skills.map(s=>[s.id,s.level])),all=new Map(base);
 for(const id of ids)if(!all.has(id))all.set(id,0);
 // Zero minima only exist in this internal model. Public request validation
 // and all witnesses continue using the original, positive target levels.
 const internal={...request,skills:[...all].map(([id,level])=>({id,level})),options:{...request.options,searchMode:'count'}};
 const model=E.buildModel(data,internal,armors,charms),tie=model.lp.objective;
 model.extensionVars=ids.map(id=>{const max=data.skills.find(s=>s.id===id).max-(base.get(id)||0),n=model.lp.variable('extension',max);model.lp.constraint([...model.skillTerms[id],[-1,n]],'>=',base.get(id)||0);return {id,n,max};});
 model.lp.objective=[...model.extensionVars.map(v=>[-10000*(direction==='cost'?(data.skills.find(s=>s.id===v.id).cost||1):1),v.n]),...tie.map(([v,n])=>[v*0.0001,n])];
 return model;
}
function context(data,request,inventory){
 if(!request.options?.ownedOnly){E.validateRequest(data,request);return {data,request,charms:null,convert:r=>E.validateResult(data,request,r)};}
 const stock=inventory?.byKey?inventory:I.parse(data,inventory),p=I.prepare(data,stock,request);
 return {...p,convert:r=>{
  const owned={version:1,inventoryId:stock.id,weapon:I.reference(p.weapon),armors:Object.fromEntries(r.pieces.map(a=>{const e=stock.byKey.get(a.id);return [e.base.part,I.reference(e)];})),charm:r.charm.empty?{empty:true}:I.reference(stock.byKey.get(r.charm.ownedKey))};
  return I.validateResult(data,stock,request,{weaponId:request.weaponId,owned,decorations:r.decorations});
 }};
}
async function analyzeFocused(originalData,originalRequest,highs,config,progress=()=>{},execution={},inventory){
 const cfg=configuration(originalData,originalRequest,config),started=Date.now(),deadline=started+cfg.seconds*1000,ctx=context(originalData,originalRequest,inventory),data=ctx.data,request=ctx.request;
 const ids=cfg.skills,focus=new Set(ids),base=new Map(request.skills.map(s=>[s.id,s.level])),wanted=new Map(base);
 for(const id of ids)wanted.set(id,data.skills.find(s=>s.id===id).max);
 const requirements=[...wanted].map(([id,level])=>({id,level}));
 progress({phase:'charms',message:'整理包含关注技能的护石候选…'});
 const charms=request.options?.noCharm?[{id:'none',name:'不使用护石',empty:true,skills:[],slots:[]}]:ctx.charms|| (request.options?.fixedCharm?[request.options.fixedCharm]:E.generateCharms(data,requirements,{fixed:request.options?.fixedCharms!==false}));
 const o=request.options||{},eligible=data.armors.filter(a=>!(o.sex==='MaleOnly'&&a.sex==='FemaleOnly')&&!(o.sex==='FemaleOnly'&&a.sex==='MaleOnly')&&!(o.rank==='Master'&&a.rank!=='Master')&&(!o.fixedArmors?.[a.part]||o.fixedArmors[a.part].id===a.id)&&(!o.locked?.[a.part]||o.locked[a.part]===a.id));
 const rank=a=>E.equivalentScore(a,requirements,data).total+(execution.profile==='alternate'?a.defense/40:0);
 const groups=E.PARTS.map(part=>eligible.filter(a=>a.part===part).map(a=>({a,score:rank(a)})).sort((a,b)=>b.score-a.score||a.a.id.localeCompare(b.a.id)));
 if(groups.some(g=>!g.length)||!charms.length)throw new Error('当前条件下缺少可用的防具或护石');
 const frontier=[],attempts=[],tiers=execution.profile==='alternate'?[24,64,Infinity]:[12,32,Infinity];let cuts=new Map(),complete=false,truncated=false,baseline=null,reason='deadline',serial=0;
 const accept=raw=>{
  const projected=E.validateResult(data,request,E.reconstruct(currentModel,raw,data,request)),result=ctx.convert(projected),v=vector(originalData,originalRequest,result,ids),k=key(v);
  if(!baseline||E.compareResults(result,baseline,'defense')<0)baseline=result;
  const pattern=resourcePattern(currentModel,raw);if(cuts.size<12)cuts.set(JSON.stringify(pattern),pattern);
  const entry={id:k,vector:v,result},keys=new Set(frontier.map(e=>resourceKey(originalData,originalRequest,e)));
  if(keys.size>=cfg.limit&&!keys.has(resourceKey(originalData,originalRequest,entry))&&!frontier.some(e=>dominates(v,e.vector))){truncated=true;return;}
  if(sum(Object.values(v))&&retain(originalData,originalRequest,frontier,entry,cfg.limit))progress({phase:'extension',entry,message:'已发现 '+new Set(frontier.map(e=>resourceKey(originalData,originalRequest,e))).size+' 个资源扩展组'});
 };
 let currentModel;
 for(let stage=0;stage<tiers.length&&Date.now()<deadline;stage++){
  const armors=groups.flatMap(g=>g.slice(0,tiers[stage]).map(v=>v.a));if(stage&&armors.length===groups.flatMap(g=>g.slice(0,tiers[stage-1])).length)continue;
  const full=armors.length===eligible.length,stageEnd=full?deadline:Math.min(deadline,started+cfg.seconds*1000*(stage===0?0.2:0.5));
  currentModel=build(data,request,ids,armors,charms,execution.profile==='alternate'?'cost':'levels');cuts=new Map();const addedCuts=new Set();
  const solver=typeof highs.createModel==='function'?E.persistentSolver(highs,currentModel,data):null;
  progress({phase:'model',stage:stage+1,armors:armors.length,charms:charms.length,message:'分析第 '+(stage+1)+' 轮 · '+armors.length+' 件防具 · '+charms.length+' 枚护石'});
  try{while(Date.now()<stageEnd){
   if(new Set(frontier.map(e=>resourceKey(originalData,originalRequest,e))).size>=cfg.limit){reason='limit';break;}
   progress({phase:'solve',variables:currentModel.lp.vars.length,message:'搜索新的技能组合…'});
   const options={output_flag:false,time_limit:Math.max(0.01,Math.min(execution.solveSlice||5,(stageEnd-Date.now())/1000)),mip_rel_gap:0,mip_abs_gap:0,random_seed:(execution.seed||0)+serial++};
   let lastCandidate=0;
   const raw=solver?solver.solve(options,candidate=>{if(Date.now()-lastCandidate<300)return;try{accept(candidate);lastCandidate=Date.now();}catch{}}):highs.solve(currentModel.lp.text(),options);
   attempts.push({stage:stage+1,full,status:raw.Status,variables:currentModel.lp.vars.length});
   if(raw.Status==='Infeasible'){if(full){complete=true;reason='exhausted';}break;}
   let invalid;
   try{accept(raw);}catch(e){invalid=e;attempts.at(-1).validation=e.message;}
   if(invalid){
    if(invalid.code==='POST_FALLBACK_INVALID'&&E.excludeFreePattern(currentModel,invalid.armorId,raw))continue;
    if(invalid.code==='DEFENSE_CANCELLED'&&E.excludeDefenseCancellation(currentModel,invalid.armorId))continue;
   }
   let changed=false;for(const [k,v] of cuts)if(!addedCuts.has(k)){cutResource(currentModel,v);addedCuts.add(k);changed=true;}
   if(!changed&&raw.Status==='Optimal')break;
   await new Promise(resolve=>setTimeout(resolve,0));
  }}finally{solver?.dispose();}
  if(complete||reason==='limit')break;
 }
 return {entries:frontier,baseline,complete:complete&&!truncated&&!frontier.truncated,reason,elapsedMs:Date.now()-started,attempts,skills:ids,scope:'selected-skills'};
}

// Resource discovery uses original goals only. Optional skills are introduced
// after a small set of armor/charm skeletons has been found.
function coreArmors(data,request,result){
 return result.pieces.map(piece=>{
  if(piece.owned||request.options?.fixedArmors?.[piece.part]?.atoms!==undefined)return {id:piece.id,atoms:clone(piece.atoms)};
  const source=result._freeArmors?.find(p=>p.id===piece.id)?.atoms||piece.atoms;
  return {id:piece.id,atoms:source.filter(a=>{
   const row=data.atoms.find(v=>v.pool===piece.pool&&v.id===a.atomId);
   return !a.fallback&&!(row?.category===13&&a.value>0&&row.cost>0);
  }).map(a=>({...a}))};
 });
}
function resources(data,request,result){
 const cores=coreArmors(data,request,result),holes=[1,2,3,4].map(level=>result.unusedSlots.filter(v=>v===level).length);
 const pieces=result.pieces.map(p=>{
  const core=cores.find(a=>a.id===p.id),fixed=p.owned||!p.pool||request.options?.augment===false||request.options?.fixedArmors?.[p.part]?.atoms!==undefined;
  const records=sum(core.atoms.map(a=>a.count)),positive=sum(core.atoms.filter(a=>{const row=data.atoms.find(v=>v.pool===p.pool&&v.id===a.atomId);return row?.category===19||row?.category===20&&a.value>0;}).map(a=>a.count));
  const cost=sum(core.atoms.map(a=>(data.atoms.find(v=>v.pool===p.pool&&v.id===a.atomId)?.cost||0)*a.count));
  return {part:p.part,records,positive,freeRecords:fixed?0:Math.max(0,(request.options?.defenseFallback?6:7)-records),positiveRoom:fixed?0:Math.max(0,(request.options?.augmentLimits?.[p.part]??7)-positive),budget:fixed?0:p.budget-cost,skillRoom:Math.max(0,5-p.skills.length-new Set(core.atoms.filter(a=>a.skillId!=null&&a.value>0&&!p.skills.some(s=>s.skill_id===a.skillId)).map(a=>a.skillId)).size)};
 });
 return {holes,pieces,positive:sum(pieces.map(p=>p.positive)),freeRecords:sum(pieces.map(p=>p.freeRecords)),budget:sum(pieces.map(p=>p.budget))};
}
function resourceObjective(data,model,request,direction){
 // Reuse exact whole-hole occupancy; never interpret an upgraded hole as a
 // new empty socket, or a low-level jewel as partially occupying a large hole.
 if(!model.slotUsage)E.applySearchObjective(data,{...request,options:{...request.options,resultSort:'unusedSlotsDesc'}},model);
 const holes=[],positive=[],records=[],cost=[],capacities=[];
 const addHoles=(slots,n)=>slots.forEach(level=>{if(level)holes.push([direction==='socketCount'?1:level,n]);});
 for(const p of model.pieces){
  if(p.a.ownedMetrics){const m=p.a.ownedMetrics;addHoles(p.a.slots,p.x);positive.push([m.additions||0,p.x]);records.push([m.records||0,p.x]);continue;}
  if(p.fixed){const v=E.evaluateArmor(data,request,{id:p.a.id,atoms:p.fixed});addHoles(v.slots,p.x);positive.push([v.additions,p.x]);records.push([v.records,p.x]);continue;}
  if(direction==='capacity'&&p.a.pool>0&&request.options?.augment!==false){
   const c=[],r=[],plus=[];for(const e of p.edits){c.push([data.atoms.find(a=>a.pool===p.a.pool&&a.id===e.atom).cost,e.n]);r.push([1,e.n]);if(e.sign>0)plus.push([1,e.n]);}for(const e of p.numeric){c.push([data.atoms.find(a=>a.pool===p.a.pool&&a.id===e.atom).cost,e.n]);r.push([1,e.n]);}for(const e of p.choices){c.push([sum(e.atoms.map(a=>a.cost)),e.n]);r.push([e.atoms.length,e.n]);plus.push([e.atoms.length,e.n]);}
   const n=model.lp.variable('resource_capacity',90);model.lp.constraint([[1,n],...c,[-p.a.budget,p.x]],'<=',0);model.lp.constraint([[1,n],...r.map(([v,k])=>[15*v,k]),[-15*(request.options?.defenseFallback?6:7),p.x]],'<=',0);model.lp.constraint([[1,n],...plus.map(([v,k])=>[15*v,k]),[-15*(request.options?.augmentLimits?.[p.a.part]??7),p.x]],'<=',0);capacities.push([-1e6,n]);
  }
  for(const e of p.edits){records.push([1,e.n]);if(e.sign>0)positive.push([1,e.n]);cost.push([data.atoms.find(a=>a.pool===p.a.pool&&a.id===e.atom).cost,e.n]);}
  for(const n of p.numeric){records.push([1,n.n]);cost.push([data.atoms.find(a=>a.pool===p.a.pool&&a.id===n.atom).cost,n.n]);}
  for(const c of p.choices){addHoles(c.slots,c.n);positive.push([c.atoms.length,c.n]);records.push([c.atoms.length,c.n]);cost.push([sum(c.atoms.map(a=>a.cost)),c.n]);}
 }
 for(const c of model.charms)addHoles(c.c.slots,c.n);
 for(const u of model.slotUsage)holes.push([direction==='socketCount'?-1:-u.level,u.n]);
 const weighted=direction==='capacity'?[...capacities,...positive.map(([v,n])=>[v*1e4,n]),...records.map(([v,n])=>[v*100,n]),...cost,...holes.map(([v,n])=>[-v*.01,n])]:direction!=='positive'?[...holes.map(([v,n])=>[-1e6*v,n]),...positive.map(([v,n])=>[1e4*v,n]),...cost,...records.map(([v,n])=>[v*.01,n])]:[...positive.map(([v,n])=>[1e6*v,n]),...records.map(([v,n])=>[1e4*v,n]),...cost,...holes.map(([v,n])=>[-v*.01,n])];
 const merged=new Map();for(const [v,n] of weighted)merged.set(n,(merged.get(n)||0)+v);model.lp.objective=[...merged].filter(([,v])=>v).map(([n,v])=>[v,n]);
 model.resourceDirection=direction;
}
function finishCore(data,request,cores){
 return cores.map(piece=>{
  const armor=data.armors.find(a=>a.id===piece.id);
  if(request.options?.fixedArmors?.[armor.part]?.atoms!==undefined)return piece;
  return request.options?.defenseFallback&&request.options?.augment!==false&&armor.pool>0?E.finishFreeArmor(data,request,piece):piece;
 });
}
function socketExtensions(data,request,result,ids,emit,deadline,limit=60,verify=r=>E.validateResult(data,request,r)){
 const wanted=new Set(ids),maxima=new Map(data.skills.map(s=>[s.id,s.max])),seen=new Set(),reported=new Set();
 const candidates=data.decorations.filter(d=>d.skills.some(s=>wanted.has(s.skill_id)&&(result.totals[s.skill_id]||0)<maxima.get(s.skill_id))).sort((a,b)=>a.slot-b.slot||String(a.id).localeCompare(String(b.id)));
 let count=0,nodes=0;const nodeLimit=Math.max(24,limit*8);
 const report=r=>{const k=key(vector(data,request,r,ids));if(reported.has(k))return;reported.add(k);emit(r);count++;};
 // Finish a socket recipe before publishing it. Broadcasting every one-jewel
 // prefix could hit the global group cap before any two-jewel recipe existed.
 // Nondecreasing indices avoid permutations; the bounded DFS stores one path.
 const visit=(current,start,depth)=>{
  let extended=false;
  for(let i=start;i<candidates.length&&Date.now()<deadline&&nodes<nodeLimit;i++){
   const d=candidates[i];
   if(!current.unusedSlots.some(level=>level>=d.slot)||!d.skills.some(s=>wanted.has(s.skill_id)&&(current.totals[s.skill_id]||0)<maxima.get(s.skill_id)))continue;
   const c=clone(current),row=c.decorations.find(v=>v.id===d.id);if(row)row.count++;else c.decorations.push({id:d.id,count:1});nodes++;
   let r;try{r=verify(c);}catch{continue;}
   const k=key(vector(data,request,r,ids))+'|'+r.unusedSlots.join(',');if(seen.has(k))continue;seen.add(k);extended=true;visit(r,i,depth+1);
  }
  if(depth&&!extended)report(current);
 };
 visit(result,0,0);return count;
}
function fixedNeighborhood(request,result,freeCharm=false){
 const q=clone(request);q.options.fixedArmors={...q.options.fixedArmors};
 for(const p of result.pieces)if(!q.options.fixedArmors[p.part])q.options.fixedArmors[p.part]={id:p.id};
 if(result.owned){q.ownedArmorKeys={...q.ownedArmorKeys,...Object.fromEntries(E.PARTS.map(part=>[part,I.entryKey(result.owned.armors[part].box,result.owned.armors[part].index)]))};if(!freeCharm&&!result.charm.empty)q.ownedCharmKey=I.entryKey(result.owned.charm.box,result.owned.charm.index);}
 if(!freeCharm&&!q.options.fixedCharm&&!q.options.noCharm){if(result.charm.empty)q.options.noCharm=true;else q.options.fixedCharm=clone(result.charm);}
 return q;
}
function retainSkeletons(bones,bone,direction,limit=20){
 const candidates=[...bones,bone];if(candidates.length<=limit){bones.push(bone);return;}
 const physical=b=>sum(b.profile.holes),room=b=>sum(b.profile.pieces.map(p=>p.positiveRoom)),skills=b=>sum(b.profile.pieces.map(p=>p.skillRoom));
 const metrics=[direction==='positive'?b=>-b.profile.positive:b=>E.unusedSlotScore(b.result),b=>b.profile.budget,physical,b=>b.profile.freeRecords,room,skills];
 const lists=metrics.map(score=>candidates.slice().sort((a,b)=>score(b)-score(a)||b.result.defense-a.result.defense)),selected=new Set();
 for(let rank=0;selected.size<limit&&rank<candidates.length;rank++)for(const list of lists){if(selected.size>=limit)break;selected.add(list[rank]);}
 bones.splice(0,bones.length,...selected);
}
async function analyze(originalData,originalRequest,highs,config,progress=()=>{},execution={},inventory){
 const cfg=configuration(originalData,originalRequest,config),started=Date.now(),deadline=started+cfg.seconds*1000,ctx=context(originalData,originalRequest,inventory),stock=originalRequest.options?.ownedOnly?(inventory?.byKey?inventory:I.parse(originalData,inventory)):null;
 const verify=r=>stock?I.validateResult(originalData,stock,originalRequest,r):E.validateResult(originalData,originalRequest,r),frontier=[],bones=[],seenBones=new Set(),attempts=[];
 let baseline=null,limited=false,firstSkeletonMs=null,firstExtensionMs=null;
 const emit=input=>{
  const result=verify(input),v=vector(originalData,originalRequest,result,cfg.skills);
  if(!baseline||result.defense>baseline.defense)baseline=result;
  if(sum(Object.values(v))){
   const entry={id:key(v),vector:v,result},before=new Set(frontier.map(e=>resourceKey(originalData,originalRequest,e)));
   if(before.size>=cfg.limit&&!before.has(resourceKey(originalData,originalRequest,entry))&&!frontier.some(e=>dominates(v,e.vector))){limited=true;return result;}
   if(retain(originalData,originalRequest,frontier,entry,cfg.limit)){firstExtensionMs??=Date.now()-started;progress({phase:'extension',entry,message:'已发现 '+new Set(frontier.map(e=>resourceKey(originalData,originalRequest,e))).size+' 个资源扩展组'});}
  }
  return result;
 };
 const quick=(result,until)=>{
  if(Date.now()>=until)return;
  emit(result);
  // A socket recipe is checked as a whole against the original request and,
  // in owned mode, against real decoration quantities.
  const add=r=>{const checked=emit(r);return checked;};
  socketExtensions(originalData,originalRequest,result,cfg.skills,add,Math.min(until,Date.now()+80),cfg.limit,verify);
  if(!stock)promote(originalData,originalRequest,{vector:vector(originalData,originalRequest,result,cfg.skills),result},cfg.skills,add,Math.min(until,Date.now()+100),verify);
  if(!stock&&originalRequest.options?.augment!==false){
   const cores=coreArmors(originalData,originalRequest,result);
   outer:for(const core of cores){const armor=originalData.armors.find(a=>a.id===core.id);if(originalRequest.options?.fixedArmors?.[armor.part]?.atoms!==undefined||!armor.pool)continue;
    const rec=sum(core.atoms.map(a=>a.count));if(rec>=(originalRequest.options?.defenseFallback?6:7))continue;
    const rows=originalData.atoms.filter(a=>a.pool===armor.pool&&a.category===20&&a.cost>0&&E.isOrdinaryAtom(a));
    const buckets=[15,12,9,6,3].map(cost=>cfg.skills.filter(id=>originalData.skills.find(s=>s.id===id).cost===cost).sort((a,b)=>Number(armor.skills.some(s=>s.skill_id===b))-Number(armor.skills.some(s=>s.skill_id===a)))),ordered=[];for(let j=0;j<Math.max(0,...buckets.map(v=>v.length));j++)for(const bucket of buckets)if(bucket[j]!==undefined)ordered.push(bucket[j]);
    for(const id of ordered){if(Date.now()>=until)break outer;const s=originalData.skills.find(s=>s.id===id),row=rows.find(a=>a.cost===s.cost&&a.values.some(v=>v.weight>0&&v.value===1));if(!row||(result.totals[id]||0)>=s.max)continue;
     const value=row.values.find(v=>v.weight>0&&v.value===1),trial=clone(cores),piece=trial.find(p=>p.id===core.id);piece.atoms.push({atomId:row.id,skillId:id,value:1,valueIndex:value.value_index,count:1});
     try{const checked=completePlan(originalData,originalRequest,{weaponId:result.weaponId,armors:trial,charm:result.charm,decorations:result.decorations},{[id]:1},verify,until),r=add(checked);socketExtensions(originalData,originalRequest,r,cfg.skills,add,Math.min(until,Date.now()+30),cfg.limit,verify);}catch{}
    }
   }
  }
 };
 const offerActual=r=>{
  firstSkeletonMs??=Date.now()-started;emit(r);
  const profile=resources(originalData,originalRequest,r),cores=coreArmors(originalData,originalRequest,r),k=JSON.stringify([r.armors.map(p=>p.id),E.charmSignature(r.charm),cores.map(p=>E.atomSignature(p.atoms)),profile.holes]);
  if(seenBones.has(k))return;seenBones.add(k);
  const bone={result:r,profile,direction:execution.profile==='alternate'?'positive':'slots'};
  retainSkeletons(bones,bone,bone.direction);
  progress({phase:'skeleton',count:bones.length,direction:bone.direction,profile,message:'已找到资源骨架 '+bones.length+' 套 · 开始验证可用技能'});
  // Incumbent callbacks must stay cheap: finishing many resource alternatives
  // here consumes the MILP's own time budget and can prevent better skeletons.
  socketExtensions(originalData,originalRequest,r,cfg.skills,emit,Math.min(deadline,Date.now()+20),cfg.limit,verify);
  if(!stock)R.affordable(originalData,originalRequest,r,cfg.skills,emit,Math.min(deadline,Date.now()+25),verify);
 };
 const offer=projected=>offerActual(ctx.convert(projected)),initialResults=[];
 for(const candidate of execution.initialResults||[])try{const checked=verify(candidate);offerActual(checked);if(!stock)initialResults.push(checked);}catch{}
 // The global model sees original goals only. A single solve may use the full
 // stage time, rather than repeatedly restarting after five seconds.
 const skeletonSeconds=Math.max(.4,Math.min(cfg.seconds*.55,100)),q={...ctx.request,options:{...ctx.request.options,searchMode:'time',seconds:skeletonSeconds,resultSort:'unusedSlotsDesc'}};
 progress({phase:'resource',message:'阶段1：'+(execution.profile==='alternate'?'最少新增正面词条':'最多空余孔位')+'，只建模原目标技能…'});
 const global=await E.search(ctx.data,q,highs,p=>{if(p.phase!=='result')progress({...p,message:'寻找资源骨架 · '+(p.message||'')});},{...execution,initialResults,bootstrap:false,refine:false,charms:ctx.charms||undefined,transformModel:(m,query)=>resourceObjective(ctx.data,m,query,execution.profile==='alternate'?'positive':'slots'),onVerifiedResult:offer});
 attempts.push(...global.attempts.map(a=>({...a,phase:'skeleton'})));
 for(const r of global.results)try{offer(r);}catch{}
 // Retained skeletons intentionally represent different distributions. Local
 // frontiers are witnesses, not a proof over every possible global skeleton.
 const queues=[...bones].sort((a,b)=>execution.profile==='alternate'?a.profile.positive-b.profile.positive||b.profile.budget-a.profile.budget:E.unusedSlotScore(b.result)-E.unusedSlotScore(a.result)||b.profile.budget-a.profile.budget);
 let jobs=0;
 for(let i=0;i<queues.length&&Date.now()<deadline-50&&!limited;i++){
  const bone=queues[i];quick(bone.result,Math.min(deadline,Date.now()+500));
  // Equal socket-grade sums can mean one Lv2 hole or two Lv1 holes. Search
  // the physical-hole direction locally before introducing optional skills.
  // This retains the two global Worker roles and the original public search.
  const socketQuery=fixedNeighborhood(originalRequest,bone.result),socketSeconds=Math.min(6,(deadline-Date.now())/1000/Math.max(1,queues.length-i)/2);
  if(socketSeconds>=1&&!stock){
   const localDirection=execution.profile==='alternate'?'capacity':'socketCount';progress({phase:'local',message:'阶段2：优化骨架 '+(i+1)+(localDirection==='capacity'?' 的预算与词条余量…':' 的空孔个数，验证多珠组合…')});
   const socketCtx=context(originalData,socketQuery,inventory),sq={...socketCtx.request,options:{...socketCtx.request.options,searchMode:'time',seconds:socketSeconds,resultSort:'unusedSlotsDesc'}};
   const sockets=await E.search(socketCtx.data,sq,highs,()=>{},{...execution,bootstrap:false,refine:false,charms:socketCtx.charms||undefined,transformModel:(m,query)=>resourceObjective(socketCtx.data,m,query,localDirection),onVerifiedResult:r=>quick(socketCtx.convert(r),Math.min(deadline,Date.now()+500))});
   attempts.push(...sockets.attempts.map(a=>({...a,phase:'socket-count'})));for(const r of sockets.results)quick(socketCtx.convert(r),Math.min(deadline,Date.now()+500));
  }
  for(const freeCharm of [false,true]){
   if(Date.now()>=deadline-50||limited)break;
   if(freeCharm&&(originalRequest.options?.fixedCharm||originalRequest.options?.noCharm||originalRequest.ownedCharmKey||cfg.skills.length>16))continue;
   const local=fixedNeighborhood(originalRequest,bone.result,freeCharm),seconds=Math.max(.05,Math.min(freeCharm?8:10,(deadline-Date.now())/1000/Math.max(1,queues.length-i)));
   if(seconds<1)break;
   progress({phase:'local',message:'阶段2：验证骨架 '+(i+1)+' / '+queues.length+' 的技能联动'+(freeCharm?'（重新选择护石）':'')});
   const out=await analyzeFocused(originalData,local,highs,{...cfg,seconds},p=>{if(p.phase==='extension'){try{emit(p.entry.result);}catch{}}},{...execution,solveSlice:10},stock||inventory);
   jobs++;attempts.push(...out.attempts.map(a=>({...a,phase:'local',job:jobs,freeCharm})));for(const entry of out.entries)try{emit(entry.result);}catch{}
  }
 }
 const impossible=!bones.length&&global.fullModelInfeasible;
 return {entries:frontier,baseline,complete:impossible,reason:limited?'limit':Date.now()>=deadline?'deadline':'skeletons-finished',elapsedMs:Date.now()-started,attempts,skills:cfg.skills,scope:'resource-skeletons',stats:{skeletons:bones.length,localJobs:jobs,firstSkeletonMs,firstExtensionMs,direction:execution.profile==='alternate'?'positive':'slots'},skeletons:bones.map(b=>({profile:b.profile,direction:b.direction}))};
}
// These are finite, verified unions, never a claim about a Cartesian product.
function group(data,entries){
 const patterns=new Map(),tokensFor=(entry,id,n)=>{
  const r=entry.result,s=data.skills.find(s=>s.id===+id);
  const dCount=s?.cost===3?sum(r.pieces.flatMap(p=>p.atoms.filter(a=>a.skillId===+id&&a.value>0&&data.atoms.find(row=>row.pool===p.pool&&row.id===a.atomId)?.cost===3).map(a=>a.count||1))):0;
  const hCount=sum(r.decorations.filter(row=>{const d=data.decorations.find(d=>d.id===row.id);return d?.slot===1&&d.skills.length===1&&d.skills[0].skill_id===+id&&d.skills[0].level===1;}).map(row=>row.count));
  const options=[];
  for(let d=0;d<=Math.min(n,dCount);d++)for(let h=0;h<=Math.min(n-d,hCount);h++)options.push([...Array(d).fill('D'),...Array(h).fill('H'),...(n>d+h?['s:'+id+':'+(n-d-h)]:[])]);
  return options.sort((a,b)=>b.filter(t=>t==='D'||t==='H').length-a.filter(t=>t==='D'||t==='H').length||a.join('|').localeCompare(b.join('|')));
 };
 for(const entry of entries){const rows=Object.entries(entry.vector).filter(([,n])=>n>0);let count=0;
  const visit=(i,tokens)=>{if(count>=256)return;if(i===rows.length){count++;if(!tokens.some(t=>t==='D'||t==='H'))return;const sorted=tokens.slice().sort(),k=sorted.join('|');if(!patterns.has(k))patterns.set(k,{tokens:sorted,members:[]});const g=patterns.get(k);if(!g.members.includes(entry))g.members.push(entry);return;}const [id,n]=rows[i];for(const t of tokensFor(entry,id,n))visit(i+1,[...tokens,...t]);};visit(0,[]);
 }
 const covered=new Set(),result=[];
 const candidates=[...patterns.values()].filter(g=>g.members.length>1).sort((a,b)=>b.members.length-a.members.length||b.tokens.filter(t=>t==='D'||t==='H').length-a.tokens.filter(t=>t==='D'||t==='H').length);
 for(const g of candidates){const members=g.members.filter(e=>!covered.has(e.id));if(members.length<2)continue;result.push({tokens:g.tokens,members,generic:true});members.forEach(e=>covered.add(e.id));}
 for(const e of entries)if(!covered.has(e.id))result.push({tokens:Object.entries(e.vector).filter(([,n])=>n>0).map(([id,n])=>'s:'+id+':'+n),members:[e],generic:false});
 return result;
}
function create({data,request,config,inventory,initialResults=[],createWorker,onProgress=()=>{},workerCount=2}){
 const cfg=configuration(data,request,config),ctx=context(data,request,inventory),stock=request.options?.ownedOnly?(inventory?.byKey?inventory:I.parse(data,inventory)):null;
 const frontier=[],workers=[],responses=[],finished=new Set(),errors=[],resourceCounts=new Map(),started=Date.now();let settled=false,initializing=true,timer,resolvePromise,baseline=null;
 const promise=new Promise(resolve=>{resolvePromise=resolve;});
 async function finish(reason){if(settled)return;settled=true;clearTimeout(timer);await Promise.allSettled(workers.map(w=>{try{return w.terminate();}catch{}}));resolvePromise({entries:frontier,baseline,complete:!['limit','cancel'].includes(reason)&&responses.some(r=>r.complete)&&!errors.length,reason,errors,elapsedMs:Date.now()-started,skills:cfg.skills,scope:'resource-skeletons',stats:{skeletons:sum([...resourceCounts.values()]),workers:responses.map(r=>r.stats||null)}});}
 const verify=r=>stock?I.validateResult(data,stock,request,r):E.validateResult(data,request,r);
 function accept(entry){if(settled)return;const result=verify(entry.result),v=vector(data,request,result,cfg.skills);if(key(v)!==key(entry.vector))throw new Error('扩展技能增量不匹配');if(sum(Object.values(v))&&retain(data,request,frontier,{id:key(v),vector:v,result},cfg.limit)){onProgress({phase:'frontier',entries:frontier.slice(),elapsedMs:Date.now()-started});if(new Set(frontier.map(e=>resourceKey(data,request,e))).size>=cfg.limit)finish('limit');}}
 function done(index,response,error){if(finished.has(index)||settled)return;finished.add(index);if(error)errors.push(error);if(response)responses.push(response);if(response?.complete&&!errors.length){finish('exhausted');return;}if(!initializing&&finished.size===workers.length)finish('done');}
 for(let index=0;index<Math.max(1,Math.min(2,workerCount));index++){
  if(settled)break;let current;
  try{const w=current=createWorker(index);workers.push(w);w.onmessage=e=>{if(settled)return;const p=e.data;try{if(p.phase==='extension')accept(p.entry);else if(p.phase==='done'){for(const entry of p.response.entries)accept(entry);if(p.response.baseline){const r=verify(p.response.baseline);if(!baseline||r.defense>baseline.defense)baseline=r;}done(index,p.response);}else if(p.phase==='error')done(index,null,p.message);else {if(p.phase==='skeleton')resourceCounts.set(index,p.count);onProgress({...p,workerIndex:index,skeletonCount:sum([...resourceCounts.values()])});}}catch(error){done(index,null,error.message);w.terminate();}};w.onerror=e=>done(index,null,e.message||'分析线程异常');w.postMessage({data,request,config:cfg,...(stock?{inventory:stock.raw}:{}),execution:{profile:index?'alternate':'balanced',seed:index*1009,initialResults}});}catch(error){errors.push(error.message);if(current){finished.add(index);try{current.terminate();}catch{}}}
 }
 initializing=false;
 if(settled)return {promise,cancel:()=>finish('cancel')};
 if(!workers.length)finish('error');else if(finished.size===workers.length)finish('done');else timer=setTimeout(()=>finish('deadline'),cfg.seconds*1000+2500);
 return {promise,cancel:()=>finish('cancel')};
}
const api={groupCovers,matchesGroup,groupProfile,recipes,completePlan,costProfiles,promote,recipe,resourceKey,retain,resourceGroups,candidateSkills,materialize,substitutions,resourcePattern,cutResource,retainSkeletons,analyzeFocused,coreArmors,resources,resourceObjective,socketExtensions,fixedNeighborhood,configuration,vector,key,dominates,insert,cut,build,analyze,group,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ForgeExtensions=api;
})(globalThis);
