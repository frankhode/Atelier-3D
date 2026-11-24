import * as THREE from 'three';
import { defaultPictorial } from '../core/pictorial.js';

const prelude = [
  'varying vec3 vPainterWorld;',
  'uniform vec3 uPainterCenter;',
  'uniform vec3 uPainterRadius;',
  'uniform float uPainterRotation;',
  'uniform float uPainterSoftness;',
  'uniform float uPainterStrength;',
  'uniform float uPainterForm;',
  'uniform float uPainterBase;',
  'uniform float uPainterReceive;'
].join('\n');

const body = [
  'vec3 pp = vPainterWorld - uPainterCenter;',
  'float pc = cos(uPainterRotation), ps = sin(uPainterRotation);',
  'vec3 pq = vec3(pc*pp.x+ps*pp.y, -ps*pp.x+pc*pp.y, pp.z) / uPainterRadius;',
  'float pm = 1.0 - smoothstep(1.0-uPainterSoftness, 1.0, length(pq));',
  'float pv = clamp(uPainterBase + pm*uPainterStrength*uPainterReceive, 0.0, 1.0);',
  'vec3 pn = normalize(inverseTransformDirection(normal, viewMatrix));',
  'float pf = 0.65 + 0.35*max(dot(pn, normalize(vec3(-0.4,0.7,0.6))),0.0);',
  'pv *= mix(1.0,pf,uPainterForm);',
  'outgoingLight = vec3(pow(max(pv,0.0),2.2));'
].join('\n');

export class PictorialStudy {
  constructor(state) { this.state=state; this.materials=new Map(); }
  materialFor(zone) {
    if(this.materials.has(zone))return this.materials.get(zone).material;
    const uniforms={
      uPainterCenter:{value:new THREE.Vector3()},uPainterRadius:{value:new THREE.Vector3()},
      uPainterRotation:{value:0},uPainterSoftness:{value:.75},uPainterStrength:{value:.7},
      uPainterForm:{value:.18},uPainterBase:{value:.18},uPainterReceive:{value:1}
    };
    const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0,side:THREE.DoubleSide,toneMapped:false});
    material.name='Atelier · pictórico · '+zone;
    material.customProgramCacheKey=()=> 'atelier-pictorial-v1';
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vPainterWorld;');
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',[
        '#include <project_vertex>',
        'vec4 painterWorld = vec4(transformed,1.0);',
        '#ifdef USE_BATCHING','painterWorld = batchingMatrix * painterWorld;','#endif',
        '#ifdef USE_INSTANCING','painterWorld = instanceMatrix * painterWorld;','#endif',
        'vPainterWorld = (modelMatrix*painterWorld).xyz;'
      ].join('\n'));
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+prelude);
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',body+'\n#include <opaque_fragment>');
    };
    this.materials.set(zone,{material,uniforms});
    this.apply();
    return material;
  }
  apply() {
    const p=this.state.pictorial || defaultPictorial();
    for(const [zone,entry] of this.materials){
      const u=entry.uniforms;
      u.uPainterCenter.value.fromArray(p.center);u.uPainterRadius.value.fromArray(p.radius);
      u.uPainterRotation.value=p.rotation*Math.PI/180;u.uPainterSoftness.value=p.softness;
      u.uPainterStrength.value=p.strength;u.uPainterForm.value=p.form;
      u.uPainterBase.value=THREE.MathUtils.clamp((zone === 'rails' ? 0.07 : p.zones[zone])+(p.shadow-.12),0,1);
      u.uPainterReceive.value=zone==='rails'?0:(p.receives[zone]?1:0);
    }
  }
  dispose(){for(const {material} of this.materials.values())material.dispose();this.materials.clear();}
}
