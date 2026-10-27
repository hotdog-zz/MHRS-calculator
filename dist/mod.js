/* Adapter for EquipmentLoadoutsManager Ver1.1. No game code is executed. */
(function(root){
'use strict';
const WEAPONS={GreatSword:0x08100000,ShortSword:0x08200000,Hammer:0x08300000,Lance:0x08400000,LongSword:0x08500000,SlashAxe:0x08600000,GunLance:0x08700000,DualBlades:0x08800000,Horn:0x08900000,InsectGlaive:0x08a00000,ChargeAxe:0x08b00000,LightBowgun:0x08c00000,HeavyBowgun:0x08d00000,Bow:0x08e00000};
const ARMORS={Head:0x0c100000,Chest:0x0c200000,Arm:0x0c300000,Waist:0x0c400000,Leg:0x0c500000};
const MOD_TYPES={ShortSword:'SwordShield',SlashAxe:'SwitchAxe',Horn:'HuntingHorn',ChargeAxe:'ChargeBlade'};
const modWeaponType=weapon=>MOD_TYPES[weapon.id.split(':')[0]]||weapon.id.split(':')[0];
const PARTS=['head','chest','arm','waist','leg'];
const clone=x=>JSON.parse(JSON.stringify(x));
const zero=()=>({Id:0,SkillId:0,ValueIndex:0});
const int=(v,label,min=0,max=0x7fffffff)=>{if(!Number.isInteger(v)||v<min||v>max)throw new Error(label+'无效');return v;};
function skillToGame(id){if(id>=0&&id<=110)return id+1;if(id>=200&&id<=235)return id-88;throw new Error('未知技能ID：'+id);}
function skillFromGame(id){if(id>=1&&id<=111)return id-1;if(id>=112&&id<=147)return id+88;throw new Error('未知游戏技能ID：'+id);}
function equipmentToGame(id){const [type,n]=id.split(':');const prefix=WEAPONS[type]||ARMORS[type];if(!prefix)throw new Error('未知装备ID：'+id);return prefix+int(+n,'装备编号',0,65535);}
function equipmentFromGame(id){int(id,'装备ID');const prefix=id&0xffff0000;const type=Object.entries({...WEAPONS,...ARMORS}).find(([,v])=>v===prefix)?.[0];if(!type)throw new Error('无法识别装备ID：'+id);return type+':'+(id&0xffff);}
function decoToGame(id){const [type,n]=id.split(':');if(!['Deco','MrDeco'].includes(type))throw new Error('未知珠子ID：'+id);return int(+n,'珠子编号')+(type==='Deco'?1:109);}
function decoFromGame(id){int(id,'珠子ID',1);return id<109?'Deco:'+(id-1):'MrDeco:'+(id-109);}
function numberArray(value,length,label,defaults=0){if(value==null)return Array(length).fill(defaults);if(!Array.isArray(value)||value.length!==length)throw new Error(label+'需要'+length+'项');return value.map(v=>int(v,label,-1));}
function cleanItem(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('装备记录缺失');
 const out={};
 for(const [key,def] of Object.entries({Type:131072,InventoryIndex:-1,IdType:0,IdVal:0,BowgunCustomizeType:0,PairInsectInventoryIndex:-1,BuildupPoint:0,HyakuryuDecoId:0,HyakuryuModelId:1048576,CustomBuildupType:0,CustomCount:0}))out[key]=int(raw[key]??def,key,['InventoryIndex','PairInsectInventoryIndex'].includes(key)?-1:0);
 out.IsLock=raw.IsLock===true;out.CustomEnable=raw.CustomEnable===true;
 for(const [key,n] of Object.entries({TalismanDecoSlotNumList:5,TalismanSkillIdList:2,TalismanSkillLvList:2,DecoIdList:3,HyakuryuSkillIdList:6,PrevHyakuryuSkillId:6}))out[key]=numberArray(raw[key],n,key);
 if(raw.CustomOpenIdArray!=null&&(!Array.isArray(raw.CustomOpenIdArray)||raw.CustomOpenIdArray.length>512))throw new Error('炼化解锁列表无效');
 out.CustomOpenIdArray=(raw.CustomOpenIdArray||[]).map(v=>int(v,'炼化解锁ID'));
 if(raw.CustomBuildup!=null&&(!Array.isArray(raw.CustomBuildup)||raw.CustomBuildup.length>7))throw new Error('炼化记录最多七项');
 out.CustomBuildup=(raw.CustomBuildup||[]).map(v=>({Id:int(v.Id,'炼化ID'),SkillId:int(v.SkillId??0,'炼化技能ID'),ValueIndex:int(v.ValueIndex??0,'炼化数值索引')}));
 while(out.CustomBuildup.length<7)out.CustomBuildup.push(zero());
 return out;
}
function parse(data,text){
 if(typeof text==='string'&&text.length>2000000)throw new Error('JSON过大，请粘贴单套配装文件');
 let raw;try{raw=typeof text==='string'?JSON.parse(text.replace(/^\uFEFF/,'')):text;}catch{throw new Error('JSON格式不正确');}
 if(!raw||!Array.isArray(raw.inventoryList)||raw.inventoryList.length!==8||!Array.isArray(raw.backupList)||raw.backupList.length!==8)throw new Error('需要Mod导出的单套配装JSON，包含八项inventoryList和backupList');
 const inventoryList=raw.inventoryList.map(cleanItem);
 if(raw.inventoryList[0].PairedInsectData)inventoryList[0].PairedInsectData=cleanItem(raw.inventoryList[0].PairedInsectData);
 const backupList=raw.backupList.map((v,i)=>{
  if(!v||v.IdVal!==inventoryList[i].IdVal)throw new Error('backupList与inventoryList的装备ID不一致');
  return {IdVal:int(v.IdVal,'备份装备ID'),InsectIdVal:int(v.InsectIdVal??-1,'猎虫ID',-1),InsectInventoryIndex:int(v.InsectInventoryIndex??-1,'猎虫索引',-1),BowgunCustomizeType:int(v.BowgunCustomizeType??0,'弩枪改装'),HyakuryuDecoId:int(v.HyakuryuDecoId??0,'百龙珠ID'),DecoIdList:numberArray(v.DecoIdList,3,'备份珠子')};
 });
 const weapon=data.weapons.find(w=>w.id===equipmentFromGame(inventoryList[0].IdVal));
 if(!weapon||inventoryList[0].IdType!==1)throw new Error('模板武器不在当前装备数据中');
 for(let i=0;i<5;i++){const item=inventoryList[i+1],armor=data.armors.find(a=>a.id===equipmentFromGame(item.IdVal));if(!armor||armor.part!==PARTS[i]||item.IdType!==2)throw new Error('模板防具部位或ID不正确');}
 if(inventoryList[6].IdType!==4||(inventoryList[7].IdVal!==0&&inventoryList[7].IdType!==3))throw new Error('花链或护石记录不正确');
 const info=raw.mySetInfo;
 if(!info||typeof info!=='object')throw new Error('缺少mySetInfo替换技配置');
 const mySetInfo={Name:typeof info.Name==='string'?info.Name.slice(0,80):'工房配装',IsUsing:true,ActionIdList:numberArray(info.ActionIdList,3,'原始替换技'),ActionIdListMR_Red:numberArray(info.ActionIdListMR_Red,5,'朱之书'),ActionIdListMR_Blue:numberArray(info.ActionIdListMR_Blue,5,'苍之书')};
 return {inventoryList,backupList,mySetInfo,uiInfo:{displayName:mySetInfo.Name,weaponName:weapon.name,weaponType:modWeaponType(weapon)}};
}
function readLoadout(data,template,engine){
 const mod=parse(data,template),totals={},armorNative={},warnings=[];
 const add=(id,level)=>{if(!data.skills.some(s=>s.id===id))throw new Error('技能不在当前数据中');totals[id]=(totals[id]||0)+level;};
 const weapon=data.weapons.find(w=>w.id===equipmentFromGame(mod.inventoryList[0].IdVal));
 for(let i=0;i<5;i++){
  const item=mod.inventoryList[i+1],armor=data.armors.find(a=>a.id===equipmentFromGame(item.IdVal));
  const levels=Object.fromEntries(armor.skills.map(s=>[s.skill_id,s.level]));let points=0;
  if(item.CustomEnable)for(const atom of item.CustomBuildup){
   if(!atom.Id)continue;
   const raw=data.atoms.find(a=>a.pool===armor.pool&&a.id===atom.Id),value=raw?.values.find(v=>v.value_index===atom.ValueIndex);
   if(!raw||!value)throw new Error(armor.name+'包含未知炼化词条或数值索引');
   if(raw.category===20){const id=skillFromGame(atom.SkillId);levels[id]=(levels[id]||0)+value.value;}
   if(raw.category===19)points+=value.value;
  }
  for(const [id,level] of Object.entries(levels)){if(level<0)throw new Error(armor.name+'技能等级为负');add(+id,level);}
  for(const s of armor.skills)if((levels[s.skill_id]||0)>0)armorNative[s.skill_id]=true;
  const slots=engine.upgradeSlots(armor.slots,points);
  mod.backupList[i+1].DecoIdList.forEach((id,j)=>{if(!id)return;const d=data.decorations.find(d=>d.id===decoFromGame(id));if(!d)throw new Error(armor.name+'珠子不存在');if(d.slot>(slots[j]||0))warnings.push(armor.name+'第'+(j+1)+'孔与珠子等级不匹配，仍按JSON中的珠子同步技能');});
 }
 const charm=mod.inventoryList[7];
 charm.TalismanSkillIdList.forEach((id,i)=>{const level=charm.TalismanSkillLvList[i];if(id&&level)add(skillFromGame(id),int(level,'护石等级',1,7));});
 for(const i of [0,1,2,3,4,5,7])for(const id of mod.backupList[i].DecoIdList){if(!id)continue;const d=data.decorations.find(d=>d.id===decoFromGame(id));if(!d)throw new Error('无法识别珠子ID：'+id);for(const s of d.skills)add(s.skill_id,s.level);}
 // Stormsoul adds once per eligible armor-native skill type, never per piece.
 const bonus=(totals[110]||0)>=5?2:(totals[110]||0)>=4?1:0;
 if(bonus)for(const id of Object.keys(armorNative))if(+id!==110)add(+id,bonus);
 const skills=Object.entries(totals).filter(([,v])=>v>0).map(([id,v])=>({id:+id,level:Math.min(v,data.skills.find(s=>s.id===+id).max)})).sort((a,b)=>b.level-a.level||a.id-b.id);
 return {weaponId:weapon.id,skills,stormsoul:bonus>0,warnings};
}
function importInto(data,current,text,mode,engine){
 if(!['template','full'].includes(mode))throw new Error('请选择模板导入或全导入');
 const template=parse(data,text);let next=clone(current),loadout;
 next.weaponId=equipmentFromGame(template.inventoryList[0].IdVal);
 if(mode==='full'){loadout=readLoadout(data,template,engine);next.skills=loadout.skills;}
 return {template,state:next,loadout};
}
function charmGameId(data,charm){
 if(charm.empty)return 0;
 if(charm.fixed){const fixed=data.fixedCharms.find(c=>c.id===charm.id);if(!fixed)throw new Error('未知固定护石');return fixed.charm_id;}
 const rules=data.melding,m=rules.methods[charm.method];if(!m)throw new Error('护石缺少炼金方式');
 const rows=charm.skills.map(s=>m.skills.find(v=>(v.skillId>=10000?v.skillId-10000+200:v.skillId)===s.skill_id));
 if(rows.some(v=>!v))throw new Error('护石技能与炼金方式不一致');
 const q=['AlchemyHaki','AlchemyEnkan'].includes(m.pattern);let rarity;
 if(q){
  let worth=0;
  charm.skills.forEach((s,i)=>{const row=rows[i][i?'second':'first'].find(v=>v.level===s.level&&v.weight>0);if(!row||row.mysteryWorth==null)throw new Error('护石等级缺少评价值');worth+=row.mysteryWorth;});
  const slot=rules.quriousSlots.find(v=>v.slots.filter(Boolean).join(',')===charm.slots.filter(Boolean).join(','));if(!slot)throw new Error('护石孔位缺少评价值');worth+=slot.mysteryWorth;
  rarity=rules.runtimeRules.quriousRarityThresholds.filter(v=>worth>=v.minimumWorth).at(-1).rarity;
 }else{
  let worth=0;
  charm.skills.forEach((s,i)=>{const g=rules.meldingTables.gradeWorth.param[['C','B','A','S'].indexOf(rows[i].grade)],max=data.skills.find(v=>v.id===s.skill_id).max;if(!g)throw new Error('护石技能档位无效');const term=Math.fround(g.gradePoint+Math.fround(Math.fround(g.addPoint*s.level)/max));worth=Math.fround(worth+term);});
  for(const slot of charm.slots)worth=Math.fround(worth+rules.meldingTables.slotWorth.param[slot].worthPoint);
  const table=rules.meldingTables.rarity.param;const index=Math.trunc(Math.min(worth,table.at(-1).worthPoint));rarity=table.find(v=>v.worthPoint===index)?.rareTypeList[m.rarityTableIndex];
 }
 const id=rules.outputKinds[q?'qurious':'ordinary'].find(v=>v.rarity===rarity)?.charmId;if(!id)throw new Error('无法确定护石类型');return id;
}
function encodeAtoms(data,armor,atoms){
 const out=[];
 for(const a of atoms){const raw=data.atoms.find(v=>v.pool===armor.pool&&v.id===a.atomId),value=raw?.values.find(v=>v.value===a.value&&(a.valueIndex==null||v.value_index===a.valueIndex));if(!value)throw new Error('无法转换炼化数值');if(a.fallback&&a.count!==1)throw new Error('防御兜底词条计数必须为1');for(let n=0;n<a.count;n++)out.push({Id:a.atomId,SkillId:a.skillId==null?0:skillToGame(a.skillId),ValueIndex:value.value_index});}
 if(out.length>7)throw new Error('炼化词条超过七项');out.sort((a,b)=>a.Id-b.Id);while(out.length<7)out.push(zero());return out;
}
function clearAugment(item){item.CustomBuildup=Array.from({length:7},zero);item.CustomOpenIdArray=[];item.CustomBuildupType=0;item.CustomEnable=false;item.CustomCount=0;}
function checkWeaponAugmentTransfer(data,source,target,item){
 if(source.id===target.id||!item.CustomEnable)return;
 const support=data.weaponAugmentSupport?.[target.augmentTable];
 for(const atom of item.CustomBuildup){
  if(atom.Id&&!support?.[atom.Id]?.includes(atom.ValueIndex))throw new Error('模板的武器强化条目 '+atom.Id+' 不适用于'+target.name+'，请导入这把武器的模板后再导出');
 }
}
function checkRampageTransfer(data,source,target,item,id){
 if(source.id===target.id||id===0||id===0x00100000)return;
 const decoration=data.rampageDecorations?.find(d=>d.gameId===id);
 if(!decoration)throw new Error('无法识别模板百龙珠，请使用目标武器的模板');
 let growth=0;if(item.CustomEnable)for(const atom of item.CustomBuildup)growth+=data.weaponRampageGrowth?.[target.augmentTable]?.[atom.Id]?.[atom.ValueIndex]||0;
 const slot=Math.min(3,(target.rampageSlot||0)+growth);
 if(slot<decoration.slot)throw new Error(target.name+'的百龙孔为'+slot+'级，放不下模板的'+decoration.name+'；请更换模板或武器');
}
function exportLoadout(data,template,result,request,engine,{index=1,now=Date.now(),name}={}){
 if(!template)throw new Error('请先粘贴导入一份同武器类型的Mod模板');
 const mod=parse(data,template),verified=engine.validateResult(data,request,result),weapon=data.weapons.find(w=>w.id===verified.weaponId),oldWeapon=data.weapons.find(w=>w.id===equipmentFromGame(mod.inventoryList[0].IdVal));
 if(weapon.type!==oldWeapon.type)throw new Error('模板武器类型为'+oldWeapon.typeName+'，请导入'+weapon.typeName+'模板后再导出');
 checkWeaponAugmentTransfer(data,oldWeapon,weapon,mod.inventoryList[0]);
 const rampageId=mod.backupList[0].HyakuryuDecoId;
 checkRampageTransfer(data,oldWeapon,weapon,mod.inventoryList[0],rampageId);
 const owners=[weapon.id,...PARTS.map(part=>verified.pieces.find(p=>p.part===part).id),null,'charm'];
 for(let i=0;i<8;i++){
  if(i===6)continue;
  const item=mod.inventoryList[i],oldId=item.IdVal;
  item.IdType=i===0?1:i===7?3:2;item.Type=131072;
  item.IdVal=i===7?charmGameId(data,verified.charm):equipmentToGame(owners[i]);
  if(i!==0)clearAugment(item);
  item.HyakuryuDecoId=i===0?rampageId:0;item.HyakuryuModelId=1048576;item.HyakuryuSkillIdList=Array(6).fill(0);item.PrevHyakuryuSkillId=Array(6).fill(0);
  item.TalismanDecoSlotNumList=Array(5).fill(0);item.TalismanSkillIdList=[0,0];item.TalismanSkillLvList=[0,0];
  if(i>0&&i<6){const p=verified.pieces.find(p=>p.id===owners[i]);item.CustomBuildup=encodeAtoms(data,p,p.atoms);item.CustomEnable=p.records>0;item.BuildupPoint=oldId===item.IdVal?item.BuildupPoint:0;delete item.PairedInsectData;}
  if(i===7){item.BuildupPoint=0;verified.charm.skills.forEach((s,j)=>{item.TalismanSkillIdList[j]=skillToGame(s.skill_id);item.TalismanSkillLvList[j]=s.level;});for(const slot of verified.charm.slots)item.TalismanDecoSlotNumList[slot]++;delete item.PairedInsectData;}
  item.DecoIdList=[0,0,0];
  for(const p of verified.placement.filter(p=>p.owner===owners[i])){if(p.decorationId)item.DecoIdList[p.index]=decoToGame(p.decorationId);}
  const oldBackup=mod.backupList[i];
  mod.backupList[i]={IdVal:item.IdVal,DecoIdList:[...item.DecoIdList],HyakuryuDecoId:item.HyakuryuDecoId,BowgunCustomizeType:i===0?item.BowgunCustomizeType:0,InsectIdVal:i===0?oldBackup.InsectIdVal:-1,InsectInventoryIndex:i===0?oldBackup.InsectInventoryIndex:-1};
 }
 const displayName=name===undefined?((mod.mySetInfo.Name||'工房配装').trim()+' · '+index).slice(0,70):String(name).trim();
 if(!displayName)throw new Error('请填写配装名称');
 if(displayName.length>70)throw new Error('配装名称最多70个字符');
 mod.mySetInfo.Name=displayName;mod.mySetInfo.IsUsing=true;mod.uiInfo={displayName,weaponName:weapon.name,weaponType:modWeaponType(weapon)};
 const filename=index+'_'+base62(Math.floor(now/1000))+'.json';
 return {payload:mod,filename,directory:'reframework/data/EquipmentLoadouts/'+mod.uiInfo.weaponType+'/'};
}
function base62(n){const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';let s='';do{s=alphabet[n%62]+s;n=Math.floor(n/62);}while(n>0);return s;}
const api={parse,readLoadout,importInto,exportLoadout,skillToGame,skillFromGame,equipmentToGame,equipmentFromGame,decoToGame,decoFromGame,charmGameId,encodeAtoms,base62};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ForgeMod=api;
})(globalThis);
