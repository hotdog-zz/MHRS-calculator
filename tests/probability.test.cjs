'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),P=require('../dist/probability.js'),D=require('../dist/data.json'),index=require('../dist/probability/index.json');
test('probability loading accepts raw gzip or HTTP-transparently-decoded JSON',async()=>{const raw={schema:1,group:'test',n:1,hist:[]},bytes=new TextEncoder().encode(JSON.stringify(raw));assert.deepEqual(await P.decode(bytes),raw);assert.deepEqual(await P.decode(zlib.gzipSync(bytes)),raw);await assert.rejects(P.decode(new TextEncoder().encode('not json')));});
test('runtime compressed probabilities match the research joint queries, including protected native skills and slot saturation',()=>{
 for(const {armorId,mode,options,expected}of require('./probability-reference.json').rows){const group=index.armors[armorId][mode],cache=require('./probability-loader.cjs').load(group),a=P.query(D,D.armors.find(a=>a.id===armorId),cache,options);assert.ok(Math.abs(a.p-expected.p)<1e-12);assert.ok(Math.abs(a.se-expected.se)<1e-12);assert.equal(a.n,expected.n);}
});
test('runtime bank loads classes on demand, memoizes queries and rejects mismatched counts',async()=>{
 const armor=D.armors.find(a=>a.id==='Leg:502');let loaded=0;const bank=P.createBank(D,index,async group=>{loaded++;return require('./probability-loader.cjs').load(group);},1);
 const q={minimumChanges:[{id:231,min:1}]},a=await bank.query(armor,'normal',q),b=await bank.query(armor,'normal',q);assert.deepEqual(a,b);assert.equal(loaded,1);assert.equal(bank.stats().queries,1);
 assert.equal((await bank.query(D.armors.find(a=>a.pool===13),'skills',q)).unsupported,true);
 const bad=P.createBank(D,index,async group=>({schema:1,group,n:1,hist:[]}));await assert.rejects(bad.query(armor,'normal',q),/索引/);
});

test('compact codec rejects truncated data, mismatched dictionary and wrong class',()=>{
 const {load,index}=require('./probability-loader.cjs'),group=Object.keys(index.groups)[0],book=P.prepareCodebook(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.resolve(__dirname,'../dist/probability/codebook.json.gz'))))),bytes=zlib.gunzipSync(fs.readFileSync(path.resolve(__dirname,'../dist/probability',group+index.extension)));
 assert.equal(load(group).n,index.groups[group].n);assert.throws(()=>P.unpack(bytes.subarray(0,bytes.length-1),book,group),/截断|计数/);assert.throws(()=>P.unpack(bytes,{...book,id:'0'.repeat(64)},group),/字典/);assert.throws(()=>P.unpack(bytes,book,'0'.repeat(16)),/索引/);assert.throws(()=>P.unpack(Buffer.concat([bytes,Buffer.from([0])]),book,group),/完整/);
});
test('runtime probabilities use at most three significant digits and preserve tiny probabilities',()=>{for(const v of [.00123456,.123456,1.23456e-10]){assert.equal(P.significant(v),Number(v.toPrecision(3)));assert.ok(Math.abs(P.significant(v)-v)/v<.005);}assert.equal(P.significant(0),0);assert.equal(P.significant(1),1);});
test('runtime tables include 2m samples for every pool6/pool13 input class and identify the complete dataset',()=>{
 const groups=new Set();for(const a of D.armors.filter(a=>[6,13].includes(a.pool)))for(const mode of a.pool===13?['normal']:['normal','skills','slots']){const id=index.armors[a.id][mode];groups.add(id);assert.equal(index.groups[id].n,2000000,a.id+' '+mode);}assert.equal(groups.size,301);assert.equal(index.rolls,Object.values(index.groups).reduce((n,g)=>n+g.n,0));assert.match(index.datasetId,/^[a-f0-9]{64}$/);
});
test('palace observation tables have ten million samples per mode without replacing actual-armor tables',async()=>{
 const loader=require('./probability-loader.cjs'),source=D.armors.find(a=>a.id==='Leg:426'),o=index.observation;assert.equal(o.sourceArmorId,source.id);assert.equal(o.rolls,30000000);
 const bank=P.createBank(D,o,async group=>loader.load(group));for(const mode of ['normal','skills','slots']){const id=o.armors[source.id][mode];assert.notEqual(id,index.armors[source.id][mode]);assert.equal(o.groups[id].n,10000000);assert.equal(index.groups[index.armors[source.id][mode]].n,2000000);const raw=loader.load(id);assert.equal(raw.n,10000000);const result=await bank.query(source,mode,{minimumChanges:[{id:233,min:1},{id:203,min:1}]});assert.equal(result.n,10000000);assert.ok(result.p>=0&&result.p<1);}
});
test('canonical queries reuse exchangeable skill labels and equivalent slot thresholds, retaining all restrictions',async()=>{
 const armor=D.armors.find(a=>a.id==='Leg:502'),native=new Set(armor.skills.map(s=>s.skill_id)),candidates=D.skills.filter(s=>s.cost===3&&s.max===3&&!native.has(s.id)),a=candidates[0],b=candidates[1],need=Eslots(armor.slots,1),q1={minimumChanges:[{id:a.id,min:1}],minSlots:need},q2={minimumChanges:[{id:b.id,min:1}],minRawSlots:1};
 assert.equal(P.queryKey(D,armor,q1),P.queryKey(D,armor,q2));const group=index.armors[armor.id].normal,raw=require('./probability-loader.cjs').load(group);assert.deepEqual(P.query(D,armor,raw,q1),P.query(D,armor,raw,q2));
 let loads=0;const bank=P.createBank(D,index,async()=>{loads++;return raw;});const results=await Promise.all([bank.query(armor,'normal',q1),bank.query(armor,'normal',q2)]);assert.deepEqual(results[0],results[1]);assert.equal(loads,1);assert.equal(bank.stats().queries,1);assert.equal(bank.stats().hits,1);
 for(const constraint of [{maxRemoved:0},{maxRecords:5},{maxPositiveRecords:1},{minimumChanges:[{id:a.id,min:2}]},{minRawSlots:2}])assert.notEqual(P.queryKey(D,armor,q2),P.queryKey(D,armor,{...q2,...constraint}));
 assert.notEqual(P.queryKey(D,armor,{minSlots:[5]}),P.queryKey(D,armor,{minRawSlots:13}));
 function Eslots(slots,n){return require('../dist/engine.js').upgradeSlots(slots,n);}
});
test('exact bound calculations share cached counts while ordinary queries retain three-digit output',async()=>{
 const L=require('./probability-loader.cjs'),armor=D.armors.find(a=>a.id==='Leg:426'),bank=P.createBank(D,L.index.observation,g=>L.load(g)),options={minimumChanges:[{id:233,min:1}],maxRemoved:0},[rounded,exact]=await Promise.all([bank.query(armor,'normal',options),bank.queryExact(armor,'normal',options)]),raw=P.query(D,armor,L.load(L.index.observation.armors[armor.id].normal),options);assert.deepEqual(exact,raw);assert.equal(rounded.p,P.significant(raw.p));assert.equal(rounded.se,P.significant(raw.se));assert.notEqual(exact.p,rounded.p);assert.equal(bank.stats().queries,1);assert.equal(bank.stats().hits,1);
});
