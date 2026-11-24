import * as THREE from "three";
import { beamDiameter } from "../core/light-beam.js";

const clampAngle = (angle) => Math.min(85, Math.max(0.5, angle));

// Concentration is explicit in the UI; the origin never moves when choosing a target.
export function aimLight(light, point, concentrate = false, normal = null) {
  if (
    !Array.isArray(point) ||
    point.length !== 3 ||
    !point.every(Number.isFinite)
  )
    throw new Error("Elegí un punto válido de la escena.");
  const distance = Math.hypot(...point.map((n, i) => n - light.position[i]));
  if (distance < 0.001)
    throw new Error("Elegí un punto distinto del origen de la luz.");
  light.target = point.slice();
  if (concentrate) {
    // Compensate the elongated footprint at grazing incidence, e.g. a source
    // near the back wall pointing almost parallel to it. A fixed 8° cone can
    // still cover the entire wall there.
    const incidence = normal
      ? Math.abs(
          new THREE.Vector3(...normal)
            .normalize()
            .dot(
              new THREE.Vector3(...light.position)
                .sub(new THREE.Vector3(...point))
                .normalize(),
            ),
        )
      : 1;
    const angle =
      (Math.atan((1.5 * incidence) / (2 * distance)) * 180) / Math.PI;
    light.angle = Math.min(light.angle, clampAngle(angle));
  }
}

// A point picked from this camera has an unobstructed camera-to-surface ray.
// Preserve the approximate beam width at the target while changing its origin.
export function lightFromView(light, camera) {
  const origin = camera.getWorldPosition(new THREE.Vector3()).toArray();
  const width = beamDiameter(light);
  const distance = Math.hypot(...origin.map((n, i) => n - light.target[i]));
  if (distance < 0.001)
    throw new Error("Alejá un poco la cámara del punto iluminado.");
  light.position = origin;
  light.angle = clampAngle((Math.atan(width / (2 * distance)) * 180) / Math.PI);
}
