import { buildPuppet } from "./puppets.js";
import { BounceStudy } from "./bounce-study.js";
import { PictorialStudy } from "./pictorial-study.js";
import { pictorialZone } from "../core/pictorial.js";
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MAX_MODEL_BYTES } from "../core/defaults.js";
const referenceURL = `${import.meta.env?.BASE_URL ?? "/"}models/sala-v04.obj`;
export function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function base64ToBytes(text) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
export async function recordFromFile(file) {
  if (file.size > MAX_MODEL_BYTES)
    throw new Error(
      "El modelo supera los 32 MB. Reducí su geometría antes de importarlo.",
    );
  const kind = file.name.split(".").pop().toLowerCase();
  if (!["obj", "glb"].includes(kind))
    throw new Error("Elegí un archivo OBJ o GLB.");
  const data = new Uint8Array(await file.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", data);
  const id = `modelo-${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")}`;
  return {
    id,
    name: file.name,
    kind,
    source:
      kind === "obj" ? new TextDecoder().decode(data) : bytesToBase64(data),
    visible: true,
    hidden: [],
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
  };
}
function disposeMaterial(material) {
  if (!material) return;
  for (const value of Object.values(material))
    if (value?.isTexture) {
      value.dispose();
      value.source?.data?.close?.();
    }
  material.dispose();
}
export function disposeTree(root, disposeMaterials = false) {
  const geometries = new Set(),
    materials = new Set();
  root.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    if (disposeMaterials && o.material)
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        materials.add(m),
      );
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach(disposeMaterial);
}
export class ModelManager {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.entries = new Map();
    this.material = new THREE.MeshStandardMaterial({
      color: state.appearance.material,
      roughness: 0.95,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    this.referenceText = null;
    this.study = new PictorialStudy(state);
    this.bounceStudy = new BounceStudy(state, this.material);
  }
  async parse(record) {
    if (record.kind === "puppet") return buildPuppet(record.pose, this.material, record.poseRotation, record.poseRig).root;
    if (record.kind === "builtin") {
      if (!this.referenceText) {
        const response = await fetch(referenceURL);
        if (!response.ok)
          throw new Error("No se pudo cargar la sala de referencia.");
        this.referenceText = await response.text();
      }
      return new OBJLoader().parse(this.referenceText);
    }
    if (!record.source) return null;
    if (record.kind === "obj") return new OBJLoader().parse(record.source);
    // Self-contained models only. Prevent loaders from fetching external dependencies.
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      if (!url.startsWith("blob:") && !url.startsWith("data:"))
        throw new Error("El GLB debe incluir todos sus recursos.");
      return url;
    });
    const gltf = await new GLTFLoader(manager).parseAsync(
      base64ToBytes(record.source).buffer,
      "",
    );
    return gltf.scene;
  }
  async prepare(record) {
    const root = await this.parse(record);
    if (!root) return null;
    const wrapper = new THREE.Group();
    wrapper.name = record.name;
    wrapper.add(root);
    const objects = [],
      oldMaterials = new Set();
    const walk = (node, path) => {
      // Imported cameras/lights never affect the studio rig.
      for (const [i, child] of [...node.children].entries()) {
        if (child.isLight || child.isCamera) {
          node.remove(child);
          continue;
        }
        walk(child, `${path}/${i}`);
      }
      if (node.isMesh) {
        if (node.material)
          (Array.isArray(node.material)
            ? node.material
            : [node.material]
          ).forEach((m) => oldMaterials.add(m));
        node.material = this.material;
        node.userData.pictorialZone = pictorialZone(node.name);
        node.castShadow = true;
        node.receiveShadow = true;
        const key = path || "0";
        node.userData.atelierKey = key;
        objects.push({
          key,
          name: node.name || `Objeto ${objects.length + 1}`,
          mesh: node,
        });
      } else if (node.isLine || node.isPoints) {
        node.visible = false;
      }
    };
    walk(root, "0");
    oldMaterials.delete(this.material);
    oldMaterials.forEach(disposeMaterial);
    if (!objects.length) {
      disposeTree(wrapper);
      throw new Error("El archivo no contiene superficies tridimensionales.");
    }
    const bounds = new THREE.Box3().setFromObject(wrapper);
    if (
      bounds.isEmpty() ||
      ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)
    ) {
      disposeTree(wrapper);
      throw new Error("La geometría del archivo no es válida.");
    }
    objects.sort((a, b) =>
      a.key.localeCompare(b.key, undefined, { numeric: true }),
    );
    return { record, wrapper, objects };
  }
  mount(entry) {
    if (!entry) return;
    this.entries.set(entry.record.id, entry);
    this.scene.add(entry.wrapper);
    this.apply(entry.record.id);
  }
  apply(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    const { record, wrapper, objects } = entry;
    wrapper.visible = record.visible;
    wrapper.position.fromArray(record.transform.position);
    wrapper.rotation.set(
      ...record.transform.rotation.map(THREE.MathUtils.degToRad),
    );
    wrapper.scale.setScalar(record.transform.scale); // Positive, uniform scale: no accidental mirror.
    objects.forEach((o) => {
      o.mesh.visible = !record.hidden.includes(o.key);
    });
    wrapper.updateMatrixWorld(true);
    this.applyLook();
  }
  async loadBounces() {
    const ok = await this.bounceStudy.load(this.referenceText);
    this.applyLook();
    return ok;
  }
  applyLook() {
    this.study.apply();
    this.bounceStudy.apply();
    const useBounces = this.state.surfaces?.enabled && this.bounceStudy.ready &&
      this.state.models.some(m=>m.id==="sala-v04" && m.visible);
    for (const entry of this.entries.values()) for (const object of entry.objects) {
      object.mesh.material = this.state.pictorial?.enabled ? this.study.materialFor(object.mesh.userData.pictorialZone || "other") : useBounces ? this.bounceStudy.material : this.material;
    }
  }
  remove(id) {
    const entry = this.entries.get(id);
    if (entry) {
      this.scene.remove(entry.wrapper);
      disposeTree(entry.wrapper);
      this.entries.delete(id);
    }
  }
  clear() {
    [...this.entries.keys()].forEach((id) => this.remove(id));
  }
  bounds(id, precise = true) {
    const bounds = new THREE.Box3();
    for (const [key, entry] of this.entries) {
      if ((id && key !== id) || !entry.wrapper.visible) continue;
      entry.wrapper.updateMatrixWorld(true);
      entry.objects.forEach((o) => {
        if (o.mesh.visible) bounds.expandByObject(o.mesh, precise);
      });
    }
    return bounds;
  }
  async prepareProject(project) {
    const staged = [];
    try {
      for (const record of project.models) {
        const entry = await this.prepare(record);
        if (entry) staged.push(entry);
      }
      return staged;
    } catch (error) {
      staged.forEach((entry) => disposeTree(entry.wrapper));
      throw error;
    }
  }
}

