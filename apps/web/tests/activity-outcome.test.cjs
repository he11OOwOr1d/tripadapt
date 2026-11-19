const {test}=require('node:test'),assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function load(file,cache={}){if(cache[file])return cache[file];const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:m.exports,Intl,Date,JSON,Set,Object,Array,Number,Math,require:n=>load(path.resolve(path.dirname(file),n+'.ts'),cache)});return cache[file]=m.exports;}
const it=load(path.resolve(__dirname,'../lib/trips/itinerary.ts')),ad=load(path.resolve(__dirname,'../lib/trips/adapter.ts'));
const base=a=>({id:a,stopId:'s',title:a,day:2,start:'10:00',minutes:60,fixed:false,completed:false,booked:false});
const trip=acts=>({...ad.emptyTrip,stops:[{id:'s',name:'Jaipur',timezone:'Asia/Kolkata',nights:3}],activities:acts});
test('hiding recorded outcomes preserves every calculated gap and all planned cards',()=>{
 const entries=it.dayTimeline([{...base('done'),completed:true},{...base('missed'),skipped:true,start:'12:00'},{...base('planned'),start:'14:00'}]);
 const visible=it.visibleDayEntries(entries,false);
 assert.deepEqual(visible.filter(e=>e.type==='gap'),entries.filter(e=>e.type==='gap'));
 assert.deepEqual(Array.from(visible.filter(e=>e.type==='activity'),e=>e.activity.id),['planned']);
 assert.equal(it.visibleDayEntries(entries,true),entries);
});
test('a skipped activity holds no time on either side of a pair',()=>{const clash=it.dayConflicts(trip([base('Fort'),{...base('Lunch'),start:'10:30'}]),'s',2);assert.ok(clash.Fort&&clash.Lunch);
 const ok=it.dayConflicts(trip([{...base('Fort'),skipped:true},{...base('Lunch'),start:'10:30'}]),'s',2);assert.equal(Object.keys(ok).length,0);});
test('done and skipped cannot both be recorded',()=>{assert.equal(ad.isTrip(trip([{...base('Fort'),skipped:true}])),true);assert.equal(ad.isTrip(trip([{...base('Fort'),skipped:true,completed:true}])),false);assert.equal(ad.isTrip(trip([{...base('Fort'),skipped:'yes'}])),false);});
test('day and trip summaries distinguish planned items from recorded outcomes',()=>{assert.equal(it.activityOutcomeLabel([]),'0 planned items');assert.equal(it.activityOutcomeLabel([base('visit')]),'1 planned item');assert.equal(it.activityOutcomeLabel([{...base('done'),completed:true},{...base('missed'),skipped:true},base('planned')]),'1 planned item · 1 completed · 1 didn’t happen');assert.equal(it.activityOutcomeLabel([{...base('missed'),skipped:true}]),'0 planned items · 1 didn’t happen');});

test('skipped historical cards reserve no timeline minutes, including overlapping histories',()=>{
 const history={...base('Skipped'),skipped:true};
 for(const acts of [[history],[history,{...history,id:'second',start:'10:30'}],[{...history,start:'06:00'},{...history,id:'late',start:'23:00'}]]) {
  const entries=it.dayTimeline(acts),gaps=entries.filter(e=>e.type==='gap');
  assert.equal(entries.filter(e=>e.type==='activity').length,acts.length);
  assert.equal(gaps.reduce((n,g)=>n+g.end-g.start,0),14*60);
  for(let i=1;i<gaps.length;i++)assert.equal(gaps[i-1].end,gaps[i].start);
 }
 const entries=it.dayTimeline([history,{...base('Visit'),start:'10:30',minutes:30}]);
 const gaps=entries.filter(e=>e.type==='gap');
 assert.equal(gaps.reduce((n,g)=>n+g.end-g.start,0),14*60-30);
 assert.equal(gaps.some(g=>g.start<660&&g.end>630),false,'an active visit still occupies its time');
});
