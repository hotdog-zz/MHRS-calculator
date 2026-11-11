const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../dist/engine.js'),X=require('../dist/extensions.js');
function fixture(){
 const data={skills:[{id:0,name:'目标',max:1,cost:15},...[1,2,3].map(id=>({id,name:'D'+id,max:2,cost:3})),{id:4,name:'非D',max:1,cost:6}],weapons:[{id:'w',slots:[],defense:0}],armors:E.PARTS.map(part=>({id:part,name:part,part,sex:'Both',rank:'Master',defense:100,slots:[],skills:part==='chest'?[{skill_id:0,level:1}]:[],pool:part==='head'?1:0,budget:part==='head'?6:0,resistances:{}})),decorations:[],atoms:[{id:144,pool:1,category:20,cost:3,values:[{value:1,value_index:0,weight:100}]}],fixedCharms:[]};
 const request={weaponId:'w',skills:[{id:0,level:1}],options:{augment:true,noCharm:true,defenseFallback:false,augmentLimits:{head:2},fixedArmors:{}}};
 const make=(id=1,count=1)=>{const result=E.validateResult(data,request,{weaponId:'w',armors:data.armors.map(a=>({id:a.id,atoms:a.part==='head'?[{atomId:144,value:1,valueIndex:0,skillId:id,count}]:[]})),charm:{empty:true,skills:[],slots:[]},decorations:[]}),vector=X.vector(data,request,result,data.skills.map(s=>s.id));return {id:X.key(vector),vector,result};};
 return {data,request,make};
}
const expand=(data,q,g,ids,verify)=>[...X.substitutions(data,q,g,ids,verify)].filter(e=>!e.checkpoint);
test('只搜到一种D技能时也补全全部合法D候选，遵守关注范围与等级上限',()=>{
 const {data,request,make}=fixture(),entry=make(),before=JSON.stringify({request,entry}),ids=data.skills.map(s=>s.id),g=X.resourceGroups(data,request,[entry])[0];assert.deepEqual(g.tokens,['D']);
 const all=expand(data,request,g,ids);assert.deepEqual(new Set(all.map(e=>e.choices[0])),new Set([1,2,3]));assert.equal(all.length,3);assert.equal(JSON.stringify({request,entry}),before);for(const e of all)E.validateResult(data,request,e.result);
 assert.deepEqual(expand(data,request,g,[2]).map(e=>e.choices),[[2]]);
 data.skills[3].max=1;request.skills.push({id:3,level:1});assert.ok(!X.candidateSkills(data,request,ids,'D').includes(3));
});
test('五技能容量排除新ID，但允许提升原生技能；删除词条也参与整组校验',()=>{
 const {data,request,make}=fixture();data.skills.push(...[10,11,12,13,14].map(id=>({id,name:'原生'+id,max:2,cost:3})));data.armors[0].skills=[10,11,12,13,14].map(skill_id=>({skill_id,level:1}));const g=X.resourceGroups(data,request,[make(10)])[0],ids=data.skills.map(s=>s.id),out=expand(data,request,g,ids);assert.deepEqual(new Set(out.map(e=>e.choices[0])),new Set([10,11,12,13,14]));
 const f=fixture();f.data.armors[0].skills=[{skill_id:1,level:2}];f.data.atoms.push({id:148,pool:1,category:20,cost:-10,values:[{value:-1,value_index:0,weight:100}]});const raw=f.make(2).result;raw.armors[0].atoms.push({atomId:148,skillId:1,value:-1,valueIndex:0,count:1});const result=E.validateResult(f.data,f.request,raw),v=X.vector(f.data,f.request,result,[1,2,3]),group=X.resourceGroups(f.data,f.request,[{id:X.key(v),vector:v,result}])[0];assert.ok(expand(f.data,f.request,group,[1,2,3]).every(e=>e.choices[0]!==1));
});
test('双D联合验证，不能把分别可用的技能误拼成超过五种的组合',()=>{
 const {data,request,make}=fixture();data.skills.push(...[10,11,12,13].map(id=>({id,name:'原生'+id,max:1,cost:3})));data.armors[0].skills=[10,11,12,13].map(skill_id=>({skill_id,level:1}));const entry=make(1,2);entry.vector=X.vector(data,request,entry.result,[1,2]);const g=X.resourceGroups(data,request,[entry])[0],out=expand(data,request,g,[1,2]);assert.deepEqual(g.tokens.filter(t=>t==='D'),['D','D']);assert.deepEqual(out.filter(e=>e.choices.every(v=>v!==null)).map(e=>e.choices),[[1,1],[2,2]]);assert.ok(out.some(e=>e.choices.includes(null)));assert.ok(out.every(e=>!e.choices.includes(1)||!e.choices.includes(2)));
 assert.throws(()=>X.materialize(data,request,g.recipes[0],[1,2],[1,2]));
});
test('固定炼化不能泛化替换；同模板不同候选不占用新的资源组',()=>{
 const {data,request,make}=fixture(),a=make(1),b=make(2),frontier=[];assert.equal(X.retain(data,request,frontier,a,1),true);assert.equal(X.retain(data,request,frontier,b,1),false);assert.equal(frontier.length,1);assert.equal(expand(data,request,X.resourceGroups(data,request,frontier)[0],[1,2,3]).length,3);
 request.options.fixedArmors.head=a.result.armors[0];const fixed=X.resourceGroups(data,request,[a])[0];assert.equal(fixed.generic,false);assert.equal(fixed.recipes[0].operations.length,0);
});
test('双一孔替换按实际珠子数量校验，位置不能拆分且重复技能不超上限',()=>{
 const {data,request}=fixture();data.weapons[0].slots=[1,1];data.decorations=[1,2].map(id=>({id:'d'+id,slot:1,skills:[{skill_id:id,level:1}]}));const result=E.validateResult(data,request,{weaponId:'w',armors:data.armors.map(a=>({id:a.id,atoms:[]})),charm:{empty:true,skills:[],slots:[]},decorations:[{id:'d1',count:2}]}),v=X.vector(data,request,result,[1,2]),g=X.resourceGroups(data,request,[{id:X.key(v),vector:v,result}])[0],verify=r=>{if(r.decorations.some(d=>d.id==='d2'&&d.count))throw Error('未拥有该珠子');return E.validateResult(data,request,r);};
 const ownedChoices=expand(data,request,g,[1,2],verify);assert.deepEqual(ownedChoices.filter(e=>e.choices.every(v=>v!==null)).map(e=>e.choices),[[1,1]]);assert.ok(ownedChoices.every(e=>!e.choices.includes(2)));data.skills[1].max=1;const capped=expand(data,request,g,[1,2]);assert.ok(capped.every(e=>!(e.choices[0]===1&&e.choices[1]===1)));assert.ok(capped.some(e=>e.choices[0]===1&&e.choices[1]===2));
});
