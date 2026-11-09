"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { applyTerrainMaterialPassOne } from "./terrainMaterialPassOne";
import { applyTerrainMaterial } from "./terrainMaterial";
import { terrainHeight, passOneHeight, riverCenter, riverWidth } from "../../lib/landing/terrain-spec.mjs";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";

// Pass one loads custom authored terrain meshes; remaining scene assets are still proxies.
export default function SunnyScene({ paused }: { paused: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const pause = useRef(paused);
  const [unavailable, setUnavailable] = useState(false);
  const [assetLoaded, setAssetLoaded] = useState(false);
  useEffect(() => { pause.current = paused; }, [paused]);
  useEffect(() => {
    const container = host.current!;
    const baseline = new URLSearchParams(window.location.search).get("baseline") === "1";
    const height = baseline ? passOneHeight : terrainHeight;
    const sunStrength = baseline ? 3.7 : 3.9;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
    catch { setUnavailable(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1.25 : 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = baseline ? 1.12 : 1.04;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#a4d6e8");
    const sky = new THREE.Mesh(new THREE.SphereGeometry(260,32,24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite:false, vertexShader:`varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 v;void main(){float h=smoothstep(-.1,.65,normalize(v).y);gl_FragColor=vec4(mix(vec3(.68,.84,.95),vec3(.13,.40,.78),h),1.);}` })); scene.add(sky);
    scene.fog = baseline ? new THREE.Fog("#b9d5e9", 65, 220) : new THREE.Fog("#b6cee7", 85, 230);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 320);
    camera.position.set(0, 12, 27);
    camera.lookAt(0, 5, -15);
    const hemi = new THREE.HemisphereLight(baseline ? "#b9d8ff" : "#a9caff", baseline ? "#667748" : "#526c3e", baseline ? 1.7 : 1.15);
    scene.add(hemi);
    const skyFill = new THREE.DirectionalLight(baseline ? "#b9d2fa" : "#a9c9ff", baseline ? .65 : .55); skyFill.position.set(15,18,25);scene.add(skyFill);
    const sun = new THREE.DirectionalLight(baseline ? "#ffe1ab" : "#ffe0ad", sunStrength);
    sun.position.set(...(baseline ? [-30,40,16] : [-42,32,12]) as [number,number,number]);
    sun.castShadow = true;
    sun.shadow.mapSize.set(window.innerWidth < 700 ? 1024 : 2048, window.innerWidth < 700 ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, far: 110 });
    sun.shadow.normalBias = 0.04;
    sun.shadow.bias = -0.0002;
    sun.shadow.radius = 4;
    scene.add(sun);
    let seed = 817;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const material = (color: string, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness });
    const rockMat = material("#83978b");
    const cream = material("#f3dca5");
    const wood = material("#735342");
    const roofMat = material("#596d75");
    const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = scene) => {
      const object = new THREE.Mesh(geometry, mat); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
    };
    // The previous procedural blockout is archived under docs/baselines.
    let disposed = false;
    let dirty = true;
    const terrainVersion=baseline ? "v1" : "v1b";
    new GLTFLoader().load(`/models/hero/alpine-terrain-${terrainVersion}${window.innerWidth < 700 ? "-mobile" : ""}.glb`, gltf => {
      if (disposed) { gltf.scene.traverse(o => { if(o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose()); }}); return; }
      gltf.scene.traverse(o => { if(o instanceof THREE.Mesh) { o.receiveShadow=true; o.castShadow=!o.name.includes("bank"); if(!o.name.includes("bank")) (baseline ? applyTerrainMaterialPassOne : applyTerrainMaterial)(o); } });
      scene.add(gltf.scene); container.dataset.terrain="loaded"; setAssetLoaded(true); dirty=true;
    }, undefined, () => { if(!disposed) setUnavailable(true); });
    // Flow shader is world-space, so the widening surface retains a consistent ripple scale.
    const water = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 p; uniform float time; void main(){float a=sin(p.z*9.-time*1.4+sin(p.x*13.+time*.3)*.8);float b=sin(p.z*24.-time*2.8+p.x*7.);float broad=sin(p.z*.8+p.x*.6-time*.2)*.5+.5;float ripple=a*b*.008;vec3 c=mix(vec3(.09,.29,.27),vec3(.19,.42,.42),broad*.18+.4);c+=ripple;float reflection=exp(-pow((p.x+1.5+sin(p.z*.4)*.4)/2.8,2.))*.08;c+=vec3(.65,.75,.68)*reflection;gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`,
    });
    const waterPoints: number[] = [], waterIndices: number[] = [];
    for (let i = 0; i <= 220; i++) { const z = -70 + i / 220 * 108; const c = riverCenter(z), w = riverWidth(z) + 0.08; waterPoints.push(c - w, 0.12, z, c + w, 0.12, z); if (i < 220) { const a = i * 2; waterIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const waterGeo = new THREE.BufferGeometry(); waterGeo.setAttribute("position", new THREE.Float32BufferAttribute(waterPoints, 3)); waterGeo.setIndex(waterIndices); waterGeo.computeVertexNormals(); mesh(waterGeo, water).castShadow = false;
    const sunDisc = mesh(new THREE.SphereGeometry(2.1, 32, 24), new THREE.MeshBasicMaterial({ color: "#fff0bc" })); sunDisc.position.set(-17, 24, -51); sunDisc.castShadow = false;
    const cloudMat = material("#fff8e7",1);
    const clouds: THREE.Object3D[] = [];
    for (const [x, y, z, scale] of [[-30,23,-43,1.1],[-3,27,-59,1.3],[27,24,-48,1.2],[11,22,-64,.7]]) {
      const cloud=new MarchingCubes(40,cloudMat,false,false,14000);
      cloud.isolation=55;cloud.reset();
      // Connected masses merge into one surface, with a broad base and raised crown.
      for(const [bx,by,bz,strength] of [[.25,.43,.5,.55],[.4,.46,.48,.8],[.55,.52,.5,1],[.68,.45,.52,.65],[.48,.62,.51,.5],[.76,.42,.49,.32]]) cloud.addBall(bx,by,bz,strength,12);
      cloud.update();cloud.position.set(x,y,z);cloud.scale.set(8.5*scale,4.6*scale,3.8*scale);cloud.castShadow=false;cloud.receiveShadow=false;scene.add(cloud);clouds.push(cloud);
    }
    const wind = { value: 0 };
    const grassMat = material("#91b649"); grassMat.side = THREE.DoubleSide;
    grassMat.onBeforeCompile = shader => { shader.uniforms.windTime = wind; shader.vertexShader = "uniform float windTime;\n" + shader.vertexShader; shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n float phase=instanceMatrix[3].x*.35+instanceMatrix[3].z*.27; transformed.x+=sin(windTime*1.1+phase)*position.y*position.y*.7;`); };
    const blade = new THREE.BufferGeometry(); blade.setAttribute("position", new THREE.Float32BufferAttribute([-.035,0,0,.035,0,0,-.008,.17,.035,.035,0,0,.025,.17,.035,-.008,.17,.035,-.008,.17,.035,.025,.17,.035,.045,.34,.08], 3)); blade.computeVertexNormals();
    const grassCount = window.innerWidth < 700 ? 14000 : 65000;
    const grass = new THREE.InstancedMesh(blade, grassMat, grassCount); grass.receiveShadow = true;
    const dummy = new THREE.Object3D(); const shade = new THREE.Color();
    for (let i = 0; i < grassCount; i++) {
      const z = -42 + random() * 77; const side = random() > .5 ? 1 : -1;
      const x = riverCenter(z) + side * (riverWidth(z) + .1 + random() * 31);
      dummy.position.set(x, height(x, z) - .04, z); dummy.rotation.y = random() * Math.PI; dummy.scale.setScalar(.55 + random() * 1.25); dummy.updateMatrix(); grass.setMatrixAt(i, dummy.matrix);
      shade.setHSL(.21 + random() * .045, .58, .33 + random() * .12); grass.setColorAt(i, shade);
    }
    scene.add(grass);
    function box(w: number, h: number, d: number, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) { const o = mesh(new THREE.BoxGeometry(w,h,d), mat, parent); o.position.set(x,y,z); return o; }
    const cottage = new THREE.Group(); cottage.position.set(10, passOneHeight(10, 0), 0); cottage.rotation.y = -.3; scene.add(cottage);
    box(3.8,.22,3.2,rockMat,cottage,0,.1,0); box(3.2,2.3,2.6,cream,cottage,0,1.25,0);
    const gable = new THREE.Shape(); gable.moveTo(-1.9,0); gable.lineTo(0,1.65); gable.lineTo(1.9,0); gable.closePath();
    const roof = mesh(new THREE.ExtrudeGeometry(gable,{depth:3.15,bevelEnabled:true,bevelSize:.08,bevelThickness:.08,bevelSegments:2,steps:1}),roofMat,cottage); roof.position.set(0,2.4,-1.58);
    box(.75,1.55,.08,wood,cottage,-.55,.9,1.34);
    const glass = material("#f7bf60");
    for (const x of [.85]) { box(.7,.85,.1,wood,cottage,x,1.45,1.34); box(.5,.65,.12,glass,cottage,x,1.45,1.4); box(.05,.65,.14,wood,cottage,x,1.45,1.43); box(.5,.05,.14,wood,cottage,x,1.45,1.43); }
    box(.45,1.4,.5,wood,cottage,.9,3.3,-.6);
    // Reclining silhouette, fixed pose. A production character must replace this blockout.
    const traveler = new THREE.Group(); traveler.position.set(-8, passOneHeight(-8, -1) + .15, -1); traveler.rotation.y = -.28; scene.add(traveler);
    const teal = material("#347c78"), trousers = material("#d5b57b"), skin = material("#d49b70"), boots = material("#493e32");
    function limb(a: number[], b: number[], radius: number, mat: THREE.Material) { const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from); const o = mesh(new THREE.CapsuleGeometry(radius, Math.max(.01,delta.length()-radius*2),5,10),mat,traveler); o.position.copy(from.add(to).multiplyScalar(.5)); o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()); return o; }
    limb([-.75,.27,0],[.35,.52,0],.33,teal);
    const head = mesh(new THREE.SphereGeometry(.29,24,16),skin,traveler); head.position.set(-1.06,.69,0);
    const hair = mesh(new THREE.SphereGeometry(.30,20,12,0,Math.PI*2,0,Math.PI*.6),boots,traveler); hair.position.copy(head.position); hair.rotation.z = -.45;
    limb([.3,.39,-.17],[1.02,.69,-.22],.17,trousers); limb([1.02,.69,-.22],[1.7,.18,-.22],.14,trousers);
    limb([.3,.38,.19],[1.25,.17,.34],.17,trousers); limb([1.25,.17,.34],[2,.12,.45],.13,trousers);
    limb([1.68,.15,-.22],[1.95,.13,-.22],.15,boots); limb([1.97,.13,.45],[2.23,.12,.45],.15,boots);
    limb([-.6,.5,.23],[-.85,.27,.48],.105,teal); limb([-.85,.27,.48],[-1.35,.55,.15],.085,skin);
    limb([-.6,.52,-.22],[-1.3,.38,-.35],.105,teal); limb([-1.3,.38,-.35],[-1.22,.73,-.1],.085,skin);
    const pack = mesh(new THREE.CapsuleGeometry(.32,.35,6,12),material("#c78c45")); pack.position.set(-10,passOneHeight(-10,-.6)+.3,-.6); pack.rotation.z = -1;
    let frame = 0, time = 0, previous = 0, renderedTime = -1;
    const cloudOrigins = clouds.map(c => c.position.x);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    function resize() { dirty = true; const w = container.clientWidth, h = container.clientHeight; renderer.setSize(w,h); camera.aspect=w/h; if(w/h < 1) { camera.position.set(0,16,46); camera.fov=62; camera.lookAt(0,7,-12); sunDisc.position.x=-9; } else { camera.position.set(0,12,27); camera.fov=43; camera.lookAt(0,7,-15); sunDisc.position.x=-17; } camera.updateProjectionMatrix(); }
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    function render(now: number) { const dt = Math.min((now-previous)/1000,.05); previous=now; if (!pause.current && !media.matches && !document.hidden) time+=dt; wind.value=time; water.uniforms.time.value=time; clouds.forEach((c,i)=>{c.position.x = cloudOrigins[i] + Math.sin(time * .025) * 2.6 * (i%2?1:-1);}); sun.intensity=sunStrength + Math.sin(time*.13)*.1; if(!document.hidden && (dirty || time !== renderedTime)) { renderer.render(scene,camera); container.dataset.triangles=String(renderer.info.render.triangles); container.dataset.drawCalls=String(renderer.info.render.calls); renderedTime=time; dirty=false; } frame=requestAnimationFrame(render); }
    frame=requestAnimationFrame(render);
    const lost = (event: Event) => { event.preventDefault(); setUnavailable(true); };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener("webglcontextlost",lost); scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose(); const materials=Array.isArray(o.material)?o.material:[o.material]; materials.forEach(m=>m.dispose());}}); renderer.dispose(); renderer.domElement.remove(); };
  }, []);
  return <div ref={host} className="sunny-canvas" aria-busy={!assetLoaded && !unavailable} role="img" aria-label="A sunny three-dimensional mountain valley. A river opens toward the foreground between green meadows, with a reclining traveler on the left and a little cottage on the right.">{!assetLoaded && !unavailable && <div className="sunny-loading" role="status">Building the valley…</div>}{unavailable && <div className="sunny-fallback"><p>Still view · 3D is unavailable on this device.</p></div>}</div>;
}
