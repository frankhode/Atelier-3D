import * as THREE from "three";
import { SURFACE_PANELS, SURFACE_SPOT_ANGLE, SURFACE_SPOT_PENUMBRA } from "./surface-lighting.js";

const URL = `${import.meta.env?.BASE_URL ?? "/"}models/sala-v04-bounces.json`;
const LAYERS = 12; // 6 normal lobes × 2 reflection orders
const validVector = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
export function decodeBounceField(field) {
  if (!field || field.version !== 1 || !validVector(field.dims) ||
      field.dims.some(v => !Number.isInteger(v) || v < 2 || v > 64) ||
      field.dims[2] * LAYERS > 256 || !validVector(field.min) || !validVector(field.max) ||
      field.min.some((v,i)=>v>=field.max[i]) ||
      !Array.isArray(field.maxima) || field.maxima.length !== 2 ||
      field.maxima.some(v=>!validVector(v) || v.some(n=>n<0)) ||
      field.panels !== JSON.stringify(SURFACE_PANELS) ||
      field.angle !== SURFACE_SPOT_ANGLE || field.penumbra !== SURFACE_SPOT_PENUMBRA)
    throw new Error("El mapa de rebotes no corresponde a las fuentes actuales.");
  const bytes = Uint8Array.from(atob(field.data), c=>c.charCodeAt(0));
  const [nx,ny,nz]=field.dims;
  if (bytes.length !== nx*ny*nz*LAYERS*4) throw new Error("Mapa de rebotes incompleto.");
  const texture = new THREE.Data3DTexture(bytes,nx,ny,nz*LAYERS);
  texture.format=THREE.RGBAFormat;
  texture.type=THREE.UnsignedByteType;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;
  texture.wrapS=texture.wrapT=texture.wrapR=THREE.ClampToEdgeWrapping;
  texture.unpackAlignment=1;
  texture.generateMipmaps=false;
  texture.needsUpdate=true;
  return texture;
}

const declarations = /* glsl */ `
varying vec3 vBounceWorld;
uniform highp sampler3D uBounceField;
uniform mat4 uBounceWorldToRoom;
uniform vec3 uBounceMin;
uniform vec3 uBounceMax;
uniform vec3 uBounceDims;
uniform vec3 uBounceMaxFirst;
uniform vec3 uBounceMaxSecond;
uniform vec3 uBounceSources;
uniform vec3 uBounceReflectance;
uniform float uBounceStrength;

// The six cardinal irradiance lobes are stacked in one 3D texture.
// Alpha is probe validity; discard probes inside walls when interpolating.
vec3 bounceLobe(vec3 grid, float layer, vec3 limit) {
  vec3 uvw = vec3((grid.xy + 0.5) / uBounceDims.xy,
                  (grid.z + 0.5 + layer * uBounceDims.z) / (12.0 * uBounceDims.z));
  vec4 texel = texture(uBounceField, uvw);
  if (texel.a < 0.003) return vec3(0.0);
  vec3 encoded = clamp(texel.rgb / texel.a, 0.0, 1.0);
  return encoded * encoded * limit;
}
vec3 roomBounce(vec3 viewNormal) {
  if (uBounceStrength <= 0.0) return vec3(0.0);
  vec3 worldNormal = inverseTransformDirection(viewNormal, viewMatrix);
  vec3 n = normalize(mat3(uBounceWorldToRoom) * worldNormal);
  vec3 p = (uBounceWorldToRoom * vec4(vBounceWorld, 1.0)).xyz;
  // Sample in free air just above a surface, rather than inside a thin wall.
  p += n * 0.23;
  vec3 outside = max(max(uBounceMin-p, p-uBounceMax), vec3(0.0));
  float coverage = 1.0-smoothstep(0.28,0.65,length(outside));
  if (coverage <= 0.0) return vec3(0.0);
  vec3 grid = clamp((p-uBounceMin)/(uBounceMax-uBounceMin),0.0,1.0)*(uBounceDims-1.0);
  vec3 w = n*n;
  float lx = n.x >= 0.0 ? 0.0 : 1.0;
  float ly = n.y >= 0.0 ? 2.0 : 3.0;
  float lz = n.z >= 0.0 ? 4.0 : 5.0;
  vec3 first = bounceLobe(grid,lx,uBounceMaxFirst)*w.x +
               bounceLobe(grid,ly,uBounceMaxFirst)*w.y +
               bounceLobe(grid,lz,uBounceMaxFirst)*w.z;
  vec3 second = bounceLobe(grid,6.0+lx,uBounceMaxSecond)*w.x +
                bounceLobe(grid,6.0+ly,uBounceMaxSecond)*w.y +
                bounceLobe(grid,6.0+lz,uBounceMaxSecond)*w.z;
  // The texture stores unit-reflectance irradiance, RGB = source groups.
  // Sum in linear space, before tone mapping and receiver BRDF evaluation.
  float e1 = dot(first, uBounceSources);
  float e2 = dot(second, uBounceSources);
  return coverage*uBounceStrength*(e1*uBounceReflectance +
                                  e2*uBounceReflectance*uBounceReflectance);
}
`;

export class BounceStudy {
  constructor(state, neutralMaterial) {
    this.state=state;
    this.ready=false;
    this.error=null;
    this.material=neutralMaterial.clone();
    this.material.name="Atelier · superficies con rebotes";
    this.uniforms={
      uBounceField:{value:null},
      uBounceWorldToRoom:{value:new THREE.Matrix4()},
      uBounceMin:{value:new THREE.Vector3()},
      uBounceMax:{value:new THREE.Vector3()},
      uBounceDims:{value:new THREE.Vector3()},
      uBounceMaxFirst:{value:new THREE.Vector3()},
      uBounceMaxSecond:{value:new THREE.Vector3()},
      uBounceSources:{value:new THREE.Vector3()},
      uBounceReflectance:{value:new THREE.Color()},
      uBounceStrength:{value:0}
    };
    this.material.customProgramCacheKey=()=> "atelier-bounce-v1";
    this.material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,this.uniforms);
      shader.vertexShader=shader.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vBounceWorld;");
      shader.vertexShader=shader.vertexShader.replace("#include <project_vertex>",[
        "#include <project_vertex>",
        "vec4 bounceWorld = vec4(transformed, 1.0);",
        "#ifdef USE_BATCHING","bounceWorld = batchingMatrix * bounceWorld;","#endif",
        "#ifdef USE_INSTANCING","bounceWorld = instanceMatrix * bounceWorld;","#endif",
        "vBounceWorld = (modelMatrix * bounceWorld).xyz;"
      ].join("\n"));
      shader.fragmentShader=shader.fragmentShader.replace("#include <common>","#include <common>\n"+declarations);
      shader.fragmentShader=shader.fragmentShader.replace("#include <lights_fragment_end>",
        "#if defined( RE_IndirectDiffuse )\n irradiance += roomBounce(geometryNormal);\n#endif\n#include <lights_fragment_end>");
    };
  }
  async load(referenceText) {
    if(this.ready)return true;
    if(this.loading)return this.loading;
    if(this.error)return false;
    this.loading=(async()=>{
      try {
        const response=await fetch(URL);
        if(!response.ok)throw new Error("No se pudo cargar el mapa de rebotes.");
        const field=await response.json();
        if(referenceText && globalThis.crypto?.subtle){
          const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(referenceText.trimEnd()));
          const sha=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
          if(sha!==field.geometrySha256)throw new Error("El mapa de rebotes no corresponde a esta sala.");
        }
        const texture=decodeBounceField(field),u=this.uniforms;
        u.uBounceField.value=texture;
        u.uBounceMin.value.fromArray(field.min);u.uBounceMax.value.fromArray(field.max);
        u.uBounceDims.value.fromArray(field.dims);
        u.uBounceMaxFirst.value.fromArray(field.maxima[0]);u.uBounceMaxSecond.value.fromArray(field.maxima[1]);
        this.ready=true;this.apply();return true;
      }catch(error){this.error=error;return false;}
    })();
    return this.loading;
  }
  apply() {
    const p=this.state,u=this.uniforms,s=p.surfaces;
    const room=p.models.find(m=>m.id==="sala-v04" && m.visible);
    this.material.color.set(p.appearance.material);
    u.uBounceReflectance.value.copy(this.material.color);
    u.uBounceSources.value.set(s?.upper??0,s?.left??0,s?.front??0);
    u.uBounceStrength.value=this.ready && room && s?.enabled && !p.pictorial?.enabled ? s.bounce??0 : 0;
    if(room){
      const {position,rotation,scale}=room.transform;
      u.uBounceWorldToRoom.value.compose(new THREE.Vector3(...position),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation.map(THREE.MathUtils.degToRad))),
        new THREE.Vector3(scale,scale,scale)).invert();
    }
  }
  dispose() {
    this.uniforms.uBounceField.value?.dispose();
    this.material.dispose();
  }
}
