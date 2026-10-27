(function(root){
'use strict';
function normalize(data,payload){
 const raw=payload?.request||payload;
 if(!raw||!data.weapons.some(w=>w.id===raw.weaponId)||!Array.isArray(raw.skills))throw new Error('配置需要有效的武器和技能列表');
 const seen=new Set();const skills=raw.skills.map(r=>{const s=data.skills.find(s=>s.id===r.id);if(!s||seen.has(r.id)||!Number.isInteger(r.level)||r.level<1||r.level>s.max)throw new Error('配置中的技能或等级无效');seen.add(r.id);return {id:r.id,level:r.level};});
 const o=raw.options||{},options={sex:o.sex==='FemaleOnly'?'FemaleOnly':'MaleOnly',rank:o.rank==='Master'?'Master':'all',augment:o.augment!==false,deleteSkills:o.deleteSkills!==false,defenseFallback:o.defenseFallback===true,seconds:[15,45,90,180].includes(+o.seconds)?+o.seconds:45,limit:[1,3,5,10,20].includes(+o.limit)?+o.limit:3,fixedCharms:o.fixedCharms!==false,noCharm:o.noCharm===true,searchMode:o.searchMode==='time'?'time':'count',resultSort:['defense','skillsAsc','skillsDesc','skillCostAsc','skillCostDesc'].includes(o.resultSort)?o.resultSort:'defense',fixedArmors:{},augmentLimits:{}};
 const parts=['head','chest','arm','waist','leg'];
 for(const part of parts){
  const limit=o.augmentLimits?.[part];if(limit!=null){if(!Number.isInteger(limit)||limit<0||limit>7)throw new Error('新增上限必须为0至7');options.augmentLimits[part]=limit;}
  const p=o.fixedArmors?.[part];if(!p)continue;
  if(data.armors.find(a=>a.id===p.id)?.part!==part||!Array.isArray(p.atoms)||p.atoms.length>7)throw new Error('固定防具配置无效');
  options.fixedArmors[part]={id:p.id,atoms:p.atoms.map(a=>{
   const out={atomId:a.atomId,value:a.value,count:a.count};
   if(!Number.isInteger(a.atomId)||!Number.isInteger(a.value)||!Number.isInteger(a.count)||a.count<1||a.count>7)throw new Error('固定炼化记录无效');
   if(a.skillId!=null){if(!Number.isInteger(a.skillId))throw new Error('炼化技能ID无效');out.skillId=a.skillId;}
   if(a.valueIndex!=null){if(!Number.isInteger(a.valueIndex)||a.valueIndex<0)throw new Error('炼化数值索引无效');out.valueIndex=a.valueIndex;}
   if(a.fallback===true)out.fallback=true;
   return out;
  })};
 }
 if(o.fixedCharm){
  const c=o.fixedCharm;if(!Array.isArray(c.skills)||!Array.isArray(c.slots)||c.slots.length>3||c.skills.length>2)throw new Error('固定护石结构无效');
  options.fixedCharm={id:String(c.id||'user').slice(0,120),name:String(c.name||'指定护石').slice(0,60),skills:c.skills.map(s=>({skill_id:s.skill_id,level:s.level})),slots:[...c.slots]};
  if(c.fixed===true)options.fixedCharm.fixed=true;else options.fixedCharm.method=String(c.method||'').slice(0,60);
  if(c.pattern)options.fixedCharm.pattern=String(c.pattern).slice(0,40);
 }
 return {weaponId:raw.weaponId,skills,options};
}
function compareSkills(a,b){return b.level-a.level||a.id-b.id;}
function payload(data,request){return {application:'Sunbreak Forge',version:'0.4.0',request:normalize(data,request)};}
const api={normalize,payload,compareSkills};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ForgeConfig=api;
})(globalThis);
