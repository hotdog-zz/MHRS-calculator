/* Post-solution observation estimates. Never used by the equipment solver. */
(function(root){'use strict';
const E=root.ForgeEngine||(typeof require==='function'?require('./engine.js'):null),H=root.ForgeHandcraft||(typeof require==='function'?require('./handcraft.js'):null),M=root.ForgeMod||(typeof require==='function'?require('./mod.js'):null);
const SOURCE='Leg:426',MODES=['normal','skills','slots'],sum=xs=>xs.reduce((a,b)=>a+b,0),copy=x=>JSON.parse(JSON.stringify(x)),vector=xs=>xs.filter(x=>x.min>0).map(x=>[x.id,x.min]).sort((a,b)=>a[0]-b[0]),key=x=>JSON.stringify(x);
function growth(base,slots=[]){for(let n=0;n<=12;n++)if(slots.every((v,i)=>(E.upgradeSlots(base.slots,n)[i]||0)>=v))return n;return Infinity;}
function shape(data,p,request={}){
 const base=data.armors.find(a=>a.id===p.baseId);if(!base||!p.goal)return null;
 const native=new Map(base.skills.map(s=>[s.skill_id,s.level])),changes=new Map((p.goal.minimumChanges||[]).map(x=>[x.id,x.min]));
 for(const s of p.goal.skills||[])changes.set(s.skill_id,Math.max(changes.get(s.skill_id)??-Infinity,s.level-(native.get(s.skill_id)||0)));
 const positive=vector([...changes].map(([id,min])=>({id,min}))),baseline=base.skills.map(s=>({id:s.skill_id,min:Math.min(0,changes.get(s.skill_id)??(p.goal.deleteSkills===false?0:-s.level))})),removed=p.goal.deleteSkills===false?0:sum(baseline.map(s=>-s.min));
 return {part:p.part,baseId:base.id,native:[...native],baseline,positive,growth:Math.max(growth(base,p.goal.slots),p.goal.minRawSlots||0),maxRemoved:Math.min(removed,p.goal.maxRemoved??Infinity),maxPositiveRecords:Math.min(p.goal.maxPositiveRecords??7,request.options?.augmentLimits?.[p.part]??7),maxRecords:p.goal.maxRecords??7};
}
function donorOptions(s){return {minimumChanges:s.positive.map(([id,min])=>({id,min})),minRawSlots:s.growth,maxRemoved:s.maxRemoved,maxPositiveRecords:s.maxPositiveRecords,maxRecords:s.maxRecords};}
function signature(s){return key([s.positive,s.growth,s.maxRemoved,s.maxPositiveRecords,s.maxRecords]);}
function legal(data,s,positive){
 const skills=new Map(data.skills.map(v=>[v.id,v])),native=new Map(s.native),baseline=new Map(s.baseline.map(x=>[x.id,x.min]));let kinds=native.size;
 for(const[id,n]of positive){const skill=skills.get(id);if(!skill||skill.cost==null||n<1||n+(native.get(id)||0)>skill.max||native.has(id)&&(baseline.get(id)||0)<0)return false;if(!native.has(id))kinds++;}
 // Original IDs keep their capacity even if their levels can be removed.
 return kinds<=5&&sum(positive.map(([,n])=>n))+Math.ceil(s.growth/3)<=s.maxPositiveRecords&&sum(positive.map(([,n])=>n))<=s.maxRecords;
}
function compositions(ids,total,remaining,visit){const row=[];function go(i,left){if(i===ids.length)return left?true:visit(row.filter(([,n])=>n))!==false;const id=ids[i];for(let n=0;n<=Math.min(left,remaining.get(id)||0);n++){row.push([id,n]);const keep=go(i+1,left-n);row.pop();if(!keep)return false;}return true;}return go(0,total);}
// Preserve each part's positive levels per (cost, maximum level), its native
// retention/deletion bounds, slot growth and record limits. Only labels move.
function families(data,shapes,totalsOverride=null,limit=2048){
 shapes=shapes.map(s=>({...s,positive:s.positive.slice().sort((a,b)=>a[0]-b[0])}));
 const skillMap=new Map(data.skills.map(s=>[s.id,s])),types=new Map(),totals=new Map();
 for(const s of shapes)for(const[id,n]of s.positive){const v=skillMap.get(id),t=v.cost+':'+v.max;if(!types.has(t))types.set(t,new Set());types.get(t).add(id);totals.set(id,(totals.get(id)||0)+n);}
 if(totalsOverride){totals.clear();for(const[id,n]of totalsOverride)if(n){const v=skillMap.get(id),t=v.cost+':'+v.max;if(!types.has(t))types.set(t,new Set());types.get(t).add(id);totals.set(id,n);}}
 const ts=[...types].map(([t,ids])=>({t,ids:[...ids].sort((a,b)=>a-b)})),amount=shapes.map(s=>new Map(ts.map(({t})=>[t,sum(s.positive.filter(([id])=>{const v=skillMap.get(id);return v.cost+':'+v.max===t;}).map(([,n])=>n))]))),out=[],chosen=[],seen=new Set();let truncated=false,nodes=0;
 function put(row){const k=key(row.map(s=>s.positive));if(!seen.has(k)){seen.add(k);out.push(row.map(v=>({...v,positive:v.positive.map(x=>[...x])})));}}
 const original=new Map();for(const s of shapes)for(const[id,n]of s.positive)original.set(id,(original.get(id)||0)+n);if(shapes.every(s=>legal(data,s,s.positive))&&[...new Set([...totals.keys(),...original.keys()])].every(id=>(totals.get(id)||0)===(original.get(id)||0)))put(shapes);
 function part(i){if(out.length>=limit||nodes++>100000){truncated=true;return false;}if(i===shapes.length){if([...totals.values()].every(n=>n===0))put(chosen);return true;}
  function type(j,ps){if(out.length>=limit||nodes++>100000){truncated=true;return false;}if(j===ts.length){ps=ps.slice().sort((a,b)=>a[0]-b[0]);if(!legal(data,shapes[i],ps))return true;for(const[id,n]of ps)totals.set(id,totals.get(id)-n);chosen.push({...shapes[i],positive:ps});const keep=part(i+1);chosen.pop();for(const[id,n]of ps)totals.set(id,totals.get(id)+n);return keep;}
   const {t,ids}=ts[j];return compositions(ids,amount[i].get(t)||0,totals,row=>type(j+1,[...ps,...row]));
  }return type(0,[]);
 }part(0);return {families:out,truncated,nodes};
}
// Exact recipe substitutions only: equal skill cost/max and level gain, fits
// the actual hole and respects stock. The original recipe is always retained.
function recipes(data,r,shapes,inventory,cfg={}){
 const skills=new Map(data.skills.map(s=>[s.id,s])),decos=new Map(data.decorations.map(d=>[d.id,d])),total=new Map();for(const s of shapes)for(const[id,n]of s.positive)total.set(id,(total.get(id)||0)+n);
 const allowed=new Set([...total.keys(),...(r.placement||[]).flatMap(p=>decos.get(p.decorationId)?.skills?.map(s=>s.skill_id)||[])]),rows=(r.placement||[]).filter(p=>p.decorationId),baseUsage=new Map();for(const p of rows)baseUsage.set(p.decorationId,(baseUsage.get(p.decorationId)||0)+1);
 const candidates=rows.map(p=>{const original=decos.get(p.decorationId);if(original?.skills.length!==1)return [original];const a=original.skills[0],s=skills.get(a.skill_id);if(s.cost==null)return [original];return data.decorations.filter(d=>d.slot<=p.level&&d.skills.length===1&&d.skills[0].level===a.level&&allowed.has(d.skills[0].skill_id)&&skills.get(d.skills[0].skill_id)?.cost===s.cost&&skills.get(d.skills[0].skill_id)?.max===s.max).sort((a,b)=>(b.id===original.id)-(a.id===original.id)||a.id-b.id);});
 const out=[{id:'original',totals:[...total],placement:copy(r.placement||[])}],seen=new Set([key([...total].sort((a,b)=>a[0]-b[0]))]),usage=new Map(),picked=[];let nodes=0,truncated=false;
 function go(i,delta){if(out.length>=24||nodes++>4000){truncated=true;return;}if(i===rows.length){const needed=new Map(total);for(const[id,n]of delta)needed.set(id,(needed.get(id)||0)+n);if([...needed.values()].some(n=>n<0))return;const k=key([...needed].filter(([,n])=>n).sort((a,b)=>a[0]-b[0]));if(seen.has(k))return;seen.add(k);let at=0;out.push({id:k,totals:[...needed],placement:(r.placement||[]).map(p=>p.decorationId?{...p,decorationId:picked[at++].id}:copy(p))});return;}
  const old=decos.get(rows[i].decorationId);if(!old)return;
  for(const d of candidates[i]){if(!d)continue;const used=(usage.get(d.id)||0)+1,stock=cfg.decos==='all'?Infinity:inventory?.counts?.get(M.decoToGame(d.id))??baseUsage.get(d.id)??0;if(used>stock)continue;usage.set(d.id,used);picked.push(d);const next=new Map(delta);for(const s of old.skills)next.set(s.skill_id,(next.get(s.skill_id)||0)+s.level);for(const s of d.skills)next.set(s.skill_id,(next.get(s.skill_id)||0)-s.level);go(i+1,next);picked.pop();if(used>1)usage.set(d.id,used-1);else usage.delete(d.id);}
 }if(rows.some((_,i)=>candidates[i].length>1))go(0,new Map());return {recipes:out,truncated};
}
const boundKey=s=>key([s.growth,s.maxRemoved,s.maxPositiveRecords,s.maxRecords]),skillCovers=(a,b)=>b.every(([id,n])=>(a.find(v=>v[0]===id)?.[1]||0)>=n);
function covers(event,goal){return skillCovers(event.positive,goal.positive)&&(event.boundMatches?event.boundMatches.includes(boundKey(goal)):event.growth>=goal.growth&&event.maxRemoved<=goal.maxRemoved&&event.maxPositiveRecords<=goal.maxPositiveRecords&&event.maxRecords<=goal.maxRecords);}
// Split ONLY numeric restrictions of the SAME skill outcome into disjoint
// applicability cells. Different skill profiles retain the requested inclusive
// lookup approximation; no AAB or other extra-skill intersections are queried.
function ratePlan(goals){
 const profiles=[...new Map(goals.map(g=>[key(g.positive),g.positive])).values()];
 return profiles.map(positive=>{const bounds=[...new Map(goals.filter(g=>skillCovers(positive,g.positive)).map(g=>[boundKey(g),g])).values()],points=Array(1<<bounds.length).fill(null);
  for(let mask=1;mask<points.length;mask++){const bit=mask&-mask,i=31-Math.clz32(bit),a=points[mask^bit],b=bounds[i];points[mask]={positive,growth:a?Math.max(a.growth,b.growth):b.growth,maxRemoved:a?Math.min(a.maxRemoved,b.maxRemoved):b.maxRemoved,maxPositiveRecords:a?Math.min(a.maxPositiveRecords,b.maxPositiveRecords):b.maxPositiveRecords,maxRecords:a?Math.min(a.maxRecords,b.maxRecords):b.maxRecords};}
  return {positive,bounds,points};
 });
}
function outcomeRates(goals,probabilities,plan=ratePlan(goals)){
 const out=[];for(const {positive,bounds,points}of plan){const cells=points.map((s,i)=>{if(!i)return 0;const p=probabilities.get(signature(s));if(!Number.isFinite(p)||p<0||p>1)throw Error('缺少有效的观星条件交叉概率');return p;}),epsilon=1e-10*Math.max(1e-12,...cells);
  for(let bit=0;bit<bounds.length;bit++)for(let mask=1;mask<cells.length;mask++)if(!(mask&(1<<bit)))cells[mask]-=cells[mask|(1<<bit)];
  for(let mask=1;mask<cells.length;mask++){if(cells[mask]<-epsilon)throw Error('观星边界概率不一致，请刷新概率数据');if(cells[mask]<=epsilon)continue;out.push({...points[mask],positive,p:cells[mask],boundMatches:bounds.filter((_,i)=>mask&(1<<i)).map(boundKey)});}
 }return out;
}
async function loadOutcomeRates(goals,lookup){const plan=ratePlan(goals),values=new Map();for(const {points}of plan)for(const point of points)if(point&&!values.has(signature(point)))values.set(signature(point),(await lookup(point)).p);return outcomeRates(goals,values,plan);}
function groupMean(inputFamilies,events,options={}){
 if(!inputFamilies.length)return {expectedRolls:null,reason:'no-family'};
 if(inputFamilies.some(f=>!f.length))return {expectedRolls:0,method:'exact-lookup-model',states:0};
 const families=[...new Map(inputFamilies.map(f=>[key(f.map(signature).sort()),f])).values()],fulls=families.map(f=>(1<<f.length)-1),start=families.map(()=>1),compatible=events.map(e=>families.map(f=>f.reduce((m,g,i)=>covers(e,g)?m|(1<<i):m,0))),memo=new Map(),transitions=new Map(),stateLimit=options.stateLimit??Math.min(3000,Math.max(100,Math.floor(300000/families.length))),edgeLimit=Math.min(2000,Math.max(16,Math.floor(3000000/(families.length*Math.max(1,events.length)))));
 const prune=(bits,full)=>{let out=bits;for(let m=full;m>=0;m--)if(out&(1<<m))for(let sub=(m-1)&m;m&&sub!==m;sub=(sub-1)&m){out&=~(1<<sub);if(sub===0)break;}return out>>>0;};
 function transition(s,e){const next=s.map((bits,j)=>{const full=fulls[j];let b=bits;for(let mask=0;mask<=full;mask++)if(bits&(1<<mask)){let free=compatible[e][j]&~mask;while(free){const bit=free&-free;free-=bit;b|=1<<(mask|bit);}}return prune(b,full);});return next.some((b,j)=>b&(1<<fulls[j]))?null:next;}
 function edges(s){const k=s.join(',');if(transitions.has(k))return transitions.get(k);const out=[];let rate=0;for(let i=0;i<events.length;i++){const next=transition(s,i);if(next&&next.every((v,j)=>v===s[j]))continue;rate+=events[i].p;out.push({p:events[i].p,next});}const r={rate,out};if(transitions.size<edgeLimit)transitions.set(k,r);return r;}
 const total=sum(events.map(e=>e.p));if(total>1+1e-9)return {expectedRolls:null,reason:'lookup-rate-sum-over-one'};
 function exact(s){const k=s.join(',');if(memo.has(k))return memo.get(k);if(memo.size>stateLimit)throw Error('state-limit');const {rate,out}=edges(s);if(!rate)return Infinity;memo.set(k,NaN);let numerator=1;for(const e of out)if(e.next)numerator+=e.p*exact(e.next);const value=numerator/rate;memo.set(k,value);return value;}
 try{const value=exact(start);return {expectedRolls:Number.isFinite(value)?value:null,method:'exact-lookup-model',states:memo.size,families:families.length};}catch(e){if(e.message!=='state-limit')throw e;}
 // Event-driven numerical estimate, skipping irrelevant repeats. Independent
 // deterministic replicates; conditional waiting means reduce variance.
 let seed=options.seed??1737;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),trials=options.trials??1536;let s1=0,s2=0;
 for(let t=0;t<trials;t++){let s=start,value=0;for(let step=0;s&&step<1000;step++){const {rate,out}=edges(s);if(!rate)return {expectedRolls:null,reason:'unreachable'};value+=1/rate;let pick=random()*rate,chosen=out[out.length-1];for(const e of out){pick-=e.p;if(pick<0){chosen=e;break;}}s=chosen.next;}if(s)return {expectedRolls:null,reason:'transition-limit'};s1+=value;s2+=value*value;}
 const mean=s1/trials;return {expectedRolls:mean,method:'event-driven-lookup-estimate',standardError:Math.sqrt(Math.max(0,(s2-trials*mean*mean)/(trials-1))/trials),trials,states:memo.size,families:families.length};
}
async function currentPlan(data,pieces,request,bank,modes=MODES,cfg={}){
 const independent=H.optimizeModes(pieces.map(p=>p.pool===6?{...p,expectedRolls:0}:p)),choices=independent.choices.slice(),pending=pieces.map((p,index)=>({p,index,s:p.pool===6&&p.expectedRolls>0?shape(data,p,request):null})).filter(v=>v.p.pool===6&&v.p.expectedRolls>0),stats={algorithm:'mode-subset-dynamic-programming',nodes:0,groupEvaluations:0,totalCombinations:1};
 const invalid=reason=>({valid:false,stargazingRolls:null,expectedRolls:independent.expectedRolls,groups:independent.groups,choices,stats,reason});if(pending.some(v=>!v.s||!Number.isFinite(v.s.growth)))return invalid('missing-goals');if(!pending.length)return {...independent,stats};
 const donor=data.armors.find(a=>a.id===SOURCE),query=bank.queryExact?bank.queryExact.bind(bank):bank.query.bind(bank),probabilities=new Map(),lookup=(mode,s)=>{const k=mode+'|'+signature(s);if(!probabilities.has(k))probabilities.set(k,Promise.resolve(query(donor,mode,donorOptions(s))));return probabilities.get(k);},ps=await Promise.all(modes.map(mode=>Promise.all(pending.map(v=>lookup(mode,v.s))))),allowed=ps.map(rows=>rows.reduce((mask,p,i)=>p.p>0&&p.p<=1?mask|(1<<i):mask,0));
 for(let i=0;i<pending.length;i++){const n=allowed.filter(mask=>mask&(1<<i)).length;if(!n)return invalid('unobserved-donor-goal');stats.totalCombinations*=n;}
 const cache=new Map(),groups=new Map(),memo=new Map();
 async function group(at,mask){if(!mask)return {cost:0,individual:0,group:null};const k=at+':'+mask;if(groups.has(k))return groups.get(k);if(mask&~allowed[at])return {cost:Infinity};const indices=pending.flatMap((_,i)=>mask&(1<<i)?[i]:[]),goals=indices.map(i=>pending[i].s),mode=modes[at],ck=mode+'|'+key(goals.map(signature).sort());
  if(!cache.has(ck)){const events=await loadOutcomeRates(goals,s=>lookup(mode,s));cache.set(ck,groupMean([goals],events,cfg.numerical));stats.groupEvaluations++;}const result=cache.get(ck),cost=result.expectedRolls??Infinity,value={cost,individual:sum(indices.map(i=>1/ps[at][i].p)),group:{mode,pool:6,budget:donor.budget,shared:true,sourceArmorId:SOURCE,parts:indices.map(i=>pending[i].p.part),probabilities:indices.map(i=>ps[at][i].p),...result,probabilitySum:undefined}};groups.set(k,value);return value;
 }
 // Assign disjoint part subsets to allowed modes. There are at most 3*31
 // different nonempty group costs; repeated quotas are evaluated only once.
 async function visit(at,remaining){if(!remaining)return {cost:0,individual:0,allocation:[]};if(at===modes.length)return {cost:Infinity};const k=at+':'+remaining;if(memo.has(k))return memo.get(k);stats.nodes++;let best={cost:Infinity};for(let subset=remaining;;subset=(subset-1)&remaining){const g=await group(at,subset);if(Number.isFinite(g.cost)){const tail=await visit(at+1,remaining^subset),cost=g.cost+tail.cost,individual=(g.individual||0)+(tail.individual||0),epsilon=1e-10*Math.max(1,Number.isFinite(best.cost)?best.cost:0);if(Number.isFinite(cost)&&(cost<best.cost-epsilon||Math.abs(cost-best.cost)<=epsilon&&individual<best.individual))best={cost,individual,allocation:subset?[{at,subset,group:g.group},...tail.allocation]:tail.allocation};}if(!subset)break;}memo.set(k,best);return best;}
 const best=await visit(0,(1<<pending.length)-1);if(!Number.isFinite(best.cost))return invalid('unreachable-lookup-model');for(const g of best.allocation)for(let i=0;i<pending.length;i++)if(g.subset&(1<<i))choices[pending[i].index]={mode:modes[g.at],...ps[g.at][i]};return {valid:true,stargazingRolls:independent.stargazingRolls+best.cost,expectedRolls:independent.expectedRolls+best.individual,groups:[...best.allocation.map(g=>g.group),...independent.groups],choices,stats};
}
async function equivalent(data,r,request,bank,modes,inventory,cfg={}){
 const pending=r.pieces.filter(p=>p.expectedRolls>0&&p.pool===6),shapes=pending.map(p=>shape(data,p,request));if(!shapes.length)return {expectedRolls:r.stargazingRolls,groups:r.stargazingGroups,alternatives:1,fixedModes:true,modeSearch:'fixed-current-group',model:'lookup-equivalence-approximation'};
 if(shapes.some(s=>!s||!Number.isFinite(s.growth)))return {expectedRolls:null,reason:'missing-goals'};
 // The current group's per-part modes are immutable. A zero-hit or absent mode
 // must not silently switch to another mode, even if that mode is cheaper.
 const assignment=pending.map(p=>p.stargazingMode||p.mode);if(assignment.some(mode=>!mode||!modes.includes(mode)))return {expectedRolls:null,fixedModes:true,modeSearch:'fixed-current-group',reason:'missing-current-mode'};
 const donor=data.armors.find(a=>a.id===SOURCE),recipeOptions=recipes(data,r,shapes,inventory,cfg),sets=[];let truncated=recipeOptions.truncated;
 for(const recipe of recipeOptions.recipes){const f=families(data,shapes,recipe.totals);truncated||=f.truncated;if(f.families.length)sets.push({recipe,families:f.families});}
 if(!sets.length)return {expectedRolls:null,reason:'no-legal-equivalence'};
 const query=bank.queryExact?bank.queryExact.bind(bank):bank.query.bind(bank),probabilities=new Map(),lookup=(mode,s)=>{const k=mode+'|'+signature(s);if(!probabilities.has(k))probabilities.set(k,Promise.resolve(query(donor,mode,donorOptions(s))));return probabilities.get(k);};
 const independentGroups=(r.stargazingGroups||[]).filter(g=>g.shared===false),independent=sum(independentGroups.map(g=>g.expectedRolls)),cache=new Map();let best=null,evaluations=0;
 // The current allocation is a valid member of its equivalence family. Keep
 // its corrected cost as an incumbent, including when numerical evaluation or
 // bounded family enumeration does not find a reliable improvement.
 if(r.stargazingModel==='palace-current-group-multiplicity-v2'&&Number.isFinite(r.stargazingRolls)&&shapes.every(s=>legal(data,s,s.positive)))best={expectedRolls:r.stargazingRolls,groups:copy(r.stargazingGroups),assignment:Object.fromEntries(pending.map((p,i)=>[p.part,assignment[i]])),example:shapes.map(s=>({part:s.part,baseId:s.baseId,positive:s.positive,growth:s.growth,maxRemoved:s.maxRemoved,nativeMinimumChanges:s.baseline,maxPositiveRecords:s.maxPositiveRecords,maxRecords:s.maxRecords})),placement:copy(r.placement||[]),recipeChanged:false,alternatives:1};
 for(const set of sets){
  // Skills may move between existing mode groups. Bucket by each mode's named
  // demand, so independently accepted group outcomes can still coexist.
  const buckets=new Map();for(const row of set.families){const available=await Promise.all(row.map((s,i)=>lookup(assignment[i],s)));if(available.some(p=>!(p.p>0)))continue;const totals=new Map();for(let i=0;i<row.length;i++){const m=assignment[i];if(!totals.has(m))totals.set(m,new Map());for(const[id,n]of row[i].positive)totals.get(m).set(id,(totals.get(m).get(id)||0)+n);}const k=key([...totals].sort(([a],[b])=>a.localeCompare(b)).map(([m,v])=>[m,[...v].sort((a,b)=>a[0]-b[0])]));if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(row);}
  for(const rows of buckets.values()){let total=independent;const groups=[];for(const mode of [...new Set(assignment)]){const indices=assignment.flatMap((m,i)=>m===mode?[i]:[]),fs=rows.map(row=>indices.map(i=>row[i])),ck=mode+'|'+key(fs.map(f=>f.map(signature).sort()).sort());
    if(!cache.has(ck)){const goals=[...new Map(fs.flat().map(s=>[signature(s),s])).values()],events=await loadOutcomeRates(goals,s=>lookup(mode,s));cache.set(ck,groupMean(fs,events,cfg.numerical));evaluations++;}const result=cache.get(ck);if(result.expectedRolls==null){total=Infinity;break;}total+=result.expectedRolls;groups.push({mode,parts:indices.map(i=>pending[i].part),...result,shared:true,sourceArmorId:SOURCE,alternatives:new Set(fs.map(f=>key(f.map(signature).sort()))).size});if(best&&total>=best.expectedRolls)break;
   }if(groups.length!==new Set(assignment).size)continue;if(!Number.isFinite(total)||best&&total>=best.expectedRolls)continue;
   const sample=rows.slice().sort((a,b)=>sum(b.map(s=>s.positive.filter(([,n])=>n>1).length))-sum(a.map(s=>s.positive.filter(([,n])=>n>1).length)))[0];best={expectedRolls:total,groups:[...groups,...independentGroups],assignment:Object.fromEntries(pending.map((p,i)=>[p.part,assignment[i]])),example:sample.map(s=>({part:s.part,baseId:s.baseId,positive:s.positive,growth:s.growth,maxRemoved:s.maxRemoved,nativeMinimumChanges:s.baseline,maxPositiveRecords:s.maxPositiveRecords,maxRecords:s.maxRecords})),placement:set.recipe.placement,recipeChanged:set.recipe.id!=='original',alternatives:rows.length};
  }
 }
 return {...(best||{expectedRolls:null,reason:'unobserved-donor-goal'}),model:'lookup-equivalence-approximation',sourceArmorId:SOURCE,truncated,fixedModes:true,modeSearch:'fixed-current-group',numericBounds:'disjoint-applicability-cells',groupEvaluations:evaluations,recipeCount:sets.length,totalAllocations:sum(sets.map(s=>s.families.length))};
}
async function evaluate(data,route,request,bank,rawConfig={},inventory=null){
 const r=copy(route),modes=rawConfig.modes||MODES,donor=data.armors.find(a=>a.id===SOURCE);if(!donor)throw Error('缺少公会宫殿护腿数据');
 for(const p of r.pieces)if(p.expectedRolls>0&&p.pool===6){const s=shape(data,p,request);p.donorGoal=s;p.donorProbabilities=await Promise.all(modes.map(async mode=>({mode,...await bank.query(donor,mode,donorOptions(s))})));p.donorArmorId=SOURCE;}
 const plan=await currentPlan(data,r.pieces,request,bank,modes,rawConfig);
 r.stargazingRolls=plan.stargazingRolls;r.stargazingGroups=plan.groups;r.stargazingValid=plan.valid;r.modeOptimization=plan.stats;r.stargazingModel='palace-current-group-multiplicity-v2';r.stargazingSourceArmorId=SOURCE;r.stargazingIndividualRolls=plan.expectedRolls;
 for(const p of r.pieces)if(p.expectedRolls>0&&p.pool===6){p.stargazingProbability=null;if(!plan.valid)p.mode=p.stargazingMode=null;}
 for(const[i,c]of plan.choices.entries())if(c){r.pieces[i].mode=r.pieces[i].stargazingMode=c.mode;r.pieces[i].stargazingProbability=c;/* actual-armor probability stays separate */}
 r.equivalentStargazing=await equivalent(data,r,request,bank,modes,inventory,rawConfig);r.observationPending=false;return r;
}
const api={SOURCE,shape,donorOptions,signature,legal,families,recipes,covers,ratePlan,outcomeRates,loadOutcomeRates,groupMean,currentPlan,equivalent,evaluate};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ForgeStargazing=api;
})(globalThis);
