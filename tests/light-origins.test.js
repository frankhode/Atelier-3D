import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { defaultProject } from "../src/core/defaults.js";
import { ModelManager } from "../src/scene/models.js";
import { Lighting } from "../src/scene/lighting.js";
import {
  setLightOrigin,
  presetOrigin,
  lightPlanData,
  planPointFromClient,
} from "../src/scene/light-origins.js";
import { projectToCanvas } from "../src/scene/light-aimer.js";
import { serializeProject, validateProject } from "../src/core/project.js";
const source = await readFile(
  new URL("../public/models/sala-v04.obj", import.meta.url),
  "utf8",
);
async function room() {
  const state = defaultProject(),
    scene = new THREE.Scene(),
    models = new ModelManager(scene, state);
  models.mount(
    await models.prepare({ ...state.models[0], kind: "obj", source }),
  );
  return { state, scene, models };
}
test("source movement is independent of destination, optics and camera and survives JSON", async () => {
  const f = await room(),
    light = f.state.lights[0],
    target = light.target.slice(),
    angle = light.angle,
    camera = structuredClone(f.state.camera),
    lighting = new Lighting(f.scene, f.state);
  setLightOrigin(light, [4.1, 3.2, 6.2]);
  lighting.apply();
  assert.deepEqual(light.target, target);
  assert.equal(light.angle, angle);
  assert.deepEqual(f.state.camera, camera);
  assert.deepEqual(lighting.lights[0].position.toArray(), light.position);
  assert.deepEqual(
    validateProject(JSON.parse(serializeProject(f.state))).lights[0],
    light,
  );
  const before = light.position.slice();
  assert.throws(() => setLightOrigin(light, light.target));
  assert.throws(() => setLightOrigin(light, [Infinity, 1, 1]));
  assert.throws(() => setLightOrigin(light, [100001, 1, 1]));
  assert.deepEqual(light.position, before);
  f.models.clear();
});
test("room origin presets obey the reference model world transformation", async () => {
  const f = await room();
  assert.deepEqual(presetOrigin(f.models, "front"), [4.1, 3.2, 6.2]);
  assert.deepEqual(presetOrigin(f.models, "upper"), [10.1, 5.05, 0.65]);
  const model = f.models.entries.get("sala-v04").record;
  model.transform.position = [2, 1, 3];
  model.transform.rotation = [0, 90, 0];
  model.transform.scale = 2;
  f.models.apply("sala-v04");
  const expected = new THREE.Vector3(4.1, 3.2, 6.2).applyMatrix4(
    f.models.entries.get("sala-v04").wrapper.matrixWorld,
  );
  assert.ok(
    new THREE.Vector3(...presetOrigin(f.models, "front")).distanceTo(expected) <
      1e-9,
  );
  assert.throws(() => presetOrigin(f.models, "unknown"));
  f.models.clear();
  assert.throws(() => presetOrigin(f.models, "front"));
});
test("source plan contains the original source, destination and real floor footprints", async () => {
  const f = await room(),
    light = f.state.lights[1],
    plan = lightPlanData(f.models, light),
    b = plan.bounds;
  assert.equal(plan.floors.length, 2);
  for (const p of [light.position, light.target]) {
    assert.ok(p[0] > b.minX && p[0] < b.minX + b.width);
    assert.ok(p[2] > b.minZ && p[2] < b.minZ + b.depth);
  }
  const floor = plan.floors[0];
  assert.ok(
    floor.some(
      ([x, z]) => Math.abs(x - 8.4) < 1e-4 && Math.abs(z - 6.5) < 1e-4,
    ),
  );
  f.models.clear();
  const empty = lightPlanData(f.models, light);
  assert.ok(empty.bounds.width > 0 && empty.bounds.depth > 0);
  assert.equal(empty.floors.length, 0);
});
test("plan taps map exactly through horizontal and vertical SVG letterboxes", () => {
  const bounds = { minX: -2, minZ: -1, width: 12, depth: 8 };
  for (const rect of [
    { left: 10, top: 20, width: 300, height: 200 },
    { left: 10, top: 20, width: 300, height: 300 },
    { left: 10, top: 20, width: 400, height: 160 },
  ]) {
    const scale = Math.min(
        rect.width / bounds.width,
        rect.height / bounds.depth,
      ),
      padX = (rect.width - bounds.width * scale) / 2,
      padZ = (rect.height - bounds.depth * scale) / 2;
    const x = 4,
      z = 3;
    assert.deepEqual(
      planPointFromClient(
        rect.left + padX + (x - bounds.minX) * scale,
        rect.top + padZ + (z - bounds.minZ) * scale,
        rect,
        bounds,
      ),
      [x, z],
    );
    if (padX > 0)
      assert.equal(
        planPointFromClient(
          rect.left + 1,
          rect.top + rect.height / 2,
          rect,
          bounds,
        ),
        null,
      );
    if (padZ > 0)
      assert.equal(
        planPointFromClient(
          rect.left + rect.width / 2,
          rect.top + 1,
          rect,
          bounds,
        ),
        null,
      );
  }
});
test("3D origin projection distinguishes offscreen, behind-camera and camera positions", () => {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 300 }),
  };
  const visible = projectToCanvas([1, 0, 0], camera, canvas);
  assert.equal(visible.visible, true);
  assert.equal(visible.inFront, true);
  const outside = projectToCanvas([50, 0, 0], camera, canvas);
  assert.equal(outside.visible, false);
  assert.equal(outside.inFront, true);
  const behind = projectToCanvas([0, 0, 20], camera, canvas);
  assert.equal(behind.visible, false);
  assert.equal(behind.inFront, false);
  const atCamera = projectToCanvas([0, 0, 10], camera, canvas);
  assert.equal(atCamera.visible, false);
  assert.equal(atCamera.atCamera, true);
});
