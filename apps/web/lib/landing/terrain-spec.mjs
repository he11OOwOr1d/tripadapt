// Custom hero terrain authoring source. Coordinates in scene metres; deterministic.
export const riverCenter = z => -2 + Math.sin((z + 10) * .105) * (.5 + (z + 65) * .021);
export const riverWidth = z => .32 + Math.pow((z + 70) / 100, 1.65) * 7.6 + (Math.sin(z*.37)+Math.sin(z*.83)*.4)*.38;
export function passOneHeight(x,z) {
  const d=Math.max(0,Math.abs(x-riverCenter(z))-riverWidth(z));
  const edge=1-Math.exp(-d*.8);
  const rolling=.65+Math.sin(x*.12+z*.07)*.45+Math.cos(z*.16-x*.09)*.3;
  const hillside=Math.pow(Math.min(d/30,1),1.7)*(2.2+Math.sin(z*.09)*1.3);
  const benches=Math.exp(-(((z+23)/13)**2))*Math.pow(Math.min(d/22,1),1.3)*2.8;
  return .08+edge*Math.max(.25,rolling)+hillside+benches;
}
// Gentle, level resting patches retain pass-one object elevations at their anchors.
const clamp01=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp01((v-a)/(b-a));return t*t*(3-2*t);};
export function terrainHeight(x,z) {
 const d=Math.max(0,Math.abs(x-riverCenter(z))-riverWidth(z));
 const edge=1-Math.exp(-d*.65);
 const forward=smooth(-24,1,z);
 const calm=.65+Math.sin(x*.09+z*.035)*.16+Math.cos(z*.1-x*.04)*.09;
 const slope=Math.pow(Math.min(d/34,1),1.8)*1.4;
 let h=passOneHeight(x,z)*(1-forward)+(.08+edge*calm+slope)*forward;
 for(const [px,pz,rx,rz] of [[-8,-1,4.5,3.4],[10,0,4.3,3.6]]) {
  const distance=Math.sqrt(((x-px)/rx)**2+((z-pz)/rz)**2);
  const weight=1-smooth(.35,1.45,distance);
  h=h*(1-weight)+passOneHeight(px,pz)*weight;
 }
 return h;
}
export function ridgeBands(u,spec) {
 return [.31+Math.sin(u*2.7+spec.phase)*.035,.64+Math.sin(u*3.4+spec.phase)*.045];
}
// Skyline profiles are deliberately different, broad alpine shoulders instead of isolated towers.
export const mountainProfiles = [
 {name:'distant-west',x:-28,z:-111,width:43,depth:28,tall:22,phase:1.7,profile:[0,.27,.51,.72,.57,.83,.66,.4,.18,0]},
 {name:'distant-east',x:29,z:-118,width:45,depth:31,tall:24,phase:4.1,profile:[0,.2,.49,.74,.61,.91,.72,.56,.3,0]},
 {name:'middle-saddle',x:0,z:-91,width:28,depth:22,tall:13,phase:3.2,profile:[0,.22,.58,.81,.67,.54,.65,.32,.16,0]},
 {name:'west-alpine-massif',x:-34,z:-68,width:36,depth:26,tall:25,phase:1.3,profile:[0,.35,.68,.8,.75,1,.94,.66,.32,0]},
 {name:'east-alpine-massif',x:37,z:-73,width:39,depth:29,tall:24,phase:5.4,profile:[0,.25,.53,.72,.9,.96,.84,.67,.38,0]},
 {name:'west-meadow-shoulder',x:-38,z:-35,width:25,depth:20,tall:8,phase:2.6,profile:[0,.25,.6,.83,.92,.79,.6,.45,.23,0]},
 {name:'east-meadow-shoulder',x:42,z:-39,width:28,depth:22,tall:9,phase:4.7,profile:[0,.18,.42,.64,.82,.95,.85,.58,.3,0]},
];
export function ridgeHeight(u,v,spec) {
 const {phase,profile,tall}=spec;
 const q=clamp01((u+1)*.5)*(.999999*(profile.length-1)),i=Math.floor(q),t=q-i;
 const crest=profile[i]*(1-t)+profile[Math.min(i+1,profile.length-1)]*t;
 const spine=-.22+Math.sin(u*3+phase)*.13;
 const dv=Math.abs(v-spine)/(v>spine?1.25:.8);
 const [upper,lower]=ridgeBands(u,spec);
 // Two continuous terraces: flat shelves between long exposed cliff faces.
 // Endpoint correction keeps the skyline and feet at the original envelope heights.
 const terrace=(center,amp)=>amp*(Math.tanh((dv-center)/.05)-(2*clamp01(dv)-1));
 const envelope=Math.max(0,1-dv+terrace(upper,.044)+terrace(lower,.043));
 const slope=Math.pow(envelope,1.22);
 const shoulder=Math.exp(-(((v-.43)/.28)**2))*.055*Math.sin(Math.PI*(u+1)*.5);
 // Broad ridge buttresses, no high-frequency erosion/noise displacement.
 const wave=((u+1)*4+Math.sin(phase)*.2)%1;
 const facet=(1-Math.abs(wave*2-1));
 const rib=(facet-.45)*.065*Math.sin(Math.min(1,dv)*Math.PI);
 return Math.max(0,(crest*slope+shoulder+rib))*tall;
}

// Dedicated valley spurs sit between the meadow and main range, leaving the river corridor open.
mountainProfiles.push(
 {name:'valley-west-foothill',x:-13,z:-40,width:9,depth:10,tall:4.8,phase:2.1,profile:[0,.12,.31,.6,.83,.75,.48,.28,.09,0]},
 {name:'valley-east-foothill',x:14,z:-49,width:11,depth:12,tall:6.2,phase:4.8,profile:[0,.14,.35,.63,.85,.88,.65,.42,.16,0]},
);

// Authored openings interrupt each shelf where exposed buttresses cross it.
export function shelfCoverage(u,level,spec) {
 const west=spec.x<0;
 const intervals=level===0?(west?[[-.93,-.38],[-.20,.14],[.43,.7]]:[[-.86,-.52],[-.34,.26],[.52,.81]]):(west?[[-.9,-.45],[-.22,.59]]:[[-.78,-.16],[.09,.72]]);
 let mask=0;
 for(const [a,b] of intervals)mask=Math.max(mask,smooth(a,a+.09,u)*(1-smooth(b-.09,b,u)));
 return mask;
}
