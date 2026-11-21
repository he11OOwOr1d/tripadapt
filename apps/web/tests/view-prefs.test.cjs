const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function load(file,deps={}){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,require:n=>deps[n.replace(/^\.\//,'')]??{},Object,Array,String,Number,Math,JSON,Date,Intl,Set,Map},{});return out;}
const p=load('../lib/trips/view-prefs.ts');
const store=(init={})=>{const m=new Map(Object.entries(init));return {m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>{m.set(k,String(v))}};};
const VIEWS=['list','grid'];
test('a remembered choice comes back, and anything else falls back',()=>{
  assert.equal(p.readPref('k',VIEWS,'list',store({k:'grid'})),'grid');
  assert.equal(p.readPref('k',VIEWS,'list',store({k:'list'})),'list');
  assert.equal(p.readPref('k',VIEWS,'list',store()),'list');
  for(const junk of ['','GRID','grid ','calendar','null','undefined','<script>','{"a":1}','0'])assert.equal(p.readPref('k',VIEWS,'list',store({k:junk})),'list',junk);
  assert.equal(p.readPref('k',['3','5'],'5',store({k:'3'})),'3');
  assert.equal(p.readPref('k',['3','5'],'5',store({k:'4'})),'5');
});
test('blocked, missing or failing storage never throws',()=>{
  assert.equal(p.readPref('k',VIEWS,'list',null),'list');
  assert.equal(p.readPref('k',VIEWS,'grid',{getItem(){throw new Error('SecurityError')},setItem(){}}),'grid');
  assert.equal(p.writePref('k','grid',null),false);
  assert.equal(p.writePref('k','grid',{getItem:()=>null,setItem(){throw new Error('QuotaExceededError')}}),false);
  // with no browser at all (the server render) the defaults come back
  assert.equal(p.readPref('k',VIEWS,'list'),'list');
  assert.equal(p.writePref('k','grid'),false);
});
test('a stored choice round-trips and the keys are stable',()=>{
  const s=store();
  assert.equal(p.writePref(p.AGENDA_VIEW_KEY,'grid',s),true);
  assert.equal(p.readPref(p.AGENDA_VIEW_KEY,VIEWS,'list',s),'grid');
  assert.equal(p.writePref(p.GRID_DAYS_KEY,'3',s),true);
  assert.equal(p.readPref(p.GRID_DAYS_KEY,['3','5'],'5',s),'3');
  assert.equal(p.AGENDA_VIEW_KEY,'elsewhere.agenda-view.v1');assert.equal(p.GRID_DAYS_KEY,'elsewhere.agenda-grid-days.v1');
  assert.notEqual(p.AGENDA_VIEW_KEY,p.GRID_DAYS_KEY);
});
