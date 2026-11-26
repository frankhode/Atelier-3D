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
test("the single menu starts closed, opens one panel at a time and leaves the scene usable", async () => {
  const f = await fixture(), d = f.document;
  const menu = d.querySelector("#main-menu"), toggle = d.querySelector("#menu-toggle");
  assert.equal(menu.hidden,true);
  assert.equal(d.querySelector("#panel").hidden,true);
  toggle.click();
  assert.equal(menu.hidden,false);
  assert.equal(toggle.getAttribute("aria-expanded"),"true");
  d.querySelector('[data-panel="objects"]').click();
  assert.equal(menu.hidden,true);
  assert.equal(d.querySelector("#panel").hidden,false);
  assert.equal(f.ui.activePanel,"objects");
  assert.equal(d.querySelectorAll(".object-row").length,64);
  toggle.click();
  d.querySelector('[data-panel="camera"]').click();
  assert.equal(f.ui.activePanel,"camera");
  assert.equal(d.querySelectorAll('[data-panel][aria-expanded="true"]').length,1);
  toggle.click();
  d.querySelector("#viewport").dispatchEvent(new f.window.PointerEvent("pointerdown",{bubbles:true}));
  assert.equal(menu.hidden,true);
  assert.equal(f.ui.activePanel,"camera","the editor remains open when navigating the scene");
  d.querySelector("#close-panel").click();
  assert.equal(f.ui.activePanel,null);
  assert.equal(d.querySelector("#panel").hidden,true);
  assert.equal(toggle.getAttribute("aria-expanded"),"false");
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
  assert.equal(f.document.querySelector("#menu-toggle").inert, true);
  assert.equal(f.document.activeElement.id, "cancel-light-aim");
  f.ui.setLightAiming(null);
  f.ui.focusLight(1);
  assert.equal(f.document.querySelector("#menu-toggle").inert, false);
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

test("source XYZ controls and the plan appear before the destination and remain editable without losing focus", async () => {
  const f = await fixture();
  f.ui.focusLight(0);
  const card = f.document.querySelector(".light-card[open]");
  const origin = card.querySelector(".light-origin-controls"),
    destination = card.querySelector(".light-target-controls");
  assert.ok(
    origin.compareDocumentPosition(destination) &
      f.window.Node.DOCUMENT_POSITION_FOLLOWING,
  );
  const input = origin.querySelector('[data-path="lights.0.position.1"]');
  assert.ok(input);
  assert.equal(input.closest("details").className, "light-card");
  input.focus();
  input.value = "4.8";
  input.dispatchEvent(new f.window.Event("input", { bubbles: true }));
  assert.equal(f.state.lights[0].position[1], 4.8);
  assert.equal(f.document.activeElement, input);
  assert.ok(f.calls.includes("lights.0.position.1"));
  await f.window.happyDOM.close();
});
test("one plan tap moves horizontal source coordinates while preserving height; drags do not place it", async () => {
  const f = await fixture();
  f.ui.focusLight(0);
  const plan = f.document.querySelector('[data-light-plan="0"]'),
    svg = plan.querySelector("svg");
  svg.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 300,
    height: 200,
  });
  const event = (type, x, y) =>
    svg.dispatchEvent(
      new f.window.PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        button: 0,
        clientX: x,
        clientY: y,
      }),
    );
  event("pointerdown", 150, 100);
  event("pointerup", 150, 100);
  const action = f.calls.at(-1);
  assert.equal(action[0], "light-origin");
  assert.equal(action[1][1], f.state.lights[0].position[1]);
  assert.equal(action[2], "0");
  assert.equal(action[1].length, 3);
  const count = f.calls.length;
  event("pointerdown", 150, 100);
  event("pointermove", 150, 130);
  event("pointerup", 150, 100);
  assert.equal(f.calls.length, count);
  await f.window.happyDOM.close();
});
test("source plan supports keyboard movement and origin presets without changing the destination", async () => {
  const f = await fixture();
  f.ui.focusLight(1);
  const target = f.state.lights[1].target.slice(),
    plan = f.document.querySelector('[data-light-plan="1"]');
  plan.focus();
  plan.dispatchEvent(
    new f.window.KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }),
  );
  const action = f.calls.at(-1);
  assert.equal(action[0], "light-origin");
  assert.equal(action[1][0], f.state.lights[1].position[0] + 0.25);
  assert.deepEqual(f.state.lights[1].target, target);
  const preset = f.document.querySelector('[data-origin-preset="1"]');
  preset.value = "front";
  preset.dispatchEvent(new f.window.Event("change", { bubbles: true }));
  assert.deepEqual(f.calls.at(-1), ["origin-preset", "front", "1"]);
  await f.window.happyDOM.close();
});
test("3D guides show source and direction, explicitly identify an offscreen origin, and hide completely", async () => {
  const f = await fixture(),
    rect = { left: 10, top: 20, width: 300, height: 200 };
  f.ui.showLightOrigin(
    0,
    { x: 70, y: 80, visible: true, inFront: true },
    { x: 160, y: 100, visible: true, inFront: true },
    rect,
  );
  assert.equal(f.document.querySelector("#light-origin-marker").hidden, false);
  assert.equal(
    f.document.querySelector("#light-path-overlay").hasAttribute("hidden"),
    false,
  );
  assert.equal(
    f.document.querySelector("#light-path-overlay line").getAttribute("x1"),
    "60",
  );
  assert.equal(
    f.document.querySelector("#light-path-overlay line").getAttribute("x2"),
    "150",
  );
  f.ui.showLightOrigin(
    0,
    { x: 400, y: 80, visible: false, inFront: true },
    { x: 160, y: 100, inFront: true },
    rect,
  );
  assert.equal(f.document.querySelector("#light-origin-marker").hidden, true);
  assert.ok(
    f.document
      .querySelector("#light-origin-status")
      .textContent.includes("fuera del encuadre"),
  );
  f.ui.hideLightTarget();
  assert.equal(
    f.document.querySelector("#light-path-overlay").hasAttribute("hidden"),
    true,
  );
  assert.equal(f.document.querySelector("#light-origin-status").hidden, true);
  await f.window.happyDOM.close();
});


test("the surface mode exposes four intensity controls and updates them independently", async () => {
  const f = await fixture();
  f.state.surfaces.enabled = true;
  f.ui.open("lights");
  assert.equal(f.document.querySelector("#panel-title").textContent, "Paredes luminosas");
  assert.equal(f.document.querySelectorAll('input[type="range"]').length, 4);
  const left = f.document.querySelector('[data-path="surfaces.left"]');
  left.value = "0.45";
  left.dispatchEvent(new f.window.Event("input", {bubbles: true}));
  assert.equal(f.state.surfaces.left, 0.45);
  assert.equal(f.state.surfaces.upper, 1);
  assert.equal(f.state.surfaces.right, 0.08);
  assert.ok(f.calls.includes("surfaces.left"));
  const bounce = f.document.querySelector('[data-path="surfaces.bounce"]');
  bounce.value = "0.7";
  bounce.dispatchEvent(new f.window.Event("input", {bubbles:true}));
  assert.equal(f.state.surfaces.bounce, 0.7);
  assert.equal(f.state.surfaces.left, 0.45);
  assert.equal(f.document.querySelector('[data-output="surfaces.bounce"]').textContent,"70%");
  assert.equal(f.document.querySelector('[data-output="surfaces.left"]').textContent,"45%");
  assert.ok(f.document.querySelector('[data-action="surface-mode"].active'));
  assert.ok(f.document.querySelector('[data-action="pictorial-mode"][data-value="true"]'));
  await f.window.happyDOM.close();
});


test("pose workshop displays anatomical joint ranges and the ten composition presets", async ()=>{
  const f=await fixture();
  const {newPuppet}=await import("../src/core/puppets.js");
  const editor={active:true,record:newPuppet("Prueba"),joint:"lKnee",contextual:false,nameDraft:""};
  f.ui.actions.editor=editor;
  f.ui.open("poseEditor");
  let rows=[...f.document.querySelectorAll('.pose-axes input[type=range]')];
  assert.equal(rows.length,1);assert.equal(rows[0].min,"0");assert.equal(rows[0].max,"145");
  assert.equal(f.document.querySelectorAll('option[value^="composition:"]').length,10);
  editor.joint="rElbow";f.ui.refresh();
  rows=[...f.document.querySelectorAll('.pose-axes input[type=range]')];
  assert.equal(rows.length,2);assert.equal(rows[0].max,"150");assert.equal(rows[0].min,"0");
  assert.equal(f.document.querySelectorAll('[data-action="puppet-adjust"]').length,4);
  editor.record.pose.rElbow[0]=-45;f.ui.syncPoseControls();
  assert.equal(rows[0].value,"45");
  await f.window.happyDOM.close();
});
