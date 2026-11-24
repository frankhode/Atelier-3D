import test from "node:test";
import assert from "node:assert/strict";
import { defaultProject } from "../src/core/defaults.js";
import { validateProject, serializeProject } from "../src/core/project.js";
import { readLocal, saveLocal, STORAGE_KEY } from "../src/core/storage.js";
import { fitFrame } from "../src/scene/renderer.js";

test("a portable JSON round trip preserves camera, lights, transforms and visibility", () => {
  const p = defaultProject();
  p.title = "Estudio 40 × 50";
  p.camera.projection = "orthographic";
  p.camera.locked = true;
  p.camera.zoom = 1.7;
  p.frame = { ratio: "4:5", thirds: true };
  p.lights[1].enabled = false;
  p.models[0].hidden = ["0/3"];
  p.models.push({
    id: "test-model",
    name: "pieza.obj",
    kind: "obj",
    source: "o test\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3",
    visible: true,
    hidden: [],
    transform: { position: [1, 2, 3], rotation: [-90, 0, 0], scale: 0.001 },
  });
  assert.deepEqual(validateProject(JSON.parse(serializeProject(p))), p);
});
test("invalid projects cannot introduce reflected, degenerate or nonfinite transforms", () => {
  for (const edit of [
    (p) => (p.models[0].transform.scale = -1),
    (p) => (p.camera.position = p.camera.target),
    (p) => (p.camera.up = [0, 0, 0]),
    (p) => (p.lights[0].intensity = Infinity),
    (p) => p.models.push(p.models[0]),
    (p) => (p.frame.ratio = "unknown"),
    (p) => (p.version = 2),
    (p) => (p.models[0].hidden = "bad"),
  ]) {
    const p = defaultProject();
    edit(p);
    assert.throws(() => validateProject(p));
  }
});
test("only known properties enter the applied state", () => {
  const p = defaultProject();
  p.untrusted = "extra";
  p.camera.matrix = "injected";
  assert.equal(validateProject(p).untrusted, undefined);
  assert.equal(validateProject(p).camera.matrix, undefined);
});
test("fixed frame fits the display and preserves exact ratio", () => {
  for (const [w, h] of [
    [1440, 900],
    [360, 800],
    [800, 360],
  ])
    for (const ratio of [0.8, 1.25, 1, 16 / 9]) {
      const f = fitFrame(w, h, ratio);
      assert.ok(f.width <= w && f.height <= h);
      assert.ok(Math.abs(f.width / f.height - ratio) < 1e-10);
    }
});
test("local storage falls back to parameters if model bytes exceed quota", () => {
  const p = defaultProject();
  p.models.push({
    id: "large",
    name: "large.obj",
    kind: "obj",
    source: "x".repeat(10000),
    visible: true,
    hidden: [],
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
  });
  const data = new Map();
  const storage = {
    setItem(k, v) {
      if (v.length > 8000) throw new Error("quota");
      data.set(k, v);
    },
    getItem: (k) => data.get(k),
  };
  assert.equal(saveLocal(p, storage), "parameters");
  const loaded = readLocal(storage);
  assert.equal(loaded.project.models[1].source, null);
  assert.equal(loaded.project.models[1].name, "large.obj");
});
test("unavailable and corrupt browser storage are recoverable", () => {
  const bad = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(saveLocal(defaultProject(), bad), "unavailable");
  assert.ok(readLocal(bad).error);
  assert.ok(readLocal({ getItem: () => "{bad json" }).error);
  const data = new Map();
  const store = {
    setItem: (k, v) => data.set(k, v),
    getItem: (k) => data.get(k),
  };
  assert.equal(saveLocal(defaultProject(), store), "complete");
  assert.ok(data.has(STORAGE_KEY));
  assert.deepEqual(readLocal(store).project, defaultProject());
});
