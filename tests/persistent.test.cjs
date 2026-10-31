const {test,before}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const E=require('../dist/engine.js');let highs;
before(async()=>{highs=await require('../dist/vendor/highs.js')({locateFile:f=>path.resolve(__dirname,'../dist/vendor',f)});});
function fixture(headCount=2){
 const armor=(part,id,defense)=>({id,name:id,part,rank:'Master',sex:'Both',defense,resistances:{fire:0,water:0,thunder:0,ice:0,dragon:0},skills:part==='chest'?[{skill_id:0,level:1}]:[],slots:[],pool:0,budget:0});
 return {skills:[{id:0,name:'目标',max:7,cost:3}],weapons:[{id:'weapon',slots:[],defense:0}],armors:[...Array.from({length:headCount},(_,i)=>armor('head','h'+String(i).padStart(2,'0'),100+i)),...E.PARTS.slice(1).map(p=>armor(p,p,100))],atoms:[],decorations:[],fixedCharms:[]};
}
function measured(){const calls={create:0,dispose:0,rows:0,seed:0,run:0};return {calls,solver:{...highs,createModel(source){calls.create++;const m=highs.createModel(source);for(const [name,key] of [['dispose','dispose'],['addRows','rows'],['setSolution','seed'],['run','run']]){const original=m[name].bind(m);m[name]=(...args)=>{calls[key]++;return original(...args);};}return m;}}};}
test('多个配装在同一持久模型增量加入排除条件，最终销毁模型',async()=>{
 const d=fixture(),q={weaponId:'weapon',skills:[{id:0,level:1}],options:{seconds:5,limit:3,noCharm:true}},m=measured();
 const r=await E.search(d,q,m.solver);assert.equal(r.results.length,2);assert.equal(m.calls.create,1);assert.ok(m.calls.rows>=2);assert.equal(m.calls.dispose,1);assert.ok(m.calls.run>=3);
});
test('扩展候选范围时提供经过逐约束验证的初始解，并保留全范围最优结果',async()=>{
 const d=fixture(30),q={weaponId:'weapon',skills:[{id:0,level:1}],options:{seconds:3,limit:1,noCharm:true,searchMode:'time',resultSort:'defense'}},m=measured();
 const r=await E.search(d,q,m.solver);assert.ok(r.results.length);assert.equal(r.results[0].defense,530);assert.ok(m.calls.create>=2);assert.ok(m.calls.seed>=1);assert.equal(m.calls.create,m.calls.dispose);
});
test('持久稀疏矩阵与兼容LP文本路径保留同样的可行域及防御最优值',async()=>{
 const d=fixture(4),q={weaponId:'weapon',skills:[{id:0,level:1}],options:{seconds:3,limit:1,noCharm:true,searchMode:'time',resultSort:'defense'}};
 const a=await E.search(d,q,highs),b=await E.search(d,q,{solve:highs.solve.bind(highs)});
 assert.equal(a.results[0].defense,b.results[0].defense);assert.deepEqual(a.results.map(r=>r.defense).sort(),b.results.map(r=>r.defense).sort());
});
