/* Inventory + sufficient capabilities; shared stargazing mode planning. */
(function(root){'use strict';
const E=root.ForgeEngine||(typeof require==='function'?require('./engine.js'):null),I=root.ForgeInventory||(typeof require==='function'?require('./inventory.js'):null),M=root.ForgeMod||(typeof require==='function'?require('./mod.js'):null);
const copy=x=>JSON.parse(JSON.stringify(x)),sum=xs=>xs.reduce((a,b)=>a+b,0),check=(v,m)=>{if(!v)throw Error(m);},skillVector=(levels,targets)=>targets.flatMap(s=>(levels[s.id]||0)>0?[{skill_id:s.id,level:levels[s.id]}]:[]);
function config(raw={}){const seconds=Number(raw.seconds??60),limit=Number(raw.limit??5),skeletons=Number(raw.skeletons??30),modes=raw.modes||['normal','skills','slots'];check(Number.isFinite(seconds)&&seconds>=3&&seconds<=180,'指导时限需为3～180秒');check(Number.isInteger(limit)&&limit>=1&&limit<=50,'路线数量需为1～50');check(Number.isInteger(skeletons)&&skeletons>=2&&skeletons<=120,'候选骨架数量需为2～120');check(['all','inventory'].includes(raw.source||'all'),'待炼防具来源无效');check(modes.length&&modes.every(m=>['normal','skills','slots'].includes(m)),'请至少选择一种炼化方式');return {seconds,limit,skeletons,modes:[...new Set(modes)],source:raw.source||'all',decos:raw.decos==='all'?'all':'owned'};}
// Positive subset recurrence avoids cancellation in inclusion/exclusion.
function exclusiveMean(probabilities){
 if(!probabilities.length)return 0;check(probabilities.length<=5,'观星组最多五件装备');check(probabilities.every(p=>Number.isFinite(p)&&p>0&&p<=1),'观星概率无效');if(sum(probabilities)>1+1e-12)return Infinity;
 const size=1<<probabilities.length,total=new Float64Array(size),mean=new Float64Array(size);
 for(let mask=1;mask<size;mask++){let numerator=1;for(let i=0;i<probabilities.length;i++)if(mask&(1<<i)){total[mask]+=probabilities[i];numerator+=probabilities[i]*mean[mask^(1<<i)];}mean[mask]=numerator/total[mask];}return mean[size-1];
}
function stargazingScore(r){return r.stargazingRolls===undefined?r.expectedRolls:r.stargazingRolls??Infinity;}
function equivalentScore(r){const value=r.equivalentStargazing?.expectedRolls;return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:Infinity;}
function optimizeModes(pieces){
 const pending=pieces.map((piece,index)=>{if(!(piece.expectedRolls>0))return null;const distinct=new Map(),input=piece.probabilities?.length?piece.probabilities:[{mode:piece.mode||'normal',p:1/piece.expectedRolls}];for(const c of input)if(c.mode&&Number.isFinite(c.p)&&c.p>0&&c.p<=1&&(!distinct.has(c.mode)||c.p>distinct.get(c.mode).p))distinct.set(c.mode,c);let choices=[...distinct.values()].sort((a,b)=>b.p-a.p||a.mode.localeCompare(b.mode));check(choices.length,'待炼部件没有有效概率');const shared=piece.pool===6;if(!shared)choices=choices.slice(0,1);return {piece,index,choices,shared,pool:shared?'pool6:'+String(piece.budget??'unknown'):'individual:'+index};}).filter(Boolean);
 const stats={totalCombinations:pending.reduce((n,p)=>n*p.choices.length,1),evaluated:0,nodes:0,pruned:0,groupEvaluations:0},cache=new Map(),seen=new Set(),groups=new Map(),chosen=Array(pieces.length).fill(null);let best=null;
 const cost=ps=>{if(!ps.length)return 0;const key=ps.slice().sort((a,b)=>a-b).join(',');if(!cache.has(key)){cache.set(key,exclusiveMean(ps));stats.groupEvaluations++;}return cache.get(key);};
 const groupKey=(item,c)=>item.pool+'|'+c.mode,epsilon=n=>1e-10*Math.max(1,n);
 function consider(){const key=pending.map(p=>chosen[p.index].mode).join('|');if(seen.has(key))return;seen.add(key);stats.evaluated++;let star=0,individual=0;const byGroup=new Map();for(const item of pending){const c=chosen[item.index],key=groupKey(item,c);if(!byGroup.has(key))byGroup.set(key,{mode:c.mode,pool:item.piece.pool??null,budget:item.piece.budget??null,shared:item.shared,probabilities:[],parts:[]});const g=byGroup.get(key);g.probabilities.push(c.p);g.parts.push(item.piece.part);individual+=1/c.p;}for(const g of byGroup.values()){g.expectedRolls=cost(g.probabilities);g.probabilitySum=sum(g.probabilities);star+=g.expectedRolls;}if(!Number.isFinite(star))return;if(!best||star<best.stargazingRolls-epsilon(best.stargazingRolls)||Math.abs(star-best.stargazingRolls)<=epsilon(star)&&individual<best.expectedRolls){best={stargazingRolls:star,expectedRolls:individual,choices:chosen.slice(),groups:[...byGroup.values()]};}}
 // Useful incumbents: individual optima and one preferred mode at a time.
 for(const pivot of [null,...new Set(pending.flatMap(p=>p.choices.map(c=>c.mode)))]){for(const p of pending)chosen[p.index]=p.choices.find(c=>c.mode===pivot)||p.choices[0];consider();}
 const ordered=pending.slice().sort((a,b)=>a.choices.length-b.choices.length||1/b.choices[0].p-1/a.choices[0].p||a.index-b.index);
 function visit(at,current,individual){stats.nodes++;if(at===ordered.length){consider();return;}
  // Only pool6 shares opportunities. Other pieces have distinct pool keys, so
  // their unavoidable individual costs add in this lower bound as well.
  const increments=new Map();let independent=individual;
  for(let j=at;j<ordered.length;j++){const item=ordered[j];independent+=1/item.choices[0].p;let minimum=Infinity;for(const c of item.choices){const ps=groups.get(groupKey(item,c))||[];minimum=Math.min(minimum,cost([...ps,c.p])-cost(ps));}if(!Number.isFinite(minimum)){stats.pruned++;return;}increments.set(item.pool,Math.max(increments.get(item.pool)||0,minimum));}
  const lower=current+sum([...increments.values()]);if(best&&(lower>best.stargazingRolls+epsilon(best.stargazingRolls)||lower>=best.stargazingRolls-epsilon(best.stargazingRolls)&&independent>=best.expectedRolls-epsilon(best.expectedRolls))){stats.pruned++;return;}
  const item=ordered[at],branches=item.choices.map(c=>{const key=groupKey(item,c),ps=groups.get(key)||[];return {c,key,ps,added:cost([...ps,c.p])-cost(ps)};}).sort((a,b)=>a.added-b.added||b.c.p-a.c.p);
  for(const b of branches){if(!Number.isFinite(b.added)){stats.pruned++;continue;}groups.set(b.key,[...b.ps,b.c.p]);chosen[item.index]=b.c;visit(at+1,current+b.added,individual+1/b.c.p);if(b.ps.length)groups.set(b.key,b.ps);else groups.delete(b.key);}
 }
 visit(0,0,0);return best?{...best,valid:true,stats}:{valid:false,stargazingRolls:null,expectedRolls:sum(pending.map(p=>1/p.choices[0].p)),choices:pieces.map((p,i)=>pending.find(x=>x.index===i)?.choices[0]||null),groups:[],stats};
}
function compare(a,b){return equivalentScore(a)-equivalentScore(b)||stargazingScore(a)-stargazingScore(b)||a.expectedRolls-b.expectedRolls||a.needsRolling-b.needsRolling||a.needsCrafting-b.needsCrafting||a.id.localeCompare(b.id);}
// Equivalence is for completed, verified routes only. Search columns and their
// concrete skill IDs remain untouched: a label swap is not a search shortcut.
function routeEquivalenceKey(data,r){
 if(!r.verified)return 'route:'+r.id;
 const skillMap=new Map(data.skills.map(s=>[s.id,s])),ref=x=>x?[x.box,x.index,x.inventoryIndex,x.idType,x.idVal,x.fingerprint]:null;
 const levels=xs=>xs.filter(([,n])=>n>0).map(([id,n])=>[+id,Math.min(n,skillMap.get(+id)?.max??n)]).sort((a,b)=>a[0]-b[0]);
 const shapes=[];
 for(const p of r.pieces.slice().sort((a,b)=>E.PARTS.indexOf(a.part)-E.PARTS.indexOf(b.part))){
  const base=data.armors.find(a=>a.id===p.baseId);if(!base)return 'route:'+r.id;
  const identity=[p.part,base.id,p.source,ref(p.ref),p.pool??base.pool,p.budget??base.budget],g=p.goal;
  if(!g){shapes.push([...identity,levels((p.skills||[]).map(s=>[s.skill_id,s.level])),p.slots,E.atomSignature(p.atoms||[])]);continue;}
  const native=new Map(base.skills.map(s=>[s.skill_id,s.level])),req=new Map();
  for(const x of g.minimumChanges||[])req.set(x.id,Math.max(req.get(x.id)??-Infinity,x.min));
  for(const s of g.skills||[])req.set(s.skill_id,Math.max(req.get(s.skill_id)??-Infinity,s.level-(native.get(s.skill_id)||0)));
  const nativeNeeds=base.skills.map(s=>[s.skill_id,Math.max(req.get(s.skill_id)??-s.level,g.deleteSkills===false?0:-s.level)]).sort((a,b)=>a[0]-b[0]),foreign=[];
  for(const [id,min]of req)if(!native.has(id)&&min>0){const s=skillMap.get(id);if(!s)return 'route:'+r.id;foreign.push([s.cost??('id:'+id),s.max,min]);}
  foreign.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const wanted=(g.slots||[]).slice().sort((a,b)=>b-a);let growth=0;for(;growth<=12;growth++)if(wanted.every((v,i)=>(E.upgradeSlots(base.slots,growth)[i]||0)>=v))break;if(growth>12)return 'route:'+r.id;
  const probabilities=(p.probabilities||[]).map(v=>[v.mode,v.p]).sort((a,b)=>a[0].localeCompare(b[0]));if(!probabilities.length)return 'route:'+r.id;
  shapes.push([...identity,nativeNeeds,foreign,Math.max(growth,g.minRawSlots||0),g.maxPositiveRecords??7,g.deleteSkills!==false,g.maxRecords??7,g.maxRemoved??null,probabilities]);
 }
 // A complete verified jewel plan travels with the representative, but its
 // recipe is not an independent augmentation route when guarantees match.
 return JSON.stringify(['capabilities-v2',r.weaponId,r.inventoryId,shapes,E.charmSignature(r.charm),ref(r.charm.guideRef),levels(Object.entries(r.totals||{}))]);
}
function preferRepresentative(a,b){const cost=equivalentScore(a)-equivalentScore(b)||stargazingScore(a)-stargazingScore(b)||a.expectedRolls-b.expectedRolls||a.needsRolling-b.needsRolling||a.needsCrafting-b.needsCrafting;if(cost)return cost;const slots=r=>sum(r.pieces.map(p=>sum(p.goal?.slots||p.slots||[])));return slots(b)-slots(a)||a.id.localeCompare(b.id);}
function uniqueRoutes(data,routes,limit=Infinity){const kept=new Map();for(const r of routes){const key=r.equivalenceKey||routeEquivalenceKey(data,r),old=kept.get(key);if(!old||preferRepresentative(r,old)<0)kept.set(key,r);}return [...kept.values()].sort(compare).slice(0,limit);}
function prepare(data,request,raw,cfg){
 const stock=raw?.byKey?raw:I.parse(data,raw),q=copy(request),o=q.options||{};
 E.validateRequest(data,{...q,options:{...o,fixedArmors:{}}});
 if(o.ownedOnly&&q.ownedInventoryId&&q.ownedInventoryId!==stock.id)throw Error('固定条件来自另一份库存，请重新同步当前装备箱');
 const allowed=a=>!(o.sex==='MaleOnly'&&a.sex==='FemaleOnly')&&!(o.sex==='FemaleOnly'&&a.sex==='MaleOnly')&&!(o.rank==='Master'&&a.rank!=='Master');
 let entries=stock.entries.filter(e=>e.kind==='armor'&&e.usable&&allowed(e.base));
 entries=entries.filter(e=>{const f=o.fixedArmors?.[e.base.part],key=o.ownedOnly?q.ownedArmorKeys?.[e.base.part]:null;return (!f||f.id===e.base.id)&&(!Array.isArray(f?.atoms)||E.atomSignature(f.atoms)===E.atomSignature(e.armor.atoms))&&(!key||key===e.key);});
 for(const part of E.PARTS){const f=o.fixedArmors?.[part];if(Array.isArray(f?.atoms))check(entries.some(e=>e.base.part===part),'固定的'+E.PART_NAMES[part]+'炼化不在当前库存；请解除炼化固定，保留防具固定后重试');}
 let charms=stock.entries.filter(e=>e.kind==='charm'&&e.usable).map(e=>({...copy(e.charm),guideRef:I.reference(e),guideSource:'inventory',guideOwned:true}));
 if(o.fixedCharm){
  const fixed=o.fixedCharm,stats=c=>JSON.stringify([c.skills.map(s=>[s.skill_id,s.level]).sort((a,b)=>a[0]-b[0]),c.slots.slice().sort((a,b)=>b-a)]);
  charms=charms.filter(c=>stats(c)===stats(fixed));const preferred=o.ownedOnly&&q.ownedCharmKey?charms.find(c=>c.ownedKey===q.ownedCharmKey):null;if(preferred)charms=[preferred];
  // A specified charm is an explicit planning assumption, not an inventory
  // reference and not a zero-cost estimate of acquiring that charm.
  if(!charms.length)charms=[{id:fixed.id||'specified',name:fixed.name||'指定护石',skills:copy(fixed.skills),slots:[...fixed.slots],...(fixed.fixed?{fixed:true}:{method:fixed.method}),...(fixed.pattern?{pattern:fixed.pattern}:{}),guideSource:'specified',guideOwned:false,guideAcquisitionIncluded:false}];
 }else if(o.ownedOnly&&q.ownedCharmKey)charms=charms.filter(c=>c.ownedKey===q.ownedCharmKey);
 if(o.noCharm)charms=[{id:'none',name:'不使用护石',empty:true,skills:[],slots:[]}];else check(charms.length,'库存中没有可用护石；请在03指定一颗合法护石，或选择不使用护石');
 const keys=new Set();charms=charms.filter(c=>{const k=JSON.stringify([c.skills,c.slots]);if(keys.has(k))return false;keys.add(k);return true;});
 const kept=[],seen=new Set();for(const e of entries){const k=e.base.part+'|'+q.skills.map(s=>Math.min(s.level,e.armor.levels[s.id]||0)).join(',')+'|'+e.armor.slots.join(',');if(seen.has(k))continue;seen.add(k);kept.push({...copy(e.base),id:'keep:'+e.key,skills:copy(e.skills),slots:[...e.armor.slots],defense:0,pool:0,budget:0,guide:{kind:'keep',baseId:e.base.id,entryKey:e.key,ref:I.reference(e),expectedRolls:0,atoms:copy(e.armor.atoms)}});}
 const bases=data.armors.filter(a=>allowed(a)&&(!o.fixedArmors?.[a.part]||o.fixedArmors[a.part].id===a.id)&&!Array.isArray(o.fixedArmors?.[a.part]?.atoms)&&!(o.ownedOnly&&q.ownedArmorKeys?.[a.part])&&(cfg.source==='all'||entries.some(e=>e.base.id===a.id)));
 const fresh=bases.map(a=>({...a,id:'fresh:'+a.id,guide:{kind:cfg.source==='all'?'craft':'reroll',baseId:a.id,pool:a.pool,budget:a.budget,ref:cfg.source==='inventory'?I.reference(entries.find(e=>e.base.id===a.id)):undefined}}));
 const decorations=data.decorations.map(d=>({...d,ownedCount:cfg.decos==='owned'?(stock.counts.get(M.decoToGame(d.id))||0):undefined}));
 const baseOptions={...o,ownedOnly:false,fixedArmors:{},fixedCharm:undefined,locked:undefined,searchMode:'count',resultSort:'skillsAsc',limit:1};
 const query={...q,options:baseOptions};
 return {stock,request:q,query,charms,kept,fresh,bases,decorations,entries};
}
function projected(data,ctx,armors){return {...data,armors,decorations:ctx.decorations};}
function patternData(data,ctx,patterns){return projected(data,ctx,patterns.map(p=>({...p,defense:0,pool:0,budget:0})));}
function guaranteeQuery(ctx){return {...ctx.query,options:{...ctx.query.options,augment:false,deleteSkills:false,defenseFallback:false,augmentLimits:{},fixedArmors:{}}};}
// Initial optimization is deliberately separable. Mode sharing is evaluated
// only by route(), after a complete feasible capability combination exists.
function capabilityCost(guide){const ps=(guide.probabilities||[]).map(c=>c.p).filter(p=>Number.isFinite(p)&&p>0&&p<=1);return ps.length?1/Math.max(...ps):guide.expectedRolls||0;}
function capabilitySession(data,ctx,patterns,highs,excluded=[],seed=null){
 const d=patternData(data,ctx,patterns),q=guaranteeQuery(ctx),model=E.buildModel(d,q,d.armors,ctx.charms,excluded);model.lp.objective=model.pieces.map(p=>[capabilityCost(p.a.guide),p.x]);
 const solver=E.persistentSolver(highs,model,d,seed);
 return {solve(seconds){try{const raw=solver.solve({output_flag:false,time_limit:Math.max(.05,seconds),mip_rel_gap:0,mip_abs_gap:0,mip_max_improving_sols:2147483647});if(raw.Status==='Infeasible'||!raw.Values||model.pieces.filter(p=>Math.round(raw.Values[model.lp.indices.get(p.x)])===1).length!==5||!model.charms.some(p=>Math.round(raw.Values[model.lp.indices.get(p.n)])===1))return null;const r=E.validateResult(d,q,E.reconstruct(model,raw,d,q));return {result:r,data:d,request:q,status:raw.Status,individualCost:sum(r.pieces.map(p=>capabilityCost(d.armors.find(a=>a.id===p.id).guide)))};}catch(e){if(/求解尚未|缺少孔位|五个|目标技能/.test(e.message))return null;throw e;}},
 exclude(solved){const ids=new Set(solved.result.armors.map(a=>a.id)),terms=model.pieces.filter(p=>ids.has(p.a.id)).map(p=>[1,p.x]),charm=model.charms.find(v=>E.charmSignature(v.c)===E.charmSignature(solved.result.charm));if(charm)terms.push([1,charm.n]);model.lp.constraint(terms,'<=',charm?5:4);},dispose(){solver.dispose();}};
}
function solvePatterns(data,ctx,patterns,highs,seconds,excluded=[]){
 if(E.PARTS.some(part=>!patterns.some(p=>p.part===part)))return null;const session=capabilitySession(data,ctx,patterns,highs,excluded);try{return session.solve(seconds);}finally{session.dispose();}
}
function route(solved,ctx){const r=solved.result,byId=new Map(solved.data.armors.map(a=>[a.id,a])),pieces=r.pieces.map(p=>{const a=byId.get(p.id),g=a.guide,base=ctx.stock.entries.find(e=>e.base?.id===g.baseId)?.base;return {id:p.id,part:p.part,name:p.name,baseId:g.baseId,source:g.kind,ref:g.ref,goal:g.goal,pool:g.pool??base?.pool??a.pool,budget:g.budget??base?.budget??a.budget,mode:g.mode,probability:g.probability,probabilities:g.probabilities,expectedRolls:g.expectedRolls||0,exampleAtoms:g.exampleAtoms,atoms:g.atoms,skills:Object.entries(p.levels).filter(([,n])=>n>0).map(([id,level])=>({skill_id:+id,level})),slots:p.slots,rarity:a.rarity??base?.rarity};});
 pieces.sort((a,b)=>E.PARTS.indexOf(a.part)-E.PARTS.indexOf(b.part));
 for(const p of pieces)if(p.expectedRolls>0){const best=(p.probabilities||[]).filter(c=>Number.isFinite(c.p)&&c.p>0&&c.p<=1).sort((a,b)=>b.p-a.p||a.mode.localeCompare(b.mode))[0]||{mode:p.mode||'normal',p:1/p.expectedRolls};p.individualBestMode=best.mode;p.individualProbability=best;p.expectedRolls=1/best.p;}
 const plan=optimizeModes(pieces);for(const [i,c]of plan.choices.entries())if(c){const p=pieces[i];p.mode=p.stargazingMode=c.mode;p.probability=p.stargazingProbability=c;}
 const expectedRolls=sum(pieces.map(p=>p.expectedRolls)),id=pieces.map(p=>p.id).join('|')+'|'+E.charmSignature(r.charm);return {id,weaponId:r.weaponId,inventoryId:ctx.stock.id,stargazingModel:'pool6-exclusive-shared-stream',stargazingRolls:plan.stargazingRolls,stargazingGroups:plan.groups,stargazingIndividualRolls:plan.expectedRolls,modeOptimization:plan.stats,stargazingValid:plan.valid,pieces,charm:r.charm,decorations:r.decorations,placement:r.placement,totals:r.totals,expectedRolls,needsRolling:pieces.filter(p=>p.expectedRolls>0).length,needsCrafting:pieces.filter(p=>p.source==='craft').length,verified:true,scope:'sufficient-skill-slot-goals',solverStatus:solved.status};
}
function optionsFor(base,minLevels,slots,request){return {minimumChanges:request.skills.flatMap(s=>{const original=base.skills.find(x=>x.skill_id===s.id)?.level||0,min=(minLevels[s.id]||0)-original;return original||min>0?[{id:s.id,min}]:[];}),minSlots:[...slots].sort((a,b)=>b-a),maxPositiveRecords:request.options?.augmentLimits?.[base.part]??7,...(request.options?.deleteSkills===false?{maxRemoved:0}:{})};}
function goalIdentity(base,kind,minLevels,slots,options){return JSON.stringify([base.id,kind,minLevels,slots,options.maxPositiveRecords,options.maxRemoved??null]);}
async function analyze(data,request,rawInventory,highs,bank,rawConfig={},progress=()=>{},execution={}){
 const cfg=config(rawConfig),ctx=prepare(data,request,rawInventory,cfg),started=Date.now(),deadline=started+cfg.seconds*1000,results=new Map(),patterns=[...ctx.kept],known=new Set(),errors=[];
 const left=()=>Math.max(0,(deadline-Date.now())/1000),publish=r=>{const key=r.equivalenceKey=routeEquivalenceKey(data,r),old=results.get(key);if(!old||preferRepresentative(r,old)<0){results.set(key,r);progress({phase:'guide-route',route:r});}},partComplete=ps=>E.PARTS.every(part=>ps.some(p=>p.part===part));
 const owned=solvePatterns(data,ctx,patterns,highs,Math.min(8,cfg.seconds*.12));if(owned){publish(route(owned,ctx));return {results:[...results.values()].sort(compare),elapsedMs:Date.now()-started,directOwned:owned.result.charm.guideOwned!==false,patterns:patterns.length,inventoryId:ctx.stock.id,errors};}
 progress({phase:'guide-status',message:'继续组合待炼化部件…'});
 // Newly crafted native armor requires zero rolls. A reroll of an existing
 // negatively augmented armor is not silently treated as a free reset.
 if(cfg.source==='all')for(const a of ctx.fresh)patterns.push({...a,id:'native:'+a.guide.baseId,guide:{...a.guide,expectedRolls:0},pool:0,budget:0});
 const native=partComplete(patterns)?solvePatterns(data,ctx,patterns,highs,Math.min(5,left()*.12)):null;if(native){const r=route(native,ctx);publish(r);if(r.expectedRolls===0)return {results:[...results.values()].sort(compare),elapsedMs:Date.now()-started,directOwned:false,patterns:patterns.length,inventoryId:ctx.stock.id,errors};}
 const skeletons=[],generation=projected(data,ctx,[...ctx.kept,...ctx.fresh]);
 if(left()>1){
  const seconds=Math.max(1,Math.min(8,left()*.2)),q={...ctx.query,options:{...ctx.query.options,augment:request.options?.augment!==false,deleteSkills:request.options?.deleteSkills!==false,defenseFallback:true,seconds,limit:Math.min(8,cfg.skeletons),searchMode:'count'}};
  progress({phase:'guide-status',message:'搜索待炼化骨架…'});
  await E.search(generation,q,highs,m=>{if(m.phase==='result'&&!skeletons.some(r=>E.resultIdentity(r)===E.resultIdentity(m.result)))skeletons.push(m.result);}, {charms:ctx.charms,profile:'alternate',seed:31,completeDefense:false,transformModel:model=>{model.lp.objective=[];for(const p of model.pieces){model.lp.objective.push([p.a.guide.kind==='keep'?0:30,p.x]);for(const e of p.edits||[])model.lp.objective.push([e.sign>0?data.skills.find(s=>s.id===e.skill).cost+5:.05,e.n]);for(const c of p.choices||[])model.lp.objective.push([c.points||c.atoms?.reduce((n,a)=>n+a.value,0)||0,c.n]);}}});
 }
 let patternCount=0,skipped=0,refinements=0,masterBuilds=0,masterSolves=0,session=null,sessionSize=0,bestIndividual=null;
 async function addPattern(source,minLevels,slots,exampleAtoms){
  minLevels={...minLevels};const base=data.armors.find(a=>a.id===source.guide.baseId);
  if(ctx.request.options?.deleteSkills===false)for(const s of base.skills)if(Object.hasOwn(minLevels,s.skill_id))minLevels[s.skill_id]=Math.max(minLevels[s.skill_id],s.level);
  const opts=optionsFor(base,minLevels,slots,ctx.request),key=goalIdentity(base,source.guide.kind,minLevels,slots,opts);if(known.has(key))return null;known.add(key);
  if(left()<.1)return null;const evaluated=await Promise.all(cfg.modes.map(async mode=>({mode,...await bank.query(base,mode,opts)}))),probabilities=evaluated.filter(p=>p.p>0);
  probabilities.sort((a,b)=>b.p-a.p);if(!probabilities.length){skipped++;return null;}const best=probabilities[0],goal={skills:skillVector(minLevels,ctx.request.skills),slots:opts.minSlots,maxPositiveRecords:opts.maxPositiveRecords,deleteSkills:ctx.request.options?.deleteSkills!==false,minimumChanges:opts.minimumChanges};
  const p={...base,id:'goal:'+patternCount++,skills:goal.skills,slots:goal.slots,defense:0,pool:0,budget:0,guide:{...source.guide,goal,mode:best.mode,probability:best,probabilities,expectedRolls:1/best.p,exampleAtoms:copy(exampleAtoms||[])}};patterns.push(p);return p;
 }
 for(let i=0;i<skeletons.length&&left()>.2;i++){
  const r=skeletons[i],mins=new Map(),slots=new Map();for(const p of r.pieces){mins.set(p.id,Object.fromEntries(ctx.request.skills.map(s=>[s.id,p.levels[s.id]||0])));slots.set(p.id,r.placement.filter(v=>v.owner===p.id&&v.decorationId).map(v=>data.decorations.find(d=>d.id===v.decorationId).slot).sort((a,b)=>b-a));}
  const remaining=Object.fromEntries(ctx.request.skills.map(s=>[s.id,Math.max(0,(r.totals[s.id]||0)-s.level)]));
  const changing=r.pieces.filter(p=>generation.armors.find(a=>a.id===p.id).guide.kind!=='keep');
  // Surplus is spent only once across pieces. Independent relaxation of every
  // piece against the original surplus would invalidate the combined guarantee.
  changing.sort((a,b)=>b.skillAddCost-a.skillAddCost);
  for(const p of changing){const min=mins.get(p.id);for(const s of ctx.request.skills){const drop=Math.min(min[s.id],remaining[s.id]);min[s.id]-=drop;remaining[s.id]-=drop;}}
  for(const p of changing){if(left()<.1)break;await addPattern(generation.armors.find(a=>a.id===p.id),mins.get(p.id),slots.get(p.id),p.atoms);}
  progress({phase:'guide-status',message:'评估炼化目标 '+(i+1)+' / '+skeletons.length+' · '+patterns.length+'个候选能力'});
  if(i===0&&partComplete(patterns)&&left()>.3){const solved=solvePatterns(data,ctx,patterns,highs,Math.min(1,left()*.1));if(solved){bestIndividual=solved;publish(route(solved,ctx));}}
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 // Probability-priced master: rebuild only after new columns arrive; reuse the
 // native model for alternative routes, and seed a larger model with its best
 // individual-cost incumbent. No stargazing information enters this objective.
 const anchors=[],expanded=new Set(),triedMoves=new Set(),sourceById=new Map(ctx.fresh.map(a=>[a.guide.baseId,a]));
 function master(seconds){if(!partComplete(patterns))return null;if(!session||sessionSize!==patterns.length){session?.dispose();session=capabilitySession(data,ctx,patterns,highs,[],bestIndividual?.result);sessionSize=patterns.length;masterBuilds++;}masterSolves++;const solved=session.solve(seconds);if(solved){if(!bestIndividual||solved.individualCost<bestIndividual.individualCost)bestIndividual=solved;publish(route(solved,ctx));if(!anchors.some(a=>a.result.armors.map(p=>p.id).join('|')===solved.result.armors.map(p=>p.id).join('|')))anchors.push(solved);}return solved;}
 function neighborhoods(solved){
  const chosen=solved.result.pieces.map(p=>{const a=solved.data.armors.find(a=>a.id===p.id);return {a,source:sourceById.get(a.guide.baseId),levels:Object.fromEntries(ctx.request.skills.map(s=>[s.id,p.levels[s.id]||0])),slots:solved.result.placement.filter(v=>v.owner===p.id&&v.decorationId).map(v=>data.decorations.find(d=>d.id===v.decorationId).slot).sort((a,b)=>b-a),cost:capabilityCost(a.guide)};}).sort((a,b)=>b.cost-a.cost);
  const moves=[],put=(priority,goals)=>{if(goals.some(g=>!g.source))return;const key=JSON.stringify(goals.map(g=>[g.source.id,g.levels,g.slots]));if(triedMoves.has(key))return;moves.push({key,priority,goals});};
  const spec=(p,levels=p.levels,slots=p.slots)=>({source:p.source,levels,slots});
  for(const p of chosen){
   if(!p.source)continue;
   // A different native skill layout may realize the same capability much more
   // often. Limit the shortlist by missing levels / growth, not by shared modes.
   const proxy=a=>sum(ctx.request.skills.map(s=>Math.max(0,(p.levels[s.id]||0)-(a.skills.find(v=>v.skill_id===s.id)?.level||0))*(data.skills.find(v=>v.id===s.id).cost??100)))+Math.max(0,sum(p.slots)-sum(a.slots))*6;
   const alternatives=ctx.fresh.filter(a=>a.part===p.a.part&&a.id!==p.source.id).sort((a,b)=>proxy(a)-proxy(b)||a.id.localeCompare(b.id)).slice(0,6);
   for(const a of alternatives)put(p.cost,[{source:a,levels:p.levels,slots:p.slots}]);
   for(const target of ctx.request.skills){const id=target.id;if(!(p.levels[id]>0))continue;const relaxed={...p.levels,[id]:p.levels[id]-1};
    for(const receiver of chosen)if(receiver!==p&&receiver.source&&(receiver.levels[id]||0)<data.skills.find(s=>s.id===id).max)put(p.cost,[spec(p,relaxed),spec(receiver,{...receiver.levels,[id]:(receiver.levels[id]||0)+1})]);
   }
   for(let i=0;i<p.slots.length;i++){if(i&&p.slots[i]===p.slots[i-1])continue;const level=p.slots[i],relaxed=p.slots.filter((_,j)=>j!==i);
    for(const receiver of chosen)if(receiver!==p&&receiver.source&&receiver.slots.length<3)put(p.cost+1,[spec(p,p.levels,relaxed),spec(receiver,receiver.levels,[...receiver.slots,level].sort((a,b)=>b-a))]);
   }
  }
  return moves.sort((a,b)=>b.priority-a.priority);
 }
 try{
  if(left()>.15)master(Math.min(2,left()*.15));
  // Add simple capabilities independently of the seed's per-part allocation.
  // Otherwise changing a native skill layout can require a coordinated move
  // which a one-level local descent never proposes. Retain representative
  // armor for skills without decorations as well as high-equivalent armor.
  if(ctx.request.options?.augment!==false){
   const score=a=>E.equivalentScore(a,ctx.request.skills,data).total,selected=new Map();
   for(const part of E.PARTS){const eligible=ctx.fresh.filter(a=>a.part===part&&a.pool>0),ranked=eligible.map(a=>({a,score:score(a)})).sort((a,b)=>b.score-a.score||a.a.id.localeCompare(b.a.id));
    for(const {a}of ranked.slice(0,Math.min(6,Math.max(2,Math.ceil(cfg.skeletons/10)))))selected.set(a.id,a);
    for(const s of ctx.request.skills)if(!data.decorations.some(d=>d.skills.some(v=>v.skill_id===s.id)))for(const {a}of ranked.filter(({a})=>a.skills.some(v=>v.skill_id===s.id)).slice(0,2))selected.set(a.id,a);
   }
   for(const anchor of anchors)for(const p of anchor.result.pieces){const a=anchor.data.armors.find(a=>a.id===p.id),source=sourceById.get(a.guide.baseId);if(source)selected.set(source.id,source);}
   let processed=0;
   for(const source of selected.values()){
    if(left()<Math.max(1,cfg.seconds*.25))break;
    const levels=Object.fromEntries(ctx.request.skills.map(s=>[s.id,Math.min(s.level,source.skills.find(v=>v.skill_id===s.id)?.level||0)])),shapes=new Map();for(const points of [0,1,2,3]){const slots=E.upgradeSlots(source.slots,points).filter(v=>v>0);shapes.set(slots.join(','),slots);}
    const upgrades=[null,...ctx.request.skills.filter(s=>(levels[s.id]||0)<s.level&&data.skills.find(v=>v.id===s.id).cost!=null)];
    for(const s of upgrades)for(const slots of shapes.values()){if(left()<Math.max(.5,cfg.seconds*.2))break;await addPattern(source,s?{...levels,[s.id]:(levels[s.id]||0)+1}:levels,slots);}
    processed++;if(processed%4===0){progress({phase:'guide-status',message:'评估独立技能／孔位能力 · '+processed+' / '+selected.size});await new Promise(resolve=>setTimeout(resolve,0));}
   }
   if(left()>.2)master(Math.min(3,left()*.2));
  }
  // Bound the neighborhood, keep improving the hardest pieces first, and query
  // probabilities before accepting any proposal into the priced model.
  for(let round=0;round<Math.ceil(cfg.skeletons/2)&&left()>.5;round++){
   const anchor=anchors.filter(a=>!expanded.has(a)).sort((a,b)=>a.individualCost-b.individualCost)[0];if(!anchor)break;
   const moves=neighborhoods(anchor),batch=Math.max(24,Math.min(64,cfg.skeletons*2));let added=0;
   if(moves.length<=batch)expanded.add(anchor);
   for(const move of moves.slice(0,batch)){if(left()<Math.max(.4,cfg.seconds*.07))break;triedMoves.add(move.key);for(const g of move.goals)if(await addPattern(g.source,g.levels,g.slots))added++;refinements++;}
   progress({phase:'guide-status',message:'按逐件概率优化 · '+patterns.length+'个候选能力 · '+refinements+'组调整'});
   if(added&&left()>.2)master(Math.min(2,left()*.18));
   else if(!anchors.some(a=>!expanded.has(a)))break;
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  // Enumerate nearby individual optima with row additions on the same model.
  // Only completed candidates receive joint mode allocation and final ranking.
  if(bestIndividual&&left()>.1){let solved=master(Math.min(1.5,left()*.25));const minimum=Math.max(8,cfg.limit*2),maximum=Math.min(160,Math.max(minimum,cfg.limit*8));for(let i=0;i<maximum&&solved&&left()>.1&&(i<minimum||results.size<cfg.limit);i++){session.exclude(solved);solved=master(Math.min(1.5,left()/Math.max(1,Math.min(5,cfg.limit-i))));}}
 }finally{session?.dispose();}
 return {results:[...results.values()].sort(compare).slice(0,cfg.limit),elapsedMs:Date.now()-started,directOwned:false,patterns:patterns.length,skeletons:skeletons.length,refinements,masterBuilds,masterSolves,individualBestRolls:bestIndividual?.individualCost,unobservedGoals:skipped,inventoryId:ctx.stock.id,errors,scope:'individual expected rolls master with bounded capability neighborhoods; stargazing allocation only for final ranking'};
}
const api={config,compare,prepare,solvePatterns,capabilitySession,capabilityCost,route,routeEquivalenceKey,preferRepresentative,uniqueRoutes,optionsFor,exclusiveMean,optimizeModes,stargazingScore,equivalentScore,analyze};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ForgeHandcraft=api;
})(globalThis);
