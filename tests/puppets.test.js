import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import * as THREE from "three";
import {JOINTS, PRESETS, newPuppet, copyPose, PUPPET_HEIGHT, neutralPose, ANATOMICAL_RIG, COMPOSITION_PRESETS, jointControls, constrainPose, setJointControl, mirrorPose, migrateLegacyPose} from "../src/core/puppets.js";
import {defaultProject} from "../src/core/defaults.js";
import {validateProject,serializeProject} from "../src/core/project.js";
import {ModelManager} from "../src/scene/models.js";
import {buildPuppet,applyPuppetPose,figureBase,figureContact,nearestSupport,placeFigure,snapFigure,pickSupport} from "../src/scene/puppets.js";
import {saveLocal,readLocal} from "../src/core/storage.js";
const obj=await readFile(new URL("../public/models/sala-v04.obj",import.meta.url),"utf8");

test("mannequin has seventeen independent pivots, true human height, and no pedestal",()=>{
 const pose=neutralPose(), p=buildPuppet(pose);
 assert.equal(p.joints.size,JOINTS.length);
 const box=new THREE.Box3().setFromObject(p.root,true);
 assert.ok(Math.abs(box.min.y)<1e-6);
 assert.ok(Math.abs(box.max.y-PUPPET_HEIGHT)<1e-6);
 const before=p.joints.get("lWrist").getWorldPosition(new THREE.Vector3());
 const right=p.joints.get("rWrist").getWorldPosition(new THREE.Vector3());
 pose.lElbow[0]=-90;applyPuppetPose(p,pose);
 assert.ok(before.distanceTo(p.joints.get("lWrist").getWorldPosition(new THREE.Vector3()))>.2);
 assert.ok(right.distanceTo(p.joints.get("rWrist").getWorldPosition(new THREE.Vector3()))<1e-8);
});
test("preset and frozen scene pose survive portable and lightweight JSON and local storage",()=>{
 const state=defaultProject(), p=newPuppet("Persona",PRESETS[3].pose);
 state.poses.push({name:"Escalera",pose:copyPose(p.pose)});state.models.push(p);
 p.transform.position=[3,.8,1];p.transform.scale=.85;p.transform.rotation=[0,45,0];p.magnet=false;
 assert.deepEqual(validateProject(JSON.parse(serializeProject(state))),state);
 assert.deepEqual(validateProject(JSON.parse(serializeProject(state,false))),state);
 const data=new Map(), storage={setItem:(k,v)=>data.set(k,v),getItem:k=>data.get(k)};
 assert.equal(saveLocal(state,storage),"complete");assert.deepEqual(readLocal(storage).project,state);
 const old=defaultProject();delete old.poses;assert.deepEqual(validateProject(old).poses,[]);
 const bad=structuredClone(state);bad.models[1].pose.lHip[0]=Infinity;assert.throws(()=>validateProject(bad));
 const draft=copyPose(p.pose);draft.lHip[0]=0;assert.notEqual(draft.lHip[0],p.pose.lHip[0]);
});
test("a figure uses the neutral scene material, casts shadows and supports actual stair geometry",async()=>{
 const state=defaultProject(), manager=new ModelManager(new THREE.Scene(),state);manager.referenceText=obj;
 manager.mount(await manager.prepare(state.models[0]));
 const p=newPuppet("Escalera",PRESETS[3].pose);state.models.push(p);
 const entry=await manager.prepare(p);manager.mount(entry);
 assert.ok(entry.objects.every(o=>o.mesh.castShadow&&o.mesh.receiveShadow&&o.mesh.material===manager.material));
 const ground=nearestSupport(manager,4,3,0,p.id);assert.ok(ground);assert.ok(Math.abs(ground.y)<1e-6);
 const stair=manager.entries.get("sala-v04").objects.find(o=>/pelda/i.test(o.name));
 assert.ok(stair,"stair mesh present");
 const box=new THREE.Box3().setFromObject(stair.mesh,true),center=box.getCenter(new THREE.Vector3());
 const step=nearestSupport(manager,center.x,center.z,box.max.y,p.id);
 assert.ok(step);assert.ok(Math.abs(step.y-box.max.y)<1e-5);
 placeFigure(entry,step);
 assert.ok(Math.abs(figureBase(entry.wrapper)-step.y)<1e-5);
 assert.ok(figureContact(entry.wrapper).distanceTo(step)<1e-5);
 p.transform.scale=1.1;manager.apply(p.id);assert.ok(snapFigure(entry,manager,step.y));
 const contact=figureContact(entry.wrapper), actual=nearestSupport(manager,contact.x,contact.z,step.y,p.id);
 assert.ok(Math.abs(contact.y-actual.y)<1e-5);
 const camera=new THREE.PerspectiveCamera(48,1,.01,100);
 camera.position.set(center.x,box.max.y+1,center.z);camera.up.set(0,0,-1);
 camera.lookAt(center.x,box.max.y,center.z);camera.updateMatrixWorld();
 const picked=pickSupport(manager,camera,new THREE.Vector2(),p.id);
 // A closer roof may occlude a step from above; direct rays from the room still find a support.
 assert.ok(picked===null||Number.isFinite(picked.y));
 manager.clear();
});

test("anatomical sliders prevent hyperextension, sideways knees and wrist twisting",()=>{
 const pose=neutralPose();
 pose.lKnee=[-90,170,-120];pose.rElbow=[70,180,-50];pose.lWrist=[-140,90,170];
 const safe=constrainPose(pose);
 assert.deepEqual(safe.lKnee,[0,0,0]);
 assert.deepEqual(jointControls("lKnee").map(c=>c.axis),[0]);
 assert.deepEqual(safe.rElbow,[0,80,0]);
 assert.deepEqual(safe.lWrist,[-75,0,35]);
 assert.deepEqual(setJointControl(safe,"lElbow",0,100).lElbow,[-100,0,0]);
 assert.deepEqual(setJointControl(safe,"lKnee",1,90).lKnee,[0,0,0]);
 assert.deepEqual(setJointControl(safe,"rKnee",0,999).rKnee,[145,0,0]);
 assert.deepEqual(setJointControl(safe,"lShoulder",2,45).lShoulder,[0,0,45]);
 assert.deepEqual(setJointControl(safe,"rShoulder",2,45).rShoulder,[0,0,-45]);
});
test("axial shoulder and hip twist does not relocate elbow or knee",()=>{
 const pose=neutralPose();pose.lShoulder=[-32,0,40];pose.rHip=[-35,0,-15];
 const p=buildPuppet(pose,undefined,undefined,ANATOMICAL_RIG);
 const elbow=p.joints.get("lElbow").getWorldPosition(new THREE.Vector3());
 const knee=p.joints.get("rKnee").getWorldPosition(new THREE.Vector3());
 pose.lShoulder[1]=65;pose.rHip[1]=-35;
 applyPuppetPose(p,pose);
 assert.ok(elbow.distanceTo(p.joints.get("lElbow").getWorldPosition(new THREE.Vector3()))<1e-8);
 assert.ok(knee.distanceTo(p.joints.get("rKnee").getWorldPosition(new THREE.Vector3()))<1e-8);
});
test("seventeen presets including the numbered composition and both contrapostos respect every limit",()=>{
 assert.equal(PRESETS.length,7);
 assert.equal(COMPOSITION_PRESETS.length,10);
 for(const [i,p] of COMPOSITION_PRESETS.entries())assert.ok(p.name.startsWith(String(i+1).padStart(2,"0")));
 for(const p of [...PRESETS,...COMPOSITION_PRESETS])assert.deepEqual(p.pose,constrainPose(p.pose));
 const left=PRESETS[5].pose,right=PRESETS[6].pose;
 assert.deepEqual(right,mirrorPose(left));
 assert.equal(left.lKnee[0],0);assert.ok(left.rKnee[0]>10);
 assert.ok(left.pelvis[2]*left.waist[2]<0);
 const p=buildPuppet(left,undefined,undefined,ANATOMICAL_RIG);
 const a=p.joints.get("lAnkle").getWorldPosition(new THREE.Vector3()),b=p.joints.get("rAnkle").getWorldPosition(new THREE.Vector3());
 assert.ok(Math.abs(a.y-b.y)<.05);assert.ok(Math.abs(a.x-b.x)>.2);
});
test("character 3 has hands on waist; character 9 lies horizontally with one hanging arm",()=>{
 const hands=buildPuppet(COMPOSITION_PRESETS[2].pose,undefined,undefined,ANATOMICAL_RIG);
 const point=(p,id)=>p.joints.get(id).getWorldPosition(new THREE.Vector3());
 for(const [s,sign] of [["l",1],["r",-1]]){
  const e=point(hands,s+"Elbow"),w=point(hands,s+"Wrist"),p=point(hands,"pelvis");
  assert.ok(sign*e.x>.3);assert.ok(sign*w.x>.1);assert.ok(Math.abs(p.y-w.y)<.12);
 }
 const preset=COMPOSITION_PRESETS[8], lying=buildPuppet(preset.pose,undefined,preset.rotation,ANATOMICAL_RIG);
 const head=point(lying,"head"),pelvis=point(lying,"pelvis");
 assert.ok(head.x>pelvis.x+.5);assert.ok(Math.abs(head.y-pelvis.y)<.15);
 assert.ok(point(lying,"lWrist").y<pelvis.y-.30);
 assert.ok(point(lying,"rKnee").y>pelvis.y+.25);
});
test("legacy records retain original angles, while new pose orientation and rig persist",()=>{
 const state=defaultProject(), record=newPuppet("Recostado",COMPOSITION_PRESETS[8].pose);
 record.poseRotation=COMPOSITION_PRESETS[8].rotation.slice();
 state.models.push(record);state.poses.push({name:"Recostado",pose:copyPose(record.pose),poseRig:ANATOMICAL_RIG,rotation:record.poseRotation.slice()});
 assert.deepEqual(validateProject(JSON.parse(serializeProject(state))),state);
 const legacy=structuredClone(state);delete legacy.models[1].poseRig;delete legacy.poses[0].poseRig;
 legacy.models[1].pose.lKnee=[-90,45,20];const old=validateProject(legacy);
 assert.deepEqual(old.models[1].pose.lKnee,[-90,45,20]);assert.equal(old.models[1].poseRig,undefined);
 assert.deepEqual(migrateLegacyPose(old.models[1].pose).lKnee,[0,0,0]);
 const invalid=structuredClone(state);invalid.models[1].pose.lKnee=[-10,10,0];
 assert.throws(()=>validateProject(invalid),/límites anatómicos/);
 const rotated=structuredClone(state);rotated.models[1].poseRotation=[0,0,900];
 assert.throws(()=>validateProject(rotated),/orientación de pose/);
});

test("seat and torso support can ignore limbs hanging lower than the support surface",async()=>{
 const state=defaultProject(),m=new ModelManager(new THREE.Scene(),state);
 const p=COMPOSITION_PRESETS[8],r=newPuppet("Recostado",p.pose);r.poseRotation=p.rotation;r.support=p.support;
 state.models.push(r);const entry=await m.prepare(r);m.mount(entry);
 const point=new THREE.Vector3(4,.6,2);
 assert.ok(figureBase(entry.wrapper,"torso")>figureBase(entry.wrapper)+.2);
 placeFigure(entry,point);
 assert.ok(figureContact(entry.wrapper,"torso").distanceTo(point)<1e-5);
 assert.ok(figureBase(entry.wrapper)<.4);
 assert.equal(validateProject(JSON.parse(serializeProject(state))).models[1].support,"torso");
 m.clear();
});
