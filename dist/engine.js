/* Sunbreak final-state set search. Plain JS shared by browser Worker and Node tests. */
(function(root){
'use strict';
const PARTS=['head','chest','arm','waist','leg'];
const HUNTER_DEFENSE=1;
const PART_NAMES={head:'头部',chest:'身体',arm:'腕部',waist:'腰部',leg:'脚部'};
const METHOD_NAMES={Alchemy1:'水镜',Alchemy2:'阳炎',Alchemy3:'月虹',Alchemy4:'幽玄',Alchemy5:'轮回',AlchemyShinki:'神气',AlchemyTensei:'转生',AlchemyKyokkou:'极光',AlchemyHaki:'霸气',AlchemyEnkan:'圆环'};
const sid=n=>n>=10000?n-10000+200:n;
const sum=a=>a.reduce((s,v)=>s+v,0);
const nativeMap=a=>Object.fromEntries(a.skills.map(s=>[s.skill_id,s.level]));
const caps=s=>[1,2,3,4].map(r=>s.filter(v=>v>=r).length);
const slotDominates=(a,b)=>[0,1,2].every(i=>(a[i]||0)>=(b[i]||0));
function upgradeSlots(initial,points){
 const a=[...initial,0,0,0].slice(0,3).sort((a,b)=>b-a);
 for(let p=0;p<points;p++){
  let i=a.indexOf(0);if(i<0)i=a.findIndex(v=>v<4);
  if(i<0)break;a[i]++;
 }
 return a.filter(Boolean);
}
function maxLevel(rows){return Math.max(0,...rows.filter(v=>v.weight>0).map(v=>v.level));}
function ordinarySlotShapes(rules,method,g1,g2){
 const tables=rules.meldingTables.slots.param;
 let states=[[]];
 for(let i=0;i<3;i++){
  const row=tables[i].slotParam.find(x=>x.skill1Grade===g1&&x.skill2Grade===g2);
  const weights=row?.['table'+method.slotTableIndex+'ProbabilityList']||[];
  const next=[];
  for(const state of states){
   if(state.done){next.push(state);continue;}
   for(let lv=0;lv<weights.length;lv++)if(weights[lv]>0){
    const a=lv?[...state,lv]:[...state];a.done=lv===0||lv===4;next.push(a);
   }
  }states=next;
 }
 const unique=new Map();
 for(const a of states){const s=[...a].sort((a,b)=>b-a);if(s.includes(4)&&s.length!==1)continue;unique.set(s.join(','),s);}
 return [...unique.values()];
}
function secondChance(rules,method,grade){
 return rules.meldingTables.secondSkill.param.find(x=>x.skill1Grade===grade)?.probabilityList[method.tableIndex]||0;
}
function firstLevel(method,s){
 const first=maxLevel(s.first),miss=maxLevel(s.missed);
 // Positive support only. Targeted methods can emit first or missed levels.
 return Math.max(first,miss);
}
function generateCharms(data,requirements,{fixed=true}={}){
 const req=new Map(requirements.map(x=>[x.id,x.level]));const rules=data.melding;const unique=new Map();
 const emit=c=>{
  const signature=c.skills.filter(x=>req.has(x.skill_id)).map(x=>[x.skill_id,Math.min(x.level,req.get(x.skill_id))]).sort((a,b)=>a[0]-b[0]);
  const key=JSON.stringify(signature)+'|'+c.slots.join(',');if(!unique.has(key))unique.set(key,c);
 };
 const slotCache=new Map();
 for(const [methodId,m] of Object.entries(rules.methods)){
  // Cyclus is contained by Vigor for the unrestricted final-state search. Keeping
  // Vigor witnesses removes a duplicate search domain without inventing a charm.
  if(m.pattern==='AlchemyEnkan')continue;
  const q=m.pattern==='AlchemyHaki';
  const first=m.skills.filter(s=>firstLevel(m,s)>0&&(!q||s.firstPickWeight>0));
  const seconds=m.skills.filter(s=>maxLevel(s.second)>0&&(!q||s.secondPickWeight>0));
  for(const a of first){
   const chance=secondChance(rules,m,a.grade);
   const options=chance>0?seconds.filter(s=>s.skillId!==a.skillId):[];
   if(chance<100)options.push(null);
   for(const b of options){
    const cacheKey=m.pattern+'|'+a.grade+'|'+(b?.grade||'None');
    if(!slotCache.has(cacheKey)){
     let shapes=q?rules.quriousSlots.filter(x=>x.weight>0).map(x=>x.slots):ordinarySlotShapes(rules,m,a.grade,b?.grade||'None');
     // Strict slot dominance with identical skills is safe for generic decoration fit.
     shapes=shapes.filter((x,i)=>!shapes.some((y,j)=>i!==j&&slotDominates(y,x)&&!slotDominates(x,y)));
     slotCache.set(cacheKey,shapes);
    }
    const skills=[{skill_id:sid(a.skillId),level:firstLevel(m,a)}];if(b)skills.push({skill_id:sid(b.skillId),level:maxLevel(b.second)});
    for(const slots of slotCache.get(cacheKey))emit({id:methodId+':'+a.skillId+':'+(b?.skillId??'-')+':'+slots.join('.'),name:METHOD_NAMES[m.pattern]+'护石',method:methodId,pattern:m.pattern,skills,slots});
   }
  }
 }
 if(fixed)for(const c of data.fixedCharms)emit({id:c.id,name:c.name_zh,fixed:true,skills:c.skills,slots:c.slots,acquisition:c.acquisition});
 // Remove weaker slot vectors for the same projected skill contribution, across methods.
 const groups=new Map();for(const c of unique.values()){
  const k=JSON.stringify(c.skills.filter(x=>req.has(x.skill_id)).map(x=>[x.skill_id,Math.min(x.level,req.get(x.skill_id))]).sort((a,b)=>a[0]-b[0]));
  if(!groups.has(k))groups.set(k,[]);groups.get(k).push(c);
 }
 const result=[];for(const g of groups.values())for(const c of g)if(!g.some(d=>d!==c&&slotDominates(d.slots,c.slots)&&!slotDominates(c.slots,d.slots)))result.push(c);
 return result;
}
function skillWeights(data,req){
 const result={};for(const r of req){const ds=data.decorations.filter(d=>d.skills.some(s=>s.skill_id===r.id));result[r.id]=!ds.length?1.5:ds.some(d=>d.slot===1)?0.25:1;}
 return result;
}
function equivalentScore(a,req,data,weights=skillWeights(data,req)){
 const wanted=new Map(req.map(x=>[x.id,x.level]));
 const native=sum(a.skills.map(s=>Math.min(s.level,wanted.get(s.skill_id)||0)*(weights[s.skill_id]||0)));
 if(!weights.slotScores)Object.defineProperty(weights,'slotScores',{value:[0,...[1,2,3,4].map(lv=>Math.max(0,...data.decorations.filter(d=>d.slot<=lv).map(d=>sum(d.skills.map(s=>Math.min(s.level,wanted.get(s.skill_id)||0)*(weights[s.skill_id]||0))))))]});
 const slot=sum(a.slots.map(lv=>weights.slotScores[lv]));
 const refundable=sum(a.skills.filter(s=>!wanted.has(s.skill_id)).map(s=>s.level));
 return {total:native+slot+Math.min(refundable,3)*0.08+a.budget*0.005,native,slot,refundable};
}
class LP{
 constructor(){this.vars=[];this.rows=[];this.objective=[];this.index=0;this.indices=new Map();}
 variable(prefix,ub=1,objective=0){const n=prefix+'_'+this.index++;this.indices.set(n,this.vars.length);this.vars.push({n,ub});if(objective)this.objective.push([objective,n]);return n;}
 expression(terms){const list=terms.filter(x=>Math.abs(x[0])>1e-12);return list.length?list.map(([c,n],i)=>(c<0?' - ':i?' + ':' ')+Math.abs(c)+' '+n).join(''):' 0 dummy';}
 constraint(t,op,rhs){const terms=new Map();for(const [v,n] of t)terms.set(n,(terms.get(n)||0)+v);this.rows.push({terms:[...terms].filter(([,v])=>Math.abs(v)>1e-12).map(([n,v])=>[v,n]),op,rhs});}
 text(){return 'Minimize\n obj:'+this.expression(this.objective)+'\nSubject To\n'+this.rows.map((x,i)=>' c'+i+':'+this.expression(x.terms)+' '+x.op+' '+x.rhs).join('\n')+'\nBounds\n dummy = 0\n'+this.vars.filter(v=>v.ub!==1).map(v=>' 0 <= '+v.n+' <= '+v.ub).join('\n')+'\nGeneral\n'+this.vars.filter(v=>v.ub!==1).map(v=>' '+v.n).join('\n')+'\nBinary\n'+this.vars.filter(v=>v.ub===1).map(v=>' '+v.n).join('\n')+'\nEnd\n';}
}
function numericAttribute(atom){if(atom.category===13)return 'defense';const i=Math.floor((atom.id-89)/10);return ['fire','water','thunder','ice','dragon'][i];}
function isDedicatedFallback(atom){return atom?.category===13&&[70,71,72].includes(atom.id);}
function isOrdinaryAtom(atom){return !!atom&&[13,14,19,20].includes(atom.category)&&!isDedicatedFallback(atom)&&atom.id!==61&&(atom.standardWeight==null||atom.standardWeight>0);}
function orderedAtoms(data,armor,atoms,{introduceSkills=false}={}){
 let expanded=atoms.flatMap(a=>Array.from({length:a.count},()=>({...a,count:1})));
 if(introduceSkills){
  const native=new Set(armor.skills.map(s=>s.skill_id)),seen=new Set(),first=[],rest=[];
  const foreign=a=>a.skillId!=null&&a.value>0&&!native.has(a.skillId);
  for(const a of expanded.filter(foreign)){if(seen.has(a.skillId))rest.push(a);else{seen.add(a.skillId);first.push(a);}}
  const sequence=[...first,...rest];let i=0;expanded=expanded.map(a=>foreign(a)?sequence[i++]:a);
 }
 const key=a=>{const raw=data.atoms.find(v=>v.pool===armor.pool&&v.id===a.atomId);if(!raw)throw new Error('未知炼化词条');return [raw.category,raw.cost,a.value];};
 return expanded.map((a,i)=>({a,i,k:key(a)})).sort((a,b)=>a.k[0]-b.k[0]||a.k[1]-b.k[1]||a.k[2]-b.k[2]||a.i-b.i).map(v=>v.a);
}
function fallbackSummary(f){if(!f)return '';if(f.effect)return '自由 '+f.freeRecords+' / 6条 · 兜底前预算 '+f.before+' → '+f.after+' · 末条防御 +'+f.effect.value;if(f.termination==='unaugmented')return '未炼化';return f.termination==='budget'?'记录 '+f.freeRecords+' / 7条 · 预算耗尽结束':'记录 '+f.freeRecords+' / 7条 · 剩余预算 '+f.after+' · 可连续失败结束';}
function fallbackEffects(data,pool,remaining){
 if(!Number.isInteger(remaining)||remaining<0)throw new Error('防御兜底前预算非法');
 if(remaining===0)return [];
 // Keep source-table order on equal cost. Only the selected entry rolls values.
 const raw=data.atoms.filter(a=>a.pool===pool&&a.category===13&&a.id>=69&&a.id<=76&&a.cost>0&&a.cost<=remaining).map((a,i)=>({a,i})).sort((a,b)=>b.a.cost-a.a.cost||a.i-b.i)[0]?.a;
 if(!raw)throw new Error('该炼化池缺少预算内的防御兜底候选');
 return raw.values.filter(v=>v.value>0&&v.weight>0).map(v=>({atomId:raw.id,value:v.value,valueIndex:v.value_index,attribute:'defense',count:1,fallback:true,cost:raw.cost})).sort((a,b)=>b.value-a.value||a.valueIndex-b.valueIndex);
}
function fallbackEffect(data,pool,remaining){return fallbackEffects(data,pool,remaining)[0]||null;}
function canFailOrdinaryDraw(data,armor,atoms,remaining){
 const pool=data.atoms.filter(a=>a.pool===armor.pool&&isOrdinaryAtom(a)&&[13,14,19,20].includes(a.category));
 if(pool.some(a=>a.cost>remaining))return true;
 const space=12-sum(armor.slots);
 if(pool.some(a=>a.category===19&&a.values.some(v=>v.weight>0&&v.value>space)))return true;
 const skillPool=pool.filter(a=>a.category===20),levels=nativeMap(armor),introduced=new Set();let capacity=armor.skills.length;
 for(const a of atoms)if(a.skillId!=null){levels[a.skillId]=(levels[a.skillId]||0)+a.value*a.count;if(a.value>0&&!armor.skills.some(s=>s.skill_id===a.skillId)){introduced.add(a.skillId);capacity+=a.count;}}
 if(skillPool.some(a=>a.cost<0)&&(!armor.skills.length||armor.skills.some(s=>!levels[s.skill_id])))return true;
 return data.skills.some(s=>skillPool.some(a=>a.cost===s.cost&&a.cost>0)&&((levels[s.id]||0)>=s.max||(capacity>=5&&!armor.skills.some(v=>v.skill_id===s.id)&&!introduced.has(s.id))));
}
function splitFallback(data,armor,atoms,records,cost){
 const remaining=armor.budget-cost,marked=atoms.filter(a=>a.fallback===true),dedicated=atoms.find(a=>isDedicatedFallback(data.atoms.find(v=>v.pool===armor.pool&&v.id===a.atomId)));
 if(records<7){
  if(marked.length||dedicated)throw new Error('防御收尾只能在六条自由记录之后产生第七条');
  if(records===0)return {atoms,freeRecords:0,before:remaining,after:remaining,effect:null,termination:'unaugmented'};
  if(remaining===0)return {atoms,freeRecords:records,before:0,after:0,effect:null,termination:'budget'};
  if(records<6&&canFailOrdinaryDraw(data,armor,atoms,remaining))return {atoms,freeRecords:records,before:remaining,after:remaining,effect:null,termination:'failed'};
  throw new Error('炼化尚未满足结束条件：六条且有预算时必须防御收尾；短记录须预算耗尽或可连续失败结束');
 }
 for(let i=0;i<atoms.length;i++){
  const t=atoms[i];if(marked.length&&t.fallback!==true)continue;if(dedicated&&t!==dedicated)continue;
  const raw=data.atoms.find(a=>a.pool===armor.pool&&a.id===t.atomId);if(raw?.category!==13||raw.cost<=0)continue;
  const before=remaining+raw.cost,expected=fallbackEffects(data,armor.pool,before).find(e=>e.atomId===t.atomId&&e.value===t.value&&e.valueIndex===t.valueIndex);
  if(!expected)continue;
  const free=atoms.flatMap((a,j)=>j!==i?[{...a,fallback:false}]:a.count>1?[{...a,count:a.count-1,fallback:false}]:[]);
  if(sum(free.map(a=>a.count))!==6||free.some(a=>!isOrdinaryAtom(data.atoms.find(v=>v.pool===armor.pool&&v.id===a.atomId))))continue;
  const effect={...expected};delete effect.cost;return {atoms:[...free,effect],freeRecords:6,before,after:remaining,effect,termination:'full'};
 }
 throw new Error(PART_NAMES[armor.part]+'固定炼化与防御兜底冲突：七条结果须包含六条自由记录及正确的防御收尾');
}
function buildModel(data,request,armors,charms,excluded=[]){
 const lp=new LP(),skillIndex=new Map(data.skills.map(s=>[s.id,s]));
 const skillTerms=Object.fromEntries(request.skills.map(s=>[s.id,[]]));const capacity=[[],[],[],[]];const pieces=[];
 const options={augment:true,deleteSkills:true,...request.options};
 for(const a of armors){
  const x=lp.variable('a',1,a.ownedMetrics?.records||0);const fixed=request.options?.fixedArmors?.[a.part];
  if(fixed&&fixed.id!==a.id)throw new Error('固定防具候选不一致');
  if(fixed&&Array.isArray(fixed.atoms)){
   const evaluated=evaluateArmor(data,request,fixed);
   for(const r of request.skills)if(evaluated.levels[r.id])skillTerms[r.id].push([evaluated.levels[r.id],x]);
   caps(evaluated.slots).forEach((v,i)=>{if(v)capacity[i].push([v,x]);});
   pieces.push({x,a,fixed:fixed.atoms});continue;
  }
  const native=nativeMap(a);const rec=[],cost=[],def=[[a.defense,x]];const edits=[];const numeric=[];const types=[];
  for(const r of request.skills)if(native[r.id])skillTerms[r.id].push([native[r.id],x]);
  const active=options.augment&&a.pool>0;const pool=data.atoms.filter(v=>v.pool===a.pool);const allowSkills=active&&pool.some(v=>v.category===20&&v.cost>0)&&a.pool!==13;
  if(allowSkills){
   for(const s of a.skills){
    if(!options.deleteSkills)continue;
    const atom=pool.find(v=>v.category===20&&v.cost<0&&v.values.some(o=>o.value===-1));if(!atom)continue;
    const n=lp.variable('del',Math.min(s.level,7),1.03);rec.push([1,n]);cost.push([atom.cost,n]);
    if(skillTerms[s.skill_id])skillTerms[s.skill_id].push([-1,n]);edits.push({n,skill:s.skill_id,sign:-1,atom:atom.id});
   }
   for(const r of request.skills){
    const s=skillIndex.get(r.id);if(s.cost==null)continue;
    const atom=pool.find(v=>v.category===20&&v.cost===s.cost&&v.values.some(o=>o.value===1));if(!atom)continue;
    const max=Math.min(7,s.max-(native[r.id]||0));if(max<=0)continue;
    const n=lp.variable('add',max,1);rec.push([1,n]);cost.push([s.cost,n]);skillTerms[r.id].push([1,n]);edits.push({n,skill:r.id,sign:1,atom:atom.id});
    const gate=lp.variable('gate');edits[edits.length-1].gate=gate;lp.constraint([[1,n],[-max,gate]],'<=',0);lp.constraint([[1,gate],[-1,x]],'<=',0);
    if(native[r.id]){
     const del=edits.find(e=>e.skill===r.id&&e.sign===-1);if(del)lp.constraint([[1,del.n],[native[r.id],gate],[-native[r.id],x]],'<=',0);
    }else{types.push([1,gate]);lp.constraint([[1,gate],[-1,n]],'<=',0);}
   }
   lp.constraint([...types,[a.skills.length-5,x]],'<=',0);
  }
  const resistanceRefunds=new Set();
  if(active)for(const atom of pool){
   if(!isOrdinaryAtom(atom)||![13,14].includes(atom.category)||atom.cost===0)continue;
   // Positive resistance cannot improve any modeled goal. Every negative outcome
   // and positive defense outcome is retained; no fabricated refund constants.
   if(atom.category===14&&atom.cost>0)continue;
   for(const v of atom.values){
    if(!v.value||v.weight<=0)continue;
    if(atom.category===14&&atom.cost<0){if(resistanceRefunds.has(atom.cost))continue;resistanceRefunds.add(atom.cost);}
    const n=lp.variable('num',7,1+Math.abs(Math.min(0,v.value))*0.001);rec.push([1,n]);cost.push([atom.cost,n]);if(atom.category===13)def.push([v.value,n]);numeric.push({n,atom:atom.id,value:v.value,valueIndex:v.value_index,attribute:numericAttribute(atom)});
   }
  }
  const slotAtoms=active?pool.filter(v=>v.category===19):[];
  const choices=[];let fallbackSelectors,failureWitnesses;const maxPoints=slotAtoms.length?12-sum(a.slots):0;
  for(let p=0;p<=maxPoints;p++){
   const atoms=[];let remaining=p;
   for(const atom of [...slotAtoms].sort((a,b)=>b.values[0].value-a.values[0].value)){
    const point=atom.values[0].value;if(point<=0)continue;
    const count=Math.floor(remaining/point);for(let j=0;j<count;j++)atoms.push({atom:atom.id,value:point,cost:atom.cost});remaining-=count*point;
   }
   if(remaining||atoms.length>7)continue;
   const n=lp.variable('slot',1,atoms.length);const final=upgradeSlots(a.slots,p);const cap=caps(final);choices.push({n,points:p,slots:final,atoms});
   rec.push([atoms.length,n]);cost.push([sum(atoms.map(x=>x.cost)),n]);cap.forEach((v,i)=>{if(v)capacity[i].push([v,n]);});
  }
  lp.constraint([...choices.map(c=>[1,c.n]),[-1,x]],'=',0);
  if((request.options?.augmentLimits?.[a.part]??7)<7)lp.constraint([...edits.filter(e=>e.sign>0).map(e=>[1,e.n]),...choices.map(c=>[c.atoms.length,c.n]),[-request.options.augmentLimits[a.part],x]],'<=',0);
  if(active&&options.defenseFallback){
   const freeRec=[...rec],upper=a.budget+6*Math.max(0,...pool.map(v=>-v.cost));
   const remaining=[[a.budget,x],...cost.map(([c,n])=>[-c,n])];
   const thresholds=[0,...new Set(pool.filter(v=>v.category===13&&v.id>=69&&v.id<=76&&v.cost>0&&v.cost<=upper&&v.values.some(o=>o.value>0&&o.weight>0)).map(v=>v.cost))].sort((a,b)=>a-b);
   const states=[{kind:'budget',lower:0,upper:0,min:0,max:6,effect:null},{kind:'unaugmented',lower:a.budget,upper:a.budget,min:0,max:0,effect:null}];
   if(upper>0)states.push({kind:'failed',lower:1,upper,min:0,max:5,effect:null});
   for(let i=1;i<thresholds.length;i++)for(const effect of fallbackEffects(data,a.pool,thresholds[i]))states.push({kind:'full',lower:thresholds[i],upper:i+1<thresholds.length?thresholds[i+1]-1:upper,min:6,max:6,effect});
   const selectors=states.map(state=>({...state,n:lp.variable('finish',1,state.effect?1:0)}));fallbackSelectors=selectors;
   lp.constraint([...selectors.map(v=>[1,v.n]),[-1,x]],'=',0);
   lp.constraint([...freeRec,...selectors.map(v=>[-v.min,v.n])],'>=',0);
   lp.constraint([...freeRec,...selectors.map(v=>[-v.max,v.n])],'<=',0);
   lp.constraint([...remaining,...selectors.map(v=>[-v.lower,v.n])],'>=',0);
   lp.constraint([...remaining,...selectors.map(v=>[-v.upper,v.n])],'<=',0);
   const failed=selectors.find(s=>s.kind==='failed');failureWitnesses=[];
   if(failed){
    const ordinary=pool.filter(isOrdinaryAtom),skillPool=ordinary.filter(v=>v.category===20),space=12-sum(a.slots);
    const hasSkill=s=>skillPool.some(v=>v.cost===s.cost&&v.cost>0);
    const always=ordinary.some(v=>v.category===19&&v.values.some(o=>o.weight>0&&o.value>space))||skillPool.some(v=>v.cost<0)&&!a.skills.length||a.skills.some(s=>hasSkill(skillIndex.get(s.skill_id))&&s.level>=skillIndex.get(s.skill_id).max&&!edits.some(e=>e.skill===s.skill_id&&e.sign<0))||a.skills.length>=5&&skillPool.some(v=>v.cost>0);
    const witness=(label,terms,threshold,test)=>{const n=lp.variable('fail_'+label);lp.constraint([[1,n],[-1,failed.n]],'<=',0);lp.constraint([...terms,[-threshold,n]],'>=',0);failureWitnesses.push({n,test});};
    if(!always){
     const maxCost=Math.max(0,...ordinary.filter(v=>[13,14,19,20].includes(v.category)).map(v=>v.cost));
     if(maxCost>0){const n=lp.variable('fail_budget');lp.constraint([[1,n],[-1,failed.n]],'<=',0);lp.constraint([...remaining,[upper,n]],'<=',upper+maxCost-1);failureWitnesses.push({n,test:p=>p.budget-p.cost<maxCost});}
     for(const s of a.skills)if(hasSkill(skillIndex.get(s.skill_id))&&s.level>=skillIndex.get(s.skill_id).max){
      const del=edits.find(e=>e.skill===s.skill_id&&e.sign<0);if(del){const n=lp.variable('fail_native_max');lp.constraint([[1,n],[-1,failed.n]],'<=',0);lp.constraint([[1,del.n],[s.level,n]],'<=',s.level);failureWitnesses.push({n,test:p=>(p.levels[s.skill_id]||0)>=skillIndex.get(s.skill_id).max});}
     }
     for(const e of edits){
      if(e.sign<0)witness('deleted',[[1,e.n]],native[e.skill],p=>!(p.levels[e.skill]||0));
      else {const threshold=skillIndex.get(e.skill).max-(native[e.skill]||0);if(threshold>0)witness('max',[[1,e.n]],threshold,p=>(p.levels[e.skill]||0)>=skillIndex.get(e.skill).max);}
     }
     if(skillPool.some(v=>v.cost>0)&&a.skills.length<5)witness('capacity',edits.filter(e=>e.sign>0&&!native[e.skill]).map(e=>[1,e.n]),5-a.skills.length,p=>a.skills.length+sum(p.atoms.filter(t=>t.skillId!=null&&t.value>0&&!native[t.skillId]).map(t=>t.count))>=5);
     lp.constraint([[1,failed.n],...failureWitnesses.map(v=>[-1,v.n])],'<=',0);
    }
   }
   for(const v of selectors)if(v.effect){const e=v.effect;rec.push([1,v.n]);cost.push([e.cost,v.n]);def.push([e.value,v.n]);numeric.push({n:v.n,atom:e.atomId,value:e.value,valueIndex:e.valueIndex,attribute:'defense',fallback:true});}
  }
  lp.constraint([...rec,[-7,x]],'<=',0);lp.constraint([...cost,[-a.budget,x]],'<=',0);lp.constraint(def,'>=',0);
  pieces.push({x,a,edits,numeric,choices,fallbackSelectors,failureWitnesses});
 }
 for(const part of PARTS)lp.constraint(pieces.filter(p=>p.a.part===part).map(p=>[1,p.x]),'=',1);
 const charmVars=charms.map(c=>{
  const n=lp.variable('charm');for(const s of c.skills)if(skillTerms[s.skill_id])skillTerms[s.skill_id].push([s.level,n]);caps(c.slots).forEach((v,i)=>{if(v)capacity[i].push([v,n]);});return {n,c};
 });lp.constraint(charmVars.map(x=>[1,x.n]),'=',1);
 for(const ids of excluded)addExclusion({lp,pieces,charms:charmVars},ids);
 const decos=[];
 for(const d of data.decorations){
  if(!d.skills.some(s=>skillTerms[s.skill_id]))continue;
  const maximum=d.ownedCount===undefined?21:Math.min(21,d.ownedCount);if(maximum<=0)continue;
  const n=lp.variable('deco',maximum,0.001);for(const s of d.skills)if(skillTerms[s.skill_id])skillTerms[s.skill_id].push([s.level,n]);decos.push({n,d});
 }
 const weapon=data.weapons.find(w=>w.id===request.weaponId);if(!weapon)throw new Error('请选择数据表中存在的武器。');
 const wc=caps(weapon.slots);
 for(let i=0;i<4;i++)lp.constraint([...decos.filter(v=>v.d.slot>=i+1).map(v=>[1,v.n]),...capacity[i].map(([v,n])=>[-v,n])],'<=',wc[i]);
 for(const s of request.skills)lp.constraint(skillTerms[s.id],'>=',s.level);
 const model={lp,pieces,charms:charmVars,decos,weapon};
 if(options.searchMode==='time')applySearchObjective(data,request,model);
 return model;
}
function applySearchObjective(data,request,model){
 const defense=[],adds=[],costs=[],upper={};
 for(const p of model.pieces){
  if(p.a.ownedMetrics){const m=p.a.ownedMetrics;defense.push([p.a.defense,p.x]);adds.push([m.skillAdds,p.x]);costs.push([m.skillAddCost,p.x]);upper[p.a.part]=Math.max(upper[p.a.part]||0,p.a.defense);continue;}
  if(p.fixed){const v=evaluateArmor(data,request,{id:p.a.id,atoms:p.fixed});defense.push([v.finalDefense,p.x]);adds.push([v.skillAdds,p.x]);costs.push([v.skillAddCost,p.x]);upper[p.a.part]=Math.max(upper[p.a.part]||0,v.finalDefense);continue;}
  defense.push([p.a.defense,p.x]);
  for(const n of p.numeric)if(n.attribute==='defense')defense.push([n.value,n.n]);
  for(const e of p.edits)if(e.sign>0){adds.push([1,e.n]);costs.push([data.skills.find(s=>s.id===e.skill).cost,e.n]);}
  upper[p.a.part]=Math.max(upper[p.a.part]||0,p.a.defense+7*Math.max(0,...p.numeric.filter(n=>n.attribute==='defense').map(n=>n.value)));
 }
 // One unit of the primary integer metric dominates the entire defense range.
 const scale=sum(Object.values(upper))+1,order=request.options.resultSort||'defense';
 const primary=order==='skillsAsc'||order==='skillsDesc'?adds:costs;
 const sign=order==='skillsDesc'||order==='skillCostDesc'?-1:1;
 const tie=model.lp.objective.map(([v,n])=>[v*0.0001,n]);
 model.lp.objective=[...defense.map(([v,n])=>[-v,n]),...tie];
 if(order!=='defense')model.lp.objective.push(...primary.map(([v,n])=>[sign*scale*v,n]));
 // LP readers need one combined coefficient for variables shared by objectives.
 const combined=new Map();for(const [v,n] of model.lp.objective)combined.set(n,(combined.get(n)||0)+v);
 model.lp.objective=[...combined].map(([n,v])=>[v,n]);
}
function equipmentStats(data,result){
 const resistances={fire:0,water:0,thunder:0,ice:0,dragon:0},series=new Map();
 let maxDefense=HUNTER_DEFENSE+(data.weapons.find(w=>w.id===result.weaponId)?.defense||0),complete=true;
 for(const p of result.pieces){
  const base=data.armors.find(a=>a.id===p.id)||p;
  if(Number.isInteger(base.seriesId)&&base.seriesId>=0)series.set(base.seriesId,(series.get(base.seriesId)||0)+1);
  if(Number.isFinite(base.maxDefense))maxDefense+=base.maxDefense+(p.finalDefense-p.defense);else complete=false;
  for(const key of Object.keys(resistances))resistances[key]+=(p.finalResistances||p.resistances)?.[key]||0;
 }
 const seriesResistanceBonus=Math.max(0,Math.min(3,Math.max(0,...series.values())-2));
 for(const key of Object.keys(resistances))resistances[key]+=seriesResistanceBonus;
 return {maxDefense:complete?maxDefense:null,resistances,seriesResistanceBonus};
}
function resultIdentity(r){if(r.owned)return JSON.stringify([r.owned.inventoryId,r.owned.weapon,r.owned.armors,r.owned.charm]);return r.armors.map(a=>a.id).sort().join('|')+'::'+charmSignature(r.charm);}
// Allocate whole resistance records across the entire set. The MILP keeps one
// representative per refund cost; this exact, bounded search restores elements.
function balanceResistances(data,request,result){
 if(request.options?.ownedOnly||result.owned||result.presetEquipment)return result;
 const elements=['fire','water','thunder','ice','dragon'],values=elements.map(()=>0),tasks=[],groups=[];
 const armors=result.armors.map(piece=>{
  const a=data.armors.find(a=>a.id===piece.id),fixed=request.options?.fixedArmors?.[a.part];
  const locked=Array.isArray(fixed?.atoms),atoms=[],group={sums:[0,0,0,0,0],counts:[0,0,0,0,0],signs:new Set()};groups.push(group);
  for(let i=0;i<5;i++)values[i]+=a.resistances[elements[i]]||0;
  for(const atom of piece.atoms){
   const raw=data.atoms.find(t=>t.pool===a.pool&&t.id===atom.atomId);
   if(!locked&&raw?.category===14&&atom.value!==0){
    const choices=elements.map((element,i)=>{
     const candidate=data.atoms.find(t=>t.pool===a.pool&&t.category===14&&t.cost===raw.cost&&isOrdinaryAtom(t)&&numericAttribute(t)===element&&t.values.some(v=>v.value===atom.value&&v.weight>0));
     const v=candidate?.values.find(v=>v.value===atom.value&&v.weight>0);
     return candidate?{i,atom:{...atom,atomId:candidate.id,valueIndex:v.value_index,attribute:element,count:1}}:null;
    }).filter(Boolean);
    if(choices.length){group.signs.add(Math.sign(atom.value));for(let n=0;n<atom.count;n++){const t={choices,delta:atom.value,group,atoms,index:atoms.length};atoms.push(null);tasks.push(t);}continue;}
   }
   atoms.push({...atom});
   if(raw?.category===14||raw?.category===15){const i=elements.indexOf(numericAttribute(raw));values[i]+=atom.value*atom.count;if(raw.category===14){group.sums[i]+=atom.value*atom.count;group.counts[i]+=atom.count;group.signs.add(Math.sign(atom.value));}}
  }
  return {...piece,atoms};
 });
 if(!tasks.length)return result;
 tasks.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)||a.choices.length-b.choices.length);
 const score=v=>[...v].sort((a,b)=>a-b),compare=(a,b)=>{for(let i=0;i<5;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
 // Splitting remaining losses into units gives an optimistic leximin bound.
 const lowerHigh=(v,loss)=>{
  const a=[...v].sort((a,b)=>b-a);let width=1;
  while(width<5){const need=(a[width-1]-a[width])*width;if(loss<need)break;loss-=need;for(let j=0;j<width;j++)a[j]=a[width];width++;}
  const q=Math.floor(loss/width),rem=loss%width;for(let j=0;j<width;j++)a[j]-=q+(j<rem?1:0);return a;
 };
 const tracked=groups.filter(g=>g.signs.size>1),valid=()=>tracked.every(g=>g.counts.every((count,i)=>!count||g.sums[i]!==0));
 const apply=(t,c,sign)=>{values[c.i]+=sign*t.delta;t.group.sums[c.i]+=sign*t.delta;t.group.counts[c.i]+=sign;};
 const choices=t=>[...t.choices].sort((a,b)=>Math.sign(t.delta)*(values[a.i]-values[b.i])||a.i-b.i);
 const initial=[];for(const t of tasks){const c=choices(t)[0];apply(t,c,1);initial.push(c);}
 let best=valid()?score(values):null,assignment=valid()?initial:null;
 for(let i=tasks.length-1;i>=0;i--)apply(tasks[i],initial[i],-1);
 // Keep a second legal incumbent for mixed signs: grouping each armor's gains
 // and losses avoids the zero-sum pairs that a record-by-record greedy creates.
 const grouped=[];
 for(const group of groups){
  const entries=tasks.map((t,i)=>({t,i})).filter(e=>e.t.group===group);if(!entries.length)continue;
  let chosen=null,localBest=null;
  for(let positive=0;positive<5;positive++)for(let negative=0;negative<5;negative++){
   const picks=entries.map(({t})=>t.choices.find(c=>c.i===(t.delta>0?positive:negative)));if(picks.some(c=>!c))continue;
   entries.forEach(({t},i)=>apply(t,picks[i],1));
   if(group.counts.every((n,i)=>!n||group.sums[i]!==0)){const s=score(values);if(!localBest||compare(s,localBest)>0){localBest=s;chosen=picks;}}
   entries.forEach(({t},i)=>apply(t,picks[i],-1));
  }
  if(!chosen)break;entries.forEach(({t,i},j)=>{apply(t,chosen[j],1);grouped.push({t,i,c:chosen[j]});});
 }
 if(grouped.length===tasks.length&&valid()&&(!best||compare(score(values),best)>0)){best=score(values);assignment=[];for(const {i,c}of grouped)assignment[i]=c;}
 for(let i=grouped.length-1;i>=0;i--)apply(grouped[i].t,grouped[i].c,-1);
 const selected=[],loss=new Array(tasks.length+1).fill(0),gain=[...loss],seen=new Set();
 for(let i=tasks.length-1;i>=0;i--){loss[i]=loss[i+1]+Math.max(0,-tasks[i].delta);gain[i]=gain[i+1]+Math.max(0,tasks[i].delta);}
 const symmetric=tasks.every(t=>t.choices.length===5);
 const column=i=>[values[i],...tracked.flatMap(g=>[g.sums[i],g.counts[i]])].join(',');
 function visit(index){
  const optimistic=score(lowerHigh(lowerHigh(values,loss[index]).map(v=>-v),gain[index]).map(v=>-v));
  if(best&&compare(optimistic,best)<=0)return;
  if(index===tasks.length){if(valid()){best=score(values);assignment=[...selected];}return;}
  const columns=elements.map((_,i)=>column(i)),key=index+':'+(symmetric?columns.sort():columns).join(';');if(seen.has(key))return;seen.add(key);
  const t=tasks[index],tried=new Set();
  for(const c of choices(t)){
   const signature=column(c.i);if(symmetric&&tried.has(signature))continue;tried.add(signature);
   apply(t,c,1);selected.push(c);visit(index+1);selected.pop();apply(t,c,-1);
  }
 }
 visit(0);if(!assignment)return result;tasks.forEach((t,i)=>{t.atoms[t.index]=assignment[i].atom;});
 return {...result,armors};
}
function reconstruct(model,solution,data,request){
 const value=n=>solution.Values?solution.Values[model.lp.indices.get(n)]||0:solution.Columns?.[n]?.Primal||0;
 const get=n=>Math.round(value(n));
 if(model.lp.vars.some(v=>Math.abs(value(v.n)-get(v.n))>1e-4))throw new Error('求解尚未得到整数可行解');
 const armors=model.pieces.filter(p=>get(p.x)===1).map(p=>{
  if(p.fixed)return {id:p.a.id,atoms:JSON.parse(JSON.stringify(p.fixed))};
  const atoms=[];for(const e of p.edits){const count=get(e.n);if(count)atoms.push({atomId:e.atom,skillId:e.skill,value:e.sign,count});}
  for(const e of p.numeric){const count=get(e.n);if(count)atoms.push({atomId:e.atom,value:e.value,valueIndex:e.valueIndex,attribute:e.attribute,count,...(e.fallback?{fallback:true}:{})});}
  const choice=p.choices.find(c=>get(c.n));if(!choice)throw new Error('缺少孔位状态');
  for(const v of choice.atoms)atoms.push({atomId:v.atom,value:v.value,count:1});
  atoms.sort((a,b)=>(a.fallback===true)-(b.fallback===true));
  return {id:p.a.id,atoms};
 });
 const charm=model.charms.find(c=>get(c.n))?.c;
 const decorations=model.decos.filter(d=>get(d.n)>0).map(d=>({id:d.d.id,count:get(d.n)}));
 return balanceResistances(data,request,{weaponId:request.weaponId,armors,charm,decorations});
}
function sparseRows(lp,from=0,infinity=Infinity){
 const rows=lp.rows.slice(from),starts=[0],indices=[],values=[],lower=[],upper=[];
 for(const row of rows){for(const [v,n] of row.terms){indices.push(lp.indices.get(n));values.push(v);}starts.push(values.length);lower.push(row.op==='<='?-infinity:row.rhs);upper.push(row.op==='>='?infinity:row.rhs);}
 return {lower:new Float64Array(lower),upper:new Float64Array(upper),matrix:{format:'csr',numRows:rows.length,numCols:lp.vars.length,starts:new Int32Array(starts),indices:new Int32Array(indices),values:new Float64Array(values)}};
}
function modelSeed(data,model,result){
 if(!result||!model.pieces.some(p=>p.a.id===result.pieces[0].id))return null;
 const values=new Float64Array(model.lp.vars.length),set=(n,v)=>{if(n)values[model.lp.indices.get(n)]=v;};
 for(const piece of result.pieces){
  const p=model.pieces.find(p=>p.a.id===piece.id);if(!p)return null;set(p.x,1);if(p.fixed)continue;
  for(const e of p.edits){const count=sum(piece.atoms.filter(a=>a.skillId===e.skill&&Math.sign(a.value)===e.sign).map(a=>a.count));set(e.n,count);set(e.gate,count?1:0);}
  const points=sum(piece.atoms.filter(a=>data.atoms.find(v=>v.pool===piece.pool&&v.id===a.atomId)?.category===19).map(a=>a.value*a.count));
  const choice=p.choices.find(c=>c.points===points);if(!choice)return null;set(choice.n,1);
  for(const e of p.numeric){const target=data.atoms.find(a=>a.pool===piece.pool&&a.id===e.atom);const count=sum(piece.atoms.filter(a=>{
   if(a.value!==e.value||!!a.fallback!==!!e.fallback)return false;
   const raw=data.atoms.find(t=>t.pool===piece.pool&&t.id===a.atomId);
   if(target?.category===14&&target.cost<0)return raw?.category===14&&raw.cost===target.cost;
   return a.atomId===e.atom&&(a.valueIndex??0)===(e.valueIndex??0);
  }).map(a=>a.count));set(e.n,count);}
  if(p.fallbackSelectors){const f=piece.fallback;if(!f)return null;const state=p.fallbackSelectors.find(s=>s.kind===f.termination&&f.before>=s.lower&&f.before<=s.upper&&(!f.effect?!s.effect:s.effect?.atomId===f.effect.atomId&&s.effect?.valueIndex===f.effect.valueIndex));if(!state)return null;set(state.n,1);if(state.kind==='failed')for(const w of p.failureWitnesses||[])set(w.n,w.test(piece)?1:0);}
  if(p.defenseCancellationVars){const net=piece.finalDefense-piece.defense,has=piece.atoms.some(a=>data.atoms.find(v=>v.pool===piece.pool&&v.id===a.atomId)?.category===13);set(p.defenseCancellationVars.has,has?1:0);set(p.defenseCancellationVars.positive,has&&net>0?1:0);}
 }
 const charm=model.charms.find(c=>charmSignature(c.c)===charmSignature(result.charm));if(!charm)return null;set(charm.n,1);
 for(const d of model.decos)set(d.n,result.decorations.find(v=>v.id===d.d.id)?.count||0);
 // A changed candidate set or refund representative may make a seed inapplicable.
 if(model.lp.rows.some(row=>{const n=sum(row.terms.map(([v,key])=>v*values[model.lp.indices.get(key)]));return row.op==='='?Math.abs(n-row.rhs)>1e-6:row.op==='<='?n>row.rhs+1e-6:n<row.rhs-1e-6;}))return null;
 return values;
}
function persistentSolver(highs,model,data,seed){
 let native,cols=0,rows=0;
 return {
  solve(options,onCandidate){
   const lp=model.lp;
   if(!native||cols!==lp.vars.length){
    native?.dispose();const sparse=sparseRows(lp,0,highs.infinity),cost=new Float64Array(lp.vars.length);
    for(const [v,n] of lp.objective)cost[lp.indices.get(n)]+=v;
    native=highs.createModel({numCols:lp.vars.length,numRows:lp.rows.length,sense:1,colCost:cost,colLower:new Float64Array(lp.vars.length),colUpper:Float64Array.from(lp.vars,v=>v.ub),rowLower:sparse.lower,rowUpper:sparse.upper,integrality:new Int32Array(lp.vars.length).fill(1),matrix:sparse.matrix});
    cols=lp.vars.length;rows=lp.rows.length;const initial=modelSeed(data,model,seed);if(initial)native.setSolution({colValue:initial});seed=null;
   }else if(rows<lp.rows.length){native.addRows(sparseRows(lp,rows,highs.infinity));rows=lp.rows.length;}
   native.zeroAllClocks();native.options.set(options);
   const callbacks=onCandidate?{[highs.constants.callbackType.mipImprovingSolution]:event=>{if(event.data.mip_solution)onCandidate({Status:'Feasible',Values:event.data.mip_solution});}}:{};
   native.run(callbacks);const status=native.getModelStatus();
   return {Status:status===highs.constants.modelStatus.optimal?'Optimal':status===highs.constants.modelStatus.infeasible?'Infeasible':'Stopped',Values:native.getSolution().colValue};
  },dispose(){native?.dispose();native=null;}
 };
}
function packDecorations(containers,decorations){
 const slots=containers.flatMap(c=>c.slots.map((level,index)=>({owner:c.id,index,level,decorationId:null})));
 const items=decorations.flatMap(({d,count})=>Array.from({length:count},()=>d)).sort((a,b)=>b.slot-a.slot);
 for(const d of items){const candidates=slots.filter(s=>s.decorationId===null&&s.level>=d.slot).sort((a,b)=>a.level-b.level);if(!candidates.length)throw new Error('实际孔位无法容纳珠子');candidates[0].decorationId=d.id;}
 return slots;
}
function validateCharm(data,c){
 if(!c||!Array.isArray(c.skills)||!Array.isArray(c.slots)||c.skills.length<1||c.skills.length>2||new Set(c.skills.map(s=>s.skill_id)).size!==c.skills.length)throw new Error('护石技能结构非法');
 if(c.fixed){const f=data.fixedCharms.find(x=>x.id===c.id);if(!f||JSON.stringify(f.skills)!==JSON.stringify(c.skills)||JSON.stringify(f.slots)!==JSON.stringify(c.slots))throw new Error('固定护石数据不符');return;}
 const method=data.melding.methods[c.method];if(!method)throw new Error('未知炼金方式');
 const rows=c.skills.map(s=>method.skills.find(r=>sid(r.skillId)===s.skill_id));if(rows.some(x=>!x))throw new Error('护石技能不在对应炼金池');
 c.skills.forEach((s,i)=>{const levels=i===0?[...rows[i].first,...rows[i].missed]:rows[i].second;if(!levels.some(x=>x.level===s.level&&x.weight>0))throw new Error('护石技能等级非法');});
 const chance=secondChance(data.melding,method,rows[0].grade);if((c.skills.length===2&&chance===0)||(c.skills.length===1&&chance===100))throw new Error('护石第二技能概率为零');
 const shapes=method.pattern==='AlchemyHaki'||method.pattern==='AlchemyEnkan'?data.melding.quriousSlots.filter(s=>s.weight>0).map(s=>s.slots):ordinarySlotShapes(data.melding,method,rows[0].grade,rows[1]?.grade||'None');
 if(!shapes.some(s=>JSON.stringify(s)===JSON.stringify(c.slots)))throw new Error('护石孔位不在该技能档位的合法支持中');
}
function atomSignature(atoms){
 const map=new Map();for(const t of atoms||[]){const key=[t.atomId,t.skillId??'',t.value,t.valueIndex??0].join(':');map.set(key,(map.get(key)||0)+t.count);}
 return JSON.stringify([...map].sort((a,b)=>a[0].localeCompare(b[0])));
}
function charmSignature(c){const signature=[c?.empty===true,c?.fixed?c.id:null,c?.method||null,c?.skills?.map(s=>[s.skill_id,s.level]),c?.slots];if(c?.ownedKey)signature.push(c.ownedKey);return JSON.stringify(signature);}
function validateArmorSelection(data,request,piece){
 const a=data.armors.find(a=>a.id===piece?.id);if(!a)throw new Error('未知防具');
 if((request.options?.sex==='MaleOnly'&&a.sex==='FemaleOnly')||(request.options?.sex==='FemaleOnly'&&a.sex==='MaleOnly'))throw new Error('防具性别不符');
 if(request.options?.rank==='Master'&&a.rank!=='Master')throw new Error('防具位阶不符');return a;
}
function evaluateArmor(data,request,piece){
 const skillIndex=new Map(data.skills.map(s=>[s.id,s]));
 if(!piece||!Array.isArray(piece.atoms))throw new Error('防具炼化记录无效');
  const a=validateArmorSelection(data,request,piece);
  if(request.options?.augment===false&&piece.atoms.length)throw new Error('已禁用炼化');
  piece={...piece,atoms:piece.atoms.map(t=>{
   if(!t||!Number.isSafeInteger(t.atomId)||!Number.isSafeInteger(t.value)||!Number.isSafeInteger(t.count)||t.count<1||t.count>7)throw new Error('炼化词条数值或计数非法');
   const raw=data.atoms.find(v=>v.pool===a.pool&&v.id===t.atomId);if(!raw||!a.pool)throw new Error('词条不在装备炼化池中');
   if(!isOrdinaryAtom(raw)&&!isDedicatedFallback(raw))throw new Error('该词条仅适用于其他炼化模式，不能用于普通炼化');
   if(t.valueIndex!=null&&(!Number.isSafeInteger(t.valueIndex)||t.valueIndex<0))throw new Error('炼化数值索引非法');
   const value=raw.values.find(v=>v.value===t.value&&v.weight>0&&(t.valueIndex==null||v.value_index===t.valueIndex));if(!value)throw new Error('炼化数值或ValueIndex不在有效数值表中');
   if(raw.category===20){if(!Number.isSafeInteger(t.skillId))throw new Error('技能炼化缺少有效技能ID');}
   else if(t.skillId!=null)throw new Error('非技能词条不能携带技能ID');
   if(t.fallback!=null&&typeof t.fallback!=='boolean')throw new Error('兜底标记非法');
   const c={atomId:t.atomId,value:t.value,count:t.count};
   if(raw.category===20)c.skillId=t.skillId;else {c.valueIndex=value.value_index;if(raw.category===13||raw.category===14)c.attribute=numericAttribute(raw);}
   if(t.fallback===true)c.fallback=true;return c;
  })};
  const dedicatedCount=sum(piece.atoms.filter(t=>isDedicatedFallback(data.atoms.find(v=>v.pool===a.pool&&v.id===t.atomId))).map(t=>t.count));
  const marked=piece.atoms.filter(t=>t.fallback);
  if(dedicatedCount>1)throw new Error('专用防御兜底词条70／71／72合计最多出现1次');
  if(marked.length>1||marked.some(t=>t.count!==1))throw new Error('防御兜底只能标记1条且数量必须为1');
  if(!request.options?.defenseFallback&&(dedicatedCount||marked.length))throw new Error('专用词条或兜底标记需要开启执行防御兜底；也可解除固定炼化');
  let records=0,cost=0,points=0,def=a.defense,defenseRecords=0;const resistanceGroups=new Map();const res={...a.resistances};const levels=nativeMap(a),signs=new Map(),removed={},added=new Set();
  for(const atom of piece.atoms){
   if(!Number.isInteger(atom.count)||atom.count<1)throw new Error('炼化词条计数非法');
   const raw=data.atoms.find(v=>v.pool===a.pool&&v.id===atom.atomId);if(!raw||!a.pool)throw new Error('词条不在装备炼化池中');
   records+=atom.count;cost+=atom.count*raw.cost;
   if(raw.category===20){
    if(a.pool===13)throw new Error('该装备禁止技能炼化');
    if(!skillIndex.has(atom.skillId)||!raw.values.some(v=>v.value===atom.value))throw new Error('技能炼化词条非法');
    if(atom.value>0&&skillIndex.get(atom.skillId).cost!==raw.cost)throw new Error('新增技能cost不匹配');
    if(atom.value<0&&raw.cost!==-10)throw new Error('技能删除cost非法');
    const old=signs.get(atom.skillId);if(old&&old!==Math.sign(atom.value))throw new Error('同一技能同时增加和删除');signs.set(atom.skillId,Math.sign(atom.value));
    levels[atom.skillId]=(levels[atom.skillId]||0)+atom.value*atom.count;
    if(atom.value<0){if(request.options?.deleteSkills===false)throw new Error('已禁止技能删除');removed[atom.skillId]=(removed[atom.skillId]||0)+atom.count;}
    else if(!a.skills.some(s=>s.skill_id===atom.skillId))added.add(atom.skillId);
   }else if(raw.category===19){if(!raw.values.some(v=>v.value===atom.value)||atom.value>12-sum(a.slots))throw new Error('单条孔位增长超过该防具原始孔位容量');points+=atom.value*atom.count;}
   else if(raw.category===13||raw.category===14){
    if(!raw.values.some(v=>v.value===atom.value&&v.value_index===atom.valueIndex))throw new Error('防御/耐性变化不在有效数值表中');
    const attribute=numericAttribute(raw);if(raw.category===13){def+=atom.value*atom.count;defenseRecords+=atom.count;}else {res[attribute]+=atom.value*atom.count;const key=raw.category+':'+attribute;resistanceGroups.set(key,(resistanceGroups.get(key)||0)+atom.value*atom.count);}
   }else throw new Error('当前结果含未支持的词条类别');
  }
  if(records>7||cost>a.budget||def<0)throw new Error('炼化条数、cost或防御下界非法');
  if([...resistanceGroups.values()].some(v=>v===0))throw new Error('同类别同属性的耐性记录合计为0，须移除抵消记录并重新计算');
  if(defenseRecords&&def===a.defense){const error=new Error(PART_NAMES[a.part]+'防御炼化词条之和为0，正负防御不能完全抵消');error.code='DEFENSE_CANCELLED';error.armorId=a.id;throw error;}
  if(a.skills.length+added.size>5)throw new Error('原生技能种类＋新增技能种类超过5');
  for(const [id,lv] of Object.entries(removed))if(lv>(nativeMap(a)[id]||0))throw new Error('删除超过原生技能等级');
  for(const [id,lv] of Object.entries(levels)){if(lv<0||lv>skillIndex.get(+id).max)throw new Error('单件技能等级越界');}
  const fallback=request.options?.defenseFallback&&request.options?.augment!==false&&a.pool>0?splitFallback(data,a,piece.atoms,records,cost):null;
  const finalAtoms=orderedAtoms(data,a,fallback?.atoms||piece.atoms,{introduceSkills:true});
  const slots=upgradeSlots(a.slots,points);
  const skillAdds=sum(piece.atoms.filter(t=>data.atoms.find(v=>v.pool===a.pool&&v.id===t.atomId)?.category===20&&t.value>0).map(t=>t.count));
  const skillAddCost=sum(piece.atoms.filter(t=>data.atoms.find(v=>v.pool===a.pool&&v.id===t.atomId)?.category===20&&t.value>0).map(t=>t.count*skillIndex.get(t.skillId).cost));
  const slotAdds=sum(piece.atoms.filter(t=>data.atoms.find(v=>v.pool===a.pool&&v.id===t.atomId)?.category===19).map(t=>t.count));
  const additions=skillAdds+slotAdds,limit=request.options?.augmentLimits?.[a.part]??7;
  if(additions>limit)throw new Error(PART_NAMES[a.part]+'新增技能与孔位词条超过上限'+limit);
  return {...a,atoms:finalAtoms,levels,slots,records,cost,fallback,finalDefense:def,finalResistances:res,skillAdds,skillAddCost,slotAdds,additions};
}
function compareResults(a,b,order='defense'){
 const skillAdds=r=>r.skillAdds??sum(r.pieces.map(p=>p.skillAdds||0));
 const skillCost=r=>r.skillAddCost??sum((r.pieces||[]).map(p=>p.skillAddCost||0));
 let score=order==='skillCostAsc'?skillCost(a)-skillCost(b):order==='skillCostDesc'?skillCost(b)-skillCost(a):order==='skillsAsc'?skillAdds(a)-skillAdds(b):order==='skillsDesc'?skillAdds(b)-skillAdds(a):b.defense-a.defense;
 return score||b.defense-a.defense||a.records-b.records||a.armors.map(x=>x.id).join('|').localeCompare(b.armors.map(x=>x.id).join('|'));
}
function validateResult(data,request,result){
 const skillIndex=new Map(data.skills.map(s=>[s.id,s]));const totals={};const add=(id,lv)=>{totals[id]=(totals[id]||0)+lv;};
 const weapon=data.weapons.find(w=>w.id===result.weaponId);if(!weapon||weapon.id!==request.weaponId)throw new Error('武器与请求不一致');
 if(result.armors.length!==5||new Set(result.armors.map(v=>data.armors.find(a=>a.id===v.id)?.part)).size!==5)throw new Error('必须恰好选择五个不同部位');
 const containers=[{id:weapon.id,slots:weapon.slots}],pieces=[];let defense=HUNTER_DEFENSE+(weapon.defense||0);
 for(const piece of result.armors){
  const evaluated=evaluateArmor(data,request,piece);
  const fixed=request.options?.fixedArmors?.[evaluated.part];
  if(fixed&&(fixed.id!==piece.id||(Array.isArray(fixed.atoms)&&atomSignature(fixed.atoms)!==atomSignature(piece.atoms))))throw new Error('固定防具或炼化被改变');
  containers.push({id:evaluated.id,slots:evaluated.slots});defense+=evaluated.finalDefense;
  for(const [id,lv] of Object.entries(evaluated.levels))if(lv)add(+id,lv);
  pieces.push(evaluated);
 }
 if(result.charm?.empty){if(!request.options?.noCharm||result.charm.skills.length||result.charm.slots.length)throw new Error('空护石状态非法');}
 else validateCharm(data,result.charm);
 if(request.options?.fixedCharm&&charmSignature(request.options.fixedCharm)!==charmSignature(result.charm))throw new Error('固定护石被改变');
 for(const s of result.charm.skills)add(s.skill_id,s.level);containers.push({id:'charm',slots:result.charm.slots});
 const ds=result.decorations.map(x=>{const d=data.decorations.find(d=>d.id===x.id);if(!d||!Number.isInteger(x.count)||x.count<=0)throw new Error('珠子不存在或数量非法');for(const s of d.skills)add(s.skill_id,s.level*x.count);return {d,count:x.count};});
 const placement=packDecorations(containers,ds);
 for(const r of request.skills)if((totals[r.id]||0)<r.level)throw new Error('目标技能未满足：'+skillIndex.get(r.id).name);
 return {...result,...equipmentStats(data,{weaponId:result.weaponId,pieces}),pieces,totals,placement,defense,verified:true,skillAddCost:sum(pieces.map(p=>p.skillAddCost)),skillAdds:sum(pieces.map(p=>p.skillAdds)),slotAdds:sum(pieces.map(p=>p.slotAdds)),additions:sum(pieces.map(p=>p.additions)),records:sum(pieces.map(p=>p.records)),decoCount:sum(ds.map(x=>x.count)),unusedSlots:placement.filter(p=>!p.decorationId).map(p=>p.level),stormsoulConservative:(totals[110]||0)>=4};
}
function addExclusion(model,excluded){
 const ids=Array.isArray(excluded)?excluded:excluded.armors;
 const terms=model.pieces.filter(p=>ids.includes(p.a.id)).map(p=>[1,p.x]);
 if(!Array.isArray(excluded)){
  const charm=model.charms.find(v=>charmSignature(v.c)===excluded.charm);if(charm)terms.push([1,charm.n]);
  model.lp.constraint(terms,'<=',charm?5:4);
 }else model.lp.constraint(terms,'<=',4);
}
function excludeDefenseCancellation(model,armorId){
 const p=model.pieces.find(p=>p.a.id===armorId);if(!p||p.fixed||p.defenseCancellationChecked)return false;
 const terms=(p.numeric||[]).filter(v=>v.attribute==='defense');if(!terms.length)return false;
 // Add this disjunction only after a candidate fails the post-solve check.
 // Permit no DEF records, net DEF <= -1, or net DEF >= 1 on this same armor.
 const {lp}=model,has=lp.variable('def_used'),positive=lp.variable('def_positive');
 const negativeBound=7*Math.max(1,...terms.map(v=>-v.value)),positiveBound=7*Math.max(1,...terms.map(v=>v.value));
 lp.constraint([...terms.map(v=>[1,v.n]),[-7,has]],'<=',0);
 lp.constraint([...terms.map(v=>[1,v.n]),[-1,has]],'>=',0);
 lp.constraint([[1,has],[-1,p.x]],'<=',0);lp.constraint([[1,positive],[-1,has]],'<=',0);
 const net=terms.map(v=>[v.value,v.n]);
 lp.constraint([...net,[-negativeBound-1,positive],[negativeBound,has]],'>=',0);
 lp.constraint([...net,[-positiveBound-1,positive],[1,has]],'<=',0);
 p.defenseCancellationChecked=true;p.defenseCancellationVars={has,positive};return true;
}
function validateRestrictions(data,request){
 const options=request.options||{};
 for(const [part,limit] of Object.entries(options.augmentLimits||{}))if(!PARTS.includes(part)||!Number.isInteger(limit)||limit<0||limit>7)throw new Error('逐件新增上限必须为0至7');
 for(const [part,piece] of Object.entries(options.fixedArmors||{})){
  if(!PARTS.includes(part)||data.armors.find(a=>a.id===piece?.id)?.part!==part)throw new Error('固定防具部位不符');
  validateArmorSelection(data,request,piece);
  if(piece.atoms!==undefined)evaluateArmor(data,request,piece);
 }
 if(options.fixedCharm){if(options.noCharm)throw new Error('固定护石与不使用护石冲突');validateCharm(data,options.fixedCharm);}
}
function validateRequest(data,request){
 if(!data.weapons.some(w=>w.id===request.weaponId))throw new Error('请先选择武器');
 validateRestrictions(data,request);
 if(!Array.isArray(request.skills)||!request.skills.length)throw new Error('请至少选择一个目标技能');
 if(new Set(request.skills.map(s=>s.id)).size!==request.skills.length)throw new Error('目标技能重复');
 for(const r of request.skills){const s=data.skills.find(s=>s.id===r.id);if(!s||!Number.isInteger(r.level)||r.level<1||r.level>s.max)throw new Error('目标技能等级无效');}
}
async function search(data,request,highs,progress=()=>{},execution={}){
 validateRequest(data,request);const started=Date.now(),budget=Math.max(1,Math.min(180,request.options?.seconds||45))*1000,deadline=started+budget;
 const timed=request.options?.searchMode==='time',limit=request.options?.limit||3,alternate=execution.profile==='alternate';
 const weights=skillWeights(data,request.skills),eligible=data.armors.filter(a=>!(request.options?.sex==='MaleOnly'&&a.sex==='FemaleOnly')&&!(request.options?.sex==='FemaleOnly'&&a.sex==='MaleOnly')&&!(request.options?.rank==='Master'&&a.rank!=='Master')&&(!request.options?.fixedArmors?.[a.part]||request.options.fixedArmors[a.part].id===a.id)&&(!request.options?.locked?.[a.part]||request.options.locked[a.part]===a.id));
 const score=v=>v.score.total+(alternate?(request.options?.resultSort==='defense'?v.a.defense/20:v.score.native*0.3)+v.score.refundable*0.1:0);
 const groups=PARTS.map(p=>eligible.filter(a=>a.part===p).map(a=>({a,score:equivalentScore(a,request.skills,data,weights)})).sort((a,b)=>score(b)-score(a)||a.a.id.localeCompare(b.a.id)));
 if(groups.some(g=>!g.length))throw new Error('某个部位没有符合条件的防具');
 progress({phase:'charms',message:'整理合法护石与孔位组合…'});
 const charms=request.options?.fixedCharm?[request.options.fixedCharm]:request.options?.noCharm?[{id:'none',name:'不使用护石',skills:[],slots:[],empty:true}]:(execution.charms||generateCharms(data,request.skills,{fixed:request.options?.fixedCharms!==false}));
 if(!charms.length)throw new Error('没有可用护石候选');
 const results=[],resultIndices=new Map(),excluded=[],attempts=[],tiers=alternate?[24,64,Infinity]:[12,32,Infinity];let exhaustive=false,domainExhausted=false,seed,solveCount=0;
 const accept=verified=>{
  const key=resultIdentity(verified),old=resultIndices.get(key);
  if(old==null||compareResults(verified,results[old],request.options?.resultSort||'defense')<0){
   verified.scores=Object.fromEntries(verified.pieces.map(a=>[a.id,equivalentScore(a,request.skills,data,weights)]));
   if(old==null){resultIndices.set(key,results.length);results.push(verified);}else results[old]=verified;
   if(!seed||compareResults(verified,seed,request.options?.resultSort||'defense')<0)seed=verified;
   progress({phase:'result',result:verified,key,index:old??results.length-1,message:`已找到 ${results.length} 套方案，正在优化所选指标…`});
  }
  return verified;
 };
 const record=(model,raw)=>accept(validateResult(data,request,reconstruct(model,raw,data,request)));
 // Secure a legal incumbent before spending the budget on the ranking objective.
 if(timed&&execution.bootstrap!==false){
  const initialRequest={...request,options:{...request.options,searchMode:'count',limit:1,seconds:Math.min(12,budget/1000)}};
  const initial=await search(data,initialRequest,highs,p=>{if(p.phase==='result')accept(p.result);else progress({...p,message:p.message?'寻找初始配装 · '+p.message:p.message});},{...execution,bootstrap:false});
  attempts.push(...initial.attempts.map(a=>({...a,phase:'bootstrap'})));
  for(const r of initial.results)accept(r);
 }
 // Improve the known armor/charm combination in a small exact subproblem first.
 if(timed&&seed&&execution.refine!==false&&Date.now()<deadline-1000){
  const focusedOptions={...request.options,searchMode:'time',seconds:Math.min(2,budget/1000*0.1,(deadline-Date.now())/1000*0.2),fixedArmors:Object.fromEntries(seed.pieces.map(p=>[p.part,request.options?.fixedArmors?.[p.part]||{id:p.id}]))};
  if(seed.charm.empty){focusedOptions.noCharm=true;delete focusedOptions.fixedCharm;}else{focusedOptions.noCharm=false;focusedOptions.fixedCharm=seed.charm;}
  const focused=await search(data,{...request,options:focusedOptions},highs,p=>{if(p.phase==='result')accept(validateResult(data,request,p.result));else progress({...p,message:p.message?'优化已知配装 · '+p.message:p.message});},{...execution,bootstrap:false,refine:false});
  attempts.push(...focused.attempts.map(a=>({...a,phase:'refine'})));
  for(const r of focused.results)accept(validateResult(data,request,r));
 }
 for(let stage=0;stage<tiers.length&&Date.now()<deadline;stage++){
  const armors=groups.flatMap(g=>g.slice(0,tiers[stage]).map(v=>v.a));if(stage>0&&armors.length===groups.flatMap(g=>g.slice(0,tiers[stage-1])).length)continue;
  const full=armors.length===eligible.length,stageEnd=timed&&!full?Math.min(deadline,started+budget*(stage===0?0.15:0.4)):deadline;
  progress({phase:'model',stage:stage+1,armors:armors.length,charms:charms.length,message:`按${alternate?'防御与技能互补':'等效'}优先搜索 ${armors.length} 件防具 · ${charms.length} 枚护石候选`});
  const model=buildModel(data,request,armors,charms,timed?[]:excluded),solver=typeof highs.createModel==='function'?persistentSolver(highs,model,data,seed):null;
  try{while(Date.now()<stageEnd&&(timed||results.length<limit)){
   const remaining=(stageEnd-Date.now())/1000;if(remaining<0.05)break;
   const seconds=timed?remaining:full?remaining:Math.min(remaining,stage===0?Math.max(4,budget/1000*0.3):Math.max(6,remaining*0.5));
   progress({phase:'solve',stage:stage+1,message:`正在求解第 ${results.length+1} 套方案…`,variables:model.lp.vars.length});
   const options={output_flag:false,time_limit:seconds,mip_rel_gap:timed?0:0.02,mip_abs_gap:timed?0:0.0001,random_seed:(execution.seed||0)+solveCount++};
   if(solver)options.mip_max_improving_sols=timed?2147483647:1;
   let lastCallback=0;
   const raw=solver?solver.solve(options,timed?candidate=>{if(Date.now()-lastCallback<200)return;try{record(model,candidate);lastCallback=Date.now();}catch{}}:null):highs.solve(model.lp.text(),options);
   const attempt={stage:stage+1,armors:armors.length,status:raw.Status,variables:model.lp.vars.length};attempts.push(attempt);
   try{
    if(raw.Status==='Infeasible')throw new Error('当前候选范围已枚举完毕');
    const verified=record(model,raw),allFixed=PARTS.every(p=>request.options?.fixedArmors?.[p]);
    // A timed-out incumbent is kept for improvement, not declared the best of its armor combination.
    if(timed&&raw.Status!=='Optimal')break;
    const exclusion=timed&&allFixed?{armors:verified.armors.map(a=>a.id),charm:charmSignature(verified.charm)}:verified.armors.map(a=>a.id);
    excluded.push(exclusion);addExclusion(model,exclusion);if(timed&&!full)break;
   }catch(e){
    attempt.validation=e.message;if(e.code==='DEFENSE_CANCELLED'&&excludeDefenseCancellation(model,e.armorId))continue;
    if(raw.Status==='Infeasible'&&full){exhaustive=results.length===0;domainExhausted=true;}break;
   }
  }}finally{solver?.dispose();}
  if((!timed&&results.length>=limit)||domainExhausted)break;
 }
 results.sort((a,b)=>compareResults(a,b,request.options?.resultSort||'defense'));
 return {status:results.length?'feasible':'unknown',results,elapsedMs:Date.now()-started,attempts,eligible:eligible.length,charms:charms.length,fullModelInfeasible:exhaustive,domainExhausted,completeDomain:false,searchMode:timed?'time':'count',profile:alternate?'alternate':'balanced',
  note:'双Worker互补候选搜索；限时模式持续优化所选指标，超时不排除未证明最优的组合。所有结果独立校验。时限内不保证全局最优。风雷合一额外加成未计入。'};
}

const api={HUNTER_DEFENSE,equipmentStats,balanceResistances,modelSeed,fallbackSummary,orderedAtoms,fallbackEffects,canFailOrdinaryDraw,isDedicatedFallback,isOrdinaryAtom,validateArmorSelection,PARTS,PART_NAMES,METHOD_NAMES,upgradeSlots,caps,ordinarySlotShapes,generateCharms,equivalentScore,buildModel,reconstruct,validateResult,validateCharm,validateRequest,packDecorations,fallbackEffect,splitFallback,applySearchObjective,resultIdentity,validateRestrictions,evaluateArmor,atomSignature,charmSignature,compareResults,search};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ForgeEngine=api;
})(globalThis);
