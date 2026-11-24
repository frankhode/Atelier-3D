import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { WebGLLights } from "three/src/renderers/webgl/WebGLLights.js";
import { defaultProject } from "../src/core/defaults.js";
import { ModelManager } from "../src/scene/models.js";
import { Lighting } from "../src/scene/lighting.js";
import {
  pickSurfaceHit,
  projectToCanvas,
  findLightBlocker,
} from "../src/scene/light-aimer.js";
import { aimLight, lightFromView } from "../src/scene/light-controls.js";
import { beamDiameter } from "../src/core/light-beam.js";
import { serializeProject, validateProject } from "../src/core/project.js";
const obj = await readFile(
  new URL("../public/models/sala-v04.obj", import.meta.url),
  "utf8",
);
async function room() {
  const state = defaultProject(),
    scene = new THREE.Scene(),
    models = new ModelManager(scene, state),
    lighting = new Lighting(scene, state);
  models.mount(
    await models.prepare({ ...state.models[0], kind: "obj", source: obj }),
  );
  scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(48, 0.5, 0.01, 1000);
  camera.position.set(4.1, 2.5, 22);
  camera.lookAt(4.1, 2.65, 0.8);
  camera.updateMatrixWorld(true);
  const canvas = {
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 360,
      height: 720,
      right: 360,
      bottom: 720,
    }),
  };
  return { state, scene, models, lighting, camera, canvas };
}
function insideBeam(light, point, angle = light.angle) {
  const axis = new THREE.Vector3(...light.target)
    .sub(new THREE.Vector3(...light.position))
    .normalize();
  const ray = new THREE.Vector3(...point)
    .sub(new THREE.Vector3(...light.position))
    .normalize();
  return axis.dot(ray) > Math.cos(THREE.MathUtils.degToRad(angle));
}
test("regression: original wide beam already covers several points on the back wall", () => {
  const light = defaultProject().lights[0];
  for (const point of [
    [2, 4, 0],
    [4, 4, 0],
    [6, 4, 0],
    [4, 2, 0],
  ])
    assert.ok(insideBeam(light, point));
});
test("real-room picking aims renderer uniforms at the back wall and confines the grazing beam", async () => {
  const f = await room(),
    light = f.state.lights[0],
    source = light.position.slice(),
    backend = WebGLLights({ has: () => false });
  backend.setup(f.lighting.lights);
  backend.setupView(f.lighting.lights, f.camera);
  const before = backend.state.spot[0].direction.clone();
  const pixel = projectToCanvas([4, 4, 0], f.camera, f.canvas),
    hit = pickSurfaceHit(pixel.x, pixel.y, f.canvas, f.camera, f.models);
  assert.equal(hit.object.name, "Muro_fondo");
  assert.ok(hit.point.distanceTo(new THREE.Vector3(4, 4, 0)) < 1e-6);
  assert.ok(Math.abs(hit.worldNormal[2]) > 0.99);
  aimLight(light, hit.point.toArray(), true, hit.worldNormal);
  f.lighting.apply();
  backend.setup(f.lighting.lights);
  backend.setupView(f.lighting.lights, f.camera);
  const actual = backend.state.spot[0].direction,
    expected = new THREE.Vector3(...light.position)
      .sub(hit.point)
      .transformDirection(f.camera.matrixWorldInverse);
  assert.ok(actual.distanceTo(expected) < 1e-9);
  assert.ok(actual.distanceTo(before) > 0.1);
  assert.deepEqual(light.position, source);
  assert.ok(insideBeam(light, [4, 4, 0]));
  assert.equal(insideBeam(light, [2, 4, 0]), false);
  assert.equal(insideBeam(light, [6, 4, 0]), false);
  assert.ok(
    light.angle < 2,
    "a grazing wall needs a narrower cone than the 8-degree preset",
  );
  assert.equal(findLightBlocker(light, f.models), null);
  f.models.clear();
});
test("different points on the real back wall update both spotlight direction and shadow camera", async () => {
  const f = await room();
  let last;
  for (const point of [
    [2, 4, 0],
    [6, 4, 0],
  ]) {
    const screen = projectToCanvas(point, f.camera, f.canvas),
      hit = pickSurfaceHit(screen.x, screen.y, f.canvas, f.camera, f.models);
    aimLight(f.state.lights[0], hit.point.toArray(), true, hit.worldNormal);
    f.lighting.apply();
    const light = f.lighting.lights[0];
    light.shadow.updateMatrices(light);
    const expected = hit.point.clone().sub(light.position).normalize();
    const shadowDirection = light.shadow.camera.getWorldDirection(
      new THREE.Vector3(),
    );
    assert.ok(shadowDirection.distanceTo(expected) < 1e-8);
    if (last) assert.ok(shadowDirection.distanceTo(last) > 0.05);
    last = shadowDirection.clone();
  }
  f.models.clear();
});
test("solo mode is temporary, isolates one enabled light and restores exact composition parameters", async () => {
  const f = await room(),
    saved = serializeProject(f.state);
  f.lighting.setSolo(1);
  assert.deepEqual(
    f.lighting.lights.map((l) => l.visible),
    [false, true, false],
  );
  assert.equal(f.lighting.ambient.intensity, 0);
  assert.equal(serializeProject(f.state), saved);
  f.lighting.setSolo(null);
  assert.deepEqual(
    f.lighting.lights.map((l) => l.visible),
    [true, true, true],
  );
  assert.equal(f.lighting.ambient.intensity, f.state.appearance.ambient);
  f.state.lights[1].enabled = false;
  f.lighting.setSolo(1);
  assert.equal(f.lighting.lights[1].visible, false);
  f.lighting.setSolo(null);
  assert.equal(f.lighting.lights[1].visible, false);
  f.models.clear();
});
test("placing light at the current view changes its origin and preserves aim and beam width", async () => {
  const f = await room(),
    light = f.state.lights[0];
  light.target = [4, 4, 0];
  const target = light.target.slice(),
    width = beamDiameter(light);
  lightFromView(light, f.camera);
  assert.deepEqual(light.position, f.camera.position.toArray());
  assert.deepEqual(light.target, target);
  assert.ok(Math.abs(beamDiameter(light) - width) < 1e-8);
  assert.equal(findLightBlocker(light, f.models), null);
  assert.deepEqual(
    validateProject(JSON.parse(serializeProject(f.state))).lights[0],
    light,
  );
  f.models.clear();
});
test("path feedback reports a real occluder, ignores hidden ones and excludes the receiver", async () => {
  const f = await room(),
    light = f.state.lights[0];
  light.position = [4.1, 2, 5];
  light.target = [4.1, 2, 0];
  assert.equal(findLightBlocker(light, f.models), null);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 0.2),
    f.models.material,
  );
  mesh.name = "Obstaculo";
  mesh.position.set(4.1, 2, 2.5);
  const wrapper = new THREE.Group();
  wrapper.add(mesh);
  f.scene.add(wrapper);
  f.models.entries.set("obstacle", { wrapper, objects: [{ mesh }] });
  assert.equal(findLightBlocker(light, f.models), mesh);
  wrapper.visible = false;
  assert.equal(findLightBlocker(light, f.models), null);
  f.models.remove("obstacle");
  f.models.clear();
});
test("aim preserves a chosen broad beam when concentration is disabled and rejects invalid targets atomically", () => {
  const light = defaultProject().lights[0],
    angle = light.angle;
  aimLight(light, [4, 4, 0], false, [0, 0, 1]);
  assert.equal(light.angle, angle);
  const saved = JSON.stringify(light);
  assert.throws(() => aimLight(light, light.position, true));
  assert.equal(JSON.stringify(light), saved);
});
