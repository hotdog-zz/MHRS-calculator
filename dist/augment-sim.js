/* Weighted, process-based armor augmentation. Independent from the set solver. */
(function(root){
'use strict';
const MODES={normal:'普通炼化',skills:'技能特化',slots:'插槽特化',stable:'稳定型'},ELEMENTS=['fire','water','thunder','ice','dragon'];
const sum=xs=>xs.reduce((a,b)=>a+b,0),attr=r=>r.category===13?'defense':ELEMENTS[Math.floor((r.id-89)/10)];
function check(v,m){if(!v)throw new Error(m);}
const GRADES={D:3,C:6,B:9,A:12,S:15};
function skillLevel(r,id,metric='final'){if(metric==='final')return r.skills.find(s=>s.skill_id===id)?.level||0;let n=0;for(const a of r.atoms)if(a.category===20&&a.skillId===id&&(metric==='added'?a.value>0:a.value<0))n+=Math.abs(a.value);return n;}
function compileQuery(data,text=''){
 check(typeof text==='string'&&text.length<=2000,'筛选指令最长2000字');if(!text.trim())return ()=>true;
 const tokens=[],pattern=/\s*(>=|<=|!=|<>|==|&&|\|\||[()!,<>=]|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[-+]?\d+(?:\.\d+)?|[\p{L}_][\p{L}\p{N}_.]*)/uy;let pos=0;
 while(pos<text.length){if(!text.slice(pos).trim())break;pattern.lastIndex=pos;const m=pattern.exec(text);check(m,'筛选指令第'+(pos+1)+'字附近有无法识别的内容');tokens.push(m[1]);pos=pattern.lastIndex;check(tokens.length<=256,'筛选指令过于复杂');}
 let i=0,depth=0;const take=()=>tokens[i++],is=(...xs)=>xs.includes((tokens[i]||'').toUpperCase()),need=t=>{check(take()===t,'筛选指令缺少 '+t);},lookup=new Map();for(const s of data.skills){lookup.set(String(s.id),s.id);lookup.set(s.name,s.id);if(s.nameEn)lookup.set(s.nameEn.toLowerCase(),s.id);}
 const count=(r,test)=>{let n=0;for(const a of r.atoms)if(a.category===20&&test(a))n+=Math.abs(a.value);return n;};
 function value(){const token=take();check(token!=null,'筛选指令缺少数值或字段');if(/^[-+]?\d/.test(token)){const n=Number(token);check(Number.isFinite(n),'筛选数值无效');return ()=>n;}
  const name=token.toLowerCase();if(tokens[i]==='('){check(['skill','added','removed'].includes(name),'不支持的筛选函数：'+token);take();const arg=take();check(arg!=null,'函数缺少技能参数');const key=/^['"]/.test(arg)?arg.slice(1,-1).replace(/\\(['"\\])/g,'$1'):arg;const id=lookup.get(key)??lookup.get(key.toLowerCase());check(id!=null,'未知技能：'+key);need(')');return r=>skillLevel(r,id,name==='skill'?'final':name);}
  const grade=/^(grade|grade_at_least)\.([dcbas])$/i.exec(token);if(grade){const cost=GRADES[grade[2].toUpperCase()],plus=grade[1].toLowerCase()==='grade_at_least';return r=>count(r,a=>a.value>0&&(plus?a.cost>=cost:a.cost===cost));}
  const fields=new Map([['defense',r=>r.defense],['defense_delta',r=>r.defenseDelta],['slots',r=>r.slotPoints],['cost',r=>r.cost],['added_cost',r=>r.skillCost],['records',r=>r.atoms.length],['added',r=>r.skillAdds],['removed',r=>count(r,a=>a.value<0)],['删除技能',r=>count(r,a=>a.value<0)],['扣技能',r=>count(r,a=>a.value<0)]]);check(fields.has(name),'未知筛选字段：'+token);return fields.get(name);
 }
 function predicate(){check(++depth<=32,'筛选括号或NOT嵌套过深');let fn;if(is('NOT','!','非')){take();const inner=predicate();fn=r=>!inner(r);}else if(tokens[i]==='('){take();fn=or();need(')');}else {const a=value();if(is('=','==','!=','<>','<','<=','>','>=')){const op=take(),b=value();fn=r=>{const x=a(r),y=b(r);return op==='='||op==='=='?x===y:op==='!='||op==='<>'?x!==y:op==='<'?x<y:op==='<='?x<=y:op==='>'?x>y:x>=y;};}else fn=r=>!!a(r);}depth--;return fn;}
 function and(){let left=predicate();while(is('AND','&&','且')){take();const a=left,b=predicate();left=r=>a(r)&&b(r);}return left;}
 function or(){let left=and();while(is('OR','||','或')){take();const a=left,b=and();left=r=>a(r)||b(r);}return left;}
 const result=or();check(i===tokens.length,'筛选指令中有多余内容：'+(tokens[i]||''));return result;
}
function createRng(seed,budget,mode){
 let z=seed>>>0;const hash=()=>{z=(z+0x9e3779b9)>>>0;let t=z;t=Math.imul(t^(t>>>16),0x21f0aaad);t=Math.imul(t^(t>>>15),0x735a2d97);return(t^(t>>>15))>>>0;};
 const k=Math.trunc((budget-10)/2),m=['normal','skills','slots','stable'].indexOf(mode),stream=k>=0&&k<=5?32+m+(3-m)*k:18;
 // A local seed creates repeatable streams, not the state of a player's save.
 for(let i=0;i<stream;i++)hash();let x=hash(),y=hash(),a=hash(),w=hash();
 const next=()=>{const t=(x^(x<<15))>>>0,r=(w^(w>>>21)^t^(t>>>4))>>>0;x=y;y=a;a=w;w=r;return r;};
 return {next,int:n=>{check(n>0,'随机候选为空');return next()%n;},stream};
}
function weighted(rows,rng,weight=r=>r.weight){const total=sum(rows.map(weight));if(total<=0)return null;let n=rng.int(total);for(const r of rows){n-=weight(r);if(n<0)return r;}return null;}
function upgradeSlots(initial,points){const a=[...initial,0,0,0].slice(0,3).sort((a,b)=>b-a);for(let n=0;n<points;n++){let i=a.indexOf(0);if(i<0)i=a.findIndex(x=>x<4);if(i<0)break;a[i]++;}return a.filter(Boolean);}
function createContext(data,armorId,mode='normal'){
 const armor=data.armors.find(a=>a.id===armorId);check(armor&&armor.pool>0,'请选择可炼化的防具');check(MODES[mode],'炼化方式无效');
 check(!['skills','slots'].includes(mode)||armor.pool<=6,'该防具不支持技能或插槽特化');
 const pool=mode==='stable'&&armor.pool<=6?armor.pool+6:armor.pool,rows=data.atoms.filter(a=>a.pool===pool),byId=new Map(rows.map(a=>[a.id,a]));
 const categories=data.augmentationLottery?.find(r=>r.table_no===pool)?.lot_num;check(categories?.length===4,'缺少炼化类别抽选权重，请更新数据');
 const skills=new Map(data.skills.map(s=>[s.id,s])),native=new Map(armor.skills.map(s=>[s.skill_id,s.level])),buckets=new Map();for(const s of data.skills)if(s.cost!=null){if(!buckets.has(s.cost))buckets.set(s.cost,[]);buckets.get(s.cost).push(s);}
 const allowed=r=>r.standardWeight>0&&[13,14,19,20].includes(r.category)&&(mode!=='stable'||[13,14,19].includes(r.category)&&r.values.some(v=>v.value>0&&v.weight>0));
 const ordinary=new Map([13,14,19,20].map(c=>[c,rows.filter(r=>r.category===c&&allowed(r)&&(mode!=='stable'||r.cost>0))]));
 const closing=rows.filter(r=>r.category===13&&r.cost>0&&r.values.some(v=>v.value>0&&v.weight>0)).sort((a,b)=>b.cost-a.cost);
 return {armor,mode,pool,rows,byId,categories,skills,native,buckets,ordinary,closing};
}
function levels(ctx,records){const out=new Map(ctx.native);for(const r of records)if(r.category===20)out.set(r.skillId,(out.get(r.skillId)||0)+r.value);return out;}
function validateEffect(ctx,records,e){
 if(e.category===19&&e.value>12-sum(ctx.armor.slots))return 'slots';
 if(e.category!==20)return null;
 const current=levels(ctx,records),lv=current.get(e.skillId)||0,s=ctx.skills.get(e.skillId);
 if(e.value<0&&(!ctx.native.has(e.skillId)||lv<=0))return 'skill';
 if(e.value>0){if(!s||lv>=s.max)return 'skill';const foreign=records.filter(r=>r.category===20&&r.value>0&&!ctx.native.has(r.skillId));
  if(!ctx.native.has(e.skillId)&&!foreign.some(r=>r.skillId===e.skillId)&&ctx.native.size+foreign.length>=5)return 'skill';}
 return null;
}
function cancelRecords(records,e){
 let out=[...records,e];if(e.category===20){const i=records.findIndex(r=>r.category===20&&r.skillId===e.skillId&&r.value===-e.value);if(i>=0)out=out.filter((_,j)=>j!==i&&j!==out.length-1);}
 else if([13,14,15,19].includes(e.category)){const same=r=>r.category===e.category&&(e.category===13||e.category===19||r.attribute===e.attribute);if(sum(out.filter(same).map(r=>r.value))===0)out=out.filter(r=>!same(r));}
 return out;
}
function rollValue(row,rng){const vs=row.values.filter(v=>v.weight>0);return vs.length===1?vs[0]:weighted(vs,rng);}
function draw(ctx,state,rng){
 const {mode,ordinary,byId}=ctx,{step,records}=state;let row,fixed=false,closing=false,third=false;
 if(records.length===6&&ctx.armor.budget-state.cost>0){row=ctx.closing.find(r=>r.cost<=ctx.armor.budget-state.cost);closing=true;}
 else if(mode==='normal'&&step<2)row=weighted(ordinary.get(step===0?13:20),rng,r=>r.standardWeight);
 else if(['skills','slots'].includes(mode)&&step<3){
  fixed=true;if(step===0)row=byId.get(149);
  else if(mode==='skills'&&step===1){const ids=[91,101,111,121,131].map(id=>byId.get(id)).filter(Boolean);row=ids.length?ids[rng.int(ids.length)]:null;}
  else if(mode==='slots'&&step===1)row=byId.get(61);
  else if(mode==='slots')row=weighted(ordinary.get(19).filter(r=>r.values.some(v=>v.value===1||v.value===2)),rng,r=>r.standardWeight);
  else {row=weighted(ordinary.get(20).filter(r=>[9,12,15].includes(r.cost)),rng,r=>r.standardWeight);third=true;}
 }else if(mode==='stable'&&step===0)row=weighted(ordinary.get(13),rng,r=>r.standardWeight);
 else {const cat=weighted([13,14,19,20].map((id,i)=>({id,weight:ctx.categories[i]})),rng);if(cat){let id=cat.id;if(mode==='stable'&&id===20)id=13;row=weighted(ordinary.get(id),rng,r=>r.standardWeight);}}
 if(!row)return {reason:'empty',third,closing};const v=rollValue(row,rng);if(!v)return {reason:'empty',third,closing};
 const e={atomId:row.id,category:row.category,cost:row.cost,value:v.value,valueIndex:v.value_index,count:1,...(closing?{fallback:true}:{})};
 if(row.category===20){
  let candidates;if(row.cost<0)candidates=[...ctx.native.keys()];else {candidates=(ctx.buckets.get(row.cost)||[]).map(s=>s.id);if(third){const deleted=new Set(records.filter(r=>r.category===20&&r.value<0).map(r=>r.skillId));candidates=candidates.filter(id=>!deleted.has(id));}}
  if(!candidates.length)return {reason:'empty',third,closing};e.skillId=candidates[rng.int(candidates.length)];
 }else if([13,14,15].includes(row.category))e.attribute=attr(row);
 return {effect:e,third,closing,fixed};
}
function finalize(ctx,records,meta){
 // The game sorts the retained records only once, after generation ends.
 const atoms=records.map(r=>({...r})).sort((a,b)=>a.category-b.category||a.cost-b.cost||a.value-b.value),lv=levels(ctx,atoms),resistances={...ctx.armor.resistances};let defense=ctx.armor.defense,points=0,adds=0,skillCost=0;
 for(const r of atoms){if(r.category===13)defense+=r.value;else if([14,15].includes(r.category))resistances[r.attribute]=(resistances[r.attribute]||0)+r.value;else if(r.category===19)points+=r.value;else if(r.category===20&&r.value>0){adds++;skillCost+=r.cost;}}
 const skills=[...lv].filter(([,level])=>level>0).map(([skill_id,level])=>({skill_id,level}));
 return {atoms,cost:sum(atoms.map(r=>r.cost)),defense,defenseDelta:defense-ctx.armor.defense,resistances,slots:upgradeSlots(ctx.armor.slots,points),slotPoints:points,skillAdds:adds,skillCost,skills,...meta};
}
function roll(ctx,rng,options={}){
 let state={records:[],cost:0,step:0,failures:0},attempts=0,restarts=0;const trace=options.trace?[]:null,maxAttempts=options.maxAttempts||100000;
 while(state.cost<ctx.armor.budget&&state.records.length<7&&state.failures<50){
  check(++attempts<=maxAttempts,'单次炼化超过保护次数，已停止本次模拟；请检查规则或种子');
  const d=options.draw?options.draw(ctx,state,rng):draw(ctx,state,rng),e=d.effect;let reason=d.reason;
  if(e&&!reason){if(state.cost+e.cost>ctx.armor.budget)reason='budget';else reason=validateEffect(ctx,state.records,e);}
  // Skills+ retries step three for skill checks, but not a budget/empty failure.
  if(!(d.third&&reason==='skill'))state.step++;
  if(!e||reason){state.failures++;if(trace)trace.push({attempt:attempts,effect:e||null,accepted:false,reason,records:state.records.length,cost:state.cost});continue;}
  const before=state.records.length;state.records=cancelRecords(state.records,e);state.cost=sum(state.records.map(r=>r.cost));state.failures=0;
  if(trace)trace.push({attempt:attempts,effect:e,accepted:true,cancelled:before+1-state.records.length,records:state.records.length,cost:state.cost});
  if(state.cost>ctx.armor.budget){state={records:[],cost:0,step:0,failures:0};restarts++;}
 }
 return finalize(ctx,state.records,{attempts,restarts,termination:state.records.length===7?'records':state.cost>=ctx.armor.budget?'budget':'failures',...(trace?{trace}:{})});
}
function identity(r){return r.atoms.map(a=>[a.atomId,a.skillId??-1,a.valueIndex].join(':')).sort().join('|');}
function compare(a,b,sort='defense',id=-1,metricType='final'){
 const kind=sort.replace('Asc',''),metric=kind==='specificSkill'?r=>skillLevel(r,id,metricType):kind==='slots'?r=>r.slotPoints:kind==='skills'?r=>r.skillAdds:kind==='skillCost'?r=>r.skillCost:r=>r.defense;
 const ak=a.key||identity(a),bk=b.key||identity(b),sign=sort.endsWith('Asc')?-1:1;return sign*(metric(b)-metric(a))||b.defense-a.defense||a.atoms.length-b.atoms.length||(ak<bk?-1:ak>bk?1:0);
}
class Retained{
 constructor(limit,sort,skill=-1,metric='final'){this.limit=limit;this.sort=sort;this.skill=skill;this.metric=metric;this.heap=[];this.map=new Map();}
 worse(a,b){return compare(a,b,this.sort,this.skill,this.metric)>0;}
 add(r,index){const key=identity(r),old=this.map.get(key);if(old){old.count++;return;}const h=this.heap;
  if(h.length===this.limit&&!this.worse(h[0],r))return;
  const row={...r,key,count:1,first:index};if(h.length===this.limit){this.map.delete(h[0].key);h[0]=row;this.map.set(key,row);let i=0;while(true){let c=i*2+1;if(c>=h.length)break;if(c+1<h.length&&this.worse(h[c+1],h[c]))c++;if(!this.worse(h[c],h[i]))break;[h[c],h[i]]=[h[i],h[c]];i=c;}}
  else {h.push(row);this.map.set(key,row);let i=h.length-1;while(i){const p=(i-1)>>1;if(!this.worse(h[i],h[p]))break;[h[i],h[p]]=[h[p],h[i]];i=p;}}
 }
 rows(){return [...this.heap].sort((a,b)=>compare(a,b,this.sort,this.skill,this.metric));}
}
function createBatch(data,config){
 const count=Number(config.count),limit=Number(config.limit);check(Number.isSafeInteger(count)&&count>=1&&count<=10000000,'模拟次数需为1～10000000');check(Number.isInteger(limit)&&limit>=1&&limit<=5000,'保留数量需为1～5000');check(['defense','slots','skills','skillCost','defenseAsc','slotsAsc','skillsAsc','skillCostAsc','specificSkill','specificSkillAsc'].includes(config.sort),'保留排序无效');
 const seed=Number(config.seed);check(Number.isInteger(seed)&&seed>=0&&seed<=0xffffffff,'种子需为0～4294967295的整数');
 const ctx=createContext(data,config.armorId,config.mode),rng=createRng(seed,ctx.armor.budget,config.mode),sortSkill=Number(config.sortSkill??-1),sortSkillMetric=config.sortSkillMetric||'final';check(['final','added'].includes(sortSkillMetric),'技能排序口径无效');if(config.sort.startsWith('specificSkill'))check(ctx.skills.has(sortSkill),'请选择用于排序的技能');const keep=new Retained(limit,config.sort,sortSkill,sortSkillMetric),query=compileQuery(data,config.query??'');
 const stats={completed:0,attempts:0,restarts:0,matches:0,maxDefense:-Infinity,maxSlots:0,maxSkills:0,defenseSum:0,terminations:{records:0,budget:0,failures:0}},target=Number(config.targetSkill??-1),level=Number(config.targetLevel??1);check(target===-1||ctx.skills.has(target)&&Number.isInteger(level)&&level>=1&&level<=ctx.skills.get(target).max,'目标技能等级无效');let version=0;
 return {ctx,rng,keep,stats,config:{...config,count,limit,seed,sortSkill,sortSkillMetric},step(size=250){const end=Math.min(count,stats.completed+size);while(stats.completed<end){const r=roll(ctx,rng);stats.completed++;stats.attempts+=r.attempts;stats.restarts+=r.restarts;stats.defenseSum+=r.defense;stats.maxDefense=Math.max(stats.maxDefense,r.defense);stats.maxSlots=Math.max(stats.maxSlots,r.slotPoints);stats.maxSkills=Math.max(stats.maxSkills,r.skillAdds);stats.terminations[r.termination]++;if((target<0||r.skills.some(s=>s.skill_id===target&&s.level>=level))&&query(r))stats.matches++;keep.add(r,stats.completed);}version++;return stats.completed===count;},snapshot(){return {version,stats:{...stats,terminations:{...stats.terminations}},rows:keep.rows(),config:this.config,stream:rng.stream};}};
}
const api={MODES,ELEMENTS,GRADES,skillLevel,compileQuery,createRng,createContext,weighted,draw,validateEffect,cancelRecords,finalize,roll,identity,compare,Retained,createBatch};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ForgeAugmentSim=api;
})(globalThis);
