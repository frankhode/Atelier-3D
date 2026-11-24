import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import * as THREE from "three";
import {
  LightAimer,
  pickSurface,
  projectToCanvas,
} from "../src/scene/light-aimer.js";
import { beamDiameter, angleForDiameter } from "../src/core/light-beam.js";
import { defaultProject } from "../src/core/defaults.js";
import { validateProject, serializeProject } from "../src/core/project.js";
function fixture(orthographic = false) {
  const window = new Window({ url: "http://localhost" }),
    canvas = window.document.createElement("canvas");
  window.document.body.append(canvas);
  canvas.getBoundingClientRect = () => ({
    left: 70,
    top: 110,
    width: 320,
    height: 400,
    right: 390,
    bottom: 510,
  });
  const camera = orthographic
    ? new THREE.OrthographicCamera(-4, 4, 5, -5, 0.1, 100)
    : new THREE.PerspectiveCamera(50, 0.8, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const wrapper = new THREE.Group(),
    parent = new THREE.Group(),
    mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    );
  parent.add(mesh);
  wrapper.add(parent);
  const models = {
    entries: new Map([["test", { wrapper, objects: [{ mesh }] }]]),
  };
  const state = defaultProject(),
    rig = { camera, controls: { enabled: true }, state };
  const event = (type, x = 230, y = 310, id = 1) =>
    canvas.dispatchEvent(
      new window.PointerEvent(type, {
        pointerId: id,
        clientX: x,
        clientY: y,
        button: 0,
        bubbles: true,
      }),
    );
  return { window, canvas, camera, wrapper, parent, mesh, models, rig, event };
}
test("surface selection uses the actual framed canvas rectangle in both projections", async () => {
  for (const ortho of [false, true]) {
    const f = fixture(ortho);
    const hit = pickSurface(230, 310, f.canvas, f.camera, f.models);
    assert.ok(hit);
    assert.ok(hit.length() < 1e-7);
    assert.equal(pickSurface(30, 310, f.canvas, f.camera, f.models), null);
    assert.equal(pickSurface(230, 70, f.canvas, f.camera, f.models), null);
    const screen = projectToCanvas([0, 0, 0], f.camera, f.canvas);
    assert.equal(screen.x, 230);
    assert.equal(screen.y, 310);
    assert.equal(screen.visible, true);
    assert.equal(
      projectToCanvas([100, 0, 0], f.camera, f.canvas).visible,
      false,
    );
    assert.equal(
      projectToCanvas([0, 0, 20], f.camera, f.canvas).visible,
      false,
    );
    await f.window.happyDOM.close();
  }
});
test("picking ignores hidden meshes, hidden ancestors and hidden models, and takes the closest surface", async () => {
  const f = fixture();
  for (const node of [f.mesh, f.parent, f.wrapper]) {
    node.visible = false;
    assert.equal(pickSurface(230, 310, f.canvas, f.camera, f.models), null);
    node.visible = true;
  }
  const near = f.mesh.clone();
  near.position.z = 2;
  f.wrapper.add(near);
  f.models.entries.get("test").objects.push({ mesh: near });
  assert.ok(
    Math.abs(pickSurface(230, 310, f.canvas, f.camera, f.models).z - 2) < 1e-7,
  );
  await f.window.happyDOM.close();
});
test("one tap picks a target and restores controls; a miss keeps selection active", async () => {
  const f = fixture(),
    picks = [],
    ended = [];
  let misses = 0;
  const aimer = new LightAimer(f.canvas, f.rig, f.models, {
    onPick: (i, p) => picks.push({ i, p }),
    onEnd: (...args) => ended.push(args),
    onMiss: () => misses++,
  });
  aimer.start(2);
  assert.equal(f.rig.controls.enabled, false);
  f.event("pointerdown", 75, 115);
  f.event("pointerup", 75, 115);
  assert.equal(misses, 1);
  assert.equal(aimer.index, 2);
  f.event("pointerdown");
  f.event("pointerup");
  assert.equal(picks.length, 1);
  assert.equal(picks[0].i, 2);
  assert.ok(Math.hypot(...picks[0].p) < 1e-7);
  assert.deepEqual(ended, [[2, true]]);
  assert.equal(f.rig.controls.enabled, true);
  aimer.dispose();
  await f.window.happyDOM.close();
});
test("drag, multitouch, pointer cancellation and Escape never choose an unintended target", async () => {
  const f = fixture();
  let picks = 0;
  const aimer = new LightAimer(f.canvas, f.rig, f.models, {
    onPick: () => {
      picks++;
    },
  });
  aimer.start(0);
  f.event("pointerdown");
  f.event("pointermove", 260, 310);
  f.event("pointerup", 230, 310);
  f.event("pointerdown", 230, 310, 1);
  f.event("pointerdown", 231, 310, 2);
  f.event("pointerup", 230, 310, 1);
  f.event("pointerup", 231, 310, 2);
  f.event("pointerdown");
  f.event("pointercancel");
  f.event("pointerup");
  assert.equal(picks, 0);
  assert.equal(aimer.index, 0);
  f.window.document.dispatchEvent(
    new f.window.KeyboardEvent("keydown", { key: "Escape" }),
  );
  assert.equal(aimer.index, null);
  assert.equal(f.rig.controls.enabled, true);
  assert.equal(picks, 0);
  aimer.dispose();
  await f.window.happyDOM.close();
});
test("aiming is available with the camera locked and preserves that lock after picking or canceling", async () => {
  const f = fixture();
  f.rig.state.camera.locked = true;
  f.rig.controls.enabled = false;
  let picks = 0;
  const aimer = new LightAimer(f.canvas, f.rig, f.models, {
    onPick: () => {
      picks++;
    },
  });
  aimer.start(1);
  f.event("pointerdown");
  f.event("pointerup");
  assert.equal(picks, 1);
  assert.equal(f.rig.controls.enabled, false);
  assert.equal(f.rig.state.camera.locked, true);
  aimer.start(1);
  aimer.cancel();
  assert.equal(picks, 1);
  assert.equal(f.rig.controls.enabled, false);
  aimer.dispose();
  await f.window.happyDOM.close();
});
test("rejected coincident targets leave aiming active and changing the diameter does not change aim", async () => {
  const f = fixture();
  const aimer = new LightAimer(f.canvas, f.rig, f.models, {
    onPick: () => false,
  });
  aimer.start(0);
  f.event("pointerdown");
  f.event("pointerup");
  assert.equal(aimer.index, 0);
  aimer.dispose();
  const project = defaultProject(),
    light = project.lights[0],
    target = light.target.slice(),
    position = light.position.slice();
  light.angle = angleForDiameter(light, 2);
  assert.ok(Math.abs(beamDiameter(light) - 2) < 1e-10);
  assert.deepEqual(light.target, target);
  assert.deepEqual(light.position, position);
  assert.deepEqual(
    validateProject(JSON.parse(serializeProject(project))).lights[0],
    light,
  );
  light.angle = 0.5;
  assert.ok(validateProject(project));
  assert.throws(() => angleForDiameter(light, 0));
  assert.throws(() => angleForDiameter(light, Infinity));
  await f.window.happyDOM.close();
});
