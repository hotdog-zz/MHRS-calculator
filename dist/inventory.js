/* Existing equipment instances. Never creates equipment or changes its augments. */
(function(root){
'use strict';
const E=root.ForgeEngine||(typeof require==='function'?require('./engine.js'):null),C=root.ForgeConfig||(typeof require==='function'?require('./config.js'):null),M=root.ForgeMod||(typeof require==='function'?require('./mod.js'):null);
const FORMAT='Sunbreak Forge Inventory',PLAN='Sunbreak Forge Owned Plan',MAX_BYTES=32*1024*1024;
const SCALARS={Type:131072,InventoryIndex:-1,IdType:0,IdVal:0,BowgunCustomizeType:0,PairInsectInventoryIndex:-1,BuildupPoint:0,HyakuryuDecoId:0,HyakuryuModelId:1048576,CustomBuildupType:0,CustomCount:0};
const ARRAYS={HyakuryuSkillIdList:6,PrevHyakuryuSkillId:6,TalismanDecoSlotNumList:5,TalismanSkillIdList:2,TalismanSkillLvList:2};
const clone=x=>JSON.parse(JSON.stringify(x));
function check(value,message){if(!value)throw new Error(message);}
function array(value,label){if(Array.isArray(value))return value;if(value&&typeof value==='object'&&!Object.keys(value).length)return [];throw new Error(label+'需要数组');}
function integer(value,label,min=0,max=0x7fffffff){check(Number.isSafeInteger(value)&&value>=min&&value<=max,label+'无效');return value;}
function cleanItem(raw){
 check(raw&&typeof raw==='object'&&!Array.isArray(raw),'库存装备记录无效');const normalized={...raw};
 for(const key of [...Object.keys(ARRAYS),'DecoIdList','CustomOpenIdArray','CustomBuildup'])if(raw[key]!=null){normalized[key]=array(raw[key],key);const size=ARRAYS[key]||(key==='DecoIdList'?3:0);if(size&&normalized[key].length===0)normalized[key]=Array(size).fill(0);}
 const item=M.cleanItem(normalized);check(item.IdVal>0,'库存记录不能是空装备');return item;
}
function fingerprint(raw){
 const item=cleanItem(raw),out=['SBFI1'];
 for(const key of Object.keys(SCALARS))out.push(key+'='+item[key]);
 for(const key of ['IsLock','CustomEnable'])out.push(key+'='+(item[key]?1:0));
 for(const [key,length] of Object.entries(ARRAYS))out.push(key+'='+Array.from({length},(_,i)=>item[key][i]||0).join(','));
 out.push('CustomOpenIdArray='+item.CustomOpenIdArray.length+':'+item.CustomOpenIdArray.join(','));
 out.push('CustomBuildup='+Array.from({length:7},(_,i)=>{const a=item.CustomBuildup[i]||{};return [a.Id||0,a.SkillId||0,a.ValueIndex||0].join(',');}).join(';'));
 return out.join('|');
}
function reference(entry){return {box:entry.box,index:entry.index,inventoryIndex:entry.item.InventoryIndex,idType:entry.item.IdType,idVal:entry.item.IdVal,fingerprint:entry.fingerprint};}
function entryKey(box,index){return box+':'+index;}
function decodeArmor(data,base,item){
 const levels=Object.fromEntries(base.skills.map(s=>[s.skill_id,s.level])),atoms=[],res={...base.resistances};let points=0,defense=base.defense,cost=0,skillAdds=0,skillAddCost=0,slotAdds=0;
 if(item.CustomEnable)for(const t of item.CustomBuildup){
  if(!t.Id)continue;const raw=data.atoms.find(a=>a.pool===base.pool&&a.id===t.Id),v=raw?.values.find(v=>v.value_index===t.ValueIndex);check(raw&&v,'无法识别既有炼化词条 '+t.Id+'／'+t.ValueIndex);
  const atom={atomId:t.Id,value:v.value,valueIndex:t.ValueIndex,count:1};cost+=raw.cost;
  if(raw.category===20){const id=M.skillFromGame(t.SkillId);check(data.skills.some(s=>s.id===id),'既有炼化技能未知');atom.skillId=id;levels[id]=(levels[id]||0)+v.value;if(v.value>0){skillAdds+=v.value;skillAddCost+=Math.max(0,raw.cost);}}
  else if(raw.category===19){check(v.value>=0&&v.value<=12-base.slots.reduce((a,b)=>a+b,0),'单条既有孔位增长超过原始容量');points+=v.value;slotAdds++;}
  else if(raw.category===13){atom.attribute='defense';defense+=v.value;}
  else if(raw.category===14||raw.category===15){atom.attribute=['fire','water','thunder','ice','dragon'][Math.floor((raw.id-89)/10)];check(atom.attribute,'耐性词条未知');res[atom.attribute]+=v.value;}
  else throw new Error('暂不能计算既有词条类型 '+raw.category);
  atoms.push(atom);
 }
 check(Number.isInteger(points)&&points>=0,'既有孔位强化无效');
 for(const [id,n] of Object.entries(levels))check(n>=0&&n<=(data.skills.find(s=>s.id===+id)?.max??-1),'既有技能等级无效');
 check(defense>=0,'既有防御无效');
 return {...base,atoms,levels,slots:E.upgradeSlots(base.slots,points),cost,records:atoms.length,finalDefense:defense,finalResistances:res,skillAdds,skillAddCost,slotAdds,additions:skillAdds+slotAdds,fallback:null,owned:true};
}
function decodeCharm(data,item,key){
 const skills=item.TalismanSkillIdList.flatMap((id,i)=>id&&item.TalismanSkillLvList[i]?[{skill_id:M.skillFromGame(id),level:item.TalismanSkillLvList[i]}]:[]);
 const slots=item.TalismanDecoSlotNumList.flatMap((n,i)=>i?Array(integer(n,'护石孔位数量',0,3)).fill(i):[]).sort((a,b)=>b-a);check(slots.length<=3,'护石孔位超过三个');
 for(const fixed of data.fixedCharms)if(fixed.charm_id===item.IdVal){const c={...clone(fixed),name:fixed.name_zh,fixed:true,ownedKey:key};if(JSON.stringify(c.skills)===JSON.stringify(skills)&&JSON.stringify(c.slots)===JSON.stringify(slots))return c;}
 for(const method of Object.keys(data.melding.methods)){const c={id:key,name:'已有护石',method,skills,slots,ownedKey:key};try{E.validateCharm(data,c);return c;}catch{}}
 throw new Error('护石技能或孔位不在已知支持中');
}
function parse(data,input){
 const raw=typeof input==='string'?JSON.parse(input.replace(/^\uFEFF/,'')):input;
 check(raw?.format===FORMAT&&raw.version===1,'请选择新版 Lua 导出的完整装备箱快照');check(typeof raw.exportId==='string'&&/^SBFI1-[0-9A-Za-z]+-[1-9][0-9]*$/.test(raw.exportId),'库存快照编号无效');
 const items=array(raw.items,'items'),decorations=array(raw.decorations,'decorations');check(items.length<=20000&&decorations.length<=5000,'库存数据过大');
 const entries=[],byKey=new Map(),counts=new Map(),errors=[];
 for(const row of items){
  check(['equipment','petalaces'].includes(row.box),'未知装备箱类别');integer(row.index,'箱位索引',0,19999);const key=entryKey(row.box,row.index);check(!byKey.has(key),'库存箱位索引重复');
  const item=cleanItem(row.item),fp=fingerprint(item);check(row.fingerprint===fp,'库存指纹不匹配：'+key);
  const entry={key,box:row.box,index:row.index,item,fingerprint:fp,referencedBy:array(row.referencedBy??[],'引用列表').map(v=>integer(v,'组合编号',1,224)),kind:'other',name:'未知装备 #'+item.IdVal,usable:false};
  try{
   if(item.IdType===1){const base=data.weapons.find(w=>M.equipmentToGame(w.id)===item.IdVal);if(base){entry.kind='weapon';entry.base=base;entry.name=base.name;entry.skills=[];entry.usable=true;}else if(item.IdVal>=149946368&&item.IdVal<150012000){entry.kind='insect';entry.name='猎虫 #'+item.IdVal;}}
   else if(item.IdType===2){entry.kind='armor';const base=data.armors.find(a=>M.equipmentToGame(a.id)===item.IdVal);check(base,'防具不在当前资料中');entry.base=base;entry.name=base.name;entry.armor=decodeArmor(data,base,item);entry.skills=Object.entries(entry.armor.levels).filter(([,n])=>n>0).map(([id,level])=>({skill_id:+id,level}));entry.usable=true;}
   else if(item.IdType===3){entry.kind='charm';entry.charm=decodeCharm(data,item,key);entry.skills=entry.charm.skills;entry.name=entry.charm.skills.map(s=>data.skills.find(v=>v.id===s.skill_id).name+' '+s.level).join('／')||'护石';entry.usable=true;}
   else if(item.IdType===4){entry.kind='petalace';entry.name='花链 #'+item.IdVal;}
  }catch(e){entry.error=e.message;errors.push({key,message:e.message});}
  entries.push(entry);byKey.set(key,entry);
 }
 for(const row of decorations){const id=integer(row.id,'珠子ID',1),count=integer(row.count,'珠子数量',0,1000000);counts.set(id,(counts.get(id)||0)+count);}
 const sets=array(raw.sets??[],'sets').map(s=>({slot:integer(s.slot,'组合栏位',1,224),used:s.used===true}));check(sets.length<=224,'组合数量过多');
 const canonical={format:FORMAT,version:1,exportId:raw.exportId,exportedAt:integer(raw.exportedAt,'导出时间'),decorationQuantityPolicy:'reported-conservative',items:entries.map(e=>({box:e.box,index:e.index,item:e.item,fingerprint:e.fingerprint,referencedBy:e.referencedBy})),decorations:[...counts].map(([id,count])=>({id,count})),sets};
 return {id:raw.exportId,raw:canonical,entries,byKey,counts,errors,exportedAt:raw.exportedAt};
}
function resolve(stock,ref){
 check(ref&&typeof ref==='object'&&!ref.empty,'缺少库存引用');const entry=stock.byKey.get(entryKey(ref.box,ref.index));check(entry,'库存条目已不存在');
 const actual=reference(entry);check(Object.keys(actual).every(k=>actual[k]===ref[k]),'库存条目或炼化已变化，请重新导出装备箱');return entry;
}
function validateSelection(data,stock,request){
 check(stock,'请先导入装备箱快照');check(request.ownedInventoryId===stock.id,'方案对应另一份库存快照，请重新导入对应快照');
 const weapon=stock.byKey.get(request.ownedWeaponKey);check(weapon?.kind==='weapon'&&weapon.usable&&weapon.base.id===request.weaponId,'请选择库存中的具体武器');
 for(const part of E.PARTS)if(request.ownedArmorKeys?.[part]){const e=stock.byKey.get(request.ownedArmorKeys[part]);check(e?.kind==='armor'&&e.usable&&e.base.part===part,'指定库存防具不存在或部位不符：'+E.PART_NAMES[part]);}
 if(request.ownedCharmKey){const e=stock.byKey.get(request.ownedCharmKey);check(e?.kind==='charm'&&e.usable,'指定库存护石不存在');}
 if(request.rampageDecorationId!==undefined)check(C.validateRampageId(data,request.rampageDecorationId)===C.validateRampageId(data,weapon.item.HyakuryuDecoId),'已有模式保留武器当前百龙珠，请在游戏内更换后重新导出库存');
 return weapon;
}
function validateQuery(data,stock,request){
 const weapon=validateSelection(data,stock,request);
 check(!(request.options?.noCharm&&(request.options?.fixedCharm||request.ownedCharmKey)),'指定护石与不使用护石冲突');
 check(data.weapons.some(w=>w.id===request.weaponId),'武器无效');check(request.skills?.length,'请至少选择一个目标技能');const ids=new Set();for(const r of request.skills){const s=data.skills.find(s=>s.id===r.id);check(s&&!ids.has(r.id)&&Number.isInteger(r.level)&&r.level>=1&&r.level<=s.max,'目标技能无效');ids.add(r.id);}
 return weapon;
}
function prepare(data,stock,request){
 const weapon=validateQuery(data,stock,request),o=request.options||{};let entries=stock.entries.filter(e=>e.kind==='armor'&&e.usable);
 entries=entries.filter(e=>{const fixed=o.fixedArmors?.[e.base.part],key=request.ownedArmorKeys?.[e.base.part];return (!fixed||fixed.id===e.base.id)&&(!fixed?.atoms||E.atomSignature(fixed.atoms)===E.atomSignature(e.armor.atoms))&&(!key||key===e.key);});
 for(const part of E.PARTS)check(entries.some(e=>e.base.part===part),'库存没有符合条件的'+E.PART_NAMES[part]+'；请检查固定条件和可用条目');
 let charms=stock.entries.filter(e=>e.kind==='charm'&&e.usable&&(!request.ownedCharmKey||request.ownedCharmKey===e.key)).map(e=>e.charm);
 if(o.fixedCharm)charms=charms.filter(c=>JSON.stringify(c.skills)===JSON.stringify(o.fixedCharm.skills)&&JSON.stringify(c.slots)===JSON.stringify(o.fixedCharm.slots));
 if(!o.noCharm)check(charms.length,'库存没有符合条件的护石');
 const armors=entries.map(e=>({...e.base,id:e.key,skills:e.skills,slots:e.armor.slots,defense:e.armor.finalDefense,resistances:e.armor.finalResistances,pool:0,budget:0,ownedMetrics:e.armor}));
 const uniqueParts=Object.fromEntries(E.PARTS.flatMap(part=>{const rows=armors.filter(a=>a.part===part);return rows.length===1?[[part,{id:rows[0].id}]]:[];}));
 const projected={...data,armors,decorations:data.decorations.map(d=>({...d,ownedCount:stock.counts.get(M.decoToGame(d.id))||0}))};
 const query={...request,options:{...o,ownedOnly:false,augment:false,deleteSkills:false,defenseFallback:false,fixedArmors:uniqueParts,augmentLimits:{}}};delete query.options.fixedCharm;
 return {data:projected,request:query,charms,weapon};
}
function validateResult(data,stock,request,result){
 const weapon=validateQuery(data,stock,request);check(result.owned?.version===1&&result.owned?.inventoryId===stock.id,'结果缺少对应库存索引');check(resolve(stock,result.owned.weapon).key===weapon.key,'已有武器引用被替换');check(result.weaponId===weapon.base.id,'结果武器不匹配');
 const pieces=[],armors=[],totals={},add=(id,n)=>totals[id]=(totals[id]||0)+n;
 for(const part of E.PARTS){const entry=resolve(stock,result.owned.armors?.[part]);check(entry.kind==='armor'&&entry.base.part===part&&entry.usable,'库存防具部位不符');const fixed=request.options?.fixedArmors?.[part];check(!fixed||fixed.id===entry.base.id,'固定防具被替换');check(!fixed?.atoms||E.atomSignature(fixed.atoms)===E.atomSignature(entry.armor.atoms),'固定炼化被替换');check(!request.ownedArmorKeys?.[part]||request.ownedArmorKeys[part]===entry.key,'指定库存防具被替换');
  const p={...clone(entry.armor),ownedRef:reference(entry)};check(!(request.options?.sex==='MaleOnly'&&p.sex==='FemaleOnly')&&!(request.options?.sex==='FemaleOnly'&&p.sex==='MaleOnly'),'库存防具性别不符');check(request.options?.rank!=='Master'||p.rank==='Master','库存防具位阶不符');pieces.push(p);armors.push({id:p.id,atoms:p.atoms});for(const [id,n] of Object.entries(p.levels))add(+id,n);
 }
 let charm;
 if(result.owned.charm?.empty){check(request.options?.noCharm,'未允许空护石');charm={id:'none',name:'不使用护石',empty:true,skills:[],slots:[]};}
 else{check(!request.options?.noCharm,'不使用护石条件被替换');const e=resolve(stock,result.owned.charm);check(e.kind==='charm'&&e.usable,'库存护石无效');check(!request.ownedCharmKey||request.ownedCharmKey===e.key,'指定库存护石被替换');charm=clone(e.charm);if(request.options?.fixedCharm)check(JSON.stringify(charm.skills)===JSON.stringify(request.options.fixedCharm.skills)&&JSON.stringify(charm.slots)===JSON.stringify(request.options.fixedCharm.slots),'固定护石被替换');}
 for(const s of charm.skills)add(s.skill_id,s.level);
 const used=new Map(),decorations=[];
 for(const row of result.decorations||[]){const d=data.decorations.find(d=>d.id===row.id);check(d,'未知珠子');integer(row.count,'珠子数量',1,21);check(!used.has(d.id),'珠子条目重复');used.set(d.id,row.count);check(row.count<=(stock.counts.get(M.decoToGame(d.id))||0),'珠子数量超过库存：'+d.name);decorations.push({id:d.id,count:row.count});for(const s of d.skills)add(s.skill_id,s.level*row.count);}
 for(const s of request.skills)check((totals[s.id]||0)>=s.level,'库存方案未满足目标技能');
 const placement=E.packDecorations([{id:weapon.base.id,slots:weapon.base.slots},...pieces.map(p=>({id:p.id,slots:p.slots})),{id:'charm',slots:charm.slots}],decorations.map(v=>({d:data.decorations.find(d=>d.id===v.id),count:v.count})));
 const owned={version:1,inventoryId:stock.id,weapon:reference(weapon),armors:Object.fromEntries(pieces.map(p=>[p.part,p.ownedRef])),charm:charm.empty?{empty:true}:reference(stock.byKey.get(charm.ownedKey))};
 return {...result,owned,weaponId:weapon.base.id,armors,pieces,charm,decorations,totals,placement,defense:weapon.base.defense+pieces.reduce((n,p)=>n+p.finalDefense,0),records:pieces.reduce((n,p)=>n+p.records,0),skillAdds:pieces.reduce((n,p)=>n+p.skillAdds,0),skillAddCost:pieces.reduce((n,p)=>n+p.skillAddCost,0),slotAdds:pieces.reduce((n,p)=>n+p.slotAdds,0),additions:pieces.reduce((n,p)=>n+p.additions,0),decoCount:decorations.reduce((n,d)=>n+d.count,0),unusedSlots:placement.filter(p=>!p.decorationId).map(p=>p.level),verified:true,stormsoulConservative:(totals[110]||0)>=4};
}
async function search(data,request,highs,progress=()=>{},execution={},raw){
 const stock=raw?.byKey?raw:parse(data,raw),p=prepare(data,stock,request);
 const convert=r=>{const owned={version:1,inventoryId:stock.id,weapon:reference(p.weapon),armors:Object.fromEntries(r.pieces.map(a=>{const e=stock.byKey.get(a.id);return [e.base.part,reference(e)];})),charm:r.charm.empty?{empty:true}:reference(stock.byKey.get(r.charm.ownedKey))};return validateResult(data,stock,request,{weaponId:request.weaponId,owned,decorations:r.decorations});};
 const result=await E.search(p.data,p.request,highs,m=>progress(m.phase==='result'?{...m,result:convert(m.result)}:m),{...execution,charms:p.charms});return {...result,results:result.results.map(convert),owned:true};
}
function exportPlan(data,stock,template,result,request,{index=1,now=Date.now(),name}={}){
 const r=validateResult(data,stock,request,result);check(template,'请先导入同武器类型的普通Mod模板，以保留替换技');const mod=M.parse(data,template),weapon=resolve(stock,r.owned.weapon),source=data.weapons.find(w=>M.equipmentToGame(w.id)===mod.inventoryList[0].IdVal);check(source.type===weapon.base.type,'请导入同武器类型的Mod模板');
 const coral=stock.entries.find(e=>e.kind==='petalace'&&e.item.IdVal===mod.inventoryList[6].IdVal);check(coral,'库存缺少模板花链，请先在游戏中取得并重新导出库存');
 const references=[r.owned.weapon,...E.PARTS.map(p=>r.owned.armors[p]),reference(coral),r.owned.charm];
 let insect=null;if(weapon.base.type==='insect_glaive'){const matches=stock.entries.filter(e=>e.kind==='insect'&&e.item.InventoryIndex===weapon.item.PairInsectInventoryIndex),e=matches.length===1?matches[0]:null;check(e,'请先在游戏中为该操虫棍配好已有猎虫，再重新导出库存');insect=reference(e);}
 const owners=[r.weaponId,...r.pieces.map(p=>p.id),null,'charm'],slotDecorations=owners.map(owner=>{const list=[0,0,0];if(owner)for(const p of r.placement.filter(p=>p.owner===owner))if(p.decorationId)list[p.index]=M.decoToGame(p.decorationId);return list;});
 const displayName=String(name??'已有装备配装').trim();check(displayName&&displayName.length<=70,'名称需要1至70个字符');
 const weaponType=mod.uiInfo.weaponType,payload={application:PLAN,version:1,forgeVersion:'0.5.1',inventoryId:stock.id,references,insect,slotDecorations,mySetInfo:{...clone(mod.mySetInfo),Name:displayName,IsUsing:true},weaponInfo:{idVal:weapon.item.IdVal,name:weapon.base.name,type:weaponType},displayName};
 return {payload,filename:'owned_'+integer(index,'配装栏位',1,224)+'_'+M.base62(Math.floor(now/1000))+'.json',directory:'reframework/data/EquipmentLoadouts/OwnedPlans/'+weaponType+'/'};
}
// Portable presets describe equipment values without requiring any inventory identity.
function validatePreset(data,request,result){
 check(!request.options?.ownedOnly,'预设方案不能包含库存模式');check(result?.weaponId===request.weaponId,'预设武器与条件不一致');
 const weapon=data.weapons.find(w=>w.id===request.weaponId);check(weapon,'未知武器');check(Array.isArray(result.armors)&&result.armors.length===5,'预设需要五件防具');
 const pieces=[],totals={},add=(id,n)=>totals[id]=(totals[id]||0)+n;
 for(const part of E.PARTS){const candidates=result.armors.filter(p=>data.armors.find(a=>a.id===p.id)?.part===part);check(candidates.length===1,'预设防具部位不完整或重复');const row=candidates[0],base=data.armors.find(a=>a.id===row.id);
  E.validateArmorSelection(data,request,row);check(Array.isArray(row.atoms)&&row.atoms.length<=7,'预设炼化记录无效');let records=0;
  for(const a of row.atoms){integer(a.atomId,'炼化ID',1);integer(a.count,'炼化数量',1,7);check(Number.isSafeInteger(a.value),'炼化数值无效');records+=a.count;const raw=data.atoms.find(x=>x.pool===base.pool&&x.id===a.atomId);check(raw,'未知炼化词条');if(raw.category===20)check(data.skills.some(s=>s.id===a.skillId),'未知炼化技能');else check(a.skillId==null,'非技能词条不应包含技能ID');}
  check(records<=7,'预设炼化超过七条');const fixed=request.options?.fixedArmors?.[part];check(!fixed||fixed.id===row.id,'预设固定防具不匹配');check(!fixed?.atoms||E.atomSignature(fixed.atoms)===E.atomSignature(row.atoms),'预设固定炼化不匹配');
  const item=M.cleanItem({IdType:2,IdVal:M.equipmentToGame(base.id),CustomEnable:records>0,CustomBuildup:M.encodeAtoms(data,base,row.atoms)}),piece={...decodeArmor(data,base,item),owned:false,preset:true};pieces.push(piece);for(const [id,n] of Object.entries(piece.levels))add(+id,n);
 }
 let charm;if(result.charm?.empty){check(request.options?.noCharm,'预设未允许空护石');charm={id:'none',name:'不使用护石',empty:true,skills:[],slots:[]};}
 else{check(!request.options?.noCharm,'预设不应使用护石');const c=result.charm;check(c&&Array.isArray(c.skills)&&Array.isArray(c.slots),'预设护石无效');charm=c.fixed?{...clone(data.fixedCharms.find(f=>f.id===c.id)||{}),fixed:true}:{id:'shared',name:c.name||'护石',method:c.method,skills:c.skills.map(s=>({skill_id:s.skill_id,level:s.level})),slots:[...c.slots]};E.validateCharm(data,charm);if(charm.fixed)charm.name=charm.name_zh;}
 if(request.options?.fixedCharm){const fixed=request.options.fixedCharm;check(!!fixed.fixed===!!charm.fixed&&JSON.stringify(fixed.skills)===JSON.stringify(charm.skills)&&JSON.stringify(fixed.slots)===JSON.stringify(charm.slots),'预设固定护石不匹配');}
 for(const s of charm.skills)add(s.skill_id,s.level);
 check(Array.isArray(result.decorations),'预设珠子列表无效');const used=new Set(),decorations=result.decorations.map(row=>{const d=data.decorations.find(d=>d.id===row.id);check(d&&!used.has(row.id),'珠子未知或重复');used.add(row.id);integer(row.count,'珠子数量',1,21);for(const s of d.skills)add(s.skill_id,s.level*row.count);return {id:row.id,count:row.count};});
 for(const s of request.skills)check((totals[s.id]||0)>=s.level,'预设未满足目标技能');
 const placement=E.packDecorations([{id:weapon.id,slots:weapon.slots},...pieces.map(p=>({id:p.id,slots:p.slots})),{id:'charm',slots:charm.slots}],decorations.map(v=>({d:data.decorations.find(d=>d.id===v.id),count:v.count})));
 return {weaponId:weapon.id,armors:pieces.map(p=>({id:p.id,atoms:p.atoms})),pieces,charm,decorations,totals,placement,defense:(weapon.defense||0)+pieces.reduce((n,p)=>n+p.finalDefense,0),records:pieces.reduce((n,p)=>n+p.records,0),skillAdds:pieces.reduce((n,p)=>n+p.skillAdds,0),skillAddCost:pieces.reduce((n,p)=>n+p.skillAddCost,0),slotAdds:pieces.reduce((n,p)=>n+p.slotAdds,0),additions:pieces.reduce((n,p)=>n+p.additions,0),decoCount:decorations.reduce((n,d)=>n+d.count,0),unusedSlots:placement.filter(p=>!p.decorationId).map(p=>p.level),verified:true,presetEquipment:true,stormsoulConservative:(totals[110]||0)>=4};
}
function shareable(data,request,result){
 const q=C.normalize(data,{...request,options:{...request.options,ownedOnly:false,presetEquipment:true,augment:true,deleteSkills:true,defenseFallback:false,fixedArmors:{},fixedCharm:undefined,augmentLimits:{},noCharm:!!result.charm?.empty}});
 const r=validatePreset(data,q,{weaponId:result.weaponId,armors:result.armors,charm:result.charm,decorations:result.decorations});
 q.options.fixedArmors=Object.fromEntries(r.pieces.map(p=>[p.part,{id:p.id,atoms:clone(p.atoms)}]));if(!r.charm.empty)q.options.fixedCharm=clone(r.charm);
 return {request:q,result:r};
}
function augmentSummary(entry){const n=entry.item.CustomEnable?entry.item.CustomBuildup.filter(a=>a.Id).length:0;return n?'已炼化 '+n+' 条':'无有效炼化';}
function sortOptions(kind){
 const common=[['box','箱位'],['name','名称']],refs=['references','组合引用数'];
 if(kind==='weapon')return [...common,['type','武器种类'],['rarity','稀有度'],['attack','原生攻击'],['affinity','原生会心'],['slots','原生孔位总等级'],['augments','炼化条数'],refs];
 if(kind==='armor')return [...common,['part','防具部位'],['rarity','稀有度'],['defense','基础防御'],['skills','技能等级总和'],['slots','孔位总等级'],['augments','炼化条数'],refs];
 if(kind==='charm')return [...common,['skills','技能等级总和'],['slots','孔位总等级'],refs];
 if(kind==='decoration')return [['name','名称'],['quantity','拥有数量'],['slot','所需孔位等级']];
 return [...common,refs];
}
function sortEntries(rows,kind,key,direction='asc'){
 check(sortOptions(kind).some(([id])=>id===key),'当前类别不支持该排序');const sign=direction==='desc'?-1:1;
 const value=e=>{switch(key){case 'name':return e.name;case 'type':return e.base?.typeName;case 'rarity':return e.base?.rarity;case 'part':return e.base?E.PARTS.indexOf(e.base.part):undefined;case 'defense':return e.armor?.finalDefense;case 'attack':return e.base?.attack;case 'affinity':return e.base?.affinity;case 'skills':return (e.skills||[]).reduce((n,s)=>n+s.level,0);case 'slots':return (e.armor?.slots||e.charm?.slots||e.base?.slots||[]).reduce((n,s)=>n+s,0);case 'augments':return e.item?.CustomEnable?e.item.CustomBuildup.filter(a=>a.Id).length:0;case 'references':return e.referencedBy?.length||0;case 'quantity':return e.count;case 'slot':return e.slot;default:return e.index;}};
 const tie=(a,b)=>(a.box||'').localeCompare(b.box||'')||(a.index??0)-(b.index??0)||String(a.key).localeCompare(String(b.key));
 return rows.slice().sort((a,b)=>{const av=value(a),bv=value(b);if(av==null||bv==null)return av==null&&bv==null?tie(a,b):av==null?1:-1;const d=typeof av==='string'?av.localeCompare(bv,'zh-CN'):av-bv;return sign*d||tie(a,b);});
}
function createStore({indexedDB,localStorage}={}){
 const key='sunbreak-forge-inventory-v1';
 const open=()=>new Promise((resolve,reject)=>{if(!indexedDB){reject(new Error('IndexedDB不可用'));return;}const r=indexedDB.open(key,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('snapshots'))r.result.createObjectStore('snapshots');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 async function action(mode,value){const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('snapshots',mode==='load'?'readonly':'readwrite'),store=tx.objectStore('snapshots');let result;if(mode==='load'){const r=store.get('current');r.onsuccess=()=>{result=r.result;};}else if(mode==='save')store.put(value,'current');else store.delete('current');tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
 return {async load(){try{return await action('load');}catch{try{return JSON.parse(localStorage?.getItem(key)||'null');}catch{return null;}}},async save(value){try{await action('save',value);return true;}catch{try{check(localStorage,'无法保存库存');localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}},async clear(){try{await action('clear');}catch{}try{localStorage?.removeItem(key);}catch{}}};
}
const api={FORMAT,PLAN,MAX_BYTES,SCALARS,ARRAYS,parse,fingerprint,reference,resolve,entryKey,validateSelection,validateQuery,prepare,validateResult,search,exportPlan,validatePreset,shareable,augmentSummary,sortOptions,sortEntries,createStore};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ForgeInventory=api;
})(globalThis);
