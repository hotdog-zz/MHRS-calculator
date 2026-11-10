const {test,before}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const E=require('../dist/engine.js'),C=require('../dist/config.js');let highs;
before(async()=>{highs=await require('../dist/vendor/highs.js')({locateFile:f=>path.resolve(__dirname,'../dist/vendor',f)});});
const none={id:'none',empty:true,skills:[],slots:[]};
function fixture(){return {skills:[{id:0,name:'目标',max:7,cost:3}],weapons:[{id:'weapon',slots:[],defense:0}],armors:E.PARTS.map(part=>({id:part,name:part,part,rank:'Master',sex:'Both',defense:100,resistances:{},skills:[],slots:[],pool:0,budget:0})),atoms:[],decorations:[{id:'small',slot:1,skills:[{skill_id:0,level:1}]}],fixedCharms:[]};}
const query=()=>({weaponId:'weapon',skills:[{id:0,level:1}],options:{searchMode:'time',resultSort:'unusedSlotsDesc',noCharm:true,augment:false,seconds:3,limit:1}});
function solve(d,q=query(),charms=[none]){const model=E.buildModel(d,q,d.armors,charms),raw=highs.solve(model.lp.text(),{output_flag:false,time_limit:2});assert.equal(raw.Status,'Optimal');const result=E.validateResult(d,q,E.reconstruct(model,raw,d,q));assert.ok(E.modelSeed(d,model,result),'occupied holes must round-trip in the solver seed');return {model,result};}
test('排序及显示共用孔等级总和，孔个数和已占用孔的等级差不计入',()=>{
 assert.equal(E.unusedSlotScore({unusedSlots:[4,1,1]}),6);assert.equal(E.unusedSlotScore({unusedSlots:[]}),0);
 const a={defense:500,records:0,armors:[],unusedSlots:[4]},b={...a,defense:1000,unusedSlots:[1,1,1]};assert.ok(E.compareResults(a,b,'unusedSlotsDesc')<0);assert.ok(E.compareResults(a,b,'defense')>0);assert.ok(E.compareResults(a,{...a,defense:501},'unusedSlotsDesc')>0);
 const placement=E.packDecorations([{id:'weapon',slots:[4]}],[{d:{id:'small',slot:1},count:1}]);assert.equal(E.unusedSlotScore({unusedSlots:placement.filter(p=>!p.decorationId).map(p=>p.level)}),0);
});
test('新排序可通过条件复制、导入和本地存储正常往返',()=>{
 const d=fixture(),q=query();assert.equal(C.normalize(d,C.payload(d,q)).options.resultSort,'unusedSlotsDesc');
 const html=require('node:fs').readFileSync(path.resolve(__dirname,'../dist/index.html'),'utf8');assert.match(html,/<option value="unusedSlotsDesc">空余孔位等级总和从大到小<\/option>/);
});
test('限时目标按整孔占用选择低防御的3-1，而不是高防御单4孔',()=>{
 const d=fixture(),q=query();d.armors[0].slots=[4];d.armors[0].defense=900;d.armors.push({...d.armors[0],id:'efficient',defense:100,slots:[3,1]});
 const {result,model}=solve(d,q);assert.equal(result.pieces.find(p=>p.part==='head').id,'efficient');assert.deepEqual(result.unusedSlots,[3]);assert.equal(model.slotUsage.length,4);
 q.options.resultSort='defense';assert.equal(solve(d,q).result.pieces.find(p=>p.part==='head').id,'head');
});
test('珠子组合也直接优化空孔，优先两颗1级珠保留4级孔',()=>{
 const d=fixture(),q=query();d.armors[0].slots=[4,1,1];q.skills[0].level=2;d.decorations.push({id:'big',slot:4,skills:[{skill_id:0,level:2}]});
 const {result}=solve(d,q);assert.deepEqual(result.decorations,[{id:'small',count:2}]);assert.deepEqual(result.unusedSlots,[4]);
});
test('4级珠必须占4级孔；目标不会把低级孔充当高级孔',()=>{
 const d=fixture(),q=query();d.armors[0].slots=[4,3,1];d.skills.push({id:1,name:'另一目标',max:1,cost:3});q.skills.push({id:1,level:1});d.decorations.push({id:'four',slot:4,skills:[{skill_id:1,level:1}]});
 const {result}=solve(d,q);assert.deepEqual(result.unusedSlots,[3]);assert.equal(result.placement.find(p=>p.decorationId==='four').level,4);
});
test('武器、护石、固定炼化和库存投影均按实际普通孔统计',()=>{
 for(const kind of ['weapon','charm','fixed','owned']){
  const d=fixture(),q=query();let charms=[none];
  if(kind==='weapon')d.weapons[0].slots=[4,1];
  else if(kind==='charm'){q.options.noCharm=false;charms=[{id:'test',skills:[{skill_id:0,level:1}],slots:[4,1]}];d.armors[0].skills=[{skill_id:0,level:1}];d.melding={};}
  else{d.armors[0].slots=[4,1];if(kind==='fixed')q.options.fixedArmors={head:{id:'head',atoms:[]}};else d.armors[0].ownedMetrics={skillAdds:0,skillAddCost:0};}
  // Use the fixed, validated special charm route for this synthetic data.
  if(kind==='charm'){charms[0].fixed=true;d.fixedCharms=[{...charms[0]}];}
  const {result}=solve(d,q,charms);assert.equal(E.unusedSlotScore(result),kind==='charm'?5:4,kind);
 }
});
test('限时空孔目标能主动炼化扩孔，固定炼化保留原值',()=>{
 const d=fixture(),q=query();q.options.augment=true;d.armors[1].skills=[{skill_id:0,level:1}];d.armors[0].pool=1;d.armors[0].budget=18;d.atoms=[{pool:1,id:139,category:19,cost:6,values:[{value:1,value_index:0,weight:100}]},{pool:1,id:141,category:19,cost:18,values:[{value:3,value_index:0,weight:100}]}];
 assert.equal(E.unusedSlotScore(solve(d,q).result),3);
 q.options.fixedArmors={head:{id:'head',atoms:[{atomId:139,value:1,count:1}]}};assert.equal(E.unusedSlotScore(solve(d,q).result),1);
});
test('真实持久搜索与文本求解器输出相同最优空孔分数',async()=>{
 const d=fixture(),q=query();d.armors[0].slots=[4];d.armors[0].defense=900;d.armors.push({...d.armors[0],id:'efficient',defense:100,slots:[3,1]});
 for(const solver of [highs,{solve:highs.solve.bind(highs)}]){const response=await E.search(d,q,solver);assert.equal(response.status,'feasible');assert.equal(response.results[0].pieces.find(p=>p.part==='head').id,'efficient');assert.equal(E.unusedSlotScore(response.results[0]),3);}
});
test('已有装备模式保持库存炼化与索引，按同一空孔总和进行限时优化',async()=>{
 const D=require('../dist/data.json'),I=require('../dist/inventory.js'),{fixture}=require('./inventory-fixture.cjs'),{stock,q}=fixture();q.options.searchMode='time';q.options.resultSort='unusedSlotsDesc';q.options.seconds=3;
 const response=await I.search(D,q,highs,()=>{},{},stock);assert.equal(response.status,'feasible');const r=response.results[0];assert.equal(r.owned.inventoryId,stock.id);assert.deepEqual(r.pieces.map(p=>p.atoms),stock.entries.filter(e=>e.kind==='armor').map(e=>e.armor.atoms));assert.equal(E.unusedSlotScore(r),r.placement.filter(p=>!p.decorationId).reduce((n,p)=>n+p.level,0));
});
