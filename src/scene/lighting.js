import * as THREE from "three";
import { SurfaceLighting } from "./surface-lighting.js";
export class Lighting {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.soloIndex = null;
    this.surfaces = new SurfaceLighting(scene, state);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.12);
    scene.add(this.ambient);
    this.lights = state.lights.map(() => {
      const light = new THREE.SpotLight(0xffffff, 100, 0, Math.PI / 4, 0.5, 2);
      light.shadow.bias = -0.0001;
      light.shadow.normalBias = 0.015;
      light.shadow.camera.near = 0.05;
      light.shadow.camera.far = 200;
      scene.add(light, light.target);
      return light;
    });
    this.helpers = this.lights.map((light) => {
      const helper = new THREE.SpotLightHelper(light, 0xd0b77b);
      scene.add(helper);
      return helper;
    });
    this.axes = new THREE.AxesHelper(1.4);
    this.axes.position.set(0, 0.02, 6.5);
    scene.add(this.axes);
    this.grid = new THREE.GridHelper(24, 24, 0x73847f, 0x444c4c);
    this.grid.position.set(4.1, -0.21, 3.25);
    scene.add(this.grid);
    this.apply();
  }
  setSolo(index) {
    if (
      index !== null &&
      (!Number.isInteger(index) || !this.state.lights[index])
    )
      return;
    this.soloIndex = index;
    this.apply();
  }
  apply() {
    this.ambient.intensity =
      this.soloIndex === null && !this.state.pictorial?.enabled && !this.state.surfaces?.enabled ? this.state.appearance.ambient : 0;
    const mapSize = this.state.appearance.quality === "high" ? 2048 : 1024;
    this.lights.forEach((light, i) => {
      const s = this.state.lights[i];
      light.visible =
        s.enabled && !this.state.pictorial?.enabled && !this.state.surfaces?.enabled && (this.soloIndex === null || this.soloIndex === i);
      light.intensity = s.intensity;
      light.position.fromArray(s.position);
      light.target.position.fromArray(s.target);
      light.angle = THREE.MathUtils.degToRad(s.angle);
      light.penumbra = s.penumbra;
      light.castShadow = s.shadows;
      if (light.shadow.mapSize.x !== mapSize) {
        light.shadow.map?.dispose();
        light.shadow.map = null;
        light.shadow.mapSize.set(mapSize, mapSize);
      }
      light.target.updateMatrixWorld();
      light.updateMatrixWorld();
      this.helpers[i].visible = this.state.appearance.helpers && light.visible;
      this.helpers[i].update();
    });
    this.surfaces.apply();
    this.axes.visible = this.grid.visible = this.state.appearance.helpers;
  }
}

