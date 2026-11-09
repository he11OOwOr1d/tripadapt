import * as THREE from "three";

/** Pass 1B: large material regions are authored in the mesh. No noisy normal perturbation. */
export function applyTerrainMaterial(mesh: THREE.Mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) {
    if (!(material instanceof THREE.MeshStandardMaterial)) continue;
    material.onBeforeCompile = shader => {
      shader.vertexShader = `varying vec3 terrainP;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nterrainP=(modelMatrix*vec4(position,1.)).xyz;");
      shader.fragmentShader = `varying vec3 terrainP;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
float terrainSaturation=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b))-min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b));
float terrainRock=(1.-smoothstep(.035,.12,terrainSaturation))*(1.-smoothstep(.55,.8,diffuseColor.r));
float stratum=sin(terrainP.y*.7+sin(terrainP.x*.09)*.6)*.5+.5;
diffuseColor.rgb*=1.-terrainRock*stratum*.035;`);
    };
    material.customProgramCacheKey = () => "hero-rock-pass1b-v1";
    material.needsUpdate = true;
  }
}
