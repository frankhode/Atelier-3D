import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { defaultProject } from "../src/core/defaults.js";
import { defaultSurfaces, surfaceDemoProject, bounceDemoProject } from "../src/core/surfaces.js";
import { serializeProject, validateProject } from "../src/core/project.js";
import { Lighting } from "../src/scene/lighting.js";

test("older projects keep their mode; area intensity and original lights round-trip independently", () => {
  const p = defaultProject();
  delete p.surfaces;
  const old = validateProject(p);
  assert.deepEqual(old.surfaces, defaultSurfaces());
  const demo = surfaceDemoProject(old);
  demo.surfaces.left = 0.38;
  demo.surfaces.front = 0;
  assert.deepEqual(validateProject(JSON.parse(serializeProject(demo))), demo);
  assert.equal(demo.pictorial.enabled, false);
  assert.deepEqual(demo.lights, p.lights);
  demo.pictorial.enabled = true;
  assert.throws(() => validateProject(demo));
  demo.pictorial.enabled = false;
  demo.surfaces.upper = Infinity;
  assert.throws(() => validateProject(demo));
});

test("surfaces suppress the point lights and ambient without changing their settings; each group is independently dimmable", () => {
  const p = defaultProject();
  const lighting = new Lighting(new THREE.Scene(), p);
  assert.ok(lighting.surfaces.samples.every(({light}) => !light.visible));
  assert.ok(lighting.lights.every(light => light.visible));
  p.surfaces.enabled = true;
  lighting.apply();
  assert.ok(lighting.lights.every(light => !light.visible));
  assert.equal(lighting.ambient.intensity, 0);
  const samples = lighting.surfaces.samples;
  assert.equal(samples.length, 8);
  assert.ok(samples.every(({light}) => light.visible && light.castShadow));
  const previous = samples.map(({light}) => light.intensity);
  p.surfaces.left = 0;
  p.surfaces.upper *= 0.5;
  lighting.apply();
  samples.forEach(({panel,light},i) => {
    if(panel.group === "left") assert.equal(light.visible,false);
    else if(panel.group === "upper") assert.equal(light.intensity, previous[i]/2);
    else assert.equal(light.intensity, previous[i]);
  });
  p.surfaces.enabled = false;
  lighting.apply();
  assert.ok(samples.every(({light}) => !light.visible));
  assert.ok(lighting.lights.every(light => light.visible));
  assert.equal(lighting.ambient.intensity,p.appearance.ambient);
});

test("surface emitters remain attached to the reference room when translated and scaled", () => {
  const p = surfaceDemoProject(defaultProject());
  const lighting = new Lighting(new THREE.Scene(),p);
  const sample = lighting.surfaces.samples[0].light;
  const origin = sample.position.clone(), target = sample.target.position.clone(), intensity=sample.intensity;
  p.models[0].transform.position = [3,2,1];
  p.models[0].transform.scale = 2;
  lighting.apply();
  assert.deepEqual(sample.position.toArray(),origin.multiplyScalar(2).add(new THREE.Vector3(3,2,1)).toArray());
  assert.deepEqual(sample.target.position.toArray(),target.multiplyScalar(2).add(new THREE.Vector3(3,2,1)).toArray());
  assert.equal(sample.intensity,intensity*4);
});

test("legacy surface files retain a direct-only composition, and the new isolated study starts with diffuse bounces",()=>{
  const p = defaultProject();
  p.surfaces.enabled = true;
  delete p.surfaces.bounce;
  assert.equal(validateProject(p).surfaces.bounce, 0);
  const b = bounceDemoProject(defaultProject());
  assert.equal(b.surfaces.bounce, .35);
  assert.equal(validateProject(JSON.parse(serializeProject(b))).surfaces.bounce, .35);
  for(const v of [-1,Infinity,2.01,"0.5",null]){
    b.surfaces.bounce=v;
    assert.throws(()=>validateProject(b));
  }
});
