const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../dist/data.json'),E=require('../dist/engine.js'),I=require('../dist/inventory.js'),S=require('../dist/share.js'),{fixture}=require('./inventory-fixture.cjs');
function primordial(){
 const pieces=E.PARTS.map(part=>D.armors.find(a=>a.part===part&&a.name.startsWith('原初'))),weapon=D.weapons.find(w=>w.defense>0),request={weaponId:weapon.id,skills:[{id:200,level:3}],options:{augment:true,deleteSkills:true,noCharm:true,sex:'FemaleOnly',defenseFallback:false}};
 const raw={weaponId:weapon.id,armors:pieces.map((a,i)=>({id:a.id,atoms:i?[]:[{atomId:69,value:1,valueIndex:0,count:1},{atomId:90,value:-3,valueIndex:0,count:1},{atomId:104,value:2,valueIndex:1,count:1}]})),charm:{id:'none',empty:true,skills:[],slots:[]},decorations:[]};
 return {weapon,request,raw,result:E.validateResult(D,request,raw)};
}
test('最终强化表完整覆盖1376件防具，并保留不同装备的各自上限',()=>{
 assert.equal(D.armors.length,1376);for(const a of D.armors){assert.ok(Number.isInteger(a.maxUpgradeLevel)&&a.maxUpgradeLevel>=1,a.id);assert.ok(Number.isInteger(a.maxDefense)&&a.maxDefense>=a.defense,a.id);assert.ok(Number.isInteger(a.seriesId)&&a.seriesId>=0,a.id);}
 for(const [id,level,defense]of [['Head:502',29,181],['Head:0',34,67],['Head:457',4,72],['Head:190',4,36]]){const a=D.armors.find(a=>a.id===id);assert.equal(a.maxUpgradeLevel,level);assert.equal(a.maxDefense,defense);}
});
test('同系列0到5件分别按0/0/0/1/2/3全耐性计算，系列0不被忽略',()=>{
 for(let count=0;count<=5;count++){
  const armors=E.PARTS.map((part,i)=>({id:part,part,seriesId:i<count?0:i+10,defense:100,maxDefense:150,resistances:{fire:-1,water:2,thunder:0,ice:3,dragon:-4}})),pieces=armors.map(a=>({...a,finalDefense:102,finalResistances:a.resistances}));
  const s=E.equipmentStats({armors,weapons:[]},{pieces}),bonus=[0,0,0,1,2,3][count];assert.equal(s.seriesResistanceBonus,bonus);assert.deepEqual(s.resistances,{fire:-5+bonus,water:10+bonus,thunder:bonus,ice:15+bonus,dragon:-20+bonus});assert.equal(s.maxDefense,761);
 }
});
test('按真实系列ID而非装备ID或名称分组；缺少系列信息不推测加成',()=>{
 const set=E.PARTS.map((part,i)=>D.armors.find(a=>a.part===part&&a.id.split(':')[1]===String(64+i%2))),pieces=set.map(a=>({...a,finalDefense:a.defense,finalResistances:a.resistances}));assert.equal(pieces.length,5);assert.ok(new Set(pieces.map(p=>p.id.split(':')[1])).size>1);assert.equal(E.equipmentStats(D,{pieces}).seriesResistanceBonus,3);
 const mixed=E.PARTS.map((part,i)=>D.armors.find(a=>a.part===part&&a.seriesId===[0,1,300,0,1][i]));assert.equal(E.equipmentStats(D,{pieces:mixed.map(a=>({...a,finalDefense:a.defense,finalResistances:a.resistances}))}).seriesResistanceBonus,0);
 const unknown={...D,armors:D.armors.map(a=>({...a,seriesId:undefined}))};assert.equal(E.equipmentStats(unknown,{pieces}).seriesResistanceBonus,0);
});
test('满强化防御包含武器原生加成与炼化；五种基础耐性按含炼化及同系列加成的整套值计算',()=>{
 const {weapon,request,raw,result}=primordial();assert.equal(result.defense,1+625+1+weapon.defense);assert.equal(result.maxDefense,1+905+1+weapon.defense);
 assert.deepEqual(result.resistances,{fire:-10,water:15,thunder:13,ice:-2,dragon:-22});assert.equal(result.seriesResistanceBonus,3);
 assert.equal(E.validateResult(D,request,{...raw,maxDefense:999999,resistances:{fire:9999}}).maxDefense,result.maxDefense);
 const stats=E.equipmentStats({...D,armors:D.armors.map(a=>({...a,maxDefense:undefined}))},result);assert.equal(stats.maxDefense,null);assert.deepEqual(stats.resistances,result.resistances);
});
test('已有装备与可移植预设按相同上限显示，且不改库存强化数据',()=>{
 const {raw,stock,q}=fixture(),before=JSON.stringify(raw),weapon=stock.byKey.get('equipment:0'),armors=stock.entries.filter(e=>e.kind==='armor'),charm=stock.byKey.get('equipment:7');
 const result=I.validateResult(D,stock,q,{weaponId:q.weaponId,owned:{version:1,inventoryId:stock.id,weapon:I.reference(weapon),armors:Object.fromEntries(armors.map(e=>[e.base.part,I.reference(e)])),charm:I.reference(charm)},decorations:[]});
 assert.equal(result.maxDefense,1+weapon.base.defense+armors.reduce((n,e)=>n+e.base.maxDefense+e.armor.finalDefense-e.base.defense,0));
 const portable=I.shareable(D,q,result);assert.equal(result.defense,1+weapon.base.defense+armors.reduce((n,e)=>n+e.armor.finalDefense,0));assert.equal(portable.result.defense,result.defense);assert.equal(portable.result.maxDefense,result.maxDefense);assert.deepEqual(portable.result.resistances,result.resistances);assert.equal(JSON.stringify(raw),before);
});
test('旧方案JSON和二维码恢复会重新计算展示数值，分享图包含新指标且不遮挡装备',async()=>{
 const {request,raw,result}=primordial(),shared=await S.encode(D,request,raw),decoded=await S.decode(D,shared.token);assert.equal(decoded.result.maxDefense,result.maxDefense);assert.deepEqual(decoded.result.resistances,result.resistances);
 const lib=require('@napi-rs/canvas'),texts=[],createCanvas=(w,h)=>{const canvas=lib.createCanvas(w,h),context=canvas.getContext('2d'),fill=context.fillText.bind(context);context.fillText=(s,...args)=>{texts.push({text:s,x:args[0],y:args[1]});return fill(s,...args);};return canvas;};
 const image=S.renderImage(D,shared,createCanvas);assert.ok(texts.some(t=>t.text.includes('满强化防御 '+result.maxDefense)));assert.ok(texts.some(t=>t.text==='基础耐性   火 -10   水 15   雷 13   冰 -2   龙 -22'));assert.ok(texts.some(t=>t.text.includes('同系列全耐性 +3（已计入）')));assert.equal(decoded.result.seriesResistanceBonus,3);
 assert.ok(image.equipmentBounds.y>105&&image.skillBounds.y>105);assert.ok(texts.filter(t=>t.y===56||t.y===57).every(t=>t.x>=image.padding));
});
