import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";
import * as THREE from "three";
import { defaultProject } from "../src/core/defaults.js";
import { Interface } from "../src/ui/interface.js";
import { ModelManager } from "../src/scene/models.js";
import { CameraRig } from "../src/scene/camera-rig.js";
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const obj = await readFile(
  new URL("../public/models/sala-v04.obj", import.meta.url),
  "utf8",
);
async function fixture() {
  const window = new Window({ url: "http://localhost" });
  window.document.write(html.replace(/<script[\s\S]*?<\/script>/g, ""));
  globalThis.window = window;
  globalThis.document = window.document;
  const state = defaultProject(),
    models = new ModelManager(new THREE.Scene(), state);
  models.mount(
    await models.prepare({ ...state.models[0], kind: "obj", source: obj }),
  );
  const calls = [];
  const actions = {
    apply: (p) => calls.push(p),
    changed: () => calls.push("changed"),
    notify: () => {},
    importModel: () => {},
    lock: () => {
      state.camera.locked = !state.camera.locked;
    },
    fit: () => {},
    action: (...args) => calls.push(args),
  };
  const ui = new Interface(state, models, actions);
  return { window, state, models, calls, ui, document: window.document };
}
test("panels open one at a time and close when clicking outside", async () => {
  const f = await fixture(),
    d = f.document;
  d.querySelector('[data-panel="objects"]').click();
  assert.equal(d.querySelector("#panel").hidden, false);
  assert.equal(f.ui.activePanel, "objects");
  assert.equal(d.querySelectorAll(".object-row").length, 64);
  d.querySelector('[data-panel="camera"]').click();
  assert.equal(f.ui.activePanel, "camera");
  assert.equal(d.querySelectorAll('[aria-expanded="true"]').length, 1);
  d.querySelector("#viewport").dispatchEvent(
    new f.window.PointerEvent("pointerdown", { bubbles: true }),
  );
  assert.equal(f.ui.activePanel, null);
  assert.equal(d.querySelector("#panel").hidden, true);
  await f.window.happyDOM.close();
});
test("composition title editing updates state and preserves focus", async () => {
  const f = await fixture();
  f.ui.open("project");
  const input = f.document.querySelector('[data-path="title"]');
  input.focus();
  input.value = "Retrato en la escalera";
  input.dispatchEvent(new f.window.Event("input", { bubbles: true }));
  assert.equal(f.state.title, "Retrato en la escalera");
  assert.equal(f.document.activeElement, input);
  assert.equal(
    f.document.getElementById("scene-title").textContent,
    "Retrato en la escalera",
  );
  assert.ok(f.calls.includes("title"));
  await f.window.happyDOM.close();
});
test("individual objects and all-model toggles mutate independent state", async () => {
  const f = await fixture();
  f.ui.open("objects");
  const toggle = f.document.querySelector("[data-object]");
  toggle.checked = false;
  toggle.dispatchEvent(new f.window.Event("input", { bubbles: true }));
  assert.ok(f.state.models[0].hidden.includes(toggle.dataset.object));
  assert.equal(f.models.entries.get("sala-v04").objects[0].mesh.visible, false);
  const modelToggle = f.document.querySelector(
    '[data-path="models.0.visible"]',
  );
  modelToggle.checked = false;
  modelToggle.dispatchEvent(new f.window.Event("input", { bubbles: true }));
  assert.equal(f.state.models[0].visible, false);
  assert.equal(f.state.models[0].hidden.length, 1);
  await f.window.happyDOM.close();
});
test("lighting inputs work without destroying controls and reflect new values", async () => {
  const f = await fixture();
  f.ui.open("lights");
  const input = f.document.querySelector('[data-path="lights.0.intensity"]');
  input.value = "275";
  input.dispatchEvent(new f.window.Event("input", { bubbles: true }));
  assert.equal(f.state.lights[0].intensity, 275);
  assert.equal(
    f.document.querySelector('[data-output="lights.0.intensity"]').textContent,
    "275 cd",
  );
  assert.equal(
    f.document.querySelector('[data-path="lights.0.intensity"]'),
    input,
  );
  await f.window.happyDOM.close();
});
test("camera lock disables optics and view controls while leaving unlock available", async () => {
  const f = await fixture();
  f.state.camera.locked = true;
  f.ui.open("camera");
  assert.equal(f.document.querySelector("fieldset").disabled, true);
  assert.equal(
    f.document.querySelector('[data-path="camera.locked"]').disabled,
    false,
  );
  f.ui.update();
  assert.equal(f.document.querySelector("#fit-camera").disabled, true);
  f.document.querySelector("#camera-lock").click();
  assert.equal(f.state.camera.locked, false);
  assert.equal(f.document.querySelector("fieldset").disabled, false);
  await f.window.happyDOM.close();
});
test("camera preserves scale across projections, uses orthogonal directions and honors lock", async () => {
  const f = await fixture();
  const canvas = f.document.createElement("canvas");
  const rig = new CameraRig(canvas, f.state, () => {});
  rig.resize(0.8);
  const initialDistance = rig.camera.position.distanceTo(rig.controls.target);
  rig.setProjection("orthographic");
  assert.equal(rig.camera.isOrthographicCamera, true);
  rig.setProjection("perspective");
  assert.ok(
    Math.abs(
      rig.camera.position.distanceTo(rig.controls.target) - initialDistance,
    ) < 1e-8,
  );
  rig.setView("front");
  assert.equal(rig.camera.isOrthographicCamera, true);
  assert.ok(rig.camera.position.z > rig.controls.target.z);
  assert.ok(Math.abs(rig.camera.position.x - rig.controls.target.x) < 1e-6);
  rig.setView("top");
  assert.deepEqual(f.state.camera.up, [0, 0, -1]);
  assert.ok(rig.camera.position.y > rig.controls.target.y);
  rig.lock();
  const before = rig.camera.position.clone();
  rig.setView("right");
  rig.setProjection("perspective");
  rig.fit(
    new THREE.Box3(
      new THREE.Vector3(-10, -10, -10),
      new THREE.Vector3(10, 10, 10),
    ),
  );
  assert.deepEqual(rig.camera.position, before);
  assert.equal(rig.controls.enabled, false);
  rig.controls.dispose();
  await f.window.happyDOM.close();
});

test("each light offers scene targeting and beam presets independently of direction", async () => {
  const f = await fixture();
  f.ui.focusLight(2);
  assert.equal(
    f.document.querySelector(".light-card[open]").dataset.light,
    "2",
  );
  const button = f.document.querySelector(
    '[data-action="aim-light"][data-value="2"]',
  );
  button.click();
  assert.deepEqual(f.calls.at(-1), ["aim-light", "2", undefined]);
  assert.equal(
    f.document.querySelector('input[type="range"][data-path$=".angle"]'),
    null,
  );
  const preset = f.document.querySelector(
    '[data-action="beam-preset"][data-id="2"]',
  );
  preset.click();
  assert.deepEqual(f.calls.at(-1), ["beam-preset", "8", "2"]);
  const width = f.document.querySelector('[data-beam-width="2"]');
  width.value = "3.5";
  width.dispatchEvent(new f.window.Event("change", { bubbles: true }));
  assert.deepEqual(f.calls.at(-1), ["beam-width", "3.5", "2"]);
  await f.window.happyDOM.close();
});
test("aim mode frees the scene, announces the selected light and returns to its controls", async () => {
  const f = await fixture();
  f.ui.open("lights");
  f.ui.setLightAiming(1);
  assert.equal(f.document.getElementById("panel").hidden, true);
  assert.equal(f.document.getElementById("light-aim-bar").hidden, false);
  assert.ok(
    f.document.getElementById("light-aim-name").textContent.includes("Luz 2"),
  );
  assert.equal(f.document.querySelector(".dock").inert, true);
  assert.equal(f.document.activeElement.id, "cancel-light-aim");
  f.ui.setLightAiming(null);
  f.ui.focusLight(1);
  assert.equal(f.document.querySelector(".dock").inert, false);
  assert.equal(
    f.document.querySelector(".light-card[open]").dataset.light,
    "1",
  );
  f.ui.showLightTarget(1, { x: 120, y: 200, visible: true });
  assert.equal(f.document.getElementById("light-target-marker").hidden, false);
  assert.equal(
    f.document.getElementById("light-target-marker").style.left,
    "120px",
  );
  f.ui.hideLightTarget();
  assert.equal(f.document.getElementById("light-target-marker").hidden, true);
  await f.window.happyDOM.close();
});

test("concentration is explicit, defaults on, and can be disabled without changing saved lights", async () => {
  const f = await fixture(),
    before = JSON.stringify(f.state.lights);
  f.ui.focusLight(0);
  const checkbox = f.document.querySelector('[data-concentrate="0"]');
  assert.equal(checkbox.checked, true);
  checkbox.checked = false;
  checkbox.dispatchEvent(new f.window.Event("input", { bubbles: true }));
  assert.equal(f.ui.concentrateOnAim[0], false);
  assert.equal(JSON.stringify(f.state.lights), before);
  f.ui.focusLight(0);
  assert.equal(
    f.document.querySelector('[data-concentrate="0"]').checked,
    false,
  );
  await f.window.happyDOM.close();
});
test("solo has a visible exit and each light offers moving its origin from the current view", async () => {
  const f = await fixture();
  f.ui.setSoloLight(2);
  f.ui.focusLight(2);
  assert.equal(f.document.querySelector("#lighting-solo").hidden, false);
  assert.ok(
    f.document.querySelector("#lighting-solo").textContent.includes("3"),
  );
  f.document
    .querySelector('[data-action="light-from-view"][data-value="2"]')
    .click();
  assert.deepEqual(f.calls.at(-1), ["light-from-view", "2", undefined]);
  f.document.querySelector("#lighting-solo").click();
  assert.deepEqual(f.calls.at(-1), ["solo-light", "clear"]);
  f.ui.setSoloLight(null);
  assert.equal(f.document.querySelector("#lighting-solo").hidden, true);
  await f.window.happyDOM.close();
});
