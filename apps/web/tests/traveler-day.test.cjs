const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function load(file){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:()=>({}),Object,Array,String,Number,Math,JSON},{});return out;}
const h=load('../lib/trips/traveler-day.ts');const J=v=>JSON.parse(JSON.stringify(v));
test('no hours, or empty hours, is the default day and is fine',()=>{
  for(const [a,b] of [[undefined,undefined],['',''],[undefined,''],['',undefined]])assert.equal(h.validDayHours(a,b),true);
  assert.deepEqual(J(h.travelerDay({})),{start:480,end:1320,custom:false,label:'08:00–22:00'});
  assert.deepEqual(J(h.travelerDay({dayStart:'',dayEnd:''})),{start:480,end:1320,custom:false,label:'08:00–22:00'});
});
test('hours are valid only as a pair of HH:MM at least four hours apart, within one day',()=>{
  for(const [a,b] of [['07:00','23:00'],['00:00','23:59'],['10:00','14:00'],['06:30','22:15']])assert.equal(h.validDayHours(a,b),true,a+b);
  for(const [a,b] of [['07:00',''],['','22:00'],['7:00','22:00'],['07:00','24:00'],['07:60','22:00'],['18:00','09:00'],['09:00','09:00'],['10:00','13:59'],['09:00','9pm'],[7,22],[null,'22:00'],[{},{}]])assert.equal(h.validDayHours(a,b),false,JSON.stringify([a,b]));
});
test('the problem is said in plain words, and is empty when there is none',()=>{
  assert.equal(h.dayHoursProblem('07:00','22:00'),'');assert.equal(h.dayHoursProblem('',''),'');
  assert.match(h.dayHoursProblem('07:00',''),/both/i);assert.match(h.dayHoursProblem('','22:00'),/both/i);
  assert.match(h.dayHoursProblem('10:00','12:00'),/four hours/);assert.match(h.dayHoursProblem('18:00','09:00'),/four hours/);
  assert.match(h.dayHoursProblem('7am','10pm'),/like 07:30/);
});
test('the traveler\'s hours become the day, and unusable hours fall back to the default rather than breaking the view',()=>{
  assert.deepEqual(J(h.travelerDay({dayStart:'10:00',dayEnd:'23:30'})),{start:600,end:1410,custom:true,label:'10:00–23:30'});
  for(const bad of [{dayStart:'10:00'},{dayEnd:'20:00'},{dayStart:'10:00',dayEnd:'11:00'},{dayStart:'x',dayEnd:'y'}])assert.deepEqual(J(h.travelerDay(bad)),{start:480,end:1320,custom:false,label:'08:00–22:00'});
  assert.equal(h.clockText(0),'00:00');assert.equal(h.clockText(1439),'23:59');assert.equal(h.clockText(545),'09:05');
});
