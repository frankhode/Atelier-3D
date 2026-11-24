import * as THREE from "three";

// Only actual, visible model surfaces participate. Guides and hidden ancestors do not.
export function pickSurface(clientX, clientY, canvas, camera, models) {
  const rect = canvas.getBoundingClientRect();
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  )
    return null;
  const point = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    (-(clientY - rect.top) / rect.height) * 2 + 1,
  );
  const meshes = [];
  for (const entry of models.entries.values()) {
    entry.wrapper.updateWorldMatrix(true, true);
    for (const object of entry.objects) {
      let visible = true;
      for (let node = object.mesh; node; node = node.parent)
        if (!node.visible) {
          visible = false;
          break;
        }
      if (visible) meshes.push(object.mesh);
    }
  }
  camera.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(point, camera);
  return ray.intersectObjects(meshes, false)[0]?.point ?? null;
}

export function projectToCanvas(point, camera, canvas) {
  camera.updateMatrixWorld(true);
  const ndc = new THREE.Vector3(...point).project(camera);
  const rect = canvas.getBoundingClientRect();
  return {
    x: rect.left + ((ndc.x + 1) * rect.width) / 2,
    y: rect.top + ((1 - ndc.y) * rect.height) / 2,
    visible:
      Number.isFinite(ndc.x) &&
      Number.isFinite(ndc.y) &&
      Math.abs(ndc.x) <= 1 &&
      Math.abs(ndc.y) <= 1 &&
      Math.abs(ndc.z) <= 1,
  };
}

export class LightAimer {
  constructor(canvas, rig, models, callbacks) {
    this.canvas = canvas;
    this.rig = rig;
    this.models = models;
    this.callbacks = callbacks;
    this.index = null;
    this.pointers = new Set();
    this.gesture = null;
    this.down = (event) => {
      if (this.index === null) return;
      event.preventDefault();
      this.pointers.add(event.pointerId);
      this.canvas.setPointerCapture?.(event.pointerId);
      if (this.pointers.size > 1) {
        if (this.gesture) this.gesture.moved = true;
        return;
      }
      if (event.button !== 0) return;
      this.gesture = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        moved: false,
      };
    };
    this.move = (event) => {
      if (
        this.gesture?.id === event.pointerId &&
        Math.hypot(
          event.clientX - this.gesture.x,
          event.clientY - this.gesture.y,
        ) > 8
      )
        this.gesture.moved = true;
    };
    this.up = (event) => {
      if (this.index === null) return;
      const gesture = this.gesture;
      this.pointers.delete(event.pointerId);
      if (gesture?.id !== event.pointerId) return;
      this.gesture = null;
      if (
        gesture.moved ||
        event.type === "pointercancel" ||
        Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8
      )
        return;
      const hit = pickSurface(
        event.clientX,
        event.clientY,
        this.canvas,
        this.rig.camera,
        this.models,
      );
      if (!hit) {
        this.callbacks.onMiss?.();
        return;
      }
      if (this.callbacks.onPick(this.index, hit.toArray()) !== false)
        this.finish(true);
    };
    this.cancelGesture = (event) => {
      this.pointers.delete(event.pointerId);
      if (this.gesture?.id === event.pointerId) this.gesture = null;
    };
    this.key = (event) => {
      if (event.key === "Escape" && this.index !== null) {
        event.preventDefault();
        this.cancel();
      }
    };
    canvas.addEventListener("pointerdown", this.down);
    canvas.addEventListener("pointermove", this.move);
    canvas.addEventListener("pointerup", this.up);
    canvas.addEventListener("pointercancel", this.cancelGesture);
    canvas.addEventListener("lostpointercapture", this.cancelGesture);
    canvas.ownerDocument.addEventListener("keydown", this.key);
  }
  start(index) {
    if (this.index !== null) this.cancel();
    this.index = index;
    this.gesture = null;
    this.pointers.clear();
    this.wasEnabled = this.rig.controls.enabled;
    this.rig.controls.enabled = false;
    this.callbacks.onStart?.(index);
  }
  finish(picked) {
    if (this.index === null) return;
    const index = this.index;
    for (const pointer of this.pointers)
      if (this.canvas.hasPointerCapture?.(pointer))
        this.canvas.releasePointerCapture(pointer);
    this.index = null;
    this.gesture = null;
    this.pointers.clear();
    this.rig.controls.enabled =
      this.wasEnabled && !this.rig.state.camera.locked;
    this.callbacks.onEnd?.(index, picked);
  }
  cancel() {
    this.finish(false);
  }
  dispose() {
    this.cancel();
    for (const [type, handler] of [
      ["pointerdown", this.down],
      ["pointermove", this.move],
      ["pointerup", this.up],
      ["pointercancel", this.cancelGesture],
      ["lostpointercapture", this.cancelGesture],
    ])
      this.canvas.removeEventListener(type, handler);
    this.canvas.ownerDocument.removeEventListener("keydown", this.key);
  }
}
