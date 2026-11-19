const {test}=require('node:test'),assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function load(file,cache={}){if(cache[file])return cache[file];const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText;vm.runInNewContext(code,{exports:module.exports,BigInt,Number,Set,Object,require:name=>name.endsWith('account-adapter')?{accountRequest:async()=>{throw Error('no network');}}:load(path.resolve(path.dirname(file),name+'.ts'),cache)});return cache[file]=module.exports;}
const plain=v=>JSON.parse(JSON.stringify(v));
const r=load(path.resolve(__dirname,'../lib/trips/cost-records.ts')),id='10000000-0000-4000-8000-000000000001';
test('a blank draft needs a description, and paid records need an amount',()=>{
 const d=r.blankCostRecord(id);assert.match(r.finishCostRecord(d).error,/Describe/);
 assert.match(r.finishCostRecord({...d,label:'Dinner',status:'paid'}).error,/amount you paid/);
 assert.deepEqual(plain(r.finishCostRecord({...d,label:'  Dinner  '}).record),{id,category:'food',label:'Dinner',unit:'per_person',quantity:1,amount:'',status:'estimated',activity_id:null,stop_id:null,leg_key:null,currency:null,conversion_rate:null,rate_note:null,rate_date:null,tax_status:'unknown',tax_percent:null});
});
test('half-typed or out-of-range numbers are explained instead of coerced',()=>{
 const d={...r.blankCostRecord(id),label:'Taxi'};
 for(const amount of ['-1','1.234','1e3','abc'])assert.match(r.finishCostRecord({...d,amount}).error,/two decimal places/);
 for(const quantity of ['','0','1.5','10001','2e1'])assert.match(r.finishCostRecord({...d,quantity}).error,/how many times/);
 assert.equal(r.finishCostRecord({...d,amount:'0',quantity:'10000'}).record.amount,'0');
});
test('totals are exact, per-person records multiply travelers, unknown stays unknown',()=>{
 const base={id,category:'food',label:'Dinner',unit:'per_person',quantity:4,amount:'12.50',status:'estimated'};
 assert.equal(r.costRecordTotal(base,3),'150.00');
 assert.equal(r.costRecordTotal({...base,unit:'per_group'},3),'50.00');
 assert.equal(r.costRecordTotal({...base,amount:''},3),null);
 assert.equal(r.costRecordTotal({...base,amount:'0'},3),'0.00');
 assert.equal(r.costRecordTotal({...base,amount:'999999999999999.99',quantity:10000},9),'89999999999999999100.00');
 assert.equal(r.costRecordTotal({...base,amount:'0.01',quantity:3,unit:'per_group'},1),'0.03');
});
test('upsert edits in place without reordering; remove leaves others untouched',()=>{
 const a={id,category:'food',label:'A',unit:'per_group',quantity:1,amount:'1',status:'estimated'},b={...a,id:'20000000-0000-4000-8000-000000000002',label:'B'};
 const list=r.upsertCostRecord(r.upsertCostRecord(undefined,a),b);assert.deepEqual(plain(list.map(x=>x.label)),['A','B']);
 assert.deepEqual(plain(r.upsertCostRecord(list,{...a,label:'A2',status:'paid'}).map(x=>x.label)),['A2','B']);
 assert.deepEqual(plain(r.removeCostRecord(list,id)),[b]);assert.equal(list.length,2);
});
test('choosing a link is explicit, exclusive and clears a removed-link flag',()=>{
 const d={...r.blankCostRecord(id),label:'Tickets',status:'paid',amount:'40',link_removed:true},act='20000000-0000-4000-8000-000000000002';
 assert.equal(r.linkValue(d),'');
 const linked=r.withLink(d,`activity:${act}`);assert.equal(linked.activity_id,act);assert.equal(linked.stop_id,null);assert.equal(linked.link_removed,false);
 assert.equal(r.linkValue(linked),`activity:${act}`);
 const stay=r.withLink(linked,`stop:${act}`);assert.equal(stay.activity_id,null);assert.equal(r.linkValue(stay),`stop:${act}`);
 assert.equal(r.finishCostRecord(r.withLink(d,'')).record.link_removed,undefined);
 // A kept payment may stay flagged; an estimate with a removed link cannot be saved.
 assert.equal(r.finishCostRecord(d).record.link_removed,true);
 assert.match(r.finishCostRecord({...d,status:'estimated'}).error,/linked item was removed/);
});
test('journey links survive keys containing colons and stay exclusive',()=>{
 const key=JSON.stringify(['origin:Delhi','10000000-0000-4000-8000-000000000009']);
 const d=r.withLink({...r.blankCostRecord(id),label:'Train',stop_id:'20000000-0000-4000-8000-000000000002'},`leg:${key}`);
 assert.equal(d.leg_key,key);assert.equal(d.stop_id,null);assert.equal(d.activity_id,null);
 assert.equal(r.linkValue(d),`leg:${key}`);
 assert.equal(r.finishCostRecord(d).record.leg_key,key);
 assert.equal(r.withLink(d,'').leg_key,null);
});
test('foreign amounts convert exactly with an entered rate and stay unknown without one',()=>{
 const base={id,category:'food',label:'Museum',unit:'per_group',quantity:1,amount:'10.00',status:'estimated',currency:'EUR',conversion_rate:'90.125'};
 assert.equal(r.displayTotal(base,3,'INR'),'901.25');
 assert.equal(r.displayTotal({...base,amount:'12.50'},3,'INR'),'1126.56');
 assert.equal(r.displayTotal({...base,conversion_rate:null},3,'INR'),null);
 assert.equal(r.displayTotal({...base,currency:'INR'},3,'INR'),'10.00');
 assert.equal(r.displayTotal({...base,currency:null,conversion_rate:null},3,'INR'),'10.00');
 const d={...r.blankCostRecord(id),label:'Museum',amount:'10'};
 assert.match(r.finishCostRecord({...d,currency:'EU'}).error,/three-letter/);
 assert.match(r.finishCostRecord({...d,conversion_rate:'2'}).error,/currency this cost/);
 assert.match(r.finishCostRecord({...d,currency:'EUR',conversion_rate:'0'}).error,/positive/);
 const ok=r.finishCostRecord({...d,currency:'eur',conversion_rate:' 90.125 ',rate_note:'  ',rate_date:''}).record;
 assert.equal(ok.currency,'EUR');assert.equal(ok.conversion_rate,'90.125');assert.equal(ok.rate_note,null);assert.equal(ok.rate_date,null);
});
test('tax not included adds the entered percentage exactly; unknown tax is never zero',()=>{
 const base={id,category:'accommodation',label:'Hotel',unit:'per_group',quantity:2,amount:'100',status:'estimated',tax_status:'excluded',tax_percent:'12'};
 assert.equal(r.costRecordTotal(base,3),'224.00');
 assert.equal(r.costRecordTotal({...base,tax_percent:'5.5',amount:'10',quantity:1},3),'10.55');
 assert.equal(r.costRecordTotal({...base,tax_percent:'0.125',amount:'0.04',quantity:1},3),'0.04');
 assert.equal(r.costRecordTotal({...base,tax_percent:null},3),'200.00');assert.equal(r.taxUnknown({...base,tax_percent:null}),true);
 assert.equal(r.taxUnknown({...base,tax_status:'included',tax_percent:null}),false);assert.equal(r.taxUnknown({...base,tax_status:undefined}),true);
 assert.equal(r.displayTotal({...base,amount:'10',quantity:1,tax_percent:'5.5',currency:'EUR',conversion_rate:'90'},3,'INR'),'949.50');
 const d={...r.blankCostRecord(id),label:'Hotel',amount:'100'};
 assert.match(r.finishCostRecord({...d,tax_status:'included',tax_percent:'5'}).error,/only applies/);
 assert.match(r.finishCostRecord({...d,tax_status:'excluded',tax_percent:'101'}).error,/0 to 100/);
 assert.equal(r.finishCostRecord({...d,tax_status:'excluded',tax_percent:' 18 '}).record.tax_percent,'18');
});
