import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
const VIEWS = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  top: [0, 1, 0],
  bottom: [0, -1, 0],
};
export class CameraRig {
  constructor(canvas, state, changed) {
    this.state = state;
    this.canvas = canvas;
    this.changed = changed;
    this.aspect = 1;
    this.perspective = new THREE.PerspectiveCamera(48, 1, 0.01, 1000000);
    this.orthographic = new THREE.OrthographicCamera(
      -4,
      4,
      4,
      -4,
      0.01,
      1000000,
    );
    this.restore();
  }
  restore() {
    this.controls?.dispose();
    const c = this.state.camera;
    this.camera =
      c.projection === "perspective" ? this.perspective : this.orthographic;
    this.camera.position.fromArray(c.position);
    this.camera.up.fromArray(c.up).normalize();
    this.camera.zoom = c.projection === "perspective" ? 1 : c.zoom;
    this.perspective.fov = c.fov;
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.fromArray(c.target);
    this.controls.enableDamping = false;
    this.controls.minDistance = 0.05;
    this.controls.maxDistance = 100000;
    this.controls.minZoom = 0.01;
    this.controls.maxZoom = 1000;
    this.controls.enabled = !c.locked;
    this.controls.update();
    this.resize(this.aspect);
    this.controls.addEventListener("change", () => {
      this.capture();
      this.changed();
    });
  }
  capture() {
    const c = this.state.camera;
    c.position = this.camera.position.toArray();
    c.target = this.controls.target.toArray();
    c.up = this.camera.up.toArray();
    c.zoom = this.camera.isOrthographicCamera ? this.camera.zoom : 1;
  }
  resize(aspect) {
    this.aspect = aspect;
    this.perspective.aspect = aspect;
    this.perspective.updateProjectionMatrix();
    const h = this.state.camera.orthoSize;
    this.orthographic.left = (-h * aspect) / 2;
    this.orthographic.right = (h * aspect) / 2;
    this.orthographic.top = h / 2;
    this.orthographic.bottom = -h / 2;
    this.orthographic.updateProjectionMatrix();
  }
  setProjection(projection) {
    if (this.state.camera.locked || projection === this.state.camera.projection)
      return;
    this.capture();
    const c = this.state.camera,
      distance = this.camera.position.distanceTo(this.controls.target);
    if (projection === "orthographic") {
      c.orthoSize =
        2 * distance * Math.tan(THREE.MathUtils.degToRad(c.fov / 2));
      c.zoom = 1;
    } else {
      const distance2 =
        c.orthoSize /
        c.zoom /
        (2 * Math.tan(THREE.MathUtils.degToRad(c.fov / 2)));
      c.position = this.camera.position
        .clone()
        .sub(this.controls.target)
        .normalize()
        .multiplyScalar(distance2)
        .add(this.controls.target)
        .toArray();
    }
    c.projection = projection;
    this.restore();
    this.changed();
  }
  setView(name) {
    if (this.state.camera.locked) return;
    const dir = VIEWS[name];
    if (!dir) return;
    this.setProjection("orthographic");
    const distance = this.camera.position.distanceTo(this.controls.target);
    this.state.camera.position = new THREE.Vector3(...dir)
      .multiplyScalar(distance)
      .add(this.controls.target)
      .toArray();
    this.state.camera.up =
      name === "top" ? [0, 0, -1] : name === "bottom" ? [0, 0, 1] : [0, 1, 0];
    this.restore();
    this.changed();
  }
  fit(bounds) {
    if (this.state.camera.locked || bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3()),
      radius = Math.max(
        bounds.getBoundingSphere(new THREE.Sphere()).radius,
        0.1,
      );
    const direction = this.camera.position
      .clone()
      .sub(this.controls.target)
      .normalize();
    const halfFov = THREE.MathUtils.degToRad(this.state.camera.fov / 2);
    const limitingAngle = Math.min(
      halfFov,
      Math.atan(Math.tan(halfFov) * this.aspect),
    );
    const distance = (radius / Math.sin(limitingAngle)) * 1.08;
    this.state.camera.position = center
      .clone()
      .add(direction.multiplyScalar(distance))
      .toArray();
    this.state.camera.target = center.toArray();
    this.state.camera.orthoSize = (radius * 2.2) / Math.min(1, this.aspect);
    this.state.camera.zoom = 1;
    this.restore();
    this.changed();
  }
  lock() {
    this.state.camera.locked = !this.state.camera.locked;
    this.controls.enabled = !this.state.camera.locked;
    this.changed();
  }
}
