import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { BounceStudy, decodeBounceField } from "../src/scene/bounce-study.js";
import { defaultProject } from "../src/core/defaults.js";
import { bounceDemoProject } from "../src/core/surfaces.js";
const field=JSON.parse(await readFile(new URL("../public/models/sala-v04-bounces.json",import.meta.url),"utf8"));
const obj=await readFile(new URL("../public/models/sala-v04.obj",import.meta.url),"utf8");

test("the committed field matches the actual architecture and contains both reflection orders and source groups",()=>{
  assert.equal(field.geometrySha256,createHash("sha256").update(obj.trimEnd()).digest("hex"));
  const texture=decodeBounceField(field);
  const [nx,ny,nz]=field.dims,voxels=nx*ny*nz,bytes=texture.image.data;
  assert.equal(texture.image.depth,12*nz);
  assert.equal(bytes.length,12*voxels*4);
  for(let order=0;order<2;order++)for(let source=0;source<3;source++){
    let dark=0,bright=0;
    for(let i=order*6*voxels;i<(order+1)*6*voxels;i++){
      if(!bytes[i*4+3])continue;
      if(bytes[i*4+source]===0)dark++;
      if(bytes[i*4+source]>100)bright++;
    }
    assert.ok(bright>0,"each source provides a nonuniform indirect field");
    assert.ok(dark>0,"occlusion/facing produce dark areas");
  }
  assert.throws(()=>decodeBounceField({...field,angle:45}));
  assert.throws(()=>decodeBounceField({...field,data:"AA=="}));
  texture.dispose();
});

test("bounce uniforms follow the source mix, reference transform, reflectance and selected mode",()=>{
  const p=bounceDemoProject(defaultProject());
  const neutral=new THREE.MeshStandardMaterial({color:p.appearance.material});
  const study=new BounceStudy(p,neutral);
  study.ready=true;study.apply();
  const u=study.uniforms;
  assert.equal(u.uBounceStrength.value,.35);
  assert.deepEqual(u.uBounceSources.value.toArray(),[1,.12,.08]);
  p.surfaces.left=0;p.surfaces.bounce=.7;
  p.models[0].transform.position=[2,3,4];
  p.models[0].transform.scale=2;
  study.apply();
  assert.deepEqual(u.uBounceSources.value.toArray(),[1,0,.08]);
  assert.equal(u.uBounceStrength.value,.7);
  const world=new THREE.Vector3(4,5,6);
  assert.deepEqual(world.applyMatrix4(u.uBounceWorldToRoom.value).toArray(),[1,1,1]);
  p.appearance.material="#888888";
  study.apply();
  assert.ok(u.uBounceReflectance.value.r<.3);
  p.models[0].visible=false;study.apply();assert.equal(u.uBounceStrength.value,0);
  p.models[0].visible=true;p.surfaces.enabled=false;study.apply();assert.equal(u.uBounceStrength.value,0);
  study.dispose();neutral.dispose();
});
