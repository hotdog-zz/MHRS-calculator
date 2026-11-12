'use strict';
const D=require('../dist/data.json'),H=require('../dist/handcraft.js'),E=require('../dist/engine.js');
function routes(){
 const names=['翔虫使','风绕','业铠【修罗】','连击','气血觉醒','超会心','奋斗','破坏王'],ids=Object.fromEntries(names.map(name=>[name,D.skills.find(s=>s.name===name).id])),targets=names.map(name=>({id:ids[name],level:D.skills.find(s=>s.id===ids[name]).max})),waist=D.armors.find(a=>a.name==='祸铠・怨【腰具】'),bases=['Head:492','Chest:502','Arm:502',waist.id,'Leg:502'].map(id=>D.armors.find(a=>a.id===id));
 const normal=[.00308,.00307,.00310,.00342,.00328],skills=[.0000351,.00000513,.00000113,.0084,.0055];
 function make(swapped,legSlots){const pieces=bases.map((base,i)=>{const levels=Object.fromEntries(base.skills.filter(s=>names.some(n=>ids[n]===s.skill_id)).map(s=>[s.skill_id,s.level]));if(i===4)levels[ids['破坏王']]=1;
   const added=i===0?'业铠【修罗】':i===1?(swapped?'奋斗':'业铠【修罗】'):i===2?(swapped?'业铠【修罗】':'奋斗'):'奋斗';levels[ids[added]]=(levels[ids[added]]||0)+1;
   const slots=[[3,2,1],[4,4,2],[4,4,2],[4,2,1],legSlots][i],options=H.optionsFor(base,levels,slots,{skills:targets,options:{deleteSkills:true}}),probabilities=[{mode:'normal',p:normal[i],n:1000000,effectiveHits:64000,se:.00001},{mode:'skills',p:skills[i],n:1000000,effectiveHits:64000,se:.00001}],best=probabilities.slice().sort((a,b)=>b.p-a.p)[0];
   return {id:(swapped?'b:':'a:')+base.id,baseId:base.id,part:base.part,name:base.name,source:'craft',pool:base.pool,budget:base.budget,slots,skills:Object.entries(levels).map(([id,level])=>({skill_id:+id,level})),expectedRolls:1/best.p,individualBestMode:best.mode,individualProbability:best,probabilities,goal:{skills:Object.entries(levels).map(([id,level])=>({skill_id:+id,level})),slots,minimumChanges:options.minimumChanges,maxPositiveRecords:7,deleteSkills:true}};
  });const plan=H.optimizeModes(pieces);for(const[i,c]of plan.choices.entries()){pieces[i].mode=pieces[i].stargazingMode=c.mode;pieces[i].probability=pieces[i].stargazingProbability=c;}
  const charm={name:'已有护石',skills:[{skill_id:225,level:2},{skill_id:21,level:3}],slots:[2,2,2],guideRef:{box:'equipment',index:0,fingerprint:'fixture'}},totals={};for(const p of [...pieces,charm])for(const s of p.skills)totals[s.skill_id]=(totals[s.skill_id]||0)+s.level;
  return {id:swapped?'swap-b':'swap-a',verified:true,weaponId:'DualBlades:481',inventoryId:'fixture',pieces,charm,totals,decorations:[],placement:[],expectedRolls:pieces.reduce((n,p)=>n+p.expectedRolls,0),stargazingRolls:plan.stargazingRolls,stargazingGroups:plan.groups,needsRolling:5,needsCrafting:5};
 }
 return {a:make(false,[4,2]),b:make(true,[4,4]),ids};
}
// The user's 685/563 regression: A,B,B by normal; A,A by skills+.
function singleSkillRoute(){const {a:r,ids}=routes(),a=ids['奋斗'],b=ids['业铠【修罗】'];for(const i of [0,2]){const p=r.pieces[i],old=i===0?b:a,next=i===0?a:b;p.goal.skills=p.goal.skills.filter(s=>s.skill_id!==old);p.goal.skills.push({skill_id:next,level:1});p.goal.minimumChanges=p.goal.minimumChanges.filter(s=>s.id!==old);p.goal.minimumChanges.push({id:next,min:1});p.skills=p.goal.skills;}r.pieces[4].goal.slots=[4,4];return r;}
module.exports={routes,singleSkillRoute};
