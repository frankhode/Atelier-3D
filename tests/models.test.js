import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import {
  ModelManager,
  bytesToBase64,
  base64ToBytes,
} from "../src/scene/models.js";
import { defaultProject } from "../src/core/defaults.js";
const text = await readFile(
  new URL("../public/models/sala-v04.obj", import.meta.url),
  "utf8",
);
test("reference has 64 named pieces, measured room and staircase ascending +X", () => {
  const root = new OBJLoader().parse(text);
  const first = root.getObjectByName("Peldano_01"),
    last = root.getObjectByName("Peldano_15");
  const bounds = (o) => new THREE.Box3().setFromObject(o);
  const a = bounds(first),
    b = bounds(last);
  assert.equal(root.children.length, 64);
  assert.ok(b.max.y > a.max.y);
  assert.ok(b.min.x > a.max.x);
  assert.ok(
    Math.abs(bounds(root.getObjectByName("Muro_fondo")).max.y - 5.6) < 1e-5,
  );
  assert.ok(
    Math.abs(bounds(root.getObjectByName("pilar_fondo")).min.x - 8.2) < 1e-5,
  );
  assert.ok(
    Math.abs(bounds(root.getObjectByName("Piso_sala")).max.z - 6.5) < 1e-5,
  );
  const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 1000);
  camera.position.set(4.1, 2.5, 13);
  camera.lookAt(4.1, 2.65, 0.8);
  camera.updateMatrixWorld();
  const ac = a.getCenter(new THREE.Vector3()).project(camera),
    bc = b.getCenter(new THREE.Vector3()).project(camera);
  assert.ok(bc.x > ac.x, "higher step must project to the right");
  assert.ok(bc.y > ac.y, "higher step must project upwards");
  assert.ok(root.matrixWorld.determinant() > 0);
});
test("import neutralizes textures and supports stable per-piece visibility and orientation", async () => {
  const state = defaultProject(),
    scene = new THREE.Scene(),
    manager = new ModelManager(scene, state);
  const record = { ...state.models[0], kind: "obj", source: text };
  const entry = await manager.prepare(record);
  manager.mount(entry);
  assert.ok(entry.objects.every((o) => o.mesh.material === manager.material));
  assert.equal(entry.wrapper.scale.x, 1);
  const key = entry.objects[0].key;
  record.hidden = [key];
  manager.apply(record.id);
  assert.equal(entry.objects[0].mesh.visible, false);
  record.transform.rotation = [-90, 0, 0];
  record.transform.scale = 0.01;
  manager.apply(record.id);
  assert.ok(entry.wrapper.matrixWorld.determinant() > 0);
  manager.clear();
  assert.equal(manager.entries.size, 0);
});
test("GLB binary encoding survives JSON without loss", () => {
  const b = Uint8Array.from([103, 108, 84, 70, 0, 255, 128, 1]);
  assert.deepEqual(base64ToBytes(bytesToBase64(b)), b);
});
test("staged imports reject empty geometry while preserving the active scene", async () => {
  const state = defaultProject(),
    manager = new ModelManager(new THREE.Scene(), state);
  const entry = await manager.prepare({
    ...state.models[0],
    kind: "obj",
    source: text,
  });
  manager.mount(entry);
  await assert.rejects(
    manager.prepareProject({
      models: [{ ...state.models[0], kind: "obj", source: "# empty" }],
    }),
  );
  assert.equal(manager.entries.size, 1);
});
// A minimal valid uncompressed GLB triangle exercises the actual binary importer.
function triangleGLB() {
  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
    ],
  };
  const raw = new TextEncoder().encode(JSON.stringify(json));
  const len = Math.ceil(raw.length / 4) * 4;
  const output = new ArrayBuffer(12 + 8 + len + 8 + 36);
  const d = new DataView(output),
    bytes = new Uint8Array(output);
  d.setUint32(0, 0x46546c67, true);
  d.setUint32(4, 2, true);
  d.setUint32(8, output.byteLength, true);
  d.setUint32(12, len, true);
  d.setUint32(16, 0x4e4f534a, true);
  bytes.fill(32, 20, 20 + len);
  bytes.set(raw, 20);
  d.setUint32(20 + len, 36, true);
  d.setUint32(24 + len, 0x004e4942, true);
  new Float32Array(output, 28 + len, 9).set([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  return new Uint8Array(output);
}
test("actual GLB parsing produces neutral geometry and portable source", async () => {
  const s = defaultProject(),
    m = new ModelManager(new THREE.Scene(), s);
  const entry = await m.prepare({
    id: "triangle",
    name: "triangle.glb",
    kind: "glb",
    source: bytesToBase64(triangleGLB()),
    visible: true,
    hidden: [],
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
  });
  assert.equal(entry.objects.length, 1);
  assert.equal(entry.objects[0].mesh.geometry.attributes.position.count, 3);
});
