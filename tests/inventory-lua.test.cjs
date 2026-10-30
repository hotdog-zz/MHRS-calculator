const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const I=require('../dist/inventory.js'),data=require('../dist/data.json'),template=require('./mod-template.json'),{fixture}=require('./inventory-fixture.cjs');
const lua=process.env.FORGE_LUA;
function literal(v){if(v===null||v===undefined)return 'nil';if(Array.isArray(v))return '{'+v.map(literal).join(',')+'}';if(typeof v==='object')return '{'+Object.entries(v).map(([k,x])=>'['+literal(k)+']='+literal(x)).join(',')+'}';return JSON.stringify(v);}
function verifyLua(makeCase){
 const {stock,q}=makeCase();const E=require('../dist/engine.js');const pieces=stock.entries.filter(e=>e.kind==='armor'),r=I.validateResult(data,stock,q,{weaponId:q.weaponId,owned:{version:1,inventoryId:stock.id,weapon:I.reference(stock.byKey.get(q.ownedWeaponKey)),armors:Object.fromEntries(pieces.map(e=>[e.base.part,I.reference(e)])),charm:I.reference(stock.byKey.get('equipment:7'))},decorations:[]});const plan=I.exportPlan(data,stock,template,r,q,{name:'库存模拟'}).payload;
 const source=fs.readFileSync(path.resolve(__dirname,'../dist/EquipmentLoadoutsManager.lua'),'utf8'),staticData=JSON.parse(source.match(/local OWNED_STATIC = json.load_string\(\[\[([\s\S]*?)\]\]\)/)[1]);
 const temp=fs.mkdtempSync(path.join(__dirname,'.lua-inventory-'));try{
 const script=`local RAW=${literal(stock.raw)}\nlocal STATIC=${literal(staticData)}\nlocal ORIGINAL=${literal(plan)}\nlocal SOURCE=${literal(path.resolve(__dirname,'../dist/EquipmentLoadoutsManager.lua'))}\n`+fs.readFileSync(path.resolve(__dirname,'inventory-game-mock.lua'),'utf8');
 fs.writeFileSync(path.join(temp,'test.lua'),script);const out=spawnSync(lua,[path.join(temp,'test.lua')],{encoding:'utf8',timeout:30000});assert.equal(out.status,0,out.stdout+'\n'+out.stderr);assert.match(out.stdout,/OWNED_LUA_OK/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}

test('真实 Lua 运行时模拟：只读导出、已有绑定与拒绝路径不写装备箱',{skip:!lua},()=>verifyLua(fixture));
test('真实 Lua 运行时模拟：已有孔位溢出仍能绑定444装备，不改写原炼化',{skip:!lua},()=>verifyLua(()=>{
 const f=fixture(),M=require('../dist/mod.js'),raw=structuredClone(f.raw),row=raw.items.find(r=>r.item.IdType===2);
 row.item.IdVal=M.equipmentToGame('Head:502');row.item.CustomEnable=true;row.item.CustomBuildup=[...Array.from({length:3},()=>({Id:149,SkillId:112,ValueIndex:0})),...Array.from({length:2},()=>({Id:141,SkillId:0,ValueIndex:0})),{Id:73,SkillId:0,ValueIndex:2},{Id:69,SkillId:0,ValueIndex:0}];row.fingerprint=I.fingerprint(row.item);
 const stock=I.parse(data,raw),other=stock.entries.find(e=>e.kind==='armor'&&e.base.part!=='head'&&e.skills.length),q={...f.q,skills:[{id:other.skills[0].skill_id,level:1}]};
 assert.equal(stock.byKey.get('equipment:'+row.index).usable,true);return {stock,q};
}));
