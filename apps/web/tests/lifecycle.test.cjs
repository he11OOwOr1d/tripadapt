const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const vm=require('node:vm');
const moduleContext={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../lib/trips/lifecycle.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,moduleContext);
const {tripCapabilities}=moduleContext.exports;
test('planning permits proposals while active keeps explanations and fresh-day checks',()=>{
 const planning=tripCapabilities('planning'),active=tripCapabilities('active');
 assert.equal(planning.generate,true); assert.equal(active.generate,false);
 assert.equal(active.chat,true); assert.equal(active.remaining,true);
 assert.ok(active.choices.includes('Replan the rest of today'));
 assert.ok(!active.choices.includes('Suggest a rest break'));
});
test('closed and unknown lifecycle do not advertise new AI work',()=>{
 for(const state of ['completed','archived',undefined,'future-status']){
  const policy=tripCapabilities(state);
  assert.equal(policy.generate,false);assert.equal(policy.chat,false);assert.equal(policy.remaining,false);assert.equal(policy.choices.length,0);
 }
});
