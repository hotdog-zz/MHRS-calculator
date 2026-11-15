(function(root){'use strict';
const E=root.ForgeEngine||(typeof require==='function'?require('./engine.js'):null),H=root.ForgeHandcraft||(typeof require==='function'?require('./handcraft.js'):null),S=root.ForgeStargazing||(typeof require==='function'?require('./stargazing.js'):null),I=root.ForgeInventory||(typeof require==='function'?require('./inventory.js'):null);
const copy=x=>JSON.parse(JSON.stringify(x)),sum=xs=>xs.reduce((a,b)=>a+b,0),eq=r=>r?.equivalentStargazing?.expectedRolls??Infinity,compare=(a,b)=>{const x=eq(a),y=eq(b);if(Number.isFinite(x)&&Number.isFinite(y)){const delta=x-y;if(Math.abs(delta)>1e-9*Math.max(1,Math.min(x,y)))return delta;}else if(x!==y)return x-y;return a.expectedRolls-b.expectedRolls||a.id.localeCompare(b.id);};
function createEvaluator(data,request,inventory,bank,config={},options={}){
 const routeCache=new Map(),groupCache=new Map(),currentGroupCache=new Map(),priceCache=new Map(),donor=data.armors.find(a=>a.id===S.SOURCE),modes=config.modes||['normal','skills','slots'];
 const stats={routes:0,routeCacheHits:0,modeAssignments:0,modeImprovements:0,budgetLimited:0,lowerBoundPruned:0},deadline=options.deadlineMs||Infinity;
 const routeKey=r=>JSON.stringify([r.id,r.decorations,r.placement]);
 async function lowerBound(input,until){
  const pending=input.pieces.filter(p=>p.expectedRolls>0&&p.pool===6),shapes=pending.map(p=>S.correctedShape(S.shape(data,p,request),config));if(!shapes.length)return 0;if(shapes.some(s=>!s))return 0;
  const recipes=S.recipes(data,input,shapes,inventory,config),goals=shapes.map(()=>new Map());
  for(const recipe of recipes.recipes){if(Date.now()>=until)return 0;const f=S.families(data,shapes,recipe.totals);for(const row of f.families)for(let i=0;i<row.length;i++)goals[i].set(S.signature(row[i]),row[i]);}
  const query=bank.queryExact||bank.query;let bound=0;for(const choices of goals){let fastest=0;for(const mode of modes){let upper=0;for(const g of choices.values()){if(Date.now()>=until)return 0;upper+=(await query.call(bank,donor,mode,S.donorOptions(g))).p;}fastest=Math.max(fastest,Math.min(1,upper));}if(fastest>0)bound=Math.max(bound,1/fastest);else return Infinity;}
  return bound;
 }
 async function evaluate(input,ms=1800,incumbent=Infinity){
  const key=routeKey(input);if(routeCache.has(key)){stats.routeCacheHits++;return copy(routeCache.get(key));}
  const until=Math.min(deadline,Date.now()+ms);if(Number.isFinite(incumbent)){const optimistic=await lowerBound(input,Math.min(until,Date.now()+250));if(optimistic>incumbent+1e-6){stats.lowerBoundPruned++;return {...copy(input),equivalentStargazing:{expectedRolls:null,reason:'equivalent-lower-bound',optimisticLowerBound:optimistic}};}}const cfg={...config,groupModePolicy:'joint',groupCache,currentGroupCache,numerical:{...config.numerical,deadlineMs:until}},r=await S.evaluate(data,input,request,bank,cfg,inventory);stats.routes++;
  const pending=r.pieces.filter(p=>p.expectedRolls>0&&p.pool===6),visited=new Set(),base=pending.map(p=>p.stargazingMode||p.mode),queue=[];let best=r.equivalentStargazing,bestAssignment=base.slice(),evaluated=0;
  const put=assignment=>{const key=assignment.join('|');if(!visited.has(key)&&!queue.some(q=>q.join('|')===key)){queue.push(assignment);const rank=a=>sum(a.map((mode,i)=>{const p=pending[i].donorProbabilities?.find(p=>p.mode===mode)?.p||0;return p>0?Math.log(1/p):100;}));queue.sort((a,b)=>rank(a)-rank(b));}};
  const neighbors=assignment=>{for(let i=0;i<pending.length;i++)for(const mode of modes)if(mode!==assignment[i])put(assignment.map((m,j)=>j===i?mode:m));};
  visited.add(base.join('|'));neighbors(base);
  while(queue.length&&Date.now()<until-15&&evaluated<(options.maxModeAssignments||18)){
   const assignment=queue.shift();visited.add(assignment.join('|'));evaluated++;stats.modeAssignments++;
   const trial=copy(r);for(let i=0;i<pending.length;i++){const p=trial.pieces.find(p=>p.part===pending[i].part);p.stargazingMode=p.mode=assignment[i];}
   // The old current-group incumbent is not a valid cost under another assignment.
   trial.stargazingModel='equivalent-mode-candidate';trial.stargazingRolls=null;
   const candidate=await S.equivalent(data,trial,request,bank,modes,inventory,cfg);
   if(Number.isFinite(candidate.expectedRolls)&&(!Number.isFinite(best?.expectedRolls)||candidate.expectedRolls<best.expectedRolls-1e-8)){best=candidate;bestAssignment=assignment;stats.modeImprovements++;neighbors(assignment);}
  }
  const limited=Date.now()>=until-15||queue.length>0;if(limited)stats.budgetLimited++;
  r.equivalentStargazing={...best,fixedModes:false,modeSearch:'equivalent-objective-coordinate',modeAssignments:evaluated+1,modeSearchTruncated:limited};r.searchObjective='equivalent-stargazing';r.observationPending=false;
  r.equivalentModeAssignment=Object.fromEntries(pending.map((p,i)=>[p.part,bestAssignment[i]]));
  // Keep current-group metrics and actual per-piece probabilities unchanged.
  if(Number.isFinite(eq(r)))routeCache.set(key,copy(r));return r;
 }
 async function price(pattern){if(!(pattern.guide.expectedRolls>0))return 0;const p={baseId:pattern.guide.baseId,goal:pattern.guide.goal},shape=S.correctedShape(S.shape(data,p,request),config);if(!shape||pattern.guide.pool!==6)return Math.log1p(H.capabilityCost(pattern.guide));const key=S.signature(shape);if(priceCache.has(key))return priceCache.get(key);const ps=await Promise.all(modes.map(mode=>(bank.queryExact||bank.query).call(bank,donor,mode,S.donorOptions(shape))));const pmax=Math.max(...ps.map(p=>p.p||0));const value=pmax>0?Math.log1p(1/pmax):30;priceCache.set(key,value);return value;}
 return {evaluate,price,lowerBound,stats,routeCache,groupCache};
}
function pruneNative(data,request,patterns){
 const skillIds=request.skills.map(s=>s.id),zero=patterns.filter(p=>p.guide.kind==='craft'&&!(p.guide.expectedRolls>0)&&!p.guide.goal),rest=patterns.filter(p=>!zero.includes(p)),v=p=>skillIds.map(id=>p.skills.find(s=>s.skill_id===id)?.level||0),vs=new Map(zero.map(p=>[p.id,v(p)])),caps=new Map(zero.map(p=>[p.id,E.caps(p.slots)]));
 for(const p of zero){const a=vs.get(p.id),c=caps.get(p.id);if(!zero.some(q=>q!==p&&q.part===p.part&&vs.get(q.id).every((n,i)=>n>=a[i])&&caps.get(q.id).every((n,i)=>n>=c[i])&&(vs.get(q.id).some((n,i)=>n>a[i])||caps.get(q.id).some((n,i)=>n>c[i])||q.id<p.id)))rest.push(p);}return rest;
}
async function optimize(c,donorBank,options={}){
 const {data,ctx,request,highs,cfg,patterns,targets,sourceById,started,deadline,left,progress,addPattern,relaxTargets,neighborhoods,markTried}=c,stock=ctx.stock||I.parse(data,c.rawInventory),evaluator=createEvaluator(data,request,stock,donorBank,cfg,{deadlineMs:deadline,maxModeAssignments:options.maxModeAssignments||14}),results=new Map(),anchors=[],expanded=new Set(),donorPrices=new Map(),seenSolutions=new Set();
 const stats={objective:'equivalent-stargazing',proposals:0,feasibleProposals:0,equivalentAccepted:0,refinements:0,skillSwaps:0,slotSwaps:0,nativeDominated:0,unsafeIndividualPruning:false},modeProfiles=['individual','donor','shape'],columnsKey=g=>JSON.stringify([g.source.guide.baseId,request.skills.map(s=>g.levels[s.id]||0),g.slots.slice().sort((a,b)=>b-a)]);
 const nativeIds=new Set(patterns.filter(p=>p.guide.kind==='craft'&&!(p.guide.expectedRolls>0)&&!p.guide.goal).map(p=>p.id)),nativeKeep=new Set(pruneNative(data,request,patterns).filter(p=>nativeIds.has(p.id)).map(p=>p.id));let pool=[],poolLength=-1,best=null,masterBuilds=0,masterSolves=0;
 const status=message=>progress({phase:'guide-status',message});
 async function refresh(){if(poolLength===patterns.length)return;pool=patterns.filter(p=>!nativeIds.has(p.id)||nativeKeep.has(p.id));stats.nativeDominated=patterns.length-pool.length;poolLength=patterns.length;for(const p of pool)if(!donorPrices.has(p.id)&&left()>.5)donorPrices.set(p.id,await evaluator.price(p));}
 function propose(pins=[],profile='donor',excluded=[],seed=null,seconds=.5){
  if(left()<.15)return null;const pinned=new Map(pins.map(p=>[p.part,p.id])),active=pool.filter(p=>!pinned.has(p.part)||pinned.get(p.part)===p.id);if(E.PARTS.some(part=>!active.some(p=>p.part===part)))return null;
  const d={...data,armors:active.map(p=>({...p,pool:0,budget:0,defense:0})),decorations:ctx.decorations},q={...ctx.query,options:{...ctx.query.options,augment:false,deleteSkills:false,defenseFallback:false,augmentLimits:{},fixedArmors:{}}},model=E.buildModel(d,q,d.armors,ctx.charms,excluded);
  model.lp.objective=model.pieces.map(p=>{const g=p.a.guide;let cost=0;if(g.expectedRolls>0){if(profile==='individual')cost=H.capabilityCost(g);else if(profile==='donor')cost=donorPrices.get(p.a.id)??30;else {const base=data.armors.find(a=>a.id===g.baseId),levels=Object.fromEntries(p.a.skills.map(s=>[s.skill_id,s.level])),s=H.capabilityPressure(data,base,levels,p.a.slots,request);cost=2*s.positiveLevels+s.slotRecords+.1*s.pressure+.1*s.repeated;}}return [cost,p.x];});
  const solver=E.persistentSolver(highs,model,d,seed);masterBuilds++;masterSolves++;stats.proposals++;
  try{const raw=solver.solve({output_flag:false,time_limit:Math.max(.05,Math.min(seconds,left()-.05)),mip_rel_gap:.02,mip_abs_gap:0,mip_max_improving_sols:profile==='individual'?2147483647:1});if(raw.Status==='Infeasible')return null;const r=E.validateResult(d,q,E.reconstruct(model,raw,d,q));stats.feasibleProposals++;return {result:r,data:d,request:q,status:raw.Status,individualCost:sum(r.pieces.map(p=>H.capabilityCost(active.find(a=>a.id===p.id).guide)))};}catch(e){if(/求解尚未|缺少孔位|五个|目标技能/.test(e.message))return null;throw e;}finally{solver.dispose();}
 }
 async function consider(solved,ms=1500){
  if(!solved||left()<.1)return null;const r=H.route(solved,ctx),identity=r.id+'|'+JSON.stringify(r.decorations);if(seenSolutions.has(identity))return null;seenSolutions.add(identity);
  const evaluated=await evaluator.evaluate(r,Math.min(ms,Math.max(50,(left()-.05)*1000)),best?eq(best.route):Infinity);if(!Number.isFinite(eq(evaluated)))return null;
  evaluated.equivalenceKey=H.routeEquivalenceKey(data,evaluated);const displayKey=H.displayEquivalenceKey(data,evaluated),old=results.get(displayKey);if(!old||compare(evaluated,old)<0){results.set(displayKey,evaluated);progress({phase:'guide-route',route:evaluated});}
  const anchor={solved,route:evaluated,key:identity};anchors.push(anchor);if(!best||compare(evaluated,best.route)<0){best=anchor;stats.equivalentAccepted++;status('等价观星改善至 '+Math.round(eq(evaluated)).toLocaleString()+' 次');}return anchor;
 }
 async function findGoal(g){const n=patterns.length;await addPattern(g.source,g.levels,g.slots);const base=data.armors.find(a=>a.id===g.source.guide.baseId),levels={...g.levels};if(request.options?.deleteSkills===false)for(const s of base.skills)if(Object.hasOwn(levels,s.skill_id))levels[s.skill_id]=Math.max(levels[s.skill_id],s.level);const slots=g.slots.slice().sort((a,b)=>b-a);
  const exact=patterns.find(p=>p.guide.baseId===base.id&&p.guide.kind===g.source.guide.kind&&request.skills.every(s=>(p.skills.find(v=>v.skill_id===s.id)?.level||0)===(levels[s.id]||0))&&p.slots.join(',')===slots.join(','));
  if(exact)return exact;return patterns.find(p=>p.guide.baseId===base.id&&!(p.guide.expectedRolls>0)&&request.skills.every(s=>(p.skills.find(v=>v.skill_id===s.id)?.level||0)>=(levels[s.id]||0))&&slots.every((v,i)=>(p.slots[i]||0)>=v));
 }
 // Pool pricing is preparatory. Every accepted search step is judged by full equivalent cost.
 status('准备等价组候选能力…');await relaxTargets(Math.max(40,cfg.skeletons),.7);await refresh();
 const initial=propose([],'individual',[],null,Math.min(2,left()*.07));await consider(initial,2000);
 if(request.options?.augment!==false){
  const chosen=new Map();for(const part of E.PARTS){const ranked=ctx.fresh.filter(a=>a.part===part&&a.pool>0).sort((a,b)=>E.equivalentScore(b,request.skills,data).total-E.equivalentScore(a,request.skills,data).total||a.id.localeCompare(b.id));for(const p of ranked.slice(0,Math.min(6,Math.max(2,Math.ceil(cfg.skeletons/10)))))chosen.set(p.id,p);for(const s of request.skills)if(!data.decorations.some(d=>d.skills.some(v=>v.skill_id===s.id)))for(const p of ranked.filter(p=>p.skills.some(v=>v.skill_id===s.id)).slice(0,2))chosen.set(p.id,p);}
  for(const source of chosen.values()){if(left()<cfg.seconds*.45)break;const levels=Object.fromEntries(request.skills.map(s=>[s.id,Math.min(s.level,source.skills.find(v=>v.skill_id===s.id)?.level||0)])),upgrades=[null,...request.skills.filter(s=>(levels[s.id]||0)<s.level&&data.skills.find(v=>v.id===s.id).cost!=null)];for(const skill of upgrades)for(const points of [0,1,2,3]){if(left()<cfg.seconds*.4)break;await addPattern(source,skill?{...levels,[skill.id]:(levels[skill.id]||0)+1}:levels,E.upgradeSlots(source.slots,points).filter(Boolean));}}
  await relaxTargets(Math.max(40,cfg.skeletons),.35);await refresh();
 }
 const excluded=[];for(let i=0;i<6&&left()>Math.max(4,cfg.seconds*.25);i++){const solved=propose([],modeProfiles[i%3],excluded,best?.solved.result,.8);if(!solved)continue;excluded.push(solved.result.armors.map(a=>a.id));await consider(solved,1600);}
 for(let round=0;round<Math.max(8,cfg.skeletons)&&left()>1.2;round++){
  let anchor=anchors.filter(a=>!expanded.has(a.key)).sort((a,b)=>compare(a.route,b.route))[0];
  if(!anchor){const solved=propose([],modeProfiles[round%3],excluded,null,.6);if(solved){excluded.push(solved.result.armors.map(a=>a.id));await consider(solved,1400);}anchor=anchors.filter(a=>!expanded.has(a.key)).sort((a,b)=>compare(a.route,b.route))[0];if(!anchor)break;}
  const moves=neighborhoods(anchor.solved),batch=Math.min(16,Math.max(8,cfg.skeletons/10));if(moves.length<=batch)expanded.add(anchor.key);
  for(const move of moves.slice(0,batch)){if(left()<1)break;markTried(move.key);stats.refinements++;if(move.kind==='skill-swap')stats.skillSwaps++;if(move.kind==='slot-swap')stats.slotSwaps++;const pins=[];for(const g of move.goals){const p=await findGoal(g);if(p)pins.push(p);}if(pins.length!==move.goals.length)continue;await refresh();const solved=propose(pins,round%3===0?'shape':'donor',[],anchor.solved.result,.45);await consider(solved,1200);}
  if(round%2===1&&left()>4){await relaxTargets(12,.08);await refresh();const solved=propose([],'individual',[],best?.solved.result,.7);await consider(solved,1600);}
  status('按等价组优化 · '+stats.refinements+'组调整 · 已评估'+evaluator.stats.routes+'条完整路线');await new Promise(resolve=>setTimeout(resolve,0));
 }
 const out=[...results.values()].sort(compare).slice(0,cfg.limit);return {objective:'equivalent-stargazing',results:out,elapsedMs:Date.now()-started,patterns:patterns.length,skeletons:c.skeletons.length,refinements:stats.refinements,masterBuilds,masterSolves,individualBestRolls:out.length?Math.min(...out.map(r=>r.expectedRolls)):null,equivalentBestRolls:best?eq(best.route):null,searchStats:{...stats,evaluator:evaluator.stats,groupCacheEntries:evaluator.groupCache.size},unobservedGoals:c.getPricingStats().unobservedGoals,inventoryId:ctx.stock.id,errors:[],scope:'bounded direct equivalent-objective search with feasible integer proposals and joint mode search'};
}
const api={createEvaluator,pruneNative,optimize,compare};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ForgeEquivalentSearch=api;
})(globalThis);
