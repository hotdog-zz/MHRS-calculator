const {test,before}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const M=require('../dist/mod.js'),E=require('../dist/engine.js'),C=require('../dist/config.js');
const F=require('../dist/file-import.js'),S=require('../dist/share.js');
const data=require('../dist/data.json'),template=require('./mod-template.json');
const state={weaponId:'LongSword:302',skills:[{id:0,level:7}],options:{sex:'MaleOnly',seconds:15,limit:1,deleteSkills:true,augment:true}};
let solution,request;
before(async()=>{
 const highs=await require('../dist/vendor/highs.js')({locateFile:f=>path.resolve(__dirname,'../dist/vendor',f)});
 request={weaponId:'Bow:427',skills:[{id:5,level:7},{id:6,level:3},{id:7,level:3},{id:203,level:3},{id:228,level:3}],options:{sex:'MaleOnly',seconds:15,limit:1}};
 const response=await E.search(data,request,highs);assert.equal(response.status,'feasible');solution=response.results[0];
});
test('游戏ID边界：零是空技能，MR技能与珠子使用不同偏移',()=>{
 assert.equal(M.skillToGame(0),1);assert.equal(M.skillToGame(203),115);assert.equal(M.skillFromGame(140),228);assert.throws(()=>M.skillFromGame(0));
 assert.equal(M.decoToGame('Deco:0'),1);assert.equal(M.decoToGame('MrDeco:58'),167);assert.equal(M.decoFromGame(168),'MrDeco:59');
 assert.equal(M.equipmentToGame('Head:502'),202375670);assert.equal(M.equipmentFromGame(148898099),'Bow:307');
 for(const s of data.skills)assert.equal(M.skillFromGame(M.skillToGame(s.id)),s.id);
 for(const d of data.decorations)assert.equal(M.decoFromGame(M.decoToGame(d.id)),d.id);
});
test('模板导入同步武器并保留技能和搜索选项；分享条件不夹带模板内容',()=>{
 const before=JSON.stringify(state),imported=M.importInto(data,state,JSON.stringify(template),'template',E);
 assert.equal(imported.state.weaponId,'Bow:427');assert.equal(imported.state.rampageDecorationId,template.backupList[0].HyakuryuDecoId);assert.deepEqual(imported.state.skills,state.skills);assert.deepEqual(imported.state.options,state.options);assert.equal(JSON.stringify(state),before);
 assert.equal(imported.template.mySetInfo.Name,'测试模板');
 assert.ok(!JSON.stringify(C.payload(data,{...state,modTemplate:template})).includes('inventoryList'));
});
test('全导入从真实样本的原生技能、炼化、护石和珠子合计并封顶',()=>{
 const full=M.importInto(data,state,template,'full',E);
 assert.equal(full.state.weaponId,'Bow:427');assert.deepEqual(full.state.options,state.options);
 const totals=Object.fromEntries(full.state.skills.map(s=>[s.id,s.level]));
 // Hand-checked specimen: MoH from three armor augments, Berserk from charm,
 // Critical Eye 1+1 decorations, and Reload Speed cannot exceed its max 2.
 assert.equal(totals[203],3);assert.equal(totals[225],2);assert.equal(totals[5],2);assert.equal(totals[51],2);
 assert.equal(full.state.skills.length,24);assert.equal(full.state.skills[0].id,16);
 const disabled=structuredClone(template);disabled.inventoryList[1].CustomEnable=false;
 const read=M.readLoadout(data,disabled,E);assert.equal(read.skills.find(s=>s.id===203).level,2);
});
test('防御词条保留真实ValueIndex；重复技能炼化展开并补足七条',()=>{
 const armor=data.armors.find(a=>a.id==='Head:502');
 const raw=data.atoms.find(a=>a.pool===armor.pool&&a.category===13&&a.values.length>1),v=raw.values[1];
 const out=M.encodeAtoms(data,armor,[{atomId:146,skillId:203,value:1,count:2},{atomId:raw.id,value:v.value,valueIndex:v.value_index,count:1}]);
 assert.equal(out.length,7);assert.equal(out[0].Id,raw.id);assert.equal(out[0].ValueIndex,v.value_index);assert.deepEqual(out[1],{Id:146,SkillId:115,ValueIndex:0});assert.deepEqual(out[2],out[1]);assert.equal(out[6].Id,0);
});
test('真实求解结果导出Mod后往返：技能与逐孔插法一致，模板不变',()=>{
 const original=JSON.stringify(template),out=M.exportLoadout(data,template,solution,request,E,{index:2,now:1792896000000,name:'寒气弓 · 日常狩猎'});
 assert.equal(out.payload.uiInfo.displayName,'寒气弓 · 日常狩猎');assert.equal(out.payload.mySetInfo.Name,'寒气弓 · 日常狩猎');
 assert.match(out.filename,/^2_[0-9A-Za-z]+\.json$/);assert.equal(out.directory,'reframework/data/EquipmentLoadouts/Bow/');
 assert.equal(JSON.stringify(template),original);assert.deepEqual(out.payload.mySetInfo.ActionIdListMR_Red,template.mySetInfo.ActionIdListMR_Red);
 assert.deepEqual(out.payload.mySetInfo.ActionIdListMR_Blue,template.mySetInfo.ActionIdListMR_Blue);assert.deepEqual(out.payload.inventoryList[6],M.parse(data,template).inventoryList[6]);
 const read=M.readLoadout(data,out.payload,E),expected=Object.entries(solution.totals).filter(([,n])=>n>0).map(([id,n])=>({id:+id,level:Math.min(n,data.skills.find(s=>s.id===+id).max)})).sort(C.compareSkills);
 assert.deepEqual(read.skills,expected);assert.deepEqual(read.warnings,[]);
 for(let i=0;i<8;i++){assert.equal(out.payload.backupList[i].IdVal,out.payload.inventoryList[i].IdVal);assert.deepEqual(out.payload.backupList[i].DecoIdList,out.payload.inventoryList[i].DecoIdList);}
 const w=out.payload.inventoryList[0];for(const key of ['CustomEnable','CustomBuildup','CustomOpenIdArray','CustomBuildupType','CustomCount'])assert.deepEqual(w[key],template.inventoryList[0][key],key);assert.equal(w.HyakuryuDecoId,template.backupList[0].HyakuryuDecoId);assert.equal(out.payload.backupList[0].HyakuryuDecoId,w.HyakuryuDecoId);
 const counts={};for(const inv of out.payload.inventoryList)for(const id of inv.DecoIdList)if(id)counts[id]=(counts[id]||0)+1;
 assert.deepEqual(counts,Object.fromEntries(solution.decorations.map(d=>[M.decoToGame(d.id),d.count])));
});
test('跨武器类型模板和无模板会明确阻止导出，不猜测替换技',()=>{
 assert.throws(()=>M.exportLoadout(data,null,solution,request,E),/模板/);
 const wrong=structuredClone(template);wrong.inventoryList[0].IdVal=M.equipmentToGame('LongSword:302');wrong.backupList[0].IdVal=wrong.inventoryList[0].IdVal;
 assert.throws(()=>M.exportLoadout(data,wrong,solution,request,E),/模板武器类型/);
});
test('同类换武器保留强化与解锁，结果武器仍来自搜索；不支持的强化明确拒绝',()=>{
 const q={...request,weaponId:'Bow:500',skills:[]},s={...solution,weaponId:q.weaponId,decorations:[]};
 const out=M.exportLoadout(data,template,s,q,E).payload;
 assert.equal(out.inventoryList[0].IdVal,M.equipmentToGame('Bow:500'));
 for(const key of ['CustomEnable','CustomBuildup','CustomOpenIdArray','CustomBuildupType','CustomCount'])assert.deepEqual(out.inventoryList[0][key],template.inventoryList[0][key],key);
 const badQ={...q,weaponId:'Bow:302'},badS={...s,weaponId:badQ.weaponId};
 assert.throws(()=>M.exportLoadout(data,template,badS,badQ,E),/武器强化条目.*不适用/);
 const inactive=structuredClone(template);inactive.inventoryList[0].CustomEnable=false;
 const disabled=M.exportLoadout(data,inactive,badS,badQ,E).payload.inventoryList[0];assert.equal(disabled.CustomEnable,false);assert.deepEqual(disabled.CustomBuildup,inactive.inventoryList[0].CustomBuildup);
});
test('百龙珠使用配装备份记录并同步双份字段；空珠、孔位不足和炼化扩孔分别处理',()=>{
 const q={...request,weaponId:'Bow:304',skills:[]},s={...solution,weaponId:q.weaponId,decorations:[]};
 assert.throws(()=>M.exportLoadout(data,template,s,q,E),/百龙孔.*放不下/);
 const empty=structuredClone(template);empty.backupList[0].HyakuryuDecoId=0;
 let out=M.exportLoadout(data,empty,s,q,E).payload;assert.equal(out.inventoryList[0].HyakuryuDecoId,0);assert.equal(out.backupList[0].HyakuryuDecoId,0);
 empty.backupList[0].HyakuryuDecoId=0x00100000;out=M.exportLoadout(data,empty,s,q,E).payload;assert.equal(out.inventoryList[0].HyakuryuDecoId,0x00100000);
 const expanded=structuredClone(template);expanded.inventoryList[0].CustomBuildup=[{Id:1,SkillId:0,ValueIndex:0},{Id:46,SkillId:0,ValueIndex:0},...Array.from({length:5},()=>({Id:0,SkillId:0,ValueIndex:0}))];expanded.inventoryList[0].CustomOpenIdArray.push(46);
 out=M.exportLoadout(data,expanded,s,q,E).payload;assert.equal(out.inventoryList[0].HyakuryuDecoId,template.backupList[0].HyakuryuDecoId);assert.equal(out.backupList[0].HyakuryuDecoId,out.inventoryList[0].HyakuryuDecoId);
});
test('空护石与固定特典可导出，孔位计数不沿用旧模板',()=>{
 for(const charm of [{id:'none',name:'无',empty:true,skills:[],slots:[]},{...data.fixedCharms[0],name:'特典',fixed:true}]){
  const q={...request,skills:[],options:{...request.options,noCharm:!!charm.empty}},s={...solution,charm,decorations:[]};
  const out=M.exportLoadout(data,template,s,q,E).payload;
  assert.equal(out.inventoryList[7].IdVal,charm.empty?0:269484039);assert.deepEqual(out.inventoryList[7].TalismanDecoSlotNumList,[0,0,0,0,0]);
  assert.ok(out.inventoryList[7].TalismanSkillIdList.every(id=>id>=0));
 }
});
test('网页指定百龙珠覆盖模板并同步双份数据，明确空置与旧方案沿用互不混淆',()=>{
 const before=JSON.stringify(template);
 for(const id of [0,1048579,1048577]){
  const q={...request,rampageDecorationId:id},out=M.exportLoadout(data,template,solution,q,E).payload;
  assert.equal(out.inventoryList[0].HyakuryuDecoId,id);assert.equal(out.backupList[0].HyakuryuDecoId,id);
  assert.deepEqual(M.importInto(data,state,out,'template',E).state.rampageDecorationId,id);
 }
 assert.equal(JSON.stringify(template),before);
 assert.equal(M.exportLoadout(data,template,solution,request,E).payload.inventoryList[0].HyakuryuDecoId,template.backupList[0].HyakuryuDecoId);
 assert.throws(()=>M.exportLoadout(data,template,solution,{...request,rampageDecorationId:999},E),/百龙珠ID无效/);
 // Explicit selections are checked even when the template and result weapons are identical.
 assert.throws(()=>M.exportLoadout(data,template,solution,{...request,rampageDecorationId:1048578},E),/百龙孔.*放不下/);
});
test('百龙孔选择计入模板扩孔、禁用强化与类型限制，导出复核实际孔位',()=>{
 const weapon=data.weapons.find(w=>w.id==='Bow:304'),expanded=structuredClone(template);
 expanded.inventoryList[0].CustomBuildup[1]={Id:47,SkillId:0,ValueIndex:0};
 assert.equal(M.rampageSlot(data,weapon,null),1);assert.equal(M.rampageSlot(data,weapon,expanded),3);
 const q={...request,weaponId:weapon.id,skills:[],rampageDecorationId:1048578},r={...solution,weaponId:weapon.id,decorations:[]};
 const out=M.exportLoadout(data,expanded,r,q,E).payload;assert.equal(out.backupList[0].HyakuryuDecoId,1048578);
 expanded.inventoryList[0].CustomEnable=false;assert.equal(M.rampageSlot(data,weapon,expanded),1);assert.throws(()=>M.exportLoadout(data,expanded,r,q,E),/放不下/);
 const other=data.weapons.find(w=>w.id==='LongSword:302');assert.equal(M.rampageSlot(data,other,template),other.rampageSlot);
});
test('风雷合一全导入只给防具原生技能种类加一次，护石专有技能不加',()=>{
 const input=structuredClone(template),ids=['Head:334','Chest:334','Arm:334','Waist:334','Leg:334'];
 for(let i=0;i<5;i++){const item=input.inventoryList[i+1];item.IdVal=M.equipmentToGame(ids[i]);item.CustomEnable=false;item.CustomBuildup=[];input.backupList[i+1].IdVal=item.IdVal;}
 for(let i=0;i<8;i++){input.backupList[i].DecoIdList=[0,0,0];input.inventoryList[i].DecoIdList=[0,0,0];}
 const read=M.readLoadout(data,input,E),levels=Object.fromEntries(read.skills.map(s=>[s.id,s.level]));
 assert.equal(read.stormsoul,true);assert.equal(levels[110],5);assert.equal(levels[29],3);assert.equal(levels[32],3);assert.equal(levels[225],2);
});
test('破损数据不产生部分导入；未知元数据不进入Mod模板',()=>{
 const original=JSON.stringify(state),bad=structuredClone(template);bad.inventoryList[1].CustomBuildup[0].ValueIndex=999;
 assert.throws(()=>M.importInto(data,state,bad,'full',E),/数值索引/);assert.equal(JSON.stringify(state),original);
 const privateInput={...template,account:'PRIVATE',origin:'PRIVATE',uiInfo:{...template.uiInfo,account:'PRIVATE'}};
 assert.ok(!JSON.stringify(M.parse(data,privateInput)).includes('PRIVATE'));
});
test('输入孔位不一致时仍同步JSON技能，并明确报告来源异常',()=>{
 const input=structuredClone(template);input.backupList[1].DecoIdList=[167,167,167];
 const imported=M.importInto(data,state,input,'full',E);assert.ok(imported.loadout.warnings.length>0);assert.ok(imported.state.skills.some(s=>s.id===0));
});
test('护石类型由评价值与炼金系列决定，固定护石保留专用ID',()=>{
 const q={method:'vigor',skills:[{skill_id:0,level:3},{skill_id:5,level:2}],slots:[2,2,2]};
 const rows=data.melding.methods.vigor.skills;
 const worth=rows.find(s=>s.skillId===0).first.find(s=>s.level===3).mysteryWorth+rows.find(s=>s.skillId===5).second.find(s=>s.level===2).mysteryWorth+4;
 const rarity=worth>=11?10:worth>=6?9:8;
 assert.equal(M.charmGameId(data,q),data.melding.outputKinds.qurious.find(x=>x.rarity===rarity).charmId);
 assert.equal(M.charmGameId(data,{...data.fixedCharms[0],fixed:true}),269484039);
 assert.equal(M.charmGameId(data,{empty:true}),0);
});
test('页面事件：条件与Mod文件拖入、两种导入、粘贴兼容及命名下载',async()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../dist/index.html'),'utf8'),elements=new Map(),storage=new Map(),downloads=[],blobs=new Map();let clipboard='';
 function element(id){
  const classes=new Set();let markup='';
  const el={id,value:'',disabled:false,checked:false,textContent:'',dataset:{},classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),toggle:(v,on)=>on===undefined?(classes.has(v)?classes.delete(v):classes.add(v)):on?classes.add(v):classes.delete(v),contains:v=>classes.has(v)},querySelectorAll:()=>[],querySelector:()=>({textContent:''}),focus(){},showModal(){this.open=true;},close(){this.open=false;},getBoundingClientRect:()=>({left:0,top:0,right:100,bottom:100}),replaceChildren(){markup='';},insertAdjacentHTML(_,text){markup+=text;}};
  Object.defineProperty(el,'innerHTML',{get:()=>markup,set:text=>{markup=text;for(const [,childId] of text.matchAll(/\bid="([^"]+)"/g))if(!elements.has(childId))elements.set(childId,element(childId));if(id==='weaponSelect'||id==='weaponType')el.value=text.match(/<option value="([^"]+)"/)?.[1]||'';}});return el;
 }
 for(const [,id] of html.matchAll(/\bid="([^"]+)"/g))elements.set(id,element(id));
 const ctx={console,ForgeEngine:E,ForgeInventory:require('../dist/inventory.js'),ForgeConfig:C,ForgeMod:M,ForgeFiles:F,ForgeShare:S,URLSearchParams,TextDecoder,Uint8Array,Blob,location:{hash:''},setTimeout:()=>0,setInterval:()=>0,clearInterval:()=>{},fetch:async()=>({ok:true,json:async()=>data}),navigator:{clipboard:{writeText:async value=>{clipboard=value;}}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},URL:{createObjectURL:blob=>{const url='blob:test'+blobs.size;blobs.set(url,blob);return url;},revokeObjectURL:()=>{}},document:{getElementById:id=>elements.get(id)||null,querySelectorAll:()=>[],createElement:()=>({click(){downloads.push({filename:this.download,blob:blobs.get(this.href)});}})}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../dist/app.js'),'utf8'),ctx);await new Promise(resolve=>setImmediate(resolve));
 const getState=()=>JSON.parse(vm.runInContext('JSON.stringify(state)',ctx));
 assert.equal(elements.get('defenseFallback').checked,false);elements.get('defenseFallback').checked=true;elements.get('defenseFallback').onchange();assert.equal(getState().options.defenseFallback,true);elements.get('defenseFallback').checked=false;elements.get('defenseFallback').onchange();assert.equal(getState().options.defenseFallback,false);
 const drop=payload=>({dataTransfer:{types:['Files'],files:[{name:'配装.json',size:JSON.stringify(payload).length,text:async()=>JSON.stringify(payload)}]},preventDefault(){this.prevented=true;},stopPropagation(){}});
 const beforeFile=getState();elements.get('importConfig').onclick();const condition={...beforeFile,skills:[{id:0,level:4}]};const configDrop=drop(C.payload(data,condition));await elements.get('configDialog').ondrop(configDrop);assert.equal(configDrop.prevented,true);assert.deepEqual(getState(),beforeFile);elements.get('applyConfig').onclick();assert.equal(getState().skills[0].level,4);
 const initial=getState();elements.get('importMod').onclick();assert.equal(elements.get('modDialog').open,true);
 await elements.get('modDialog').ondrop(drop(template));assert.deepEqual(getState(),initial);assert.equal(elements.get('applyModFull').disabled,false);
 elements.get('applyModTemplate').onclick();assert.equal(getState().weaponId,'Bow:427');assert.deepEqual(getState().skills,initial.skills);assert.deepEqual(getState().options,initial.options);assert.equal(elements.get('weaponSelect').value,'Bow:427');assert.equal(JSON.parse(storage.get('sunbreak-forge-v1')).weaponId,'Bow:427');assert.ok(storage.has('sunbreak-forge-mod-template-v1'));
 await elements.get('share').onclick();assert.deepEqual(JSON.parse(clipboard).request,C.normalize(data,{...initial,weaponId:'Bow:427',rampageDecorationId:template.backupList[0].HyakuryuDecoId}));assert.ok(!clipboard.includes('inventoryList'));
 elements.get('modText').value=JSON.stringify(template);elements.get('applyModFull').onclick();assert.equal(getState().weaponId,'Bow:427');assert.equal(getState().skills.length,24);
 ctx.fixtureSolution=solution;ctx.fixtureRequest=request;vm.runInContext('found=[fixtureSolution];activeRequest=fixtureRequest;',ctx);
 elements.get('results').onclick({target:{closest:selector=>selector==='[data-export-mod]'?{dataset:{exportMod:'0'}}:null}});
 assert.equal(downloads.length,0);assert.equal(elements.get('modExportDialog').open,true);assert.equal(elements.get('modExportName').value,'测试模板 · 1');assert.equal(elements.get('ownedExportSlotWrap').classList.contains('hidden'),false);elements.get('ownedExportSlot').value='224';
 elements.get('modExportName').value='   ';elements.get('confirmModExport').onclick();assert.equal(downloads.length,0);assert.equal(elements.get('modExportDialog').open,true);assert.ok(elements.get('modExportError').textContent);
 elements.get('modExportName').value='  我的寒气弓 <一号>  ';elements.get('confirmModExport').onclick();
 assert.equal(downloads.length,1);assert.match(downloads[0].filename,/^224_[0-9A-Za-z]+\.json$/);const payload=JSON.parse(await downloads[0].blob.text());assert.equal(payload.uiInfo.weaponType,'Bow');assert.equal(payload.inventoryList.length,8);assert.equal(payload.uiInfo.displayName,'我的寒气弓 <一号>');assert.equal(payload.mySetInfo.Name,payload.uiInfo.displayName);assert.equal(elements.get('modExportDialog').open,false);
 for(const key of ['CustomEnable','CustomBuildup','CustomOpenIdArray','CustomBuildupType','CustomCount'])assert.deepEqual(payload.inventoryList[0][key],template.inventoryList[0][key],key);
 assert.equal(payload.inventoryList[0].HyakuryuDecoId,template.backupList[0].HyakuryuDecoId);assert.equal(payload.backupList[0].HyakuryuDecoId,payload.inventoryList[0].HyakuryuDecoId);
 const prior=getState();elements.get('modText').value='{invalid';elements.get('applyModFull').onclick();assert.deepEqual(getState(),prior);assert.equal(elements.get('modDialog').open,false);assert.ok(elements.get('modError').textContent);
 elements.get('clearMod').onclick();assert.equal(storage.has('sunbreak-forge-mod-template-v1'),false);assert.deepEqual(getState(),prior);
 // New controls use the same real result and state as the import/export workflow.
 vm.runInContext("openArmor('head')",ctx);assert.equal(elements.get('equipmentDialog').open,true);
 const armorMatch=JSON.parse(vm.runInContext("JSON.stringify(armorChoices().find(a=>!data.armors.find(b=>b.id===armorEditor.id).name.includes(a.name)))",ctx));
 vm.runInContext('armorEditor.atoms=JSON.parse(JSON.stringify(fixtureSolution.pieces[0].atoms));',ctx);
 elements.get('armorSearch').value=armorMatch.name;elements.get('armorSearch').oninput();assert.equal(elements.get('armorSelect').value,armorMatch.id);assert.equal(vm.runInContext('armorEditor.atoms.length',ctx),0);assert.match(elements.get('armorDetails').innerHTML,/基础防御/);
 vm.runInContext('armorEditor.atoms=[{atomId:144,skillId:0,value:1,count:1}];',ctx);elements.get('armorSearch').oninput();assert.equal(vm.runInContext('armorEditor.atoms.length',ctx),1);
 elements.get('armorSearch').value='不存在的装备';elements.get('armorSearch').oninput();assert.equal(elements.get('armorSelect').value,'');assert.equal(elements.get('saveArmor').disabled,true);assert.equal(elements.get('addArmorAtom').disabled,true);assert.match(elements.get('armorDetails').textContent,/没有匹配防具/);
 elements.get('armorSearch').value=armorMatch.name;elements.get('armorSearch').oninput();assert.equal(elements.get('saveArmor').disabled,false);assert.equal(elements.get('armorSelect').value,armorMatch.id);

 vm.runInContext("armorEditor.id=fixtureSolution.pieces[0].id;armorEditor.atoms=JSON.parse(JSON.stringify(fixtureSolution.pieces[0].atoms));",ctx);
 assert.equal(elements.get('fixArmorAugment').checked,false);
 elements.get('saveArmor').onclick();assert.equal(getState().options.fixedArmors.head.id,solution.pieces[0].id);assert.equal(getState().options.fixedArmors.head.atoms,undefined);assert.equal(elements.get('equipmentDialog').open,false);assert.match(elements.get('fixedEquipment').innerHTML,/炼化自动搜索/);
 vm.runInContext("openArmor('head')",ctx);assert.equal(elements.get('fixArmorAugment').checked,false);
 vm.runInContext('armorEditor.atoms=JSON.parse(JSON.stringify(fixtureSolution.pieces[0].atoms));',ctx);
 elements.get('fixArmorAugment').checked=true;elements.get('fixArmorAugment').onchange();assert.match(elements.get('armorValidation').textContent,/校验通过/);
 vm.runInContext('armorEditor.atoms=[{atomId:69,value:1,valueIndex:0,count:8}];',ctx);elements.get('fixArmorAugment').onchange();assert.match(elements.get('armorValidation').textContent,/计数非法/);elements.get('saveArmor').onclick();assert.equal(elements.get('equipmentDialog').open,true);assert.equal(getState().options.fixedArmors.head.atoms,undefined);
 vm.runInContext('armorEditor.atoms=JSON.parse(JSON.stringify(fixtureSolution.pieces[0].atoms));',ctx);elements.get('fixArmorAugment').onchange();elements.get('saveArmor').onclick();assert.ok(Array.isArray(getState().options.fixedArmors.head.atoms));
 vm.runInContext("openArmor('head')",ctx);assert.equal(elements.get('fixArmorAugment').checked,true);elements.get('equipmentDialog').close();
 elements.get('fixedEquipment').onclick({target:{closest:selector=>selector==='[data-unlock-augment]'?{dataset:{unlockAugment:'head'}}:null}});assert.equal(getState().options.fixedArmors.head.id,solution.pieces[0].id);assert.equal(getState().options.fixedArmors.head.atoms,undefined);
 elements.get('fixedEquipment').onchange({target:{dataset:{augmentLimit:'head'},value:'0'}});assert.equal(getState().options.augmentLimits.head,0);
 elements.get('fixedEquipment').onchange({target:{dataset:{augmentLimit:'head'},value:'7'}});
 elements.get('fixedEquipment').onclick({target:{closest:selector=>selector==='[data-unlock-armor]'?{dataset:{unlockArmor:'head'}}:null}});assert.equal(getState().options.fixedArmors.head,undefined);
 elements.get('editCharm').onclick();assert.equal(elements.get('charmDialog').open,true);
 assert.match(elements.get('fixedEquipment').innerHTML,/最多新增正面词条/);
 const searchSkill=(index,query)=>{elements.get('charmSkillSearch'+index).value=query;elements.get('charmFields').oninput({target:{dataset:{charmSkillSearch:String(index)}}});};
 const firstSkillOptions=elements.get('charmSkill0').innerHTML;
 searchSkill(0,'攻击');assert.match(elements.get('charmSkill0').innerHTML,/>攻击<\/option>/);assert.equal(elements.get('charmSkill0').value,'0');assert.equal(elements.get('charmSkill1').innerHTML,firstSkillOptions.replace('请选择技能','无第二技能'));
 searchSkill(0,'攻');assert.equal(elements.get('charmSkill0').value,'0');
 searchSkill(0,'Critical Eye');assert.match(elements.get('charmSkill0').innerHTML,/看破/);assert.equal(elements.get('charmSkill0').value,'5');assert.ok(!elements.get('charmSkill0').innerHTML.includes('>攻击<'));
 searchSkill(1,'  cRiTiCaL eYe  ');assert.match(elements.get('charmSkill1').innerHTML,/看破/);assert.equal(elements.get('charmSkill1').value,'5');
 searchSkill(0,'不存在的技能');assert.match(elements.get('charmSkill0').innerHTML,/没有匹配技能/);assert.equal(elements.get('charmSkill0').value,'');assert.equal(elements.get('saveCharm').disabled,true);
 const beforeInvalidCharm=getState();elements.get('saveCharm').onclick();assert.deepEqual(getState(),beforeInvalidCharm);assert.equal(elements.get('charmDialog').open,true);
 searchSkill(0,'');assert.equal((elements.get('charmSkill0').innerHTML.match(/<option /g)||[]).length,data.skills.length+1);assert.equal(elements.get('charmSkill0').value,'');assert.equal(elements.get('saveCharm').disabled,false);


 for(let i=0;i<2;i++){elements.get('charmSkill'+i).value=solution.charm.skills[i]?String(solution.charm.skills[i].skill_id):'';elements.get('charmLevel'+i).value=String(solution.charm.skills[i]?.level||1);}
 for(let i=0;i<3;i++)elements.get('charmSlot'+i).value=String(solution.charm.slots[i]||0);
 elements.get('saveCharm').onclick();assert.equal(elements.get('charmDialog').open,false);assert.deepEqual(getState().options.fixedCharm.skills,solution.charm.skills);
 elements.get('searchMode').value='time';elements.get('searchMode').onchange();assert.equal(elements.get('limit').disabled,true);assert.equal(getState().options.searchMode,'time');
 vm.runInContext("lockResult(0)",ctx);assert.equal(Object.keys(getState().options.fixedArmors).length,5);
 vm.runInContext("found=Array.from({length:12},(_,i)=>({...fixtureSolution,defense:500+i,skillAdds:i,skillAddCost:36-i*3}));renderResults();",ctx);assert.equal(elements.get('resultCount').textContent,12);assert.equal((elements.get('results').innerHTML.match(/<article /g)||[]).length,8);
 elements.get('nextResults').onclick();assert.equal((elements.get('results').innerHTML.match(/<article /g)||[]).length,4);assert.match(elements.get('resultPageInfo').textContent,/2 \/ 2/);
 elements.get('resultSort').value='skillsAsc';elements.get('resultSort').onchange();assert.equal(vm.runInContext('found[0].skillAdds',ctx),0);assert.match(elements.get('resultPageInfo').textContent,/1 \/ 2/);
 elements.get('resultSort').value='skillCostAsc';elements.get('resultSort').onchange();assert.equal(vm.runInContext('found[0].skillAddCost',ctx),3);assert.match(elements.get('results').innerHTML,/新增技能cost/);
 elements.get('resultSort').value='skillCostDesc';elements.get('resultSort').onchange();assert.equal(vm.runInContext('found[0].skillAddCost',ctx),36);
 await elements.get('share').onclick();assert.equal(JSON.parse(clipboard).request.options.resultSort,'skillCostDesc');

 // Sorting the visible list must not move the canonical fallback or change its summary.
 const atoms=[[144,1,0,16],[124,2,1],[89,-2,1],[99,-2,1],[109,-2,1],[69,1,0],[76,12,2]].map(([atomId,value,valueIndex,skillId],i)=>({atomId,value,valueIndex,count:1,...(skillId==null?{}:{skillId}),...(i===6?{fallback:true}:{})}));
 const piece=E.evaluateArmor(data,{...request,options:{...request.options,defenseFallback:true}},{id:'Head:502',atoms});
 ctx.sortedDisplayResult={...solution,pieces:[piece,...solution.pieces.slice(1)]};const snapshot=JSON.stringify(ctx.sortedDisplayResult);
 vm.runInContext('found=[sortedDisplayResult];activeRequest=fixtureRequest;renderResults();',ctx);
 const rendered=elements.get('results').innerHTML,list=rendered.match(/<div class="augment-list">(.*?)<\/div>/)[1];
 assert.ok(list.indexOf('防御 +1<')<list.indexOf('防御兜底 · 防御 +12'));
 assert.ok(list.indexOf('防御兜底 · 防御 +12')<list.indexOf('火耐性'));
 assert.ok(list.indexOf('冰耐性')<list.indexOf(data.skills.find(s=>s.id===16).name));
 assert.match(rendered,/自由 6 \/ 6条 · 兜底前预算 10 → 0 · 末条防御 \+12/);
 assert.equal(JSON.stringify(ctx.sortedDisplayResult),snapshot);

 // Template equipment and augmentation locks are independent, too.
 ctx.fixtureLockTemplate=structuredClone(template);ctx.fixtureLockTemplate.inventoryList[1].CustomEnable=false;ctx.fixtureLockTemplate.inventoryList[1].IdVal=M.equipmentToGame('Head:502');ctx.fixtureLockTemplate.backupList[1].IdVal=ctx.fixtureLockTemplate.inventoryList[1].IdVal;
 vm.runInContext('modTemplate=fixtureLockTemplate;openTemplateLocks();',ctx);assert.match(elements.get('templateLockChoices').innerHTML,/data-template-augment="head"/);
 elements.get('templateLockChoices').querySelectorAll=()=>[{dataset:{templatePart:'head'}}];elements.get('applyTemplateLocks').onclick();
 assert.deepEqual(getState().options.fixedArmors.head,{id:'Head:502'},elements.get('templateLocksError').textContent);
 vm.runInContext('openTemplateLocks();',ctx);elements.get('templateLockChoices').querySelectorAll=()=>[{dataset:{templatePart:'head'}},{dataset:{templateAugment:'head'}}];elements.get('applyTemplateLocks').onclick();assert.deepEqual(getState().options.fixedArmors.head.atoms,[]);
 const ordinaryIds=JSON.parse(vm.runInContext("JSON.stringify(atomChoices(data.armors.find(a=>a.id==='Head:502')).map(c=>c.atom.atomId))",ctx));assert.ok(!ordinaryIds.some(id=>[61,70,71,72].includes(id)));

 // Importing a share code restores the actual result immediately and preserves the Mod template.
 const shared=await S.encode(data,request,solution),savedTemplate=vm.runInContext('JSON.stringify(modTemplate)',ctx);
 elements.get('importPlan').onclick();assert.equal(elements.get('planDialog').open,true);elements.get('planText').value=shared.token;await elements.get('applyPlan').onclick();
 assert.equal(elements.get('planDialog').open,false);assert.equal(elements.get('resultCount').textContent,1);assert.equal(getState().weaponId,solution.weaponId);assert.equal(Object.keys(getState().options.fixedArmors).length,5);
 assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(found[0].placement)',ctx)),solution.placement);assert.equal(vm.runInContext('JSON.stringify(modTemplate)',ctx),savedTemplate);assert.match(elements.get('results').innerHTML,/data-share-image="0"/);
 const importedState=getState();assert.equal(elements.get('rampageSelect').value,'-1');
 elements.get('rampageSearch').value='护刃';elements.get('rampageSearch').oninput();assert.equal(getState().rampageDecorationId,1048579);assert.equal(elements.get('rampageSelect').value,'1048579');assert.ok(!elements.get('rampageSelect').innerHTML.includes('属痛'));
 assert.equal(vm.runInContext('activeRequest.rampageDecorationId',ctx),1048579);assert.match(elements.get('results').innerHTML,/百龙珠：护刃龙珠/);
 const newShare=await S.encode(data,JSON.parse(vm.runInContext('JSON.stringify(activeRequest)',ctx)),solution);assert.equal((await S.decode(data,newShare.token)).request.rampageDecorationId,1048579);
 elements.get('rampageSearch').value='没有这个珠';elements.get('rampageSearch').oninput();assert.equal(elements.get('rampageSelect').disabled,true);assert.equal(getState().rampageDecorationId,1048579);
 elements.get('rampageSearch').value='';elements.get('rampageSearch').oninput();assert.equal(getState().rampageDecorationId,1048579);elements.get('rampageSelect').value='0';elements.get('rampageSelect').onchange();assert.equal(getState().rampageDecorationId,0);assert.equal(vm.runInContext('activeRequest.rampageDecorationId',ctx),0);
 // Switching to a smaller native hole clears the unavailable jewel, while old results retain theirs.
 elements.get('rampageSelect').value=String(template.backupList[0].HyakuryuDecoId);elements.get('rampageSelect').onchange();elements.get('weaponSelect').value='Bow:304';elements.get('weaponSelect').onchange();assert.equal(getState().rampageDecorationId,0);assert.match(elements.get('toast').textContent,/已改为空置/);assert.equal(vm.runInContext('activeRequest.rampageDecorationId',ctx),template.backupList[0].HyakuryuDecoId);
 elements.get('planText').value=shared.token;await elements.get('applyPlan').onclick();assert.deepEqual(getState(),importedState);
 const beforeBadPlan=getState();elements.get('importPlan').onclick();elements.get('planText').value='SBF1:invalid';await elements.get('applyPlan').onclick();assert.equal(elements.get('planDialog').open,true);assert.deepEqual(getState(),beforeBadPlan);assert.ok(elements.get('planError').textContent);

 // The share action snapshots the displayed result, previews PNG, downloads and copies its code.
 elements.get('planDialog').close();ctx.ForgeShare={...S,renderImage:()=>({canvas:{toBlob:callback=>callback(new Blob(['png-test'],{type:'image/png'}))},width:1920,height:2600})};
 const beforeImages=downloads.length;await vm.runInContext('shareResult(0)',ctx);assert.equal(elements.get('shareImageDialog').open,true);assert.equal(elements.get('downloadShareImage').disabled,false);assert.match(elements.get('sharePlanCode').value,/^SBF1:/);assert.match(elements.get('shareImagePreview').src,/^blob:/);
 elements.get('downloadShareImage').onclick();assert.equal(downloads.length,beforeImages+1);assert.match(downloads.at(-1).filename,/^sunbreak-plan-[a-f0-9]{16}\.png$/);assert.equal(downloads.at(-1).blob.type,'image/png');await elements.get('copyPlanCode').onclick();assert.equal(clipboard,elements.get('sharePlanCode').value);
 elements.get('shareImageDialog').onclose();assert.equal(elements.get('shareImagePreview').src,'');ctx.ForgeShare=S;
 elements.get('importPlan').onclick();ctx.fixturePlanJson={name:'loadout.json',type:'application/json',size:100,text:async()=>JSON.stringify({...C.payload(data,request),result:solution})};await vm.runInContext('readPlanFile(fixturePlanJson)',ctx);assert.match(elements.get('planFileStatus').textContent,/已识别并校验/);await elements.get('applyPlan').onclick();assert.equal(elements.get('planDialog').open,false);

 // Inventory page, owned mode, native JSON import and dedicated Mod export use actual instances.
 const I=require('../dist/inventory.js'),inv=require('./inventory-fixture.cjs').fixture();
 ctx.inventoryFileFixture={size:JSON.stringify(inv.raw).length,text:async()=>JSON.stringify(inv.raw)};
 await vm.runInContext('importInventoryFile(inventoryFileFixture)',ctx);
 elements.get('inventoryTab').onclick();assert.equal(elements.get('plannerPage').classList.contains('hidden'),true);assert.match(elements.get('inventorySummary').textContent,/防具 5/);assert.equal(elements.get('inventoryWeaponCount').textContent,'1');assert.equal(elements.get('inventoryArmorCount').textContent,'5');assert.equal(elements.get('inventoryCharmCount').textContent,'1');assert.equal(elements.get('inventoryConnection').textContent,'已载入本机库存');assert.match(elements.get('inventoryCategories').innerHTML,/data-inventory-kind="charm"/);
 elements.get('inventoryKind').value='armor';elements.get('inventorySearch').value=inv.stock.entries.find(e=>e.kind==='armor').name;elements.get('inventorySearch').oninput();assert.equal((elements.get('inventoryList').innerHTML.match(/<article /g)||[]).length,1);assert.match(elements.get('inventoryList').innerHTML,/augment-list/);assert.match(elements.get('inventoryList').innerHTML,/既有炼化/);
 elements.get('inventorySearch').value='';elements.get('inventoryCategories').onclick({target:{closest:()=>({dataset:{inventoryKind:'charm'}})}});assert.equal(elements.get('inventoryKind').value,'charm');assert.equal((elements.get('inventoryList').innerHTML.match(/<article /g)||[]).length,1);assert.match(elements.get('inventoryList').innerHTML,/实际孔位/);
 elements.get('inventorySearch').value='不存在的装备名称';elements.get('inventorySearch').oninput();assert.match(elements.get('inventoryList').innerHTML,/没有找到符合条件/);elements.get('inventorySearch').value='';elements.get('inventorySearch').oninput();
 elements.get('inventoryCategories').onclick({target:{closest:()=>({dataset:{inventoryKind:'weapon'}})}});assert.ok(!elements.get('inventorySort').innerHTML.includes('value="defense"'));assert.match(elements.get('inventorySort').innerHTML,/value="rarity"/);elements.get('inventorySort').value='rarity';elements.get('inventorySortDirection').value='desc';elements.get('inventorySortDirection').onchange();assert.equal(elements.get('inventorySortDirection').value,'desc');
 elements.get('inventoryCategories').onclick({target:{closest:()=>({dataset:{inventoryKind:'armor'}})}});assert.match(elements.get('inventorySort').innerHTML,/value="defense"/);assert.match(elements.get('inventorySort').innerHTML,/value="rarity"/);
 elements.get('useInventory').onclick();assert.equal(getState().options.ownedOnly,true);assert.equal(getState().ownedWeaponKey,'equipment:0');assert.ok(!elements.get('ownedWeaponSelect').innerHTML.includes('强化 0'));assert.match(elements.get('ownedWeaponSelect').innerHTML,/炼化/);assert.equal(elements.get('rampageSelect').disabled,true);assert.equal(elements.get('plannerPage').classList.contains('hidden'),false);
 const ownedResult=I.validateResult(data,inv.stock,inv.q,{weaponId:inv.q.weaponId,decorations:[],owned:{version:1,inventoryId:inv.stock.id,weapon:I.reference(inv.stock.byKey.get('equipment:0')),armors:Object.fromEntries(inv.stock.entries.filter(e=>e.kind==='armor').map(e=>[e.base.part,I.reference(e)])),charm:I.reference(inv.stock.byKey.get('equipment:7'))}});
 elements.get('importPlan').onclick();elements.get('planText').value=JSON.stringify({...C.payload(data,inv.q),result:ownedResult});await elements.get('applyPlan').onclick();assert.equal(elements.get('planDialog').open,false);assert.equal(getState().ownedArmorKeys.head,'equipment:1');assert.match(elements.get('results').innerHTML,/珠子库存校验通过/);assert.match(elements.get('results').innerHTML,/箱位 2/);
 vm.runInContext('exportMod(0)',ctx);elements.get('ownedExportSlot').value='224';elements.get('modExportName').value='已有实例配装';elements.get('confirmModExport').onclick();assert.match(downloads.at(-1).filename,/^owned_224_/);const ownedPayload=JSON.parse(await downloads.at(-1).blob.text());assert.equal(ownedPayload.application,I.PLAN);assert.equal(ownedPayload.inventoryList,undefined);assert.equal(ownedPayload.references[1].index,1);
 // Sharing an owned result yields a self-contained preset, readable after clearing local inventory.
 ctx.ForgeShare={...S,renderImage:()=>({canvas:{toBlob:callback=>callback(new Blob(['owned-share'],{type:'image/png'}))},width:1920,height:2600})};await vm.runInContext('shareResult(0)',ctx);assert.equal(elements.get('downloadShareImage').disabled,false);const portable=await S.decode(data,elements.get('sharePlanCode').value);assert.equal(portable.request.options.ownedOnly,false);assert.equal(portable.result.owned,undefined);assert.deepEqual(portable.result.totals,ownedResult.totals);elements.get('shareImageDialog').onclose();ctx.ForgeShare=S;

 // A condition from another inventory must not silently bind to matching box numbers.
 const beforeForeign=getState(),foreign=C.payload(data,{...inv.q,ownedInventoryId:'SBFI1-Another-1'});
 elements.get('importConfig').onclick();elements.get('configText').value=JSON.stringify(foreign);elements.get('applyConfig').onclick();
 assert.equal(elements.get('configDialog').open,true);assert.match(elements.get('configError').textContent,/另一份库存/);assert.deepEqual(getState(),beforeForeign);
 elements.get('configDialog').close();
 // Restoring mismatched saved conditions leaves the original inventory identity intact and search disabled.
 vm.runInContext("state.ownedInventoryId='SBFI1-Another-1';renderWeapons();setBusy(false);",ctx);
 assert.equal(getState().ownedInventoryId,'SBFI1-Another-1');assert.equal(elements.get('solve').disabled,true);assert.match(elements.get('ownedWeaponSelect').innerHTML,/不匹配/);
 ctx.validOwnedConditions=beforeForeign;vm.runInContext('state=ForgeConfig.normalize(data,validOwnedConditions);renderWeapons();',ctx);
 elements.get('clearCharm').onclick();assert.equal(getState().ownedCharmKey,undefined);elements.get('clearInventory').onclick();await new Promise(resolve=>setImmediate(resolve));assert.equal(getState().options.ownedOnly,false);
 elements.get('importPlan').onclick();elements.get('planText').value=portable.token;await elements.get('applyPlan').onclick();assert.equal(elements.get('planDialog').open,false);assert.equal(getState().options.ownedOnly,false);assert.equal(getState().options.presetEquipment,true);assert.equal(getState().ownedInventoryId,undefined);assert.match(elements.get('results').innerHTML,/预设装备/);
 vm.runInContext('exportMod(0)',ctx);elements.get('ownedExportSlot').value='223';elements.get('confirmModExport').onclick();assert.match(downloads.at(-1).filename,/^223_/);const portableMod=JSON.parse(await downloads.at(-1).blob.text());assert.equal(portableMod.inventoryList.length,8);assert.equal(portableMod.references,undefined);


});
