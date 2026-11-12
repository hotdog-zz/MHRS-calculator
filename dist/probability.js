/* Anonymous armor probabilities, shared by browser workers and Node validation. */
(function(root){'use strict';
function assignment(partition,population,minima){if(minima.length>population||partition.length>population)return 0;const counts=new Map();for(const v of partition)counts.set(v,(counts.get(v)||0)+1);counts.set(0,(counts.get(0)||0)+population-partition.length);const needs=[...minima].sort((a,b)=>b-a);
 function visit(i,left){if(i===needs.length)return 1;let p=0;for(const [v,n]of counts)if(n&&v>=needs[i]){counts.set(v,n-1);p+=n/left*visit(i+1,left-1);counts.set(v,n);}return p;}return visit(0,population);}
function prepare(raw){if(raw.schema===2&&raw.prepared)return raw;if(raw.schema!==1||!Array.isArray(raw.hist)||!(raw.n>0))throw Error('概率文件格式无效');let total=0;const records=raw.hist.map(([key,count])=>{total+=count;const [points,slotRecords,records,ns,ff]=JSON.parse(key);let removed=0,positive=slotRecords;for(const[,vs]of ns)for(const v of vs)if(v<0)removed-=v;else positive+=v;for(const[,vs]of ff)positive+=vs.reduce((a,b)=>a+b,0);return {points,records,removed,positive,ns:new Map(ns),ff:new Map(ff),count};});if(total!==raw.n)throw Error('概率计数不完整');return {group:raw.group,n:raw.n,records};}
function query(data,armor,cache,options={}){
 const skillMap=new Map(data.skills.map(s=>[s.id,s])),native=new Map(armor.skills.map(s=>[s.skill_id,s.level])),type=(s,lv)=>[s.cost??'x',s.cost==null?'x':s.max,lv].join(':'),members=new Map(),population=new Map(),nt=new Map(),ft=new Map();
 for(const[id,lv]of native){const t=type(skillMap.get(id),lv);members.set(t,(members.get(t)||0)+1);}for(const s of data.skills)if(s.cost!=null&&!native.has(s.id)){const t=s.cost+':'+s.max;population.set(t,(population.get(t)||0)+1);}
 const req=new Map();for(const r of options.minimumChanges||[]){if(!skillMap.has(r.id)||!Number.isInteger(r.min))throw Error('概率技能条件无效');req.set(r.id,Math.max(req.get(r.id)??-Infinity,r.min));}for(const id of options.protectedSkills||[])req.set(id,Math.max(0,req.get(id)??0));
 for(const[id,min]of req){const s=skillMap.get(id);if(native.has(id)){const t=type(s,native.get(id));if(!nt.has(t))nt.set(t,[]);nt.get(t).push(min);}else if(min>0){if(s.cost==null)return {p:0,n:cache.n,ruleImpossible:true};const t=s.cost+':'+s.max;if(!ft.has(t))ft.set(t,[]);ft.get(t).push(min);}}
 const slotMemo=new Map(),assignmentMemo=new Map();const match=(vs,m,needs)=>{const k=vs.join(',')+'|'+m+'|'+needs.join(',');if(!assignmentMemo.has(k))assignmentMemo.set(k,assignment(vs,m,needs));return assignmentMemo.get(k);};let s=0,s2=0,support=0;
 for(const r of cache.records){if(r.points<(options.minRawSlots||0)||r.removed>(options.maxRemoved??Infinity)||r.records>(options.maxRecords??7)||r.positive>(options.maxPositiveRecords??7))continue;
  if(options.minSlots){if(!slotMemo.has(r.points)){const a=[...armor.slots,0,0,0].slice(0,3).sort((a,b)=>b-a);for(let i=0;i<r.points;i++){let j=a.indexOf(0);if(j<0)j=a.findIndex(v=>v<4);if(j<0)break;a[j]++;}slotMemo.set(r.points,a);}const slots=slotMemo.get(r.points);if(options.minSlots.some((v,i)=>(slots[i]||0)<v))continue;}
  let q=1;for(const[t,needs]of nt){q*=match(r.ns.get(t)||[],members.get(t)||0,needs);if(!q)break;}if(q)for(const[t,needs]of ft){q*=match(r.ff.get(t)||[],population.get(t)||0,needs);if(!q)break;}s+=r.count*q;s2+=r.count*q*q;if(q)support+=r.count;
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
function queryKey(data,armor,options={}){
 const skills=new Map(data.skills.map(s=>[s.id,s])),native=new Map(armor.skills.map(s=>[s.skill_id,s.level])),req=new Map(),needs=new Map();
 for(const r of options.minimumChanges||[]){if(!skills.has(r.id)||!Number.isInteger(r.min))throw Error('概率技能条件无效');req.set(r.id,Math.max(req.get(r.id)??-Infinity,r.min));}for(const id of options.protectedSkills||[])req.set(id,Math.max(0,req.get(id)??0));
 for(const[id,min]of req){const s=skills.get(id);if(!s)throw Error('概率技能条件无效');if(!native.has(id)&&min<=0)continue;const key=native.has(id)?'n:'+[(s.cost??'x'),s.cost==null?'x':s.max,native.get(id)].join(':'):'f:'+[(s.cost??'x'),s.max].join(':');if(!needs.has(key))needs.set(key,[]);needs.get(key).push(min);}
 const a=[...armor.slots,0,0,0].slice(0,3).sort((a,b)=>b-a);let growth=0;
 if(options.minSlots)while(options.minSlots.some((v,i)=>(a[i]||0)<v)){let j=a.indexOf(0);if(j<0)j=a.findIndex(v=>v<4);if(j<0){growth=Infinity;break;}a[j]++;growth++;}
 return JSON.stringify([[...needs].map(([k,v])=>[k,v.sort((a,b)=>a-b)]).sort((a,b)=>a[0].localeCompare(b[0])),Number.isFinite(growth)?Math.max(growth,options.minRawSlots||0):'impossible',options.maxRemoved??null,options.maxRecords??7,options.maxPositiveRecords??7]);
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
