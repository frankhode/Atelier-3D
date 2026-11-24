import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaultProject} from '../src/core/defaults.js';
import {defaultPictorial,validatePictorial,pictorialMask,pictorialZone,pictorialDemoProject} from '../src/core/pictorial.js';
import {validateProject,serializeProject} from '../src/core/project.js';
import {PictorialStudy} from '../src/scene/pictorial-study.js';
import {saveLocal,readLocal,STORAGE_KEY} from '../src/core/storage.js';

test('old compositions load with physical lighting and painterly parameters round-trip independently',()=>{
 const old=defaultProject();delete old.pictorial;const restored=validateProject(old);
 assert.equal(restored.pictorial.enabled,false);
 const p=pictorialDemoProject(defaultProject()),lights=structuredClone(p.lights);
 p.pictorial.center=[2,3,1];p.pictorial.zones.left=.54;p.pictorial.receives.floor=true;
 assert.deepEqual(validateProject(JSON.parse(serializeProject(p))),p);
 assert.deepEqual(p.lights,lights);
});
test('painterly validation rejects invalid controls without sharing mutable defaults',()=>{
 for(const change of [p=>p.radius[1]=0,p=>p.center[0]=NaN,p=>p.strength=3,p=>p.softness=0,p=>p.zones.left=-1,p=>p.receives.floor='yes']){
  const p=defaultPictorial();change(p);assert.throws(()=>validatePictorial(p));
 }
 const a=defaultPictorial(),b=defaultPictorial();a.zones.left=.9;assert.equal(b.zones.left,.28);
});
test('the pictorial field has a full core, a soft edge and a controllable diagonal independent of lights',()=>{
 const p=defaultPictorial();assert.equal(pictorialMask(p,p.center),1);assert.equal(pictorialMask(p,[100,100,100]),0);
 const a=pictorialMask(p,[4.6,3,0]);assert.ok(a>.5);
 const b=structuredClone(p);b.center=[0,0,0];assert.ok(pictorialMask(b,[4.6,3,0])<a);
 assert.equal(pictorialZone('Muro_fondo'),'back');assert.equal(pictorialZone('Muro_izq_fondo'),'left');
 assert.equal(pictorialZone('Peldano_08'),'stairs');assert.equal(pictorialZone('Piso_sala'),'floor');assert.equal(pictorialZone('Pasamanos_inclinado'),'rails');
});
test('per-zone materials keep distinct values while sharing one world-space mask',()=>{
 const state=pictorialDemoProject(defaultProject()),study=new PictorialStudy(state);
 const back=study.materialFor('back'),left=study.materialFor('left');assert.notEqual(back,left);
 assert.equal(back.toneMapped,false);assert.equal(back.side,THREE.DoubleSide);
 assert.equal(study.materials.get('back').uniforms.uPainterReceive.value,1);
 assert.equal(study.materials.get('left').uniforms.uPainterReceive.value,0);
 state.pictorial.zones.left=.6;study.apply();assert.equal(study.materials.get('left').uniforms.uPainterBase.value,.6);
 assert.equal(study.materials.get('back').uniforms.uPainterBase.value,.18);study.dispose();
});
test('the practical demonstration uses a different save slot without replacing the active composition',()=>{
 const data=new Map([[STORAGE_KEY,'original composition']]),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const study=pictorialDemoProject(defaultProject());assert.equal(saveLocal(study,storage,'study-slot'),'complete');
 assert.equal(data.get(STORAGE_KEY),'original composition');assert.equal(readLocal(storage,'study-slot').project.pictorial.enabled,true);
});
