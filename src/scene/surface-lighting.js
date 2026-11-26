import * as THREE from "three";

// Fixed emitters in the reference room's local coordinates. Broad, distributed
// samples approximate rectangular emitters with actual occlusion by the room.
// No mesh/emissive panel is added: the source is invisible to the camera.
export const SURFACE_SPOT_ANGLE = 52;
export const SURFACE_SPOT_PENUMBRA = 0.75;
export const SURFACE_PANELS = [
  // The upper adjoining room extends from x=8.4 to 11.2, y=2.8 to 5.6.
  // Two inward-facing walls near the stair opening (z=0..1.4).
  { group: "upper", normal: [-1, -0.12, 0], power: 420,
    samples: [[11.12, 3.45, 0.85], [11.12, 4.65, 1.65]] },
  { group: "upper", normal: [-0.85, -0.08, 0.5], power: 180,
    samples: [[8.85, 3.6, 0.14], [10.1, 4.6, 0.14]] },
  // Secondary sources on opposite sides, behind the left French window and
  // the two right-hand openings below the upper storey, at figure height.
  { group: "left", normal: [1, 0, 0], power: 300,
    samples: [[-1.25, 1.15, 2.45], [-1.25, 2.05, 3.95]] },
  { group: "right", normal: [-1, 0, 0], power: 230,
    samples: [[9.65, 1.15, 2.40], [9.65, 2.05, 4.45]] },
];

export class SurfaceLighting {
  constructor(scene, state) {
    this.state = state;
    this.samples = SURFACE_PANELS.flatMap(panel => panel.samples.map(origin => {
      const light = new THREE.SpotLight(0xffffff, 0, 0, THREE.MathUtils.degToRad(SURFACE_SPOT_ANGLE), SURFACE_SPOT_PENUMBRA, 2);
      light.name = "Superficie · " + panel.group;
      light.castShadow = true;
      light.shadow.bias = -0.0009;
      light.shadow.normalBias = 0.055;
      light.visible = false;
      scene.add(light, light.target);
      return { panel, origin, light };
    }));
  }
  apply() {
    const state = this.state;
    const active = state.surfaces?.enabled && !state.pictorial?.enabled;
    const transform = state.models.find(model => model.id === "sala-v04")?.transform;
    const scale = transform?.scale ?? 1;
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...(transform?.position ?? [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(
        ...(transform?.rotation ?? [0, 0, 0]).map(THREE.MathUtils.degToRad)
      )),
      new THREE.Vector3(scale, scale, scale)
    );
    const size = state.appearance.quality === "high" ? 2048 : 1024;
    for (const { panel, origin, light } of this.samples) {
      const strength = active ? state.surfaces[panel.group] : 0;
      light.visible = strength > 0;
      light.intensity = panel.power * strength * scale ** 2 / panel.samples.length;
      light.position.set(...origin).applyMatrix4(matrix);
      light.target.position.set(...origin).add(new THREE.Vector3(...panel.normal)).applyMatrix4(matrix);
      light.shadow.camera.near = 0.05 * scale;
      light.shadow.camera.far = 40 * scale;
      light.shadow.normalBias = 0.055 * scale;
      if (light.shadow.mapSize.x !== size) {
        light.shadow.map?.dispose();
        light.shadow.map = null;
        light.shadow.mapSize.set(size, size);
      }
      light.target.updateMatrixWorld();
      light.updateMatrixWorld();
    }
  }
}
