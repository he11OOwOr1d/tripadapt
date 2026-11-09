import * as THREE from "three";

/** Temporary custom rock micro-surface; final authored normal/AO atlases follow review. */
export function applyTerrainMaterialPassOne(mesh: THREE.Mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) {
    if (!(material instanceof THREE.MeshStandardMaterial)) continue;
    material.onBeforeCompile = shader => {
      shader.vertexShader = `varying vec3 terrainP;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nterrainP=(modelMatrix*vec4(position,1.)).xyz;");
      shader.fragmentShader = `varying vec3 terrainP;
float terrainHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float terrainNoise(vec3 p){vec3 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(terrainHash(a),terrainHash(a+vec3(1,0,0)),f.x),mix(terrainHash(a+vec3(0,1,0)),terrainHash(a+vec3(1,1,0)),f.x),f.y),mix(mix(terrainHash(a+vec3(0,0,1)),terrainHash(a+vec3(1,0,1)),f.x),mix(terrainHash(a+vec3(0,1,1)),terrainHash(a+vec3(1,1,1)),f.x),f.y),f.z);}
` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
float terrainSaturation=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b))-min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b));
float terrainRock=(1.-smoothstep(.035,.13,terrainSaturation))*(1.-smoothstep(.55,.8,diffuseColor.r));
float terrainDetail=terrainNoise(terrainP*.35)*.7+terrainNoise(terrainP*1.2)*.25+terrainNoise(terrainP*3.)*.05;
diffuseColor.rgb*=1.-terrainRock*(.08+(1.-terrainDetail)*.24);`);
      shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
vec3 terrainDx=dFdx(-vViewPosition),terrainDy=dFdy(-vViewPosition);
vec3 terrainR1=cross(terrainDy,normal),terrainR2=cross(normal,terrainDx);
float terrainDet=dot(terrainDx,terrainR1);
vec3 terrainGradient=dFdx(terrainDetail)*terrainR1+dFdy(terrainDetail)*terrainR2;
normal=normalize(abs(terrainDet)*normal-sign(terrainDet)*terrainGradient*.09*terrainRock);`);
    };
    material.customProgramCacheKey = () => "hero-rock-pass1-v1";
    material.needsUpdate = true;
  }
}
