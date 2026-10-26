/* Sunbreak final-state set search. Plain JS shared by browser Worker and Node tests. */
(function(root){
'use strict';
const PARTS=['head','chest','arm','waist','leg'];
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
 const slot=sum(a.slots.map(lv=>Math.max(0,...data.decorations.filter(d=>d.slot<=lv).map(d=>sum(d.skills.map(s=>Math.min(s.level,wanted.get(s.skill_id)||0)*(weights[s.skill_id]||0)))))));
 const refundable=sum(a.skills.filter(s=>!wanted.has(s.skill_id)).map(s=>s.level));
 return {total:native+slot+Math.min(refundable,3)*0.08+a.budget*0.005,native,slot,refundable};
}
class LP{
 constructor(){this.vars=[];this.rows=[];this.objective=[];this.index=0;}
 variable(prefix,ub=1,objective=0){const n=prefix+'_'+this.index++;this.vars.push({n,ub});if(objective)this.objective.push([objective,n]);return n;}
 expression(terms){const list=terms.filter(x=>Math.abs(x[0])>1e-12);return list.length?list.map(([c,n],i)=>(c<0?' - ':i?' + ':' ')+Math.abs(c)+' '+n).join(''):' 0 dummy';}
 constraint(t,op,rhs){this.rows.push(this.expression(t)+' '+op+' '+rhs);}
 text(){return 'Minimize\n obj:'+this.expression(this.objective)+'\nSubject To\n'+this.rows.map((x,i)=>' c'+i+':'+x).join('\n')+'\nBounds\n dummy = 0\n'+this.vars.filter(v=>v.ub!==1).map(v=>' 0 <= '+v.n+' <= '+v.ub).join('\n')+'\nGeneral\n'+this.vars.filter(v=>v.ub!==1).map(v=>' '+v.n).join('\n')+'\nBinary\n'+this.vars.filter(v=>v.ub===1).map(v=>' '+v.n).join('\n')+'\nEnd\n';}
}
function numericAttribute(atom){if(atom.category===13)return 'defense';const i=Math.floor((atom.id-89)/10);return ['fire','water','thunder','ice','dragon'][i];}
function buildModel(data,request,armors,charms,excluded=[]){
 const lp=new LP(),skillIndex=new Map(data.skills.map(s=>[s.id,s]));
 const skillTerms=Object.fromEntries(request.skills.map(s=>[s.id,[]]));const capacity=[[],[],[],[]];const pieces=[];
 const options={augment:true,deleteSkills:true,...request.options};
 for(const a of armors){
  const x=lp.variable('a');const fixed=request.options?.fixedArmors?.[a.part];
  if(fixed){
   if(fixed.id!==a.id)throw new Error('固定防具候选不一致');
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
    const gate=lp.variable('gate');lp.constraint([[1,n],[-max,gate]],'<=',0);lp.constraint([[1,gate],[-1,x]],'<=',0);
    if(native[r.id]){
     const del=edits.find(e=>e.skill===r.id&&e.sign===-1);if(del)lp.constraint([[1,del.n],[native[r.id],gate],[-native[r.id],x]],'<=',0);
    }else{types.push([1,gate]);lp.constraint([[1,gate],[-1,n]],'<=',0);}
   }
   lp.constraint([...types,[a.skills.length-5,x]],'<=',0);
  }
  if(active)for(const atom of pool){
   if(![13,14].includes(atom.category)||atom.cost===0)continue;
   // Positive resistance cannot improve any modeled goal. Every negative outcome
   // and positive defense outcome is retained; no fabricated refund constants.
   if(atom.category===14&&atom.cost>0)continue;
   for(const v of atom.values){
    if(!v.value)continue;
    const n=lp.variable('num',7,1+Math.abs(Math.min(0,v.value))*0.001);rec.push([1,n]);cost.push([atom.cost,n]);if(atom.category===13)def.push([v.value,n]);numeric.push({n,atom:atom.id,value:v.value,valueIndex:v.value_index,attribute:numericAttribute(atom)});
   }
  }
  const slotAtoms=active?pool.filter(v=>v.category===19):[];
  const choices=[];const maxPoints=slotAtoms.length?12-sum(a.slots):0;
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
  lp.constraint([...edits.filter(e=>e.sign>0).map(e=>[1,e.n]),...choices.map(c=>[c.atoms.length,c.n]),[-(request.options?.augmentLimits?.[a.part]??7),x]],'<=',0);
  lp.constraint([...rec,[-7,x]],'<=',0);lp.constraint([...cost,[-a.budget,x]],'<=',0);lp.constraint(def,'>=',0);
  pieces.push({x,a,edits,numeric,choices});
 }
 for(const part of PARTS)lp.constraint(pieces.filter(p=>p.a.part===part).map(p=>[1,p.x]),'=',1);
 const charmVars=charms.map(c=>{
  const n=lp.variable('charm');for(const s of c.skills)if(skillTerms[s.skill_id])skillTerms[s.skill_id].push([s.level,n]);caps(c.slots).forEach((v,i)=>{if(v)capacity[i].push([v,n]);});return {n,c};
 });lp.constraint(charmVars.map(x=>[1,x.n]),'=',1);
 for(const ids of excluded)addExclusion({lp,pieces,charms:charmVars},ids);
 const decos=[];
 for(const d of data.decorations){
  if(!d.skills.some(s=>skillTerms[s.skill_id]))continue;
  const n=lp.variable('deco',21,0.001);for(const s of d.skills)if(skillTerms[s.skill_id])skillTerms[s.skill_id].push([s.level,n]);decos.push({n,d});
 }
 const weapon=data.weapons.find(w=>w.id===request.weaponId);if(!weapon)throw new Error('请选择数据表中存在的武器。');
 const wc=caps(weapon.slots);
 for(let i=0;i<4;i++)lp.constraint([...decos.filter(v=>v.d.slot>=i+1).map(v=>[1,v.n]),...capacity[i].map(([v,n])=>[-v,n])],'<=',wc[i]);
 for(const s of request.skills)lp.constraint(skillTerms[s.id],'>=',s.level);
 return {lp,pieces,charms:charmVars,decos,weapon};
}
function reconstruct(model,solution,data,request){
 const get=n=>Math.round(solution.Columns?.[n]?.Primal||0);
 if(model.lp.vars.some(v=>Math.abs((solution.Columns?.[v.n]?.Primal||0)-get(v.n))>1e-4))throw new Error('求解尚未得到整数可行解');
 const armors=model.pieces.filter(p=>get(p.x)===1).map(p=>{
  if(p.fixed)return {id:p.a.id,atoms:JSON.parse(JSON.stringify(p.fixed))};
  const atoms=[];for(const e of p.edits){const count=get(e.n);if(count)atoms.push({atomId:e.atom,skillId:e.skill,value:e.sign,count});}
  for(const e of p.numeric){const count=get(e.n);if(count)atoms.push({atomId:e.atom,value:e.value,valueIndex:e.valueIndex,attribute:e.attribute,count});}
  const choice=p.choices.find(c=>get(c.n));if(!choice)throw new Error('缺少孔位状态');
  for(const v of choice.atoms)atoms.push({atomId:v.atom,value:v.value,count:1});
  return {id:p.a.id,atoms};
 });
 const charm=model.charms.find(c=>get(c.n))?.c;
 const decorations=model.decos.filter(d=>get(d.n)>0).map(d=>({id:d.d.id,count:get(d.n)}));
 return {weaponId:request.weaponId,armors,charm,decorations};
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
function charmSignature(c){return JSON.stringify([c?.empty===true,c?.fixed?c.id:null,c?.method||null,c?.skills?.map(s=>[s.skill_id,s.level]),c?.slots]);}
function evaluateArmor(data,request,piece){
 const skillIndex=new Map(data.skills.map(s=>[s.id,s]));
 if(!piece||!Array.isArray(piece.atoms))throw new Error('防具炼化记录无效');
  const a=data.armors.find(a=>a.id===piece.id);if(!a)throw new Error('未知防具');
  if((request.options?.sex==='MaleOnly'&&a.sex==='FemaleOnly')||(request.options?.sex==='FemaleOnly'&&a.sex==='MaleOnly'))throw new Error('防具性别不符');
  if(request.options?.rank==='Master'&&a.rank!=='Master')throw new Error('防具位阶不符');
  if(request.options?.augment===false&&piece.atoms.length)throw new Error('已禁用炼化');
  let records=0,cost=0,points=0,def=a.defense;const res={...a.resistances};const levels=nativeMap(a),signs=new Map(),removed={},added=new Set();
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
   }else if(raw.category===19){if(!raw.values.some(v=>v.value===atom.value))throw new Error('孔位词条数值非法');points+=atom.value*atom.count;}
   else if(raw.category===13||raw.category===14){
    if(!raw.values.some(v=>v.value===atom.value&&v.value_index===atom.valueIndex))throw new Error('防御/耐性变化不在有效数值表中');
    const attribute=numericAttribute(raw);if(raw.category===13)def+=atom.value*atom.count;else res[attribute]+=atom.value*atom.count;
   }else throw new Error('当前结果含未支持的词条类别');
  }
  if(records>7||cost>a.budget||def<0)throw new Error('炼化条数、cost或防御下界非法');
  if(a.skills.length+added.size>5)throw new Error('原生技能种类＋新增技能种类超过5');
  for(const [id,lv] of Object.entries(removed))if(lv>(nativeMap(a)[id]||0))throw new Error('删除超过原生技能等级');
  for(const [id,lv] of Object.entries(levels)){if(lv<0||lv>skillIndex.get(+id).max)throw new Error('单件技能等级越界');}
  const slots=upgradeSlots(a.slots,points);
  const skillAdds=sum(piece.atoms.filter(t=>data.atoms.find(v=>v.pool===a.pool&&v.id===t.atomId)?.category===20&&t.value>0).map(t=>t.count));
  const skillAddCost=sum(piece.atoms.filter(t=>data.atoms.find(v=>v.pool===a.pool&&v.id===t.atomId)?.category===20&&t.value>0).map(t=>t.count*skillIndex.get(t.skillId).cost));
  const slotAdds=sum(piece.atoms.filter(t=>data.atoms.find(v=>v.pool===a.pool&&v.id===t.atomId)?.category===19).map(t=>t.count));
  const additions=skillAdds+slotAdds,limit=request.options?.augmentLimits?.[a.part]??7;
  if(additions>limit)throw new Error(PART_NAMES[a.part]+'新增技能与孔位词条超过上限'+limit);
  return {...a,atoms:piece.atoms,levels,slots,records,cost,finalDefense:def,finalResistances:res,skillAdds,skillAddCost,slotAdds,additions};
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
 const containers=[{id:weapon.id,slots:weapon.slots}],pieces=[];let defense=weapon.defense||0;
 for(const piece of result.armors){
  const evaluated=evaluateArmor(data,request,piece);
  const fixed=request.options?.fixedArmors?.[evaluated.part];
  if(fixed&&(fixed.id!==piece.id||atomSignature(fixed.atoms)!==atomSignature(piece.atoms)))throw new Error('固定防具或炼化被改变');
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
 return {...result,pieces,totals,placement,defense,verified:true,skillAddCost:sum(pieces.map(p=>p.skillAddCost)),skillAdds:sum(pieces.map(p=>p.skillAdds)),slotAdds:sum(pieces.map(p=>p.slotAdds)),additions:sum(pieces.map(p=>p.additions)),records:sum(pieces.map(p=>p.records)),decoCount:sum(ds.map(x=>x.count)),unusedSlots:placement.filter(p=>!p.decorationId).map(p=>p.level),stormsoulConservative:(totals[110]||0)>=4};
}
function addExclusion(model,excluded){
 const ids=Array.isArray(excluded)?excluded:excluded.armors;
 const terms=model.pieces.filter(p=>ids.includes(p.a.id)).map(p=>[1,p.x]);
 if(!Array.isArray(excluded)){
  const charm=model.charms.find(v=>charmSignature(v.c)===excluded.charm);if(charm)terms.push([1,charm.n]);
  model.lp.constraint(terms,'<=',charm?5:4);
 }else model.lp.constraint(terms,'<=',4);
}
function validateRestrictions(data,request){
 const options=request.options||{};
 for(const [part,limit] of Object.entries(options.augmentLimits||{}))if(!PARTS.includes(part)||!Number.isInteger(limit)||limit<0||limit>7)throw new Error('逐件新增上限必须为0至7');
 for(const [part,piece] of Object.entries(options.fixedArmors||{})){
  if(!PARTS.includes(part)||data.armors.find(a=>a.id===piece?.id)?.part!==part)throw new Error('固定防具部位不符');
  evaluateArmor(data,request,piece);
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
async function search(data,request,highs,progress=()=>{}){
 validateRequest(data,request);const started=Date.now();const deadline=started+Math.max(1,Math.min(180,request.options?.seconds||45))*1000;
 const timed=request.options?.searchMode==='time',limit=request.options?.limit||3;
 const weights=skillWeights(data,request.skills);const eligible=data.armors.filter(a=>!(request.options?.sex==='MaleOnly'&&a.sex==='FemaleOnly')&&!(request.options?.sex==='FemaleOnly'&&a.sex==='MaleOnly')&&!(request.options?.rank==='Master'&&a.rank!=='Master')&&(!request.options?.fixedArmors?.[a.part]||request.options.fixedArmors[a.part].id===a.id)&&(!request.options?.locked?.[a.part]||request.options.locked[a.part]===a.id));
 const groups=PARTS.map(p=>eligible.filter(a=>a.part===p).map(a=>({a,score:equivalentScore(a,request.skills,data,weights)})).sort((a,b)=>b.score.total-a.score.total));
 if(groups.some(g=>!g.length))throw new Error('某个部位没有符合条件的防具');
 progress({phase:'charms',message:'整理合法护石与孔位组合…'});
 const charms=request.options?.fixedCharm?[request.options.fixedCharm]:request.options?.noCharm?[{id:'none',name:'不使用护石',skills:[],slots:[],empty:true}]:generateCharms(data,request.skills,{fixed:request.options?.fixedCharms!==false});
 if(!charms.length)throw new Error('没有可用护石候选');
 const results=[],excluded=[],attempts=[],tiers=[12,32,Infinity];let exhaustive=false,domainExhausted=false;
 for(let stage=0;stage<tiers.length&&Date.now()<deadline;stage++){
  const armors=groups.flatMap(g=>g.slice(0,tiers[stage]).map(v=>v.a));
  if(stage>0&&armors.length===groups.flatMap(g=>g.slice(0,tiers[stage-1])).length)continue;
  const full=armors.length===eligible.length;
  const stageEnd=timed&&!full?Math.min(deadline,started+(deadline-started)*(stage===0?0.25:0.6)):deadline;
  progress({phase:'model',stage:stage+1,armors:armors.length,charms:charms.length,message:`按等效优先搜索 ${armors.length} 件防具 · ${charms.length} 枚护石候选`});
  const model=buildModel(data,request,armors,charms,excluded);
  while(Date.now()<stageEnd&&(timed||results.length<limit)){
   const text=model.lp.text();const remaining=(stageEnd-Date.now())/1000;if(remaining<0.05)break;
   const seconds=timed?Math.min(remaining,Math.max(0.2,(deadline-started)/1000*0.15)):full?remaining:Math.min(remaining,stage===0?Math.max(4,(deadline-started)/1000*0.3):Math.max(6,remaining*0.5));
   progress({phase:'solve',stage:stage+1,message:`正在求解第 ${results.length+1} 套方案…`,variables:model.lp.vars.length});
   const raw=highs.solve(text,{output_flag:false,time_limit:seconds,mip_rel_gap:0.02,mip_abs_gap:0.0001,random_seed:attempts.length});
   const attempt={stage:stage+1,armors:armors.length,status:raw.Status,variables:model.lp.vars.length};attempts.push(attempt);
   try{
    if(raw.Status==='Infeasible')throw new Error('当前候选范围已枚举完毕');
    const verified=validateResult(data,request,reconstruct(model,raw,data,request));verified.scores=Object.fromEntries(verified.pieces.map(a=>[a.id,equivalentScore(a,request.skills,data,weights)]));
    results.push(verified);
    const exclusion=timed?{armors:verified.armors.map(a=>a.id),charm:charmSignature(verified.charm)}:verified.armors.map(a=>a.id);
    excluded.push(exclusion);addExclusion(model,exclusion);
    progress({phase:'result',result:verified,index:results.length,message:`找到并校验通过第 ${results.length} 套方案`});
   }catch(e){
    attempt.validation=e.message;
    if(raw.Status==='Infeasible'&&full){exhaustive=results.length===0;domainExhausted=true;}
    // A full-domain timeout may be retried within the remaining wall-clock budget.
    if(timed&&full&&raw.Status!=='Infeasible'&&Date.now()<stageEnd-100)continue;
    break;
   }
  }
  if((!timed&&results.length>=limit)||domainExhausted)break;
 }
 results.sort((a,b)=>compareResults(a,b,request.options?.resultSort||'defense'));
 return {status:results.length?'feasible':'unknown',results,elapsedMs:Date.now()-started,attempts,eligible:eligible.length,charms:charms.length,fullModelInfeasible:exhaustive,domainExhausted,completeDomain:false,searchMode:timed?'time':'count',
  note:'方案按防具组合与护石区分；同一组合不枚举所有炼化和珠子变体。限时内持续搜索，不保证穷举或全局最优。风雷合一额外加成未计入。'};
}

const api={PARTS,PART_NAMES,METHOD_NAMES,upgradeSlots,caps,ordinarySlotShapes,generateCharms,equivalentScore,buildModel,reconstruct,validateResult,validateCharm,validateRequest,packDecorations,validateRestrictions,evaluateArmor,atomSignature,charmSignature,compareResults,search};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ForgeEngine=api;
})(globalThis);
