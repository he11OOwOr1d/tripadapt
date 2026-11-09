/** Rebuild custom terrain meshes: node scripts/generate-hero-terrain.mjs (from apps/web). */
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { terrainHeight,riverCenter,riverWidth,mountainProfiles,ridgeHeight,ridgeBands,shelfCoverage } from '../lib/landing/terrain-spec.mjs';
// GLTFExporter uses FileReader only to turn generated buffers into a binary GLB.
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
const mobile=process.argv.includes('--mobile');
const group=new THREE.Group();group.name='Elsewhere_Custom_Alpine_Terrain_Pass1B';
function grid(name,nx,nz,point,colorize){
 const pos=[],uv=[],indices=[];
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){pos.push(...point(i/nx,j/nz));uv.push(i/nx,j/nz);if(j<nz&&i<nx){const a=j*(nx+1)+i;indices.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
 const colors=[],p=g.getAttribute('position'),norm=g.getAttribute('normal');
 for(let i=0;i<p.count;i++){const c=colorize(p.getX(i),p.getY(i),p.getZ(i),norm.getY(i));colors.push(c.r,c.g,c.b);}
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.92});m.name=name.includes('bank')?'Meadow_earth_grass_zone':'Alpine_rock_grass_snow_zones';
 const mesh=new THREE.Mesh(g,m);mesh.name=name;group.add(mesh);return mesh;
}
for(const side of [-1,1]){
 // X is ascending on both banks so face winding is consistent.
 grid(side<0?'west-bank':'east-bank',mobile?60:110,mobile?100:190,(u,v)=>{const z=-70+v*105;const d=(side<0?1-u:u)**1.8*65;const x=riverCenter(z)+side*(riverWidth(z)+d);return[x,terrainHeight(x,z)-(d<.025?.13:0),z];},(x,y,z)=>{
 const variation=(Math.sin(x*.38+z*.2)+Math.sin(x*.91-z*.48)*.3)*.035;
 return new THREE.Color().setHSL(.224+Math.sin(x*.1+z*.08)*.012,.58,.32+variation).convertSRGBToLinear();});
}
for(const spec of mountainProfiles){
 grid(spec.name,spec.name.startsWith('valley-')?(mobile?48:80):(mobile?80:144),spec.name.startsWith('valley-')?(mobile?32:48):(mobile?48:88),(u,v)=>{const a=u*2-1,b=v*2-1;return[spec.x+a*spec.width,ridgeHeight(a,b,spec)-.1,spec.z+b*spec.depth];},(x,y,z,ny)=>{
 const grass=new THREE.Color('#638831'),rock=new THREE.Color('#87867f'),snow=new THREE.Color('#edf2f3');
 const u=(x-spec.x)/spec.width,v=(z-spec.z)/spec.depth;
 const spine=-.22+Math.sin(u*3+spec.phase)*.13;
 const dv=Math.abs(v-spine)/(v>spine?1.25:.8);
 const [upper,lower]=ridgeBands(u,spec);
 const smooth=(a,b,t)=>THREE.MathUtils.smoothstep(t,a,b);
 const strip=(center,width)=>1-smooth(width,width+.025,Math.abs(dv-center));
 const shelf=Math.max(strip(upper,.04+Math.max(0,Math.sin(u*4+spec.phase))*.035)*shelfCoverage(u,0,spec),strip(lower,.05+Math.max(0,Math.sin(u*3-spec.phase))*.035)*shelfCoverage(u,1,spec));
 const foot=smooth(.71,.89,dv);
 // Designed connected shelves and foot slopes. No local noise/slope speckle mask.
 const grassAmount=Math.max(shelf,foot);
 const isFoothill=spec.tall<10;
 const c=isFoothill?grass.clone().lerp(rock,(1-shelf)*(1-foot)*.24):rock.clone().lerp(grass,grassAmount);
 const elevation=y/spec.tall;
 // Uneven snow line with long tongues in named crest gullies, rather than a white cap.
 const gully=Math.pow(Math.max(0,Math.cos(u*12+spec.phase)),10)*.13;
 const snowLine=(spec.z < -90?.72:.86)+Math.sin(u*9+spec.phase)*.045-gully;
 const snowMix=isFoothill?0:smooth(snowLine,snowLine+.018,elevation);
 c.lerp(snow,snowMix);
 // Broad face tint and atmospheric layer separation, not baked lighting.
 c.multiplyScalar(.97+Math.sin(u*5+spec.phase)*.025);
 const air=smooth(76,132,-spec.z)*.32;
 c.lerp(new THREE.Color('#a8c8dc'),air);
 return c;});
}
const output=fileURLToPath(new URL(mobile?'../public/models/hero/alpine-terrain-v1b-mobile.glb':'../public/models/hero/alpine-terrain-v1b.glb',import.meta.url));await mkdir(fileURLToPath(new URL('../public/models/hero/',import.meta.url)),{recursive:true});
const buffer=await new GLTFExporter().parseAsync(group,{binary:true});await writeFile(output,Buffer.from(buffer));
const triangles=group.children.reduce((n,m)=>n+m.geometry.index.count/3,0);
console.log(JSON.stringify({output,bytes:buffer.byteLength,meshes:group.children.length,triangles}));
