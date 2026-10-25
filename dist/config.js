(function(root){
'use strict';
function normalize(data,payload){
 const raw=payload?.request||payload;
 if(!raw||!data.weapons.some(w=>w.id===raw.weaponId)||!Array.isArray(raw.skills))throw new Error('配置需要有效的武器和技能列表');
 const seen=new Set();const skills=raw.skills.map(r=>{const s=data.skills.find(s=>s.id===r.id);if(!s||seen.has(r.id)||!Number.isInteger(r.level)||r.level<1||r.level>s.max)throw new Error('配置中的技能或等级无效');seen.add(r.id);return {id:r.id,level:r.level};});
 const o=raw.options||{};
 return {weaponId:raw.weaponId,skills,options:{sex:o.sex==='FemaleOnly'?'FemaleOnly':'MaleOnly',rank:o.rank==='Master'?'Master':'all',augment:o.augment!==false,deleteSkills:o.deleteSkills!==false,seconds:[15,45,90].includes(+o.seconds)?+o.seconds:45,limit:[1,3,5].includes(+o.limit)?+o.limit:3,fixedCharms:o.fixedCharms!==false,noCharm:o.noCharm===true}};
}
function compareSkills(a,b){return b.level-a.level||a.id-b.id;}
function payload(data,request){return {application:'Sunbreak Forge',version:'0.2.1',request:normalize(data,request)};}
const api={normalize,payload,compareSkills};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ForgeConfig=api;
})(globalThis);
