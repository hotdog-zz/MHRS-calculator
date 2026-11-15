/* Anonymous armor probabilities, shared by browser workers and Node validation. */
(function(root){'use strict';
function assignment(partition,population,minima){if(minima.length>population||partition.length>population)return 0;const counts=new Map();for(const v of partition)counts.set(v,(counts.get(v)||0)+1);counts.set(0,(counts.get(0)||0)+population-partition.length);const needs=[...minima].sort((a,b)=>b-a);
 function visit(i,left){if(i===needs.length)return 1;let p=0;for(const [v,n]of counts)if(n&&v>=needs[i]){counts.set(v,n-1);p+=n/left*visit(i+1,left-1);counts.set(v,n);}return p;}return visit(0,population);}
// Inverse graft queries retain the target's NET requirements. A source loss
// may be compensated by a positive skill which is native on the target.
// Immutable interval matchers are shared across queries; only mathematical
// population/interval constraints enter this key, never equipment identity.
const graftMatcherCache=new Map();
function graftMatcher(pop,needs,hits){
 const sorted=needs.slice().sort((a,b)=>b[0]-a[0]||a[1]-b[1]||(hits?Number(b[2])-Number(a[2]):0)),key=(hits?'hits|':'scalar|')+pop+'|'+JSON.stringify(sorted.map(([min,max,native])=>hits?[min,Number.isFinite(max)?max:'inf',native]:[min,Number.isFinite(max)?max:'inf']));
 if(graftMatcherCache.has(key))return graftMatcherCache.get(key);
 const memo=new Map(),match=vector=>{
  if(memo.has(vector.key))return memo.get(vector.key);const values=vector.values;
  if(sorted.length>pop||values.length>pop){const result=hits?[0]:0;memo.set(vector.key,result);return result;}
  const counts=new Map();for(const v of values)counts.set(v,(counts.get(v)||0)+1);counts.set(0,(counts.get(0)||0)+pop-values.length);
  function scalar(i,left){if(i===sorted.length)return 1;const[min,max]=sorted[i];let p=0;for(const[v,n]of counts)if(n&&v>=min&&v<=max){counts.set(v,n-1);p+=n/left*scalar(i+1,left-1);counts.set(v,n);}return p;}
  function distribution(i,left){if(i===sorted.length)return [1];const[min,max,native]=sorted[i],out=[];for(const[v,n]of counts)if(n&&v>=min&&v<=max){counts.set(v,n-1);const next=distribution(i+1,left-1),shift=native&&v>0?1:0;counts.set(v,n);for(let j=0;j<next.length;j++)out[j+shift]=(out[j+shift]||0)+n/left*(next[j]||0);}return out;}
  const result=hits?distribution(0,pop):scalar(0,pop);memo.set(vector.key,result);return result;
 };
 graftMatcherCache.set(key,match);if(graftMatcherCache.size>4096)graftMatcherCache.delete(graftMatcherCache.keys().next().value);return match;
}
function graftQuery(data,armor,cache,options){
 const skills=new Map(data.skills.map(s=>[s.id,s])),sourceNative=new Map(armor.skills.map(s=>[s.skill_id,s.level])),nativeType=(s,level)=>[s.cost??'x',s.cost==null?'x':s.max,level].join(':'),members=new Map(),population=new Map(),profile=new Map((options.minimumChanges||[]).map(v=>[v.id,v.min]));
 for(const[id,level]of sourceNative){const t=nativeType(skills.get(id),level);members.set(t,(members.get(t)||0)+1);}for(const s of data.skills)if(s.cost!=null&&!sourceNative.has(s.id)){const t=s.cost+':'+s.max;population.set(t,(population.get(t)||0)+1);}
 const factorial=[1];for(let i=1;i<=7;i++)factorial[i]=factorial[i-1]*i;
 const compiled=new Map(),nativeMaps=new WeakMap(),foreignMaps=new WeakMap(),nativeVectors=new WeakMap(),foreignVectors=new WeakMap(),emptyVector={values:[],key:''};
 const contexts=options.graftTargets.map(target=>{const nativeIds=new Set(target.native.map(v=>v.id)),complete=target.completeOutcome===true,base=new Map([...profile].map(([id,min])=>[id,[Math.max(0,min),Infinity]]));for(const v of target.minimumChanges||[]){const old=base.get(v.id)||[0,Infinity];base.set(v.id,[Math.max(old[0],v.min,0),old[1]]);}return {target,nativeIds,identity:JSON.stringify([complete,complete?[...nativeIds].sort((a,b)=>a-b):[]]),base,capacity:target.native.reduce((a,v)=>a+v.level,0),weighted:Array.isArray(target.removedWeights),plans:new Map()};});
 function compile(bounds,context){
  const target=context.target,complete=target.completeOutcome===true,targetNative=context.nativeIds,key=context.identity+'|'+JSON.stringify([...bounds].sort(([a],[b])=>a-b));if(compiled.has(key))return compiled.get(key);
  const groups=new Map();let totalMin=0,impossible=false;
  for(const[id,[min,max]]of bounds){if(min>max){impossible=true;break;}if(min<=0&&max===Infinity)continue;const s=skills.get(id);if(!s)throw Error('概率技能条件无效');totalMin+=Math.max(0,min);
   if(!sourceNative.has(id)&&s.cost==null){if(min>0)impossible=true;continue;}
   const native=sourceNative.has(id),type=native?nativeType(s,sourceNative.get(id)):s.cost+':'+s.max,k=(native?'n:':'f:')+type;
   if(!groups.has(k))groups.set(k,{native,type,population:native?members.get(type):population.get(type),needs:[]});groups.get(k).needs.push([Math.max(0,min),max,complete&&targetNative.has(id)]);
  }
  const result={groups:[...groups.values()].map(g=>({...g,scalar:graftMatcher(g.population||0,g.needs,false),hits:graftMatcher(g.population||0,g.needs,true)})),totalMin,impossible,complete,nativeCount:targetNative.size};compiled.set(key,result);return result;
 }
 function mapped(raw,native){const maps=native?nativeMaps:foreignMaps;if(maps.has(raw))return maps.get(raw);const vectorMemo=native?nativeVectors:foreignVectors,vectors=new Map();let kinds=0;for(const[type,original]of raw){let vector=vectorMemo.get(original);if(!vector){const values=native?original.map(v=>Math.max(0,v)).filter(Boolean):original;vector={values,key:values.join(',')};vectorMemo.set(original,vector);}vectors.set(type,vector);kinds+=vector.values.length;}const result={vectors,kinds};maps.set(raw,result);return result;}
 function match(row,c){if(c.impossible||c.totalMin>row.positive)return 0;const native=mapped(row.ns,true),foreign=mapped(row.ff,false),positiveKinds=c.complete?native.kinds+foreign.kinds:0,neededNativeHits=c.complete?Math.max(0,positiveKinds-(5-c.nativeCount)):0;
  if(neededNativeHits>c.nativeCount)return 0;
  if(!neededNativeHits){let q=1;for(const g of c.groups){q*=g.scalar((g.native?native:foreign).vectors.get(g.type)||emptyVector);if(!q)break;}return q;}
  let distribution=[1];for(const g of c.groups){const part=g.hits((g.native?native:foreign).vectors.get(g.type)||emptyVector),next=[];for(let i=0;i<distribution.length;i++)for(let j=0;j<part.length;j++)next[i+j]=(next[i+j]||0)+(distribution[i]||0)*(part[j]||0);distribution=next;if(!distribution.some(p=>p>0))return 0;}
  return distribution.reduce((q,p,i)=>q+(i>=neededNativeHits?(p||0):0),0);
 }
 function plans(context,k,minimumCompensation){
  if(k>context.capacity||k&&!context.target.native.length||minimumCompensation>k)return [];
  const cacheKey=k*8+minimumCompensation,planMemo=context.plans;if(planMemo.has(cacheKey))return planMemo.get(cacheKey);const out=[],target=context.target,native=target.native,n=native.length,base=context.base,losses=Array(n).fill(0);
  function put(weight){
   const bounds=new Map(base);for(let i=0;i<n;i++){const v=native[i],old=bounds.get(v.id)||[0,Infinity],maximum=target.completeOutcome?skills.get(v.id).max-v.level+losses[i]:Infinity;bounds.set(v.id,[Math.max(old[0],v.min+losses[i],0),Math.min(old[1],maximum)]);}
   // With no extra global cancellation requirement, all eligible gains are
   // inclusive and one query per positional allocation is sufficient.
   if(!minimumCompensation){out.push({weight,compiled:compile(bounds,context)});return;}
   // Partition min(gain_i, loss_i) into disjoint intervals. Exact intervals
   // below loss_i and one inclusive tail at loss_i avoid double counting.
   function compensation(i,total,current){if(i===n){if(total>=minimumCompensation)out.push({weight,compiled:compile(current,context)});return;}const v=native[i],d=losses[i],old=current.get(v.id)||[0,Infinity];
    for(let c=0;c<=d;c++){const min=Math.max(old[0],c),max=c===d?old[1]:Math.min(old[1],c);if(min>max)continue;const next=new Map(current);next.set(v.id,[min,max]);compensation(i+1,total+c,next);}
   }compensation(0,0,bounds);
  }
  function allocate(i,left,denominator){if(i===n){if(!left)put(factorial[k]/denominator/(k?n**k:1));return;}for(let d=0;d<=Math.min(left,native[i].level);d++){losses[i]=d;allocate(i+1,left-d,denominator*factorial[d]);}}
  allocate(0,k,1);planMemo.set(cacheKey,out);return out;
 }
 // Position-only targets compile one fixed positive requirement. Losses
 // carry a scalar weight; they never create gains, restore capacity, relax
 // record limits, or provide extra headroom at the native level cap.
 for(const context of contexts)if(context.weighted){const bounds=new Map(context.base);for(const v of context.target.native){const old=bounds.get(v.id)||[0,Infinity];bounds.set(v.id,[Math.max(old[0],v.min,0),Math.min(old[1],context.target.completeOutcome?skills.get(v.id).max-v.level:Infinity)]);}context.fixed=compile(bounds,context);}
 let total=0,second=0,support=0;
 for(const row of cache.records){if(row.points<(options.minRawSlots||0))continue;let q=1;
  for(const context of contexts){const target=context.target,k=row.removed,minimumCompensation=Math.max(0,k-(target.maxNetRemoved??Infinity),row.positive-(target.maxPositiveRecords??7),Math.ceil((row.records-(target.maxRecords??7))/2));let marginal=0;
   if(context.weighted){if(k>(target.maxNetRemoved??Infinity)||row.positive>(target.maxPositiveRecords??7)||row.records>(target.maxRecords??7)){q=0;break;}const weight=target.removedWeights[k]??0;if(weight)marginal=weight*match(row,context.fixed);}
   else for(const plan of plans(context,k,minimumCompensation))marginal+=plan.weight*match(row,plan.compiled);
   // Joint observation keeps the requested optimistic marginal coupling.
   // It does not require shared physical deletion positions across armors.
   q=Math.min(q,marginal);if(!q)break;
  }
  q=Math.min(1,Math.max(0,q));total+=row.count*q;second+=row.count*q*q;if(q)support+=row.count;
 }
 const p=total/cache.n,se=Math.sqrt(Math.max(0,second/cache.n-p*p)/cache.n),effectiveHits=second?total*total/second:0;
 return {p,se,n:cache.n,support,effectiveHits,sparse:effectiveHits<100,zeroHitUpper95:p===0?1-Math.pow(.05,1/cache.n):undefined,graftModel:contexts.every(c=>c.weighted)?'position-weighted-complete-v1':options.graftTargets.some(t=>t.completeOutcome)?'inverse-net-complete-v2':'inverse-net-change-v1'};
}
function prepare(raw){if(raw.schema===2&&raw.prepared)return raw;if(raw.schema!==1||!Array.isArray(raw.hist)||!(raw.n>0))throw Error('概率文件格式无效');let total=0;const records=raw.hist.map(([key,count])=>{total+=count;const [points,slotRecords,records,ns,ff]=JSON.parse(key);let removed=0,positive=slotRecords;for(const[,vs]of ns)for(const v of vs)if(v<0)removed-=v;else positive+=v;for(const[,vs]of ff)positive+=vs.reduce((a,b)=>a+b,0);return {points,records,removed,positive,ns:new Map(ns),ff:new Map(ff),count};});if(total!==raw.n)throw Error('概率计数不完整');return {group:raw.group,n:raw.n,records};}
function query(data,armor,cache,options={}){
 if(options.graftTargets?.length)return graftQuery(data,armor,cache,options);
 const skillMap=new Map(data.skills.map(s=>[s.id,s])),native=new Map(armor.skills.map(s=>[s.skill_id,s.level])),type=(s,lv)=>[s.cost??'x',s.cost==null?'x':s.max,lv].join(':'),members=new Map(),population=new Map(),nt=new Map(),ft=new Map();
 for(const[id,lv]of native){const t=type(skillMap.get(id),lv);members.set(t,(members.get(t)||0)+1);}for(const s of data.skills)if(s.cost!=null&&!native.has(s.id)){const t=s.cost+':'+s.max;population.set(t,(population.get(t)||0)+1);}
 const req=new Map();for(const r of options.minimumChanges||[]){if(!skillMap.has(r.id)||!Number.isInteger(r.min))throw Error('概率技能条件无效');req.set(r.id,Math.max(req.get(r.id)??-Infinity,r.min));}for(const id of options.protectedSkills||[])req.set(id,Math.max(0,req.get(id)??0));
 for(const[id,min]of req){const s=skillMap.get(id);if(native.has(id)){const t=type(s,native.get(id));if(!nt.has(t))nt.set(t,[]);nt.get(t).push(min);}else if(min>0){if(s.cost==null)return {p:0,n:cache.n,ruleImpossible:true};const t=s.cost+':'+s.max;if(!ft.has(t))ft.set(t,[]);ft.get(t).push(min);}}
 const slotMemo=new Map(),assignmentMemo=new Map();const match=(vs,m,needs)=>{const k=vs.join(',')+'|'+m+'|'+needs.join(',');if(!assignmentMemo.has(k))assignmentMemo.set(k,assignment(vs,m,needs));return assignmentMemo.get(k);};let s=0,s2=0,support=0;
 for(const r of cache.records){if(r.points<(options.minRawSlots||0)||r.removed>(options.maxRemoved??Infinity)||r.records>(options.maxRecords??7)||r.positive>(options.maxPositiveRecords??7))continue;
  if(options.minSlots){if(!slotMemo.has(r.points)){const a=[...armor.slots,0,0,0].slice(0,3).sort((a,b)=>b-a);for(let i=0;i<r.points;i++){let j=a.indexOf(0);if(j<0)j=a.findIndex(v=>v<4);if(j<0)break;a[j]++;}slotMemo.set(r.points,a);}const slots=slotMemo.get(r.points);if(options.minSlots.some((v,i)=>(slots[i]||0)<v))continue;}
  let q=options.removedWeights?(options.removedWeights[r.removed]??0):1;for(const[t,needs]of nt){q*=match(r.ns.get(t)||[],members.get(t)||0,needs);if(!q)break;}if(q)for(const[t,needs]of ft){q*=match(r.ff.get(t)||[],population.get(t)||0,needs);if(!q)break;}s+=r.count*q;s2+=r.count*q*q;if(q)support+=r.count;
 }
 const p=s/cache.n,se=Math.sqrt(Math.max(0,s2/cache.n-p*p)/cache.n),effectiveHits=s2?s*s/s2:0;return {p,se,n:cache.n,support,effectiveHits,sparse:effectiveHits<100,zeroHitUpper95:p===0?1-Math.pow(.05,1/cache.n):undefined};
}
// A shared component dictionary replaces repeated native/foreign partitions.
function prepareCodebook(raw){
 if(raw.schema!==2||!Array.isArray(raw.native)||!Array.isArray(raw.foreign)||!/^[a-f0-9]{64}$/.test(raw.id))throw Error('概率字典格式无效');
 const native=new Map(),foreign=new Map();
 function component(id,isNative){const source=isNative?raw.native:raw.foreign,cache=isNative?native:foreign;if(!Number.isInteger(id)||id<0||id>=source.length)throw Error('概率字典编号无效');if(cache.has(id))return cache.get(id);const entries=JSON.parse(source[id]);let removed=0,positive=0;for(const[,values]of entries)for(const value of values){if(value<0)removed-=value;else positive+=value;}const result={map:new Map(entries),removed,positive};cache.set(id,result);if(cache.size>4096)cache.delete(cache.keys().next().value);return result;}
 return {id:raw.id,component};
}
function unpack(view,book,group){
 if(!book||view.length<20)throw Error('概率数据缺少字典或已损坏');const hex=a=>Array.from(a,v=>v.toString(16).padStart(2,'0')).join('');
 if(hex(view.subarray(4,12))!==book.id.slice(0,16))throw Error('概率字典与数据不匹配');const actualGroup=hex(view.subarray(12,20));if(group&&group!==actualGroup)throw Error('概率文件与索引不匹配');let at=20;
 function integer(){let n=0,factor=1;for(let i=0;i<8;i++){if(at>=view.length)throw Error('概率文件被截断');const v=view[at++];n+=(v&127)*factor;if(!Number.isSafeInteger(n))throw Error('概率整数溢出');if(v<128)return n;factor*=128;}throw Error('概率整数无效');}
 const n=integer(),length=integer();if(!n||length>n)throw Error('概率计数无效');const records=[];let ni=0,fi=0,header=0,total=0;
 for(let i=0;i<length;i++){const dn=integer();ni+=dn;if(dn)fi=header=0;const df=integer();fi+=df;if(df)header=0;header+=integer();const count=integer();if(!count)throw Error('概率计数无效');const a=book.component(ni,true),b=book.component(fi,false),slotRecords=(header>>3)&7;records.push({points:Math.floor(header/64),slotRecords,records:header&7,removed:a.removed,positive:slotRecords+a.positive+b.positive,ns:a.map,ff:b.map,count});total+=count;}
 if(total!==n||at!==view.length)throw Error('概率计数不完整');return {schema:2,prepared:true,group:actualGroup,n,records};
}
async function decode(bytes,book,group){let view=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);if(view[0]===31&&view[1]===139){if(typeof DecompressionStream!=='function')throw Error('当前浏览器不支持概率数据解压，请使用新版浏览器');view=new Uint8Array(await new Response(new Blob([view]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());}if(view[0]===83&&view[1]===66&&view[2]===80&&view[3]===50)return unpack(view,book,group);return JSON.parse(new TextDecoder().decode(view));}
function significant(value){return value?Number(value.toPrecision(3)):0;}
// Exchangeability is exact within a recorded input class, not an approximation
// by pool or cost alone. Include native type, requested levels and final-slot
// capacity; retain every constraint used by query().
function graftQueryKey(data,armor,options){
 const skills=new Map(data.skills.map(s=>[s.id,s])),source=new Map(armor.skills.map(s=>[s.skill_id,s.level])),profile=new Map(),ids=new Set();
 for(const r of options.minimumChanges||[]){if(!skills.has(r.id)||!Number.isInteger(r.min))throw Error('概率技能条件无效');profile.set(r.id,Math.max(0,r.min));ids.add(r.id);}
 const targets=options.graftTargets.map(target=>{const native=new Map(),required=new Map();for(const n of target.native){native.set(n.id,n);ids.add(n.id);}for(const r of target.minimumChanges||[]){required.set(r.id,Math.max(required.get(r.id)||0,r.min,0));ids.add(r.id);}return {target,native,required};});
 // Keep malformed/unsupported shapes separate rather than extending the
 // exchangeability proof beyond the validated guide contract.
 if(targets.some(({target,native})=>native.size!==target.native.length||target.native.some(n=>!Number.isInteger(n.level)||n.level<0||!Number.isInteger(n.min))||target.completeOutcome!=null&&typeof target.completeOutcome!=='boolean'))return JSON.stringify(['inverse-raw-v2',options.minRawSlots||0,options.minimumChanges||[],options.graftTargets]);
 const limits=targets.map(({target})=>[target.native.length,target.maxNetRemoved??'inf',target.maxPositiveRecords??7,target.maxRecords??7,target.completeOutcome===true,...(Array.isArray(target.removedWeights)?['position',target.removedWeights]:['inverse'])]),nodes=[];
 for(const id of ids){const s=skills.get(id);if(!s)throw Error('概率技能条件无效');const columns=targets.map(({native,required})=>{const n=native.get(id);return n?[1,n.level,n.min,required.get(id)||0]:[0,0,0,required.get(id)||0];}),minimum=profile.get(id)||0;
  if(!minimum&&columns.every(c=>!c[0]&&!c[3]))continue;
  // A name may be exchanged only within its SOURCE native/foreign class.
  // The full incidence column retains every overlap between required labels
  // and each destination's native skills, including joint intersections.
  const bucket=source.has(id)?['n',s.cost??'x',s.max,source.get(id)]:['f',s.cost??'x',s.max],value=[bucket,minimum,columns];nodes.push({value,key:JSON.stringify(value)});
 }
 nodes.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);return JSON.stringify(['graft-canonical-v2',options.minRawSlots||0,limits,nodes.map(n=>n.value)]);
}
function queryKey(data,armor,options={}){
 if(options.graftTargets?.length)return graftQueryKey(data,armor,options);
 const skills=new Map(data.skills.map(s=>[s.id,s])),native=new Map(armor.skills.map(s=>[s.skill_id,s.level])),req=new Map(),needs=new Map();
 for(const r of options.minimumChanges||[]){if(!skills.has(r.id)||!Number.isInteger(r.min))throw Error('概率技能条件无效');req.set(r.id,Math.max(req.get(r.id)??-Infinity,r.min));}for(const id of options.protectedSkills||[])req.set(id,Math.max(0,req.get(id)??0));
 for(const[id,min]of req){const s=skills.get(id);if(!s)throw Error('概率技能条件无效');if(!native.has(id)&&min<=0)continue;const key=native.has(id)?'n:'+[(s.cost??'x'),s.cost==null?'x':s.max,native.get(id)].join(':'):'f:'+[(s.cost??'x'),s.max].join(':');if(!needs.has(key))needs.set(key,[]);needs.get(key).push(min);}
 const a=[...armor.slots,0,0,0].slice(0,3).sort((a,b)=>b-a);let growth=0;
 if(options.minSlots)while(options.minSlots.some((v,i)=>(a[i]||0)<v)){let j=a.indexOf(0);if(j<0)j=a.findIndex(v=>v<4);if(j<0){growth=Infinity;break;}a[j]++;growth++;}
 return JSON.stringify([[...needs].map(([k,v])=>[k,v.sort((a,b)=>a-b)]).sort((a,b)=>a[0].localeCompare(b[0])),Number.isFinite(growth)?Math.max(growth,options.minRawSlots||0):'impossible',options.maxRemoved??null,options.maxRecords??7,options.maxPositiveRecords??7,...(options.removedWeights?[options.removedWeights]:[]),...(options.graftTargets?.length?['inverse-net-change-v1',[...(options.minimumChanges||[])].sort((a,b)=>a.id-b.id),options.graftTargets]:[])]);
}
function createBank(data,index,loader,maxCached=12){const saved=new Map(),pending=new Map(),memo=new Map(),inFlight=new Map();let queries=0,hits=0;
 async function get(group){if(saved.has(group)){const v=saved.get(group);saved.delete(group);saved.set(group,v);return v;}if(pending.has(group))return pending.get(group);const job=(async()=>{const raw=await loader(group);if(raw.group!==group||raw.n!==index.groups[group]?.n)throw Error('概率文件与索引不匹配，请刷新页面');const v=prepare(raw);saved.set(group,v);while(saved.size>maxCached)saved.delete(saved.keys().next().value);return v;})();pending.set(group,job);try{return await job;}finally{pending.delete(group);}}
 async function lookup(armor,mode,options,full){const group=index.armors[armor.id]?.[mode];if(!group)return {p:0,n:0,unsupported:true};const key=group+'|'+queryKey(data,armor,options),field=full?'exact':'rounded';if(memo.has(key)){hits++;return memo.get(key)[field];}if(inFlight.has(key)){hits++;return (await inFlight.get(key))[field];}const job=(async()=>{const exact=query(data,armor,await get(group),options),r={exact,rounded:{...exact,p:significant(exact.p),se:significant(exact.se)}};queries++;memo.set(key,r);if(memo.size>4000)memo.delete(memo.keys().next().value);return r;})();inFlight.set(key,job);try{return (await job)[field];}finally{inFlight.delete(key);}}
 // Bounds are differenced before rounding. The existing query() contract and
 // all probabilities used by the equipment search stay at three digits.
 return {query:(armor,mode,options)=>lookup(armor,mode,options,false),queryExact:(armor,mode,options)=>lookup(armor,mode,options,true),stats:()=>({groups:saved.size,queries,hits,samples:index.rolls})};
}
const api={assignment,prepare,query,queryKey,decode,createBank,prepareCodebook,unpack,significant};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ForgeProbability=api;
})(globalThis);
