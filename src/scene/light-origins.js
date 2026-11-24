import * as THREE from "three";

export const ORIGIN_PRESETS = [
  { id: "front", label: "Frente de la sala", point: [4.1, 3.2, 6.2] },
  {
    id: "upper",
    label: "Abertura superior derecha",
    point: [10.1, 5.05, 0.65],
  },
  { id: "left", label: "Puerta ventana izquierda", point: [-2, 2.1, 3.2] },
  {
    id: "lower",
    label: "Aberturas inferiores derechas",
    point: [10, 1.8, 4.4],
  },
];
export function setLightOrigin(light, point) {
  if (
    !Array.isArray(point) ||
    point.length !== 3 ||
    !point.every((n) => Number.isFinite(n) && Math.abs(n) <= 100000)
  )
    throw new Error("Indicá una posición válida en metros.");
  if (Math.hypot(...point.map((n, i) => n - light.target[i])) < 0.001)
    throw new Error("El origen y el destino de la luz deben ser distintos.");
  light.position = point.slice();
}
export function presetOrigin(models, id) {
  const preset = ORIGIN_PRESETS.find((p) => p.id === id),
    entry = models.entries.get("sala-v04");
  if (!preset || !entry)
    throw new Error("Esta ubicación requiere la sala de referencia.");
  entry.wrapper.updateWorldMatrix(true, false);
  return new THREE.Vector3(...preset.point)
    .applyMatrix4(entry.wrapper.matrixWorld)
    .toArray();
}
export function lightPlanData(models, light) {
  const reference = models.entries.get("sala-v04");
  const box = models.bounds(reference ? "sala-v04" : undefined, false);
  const points = [light.position, light.target];
  let minX = Math.min(...points.map((p) => p[0])),
    maxX = Math.max(...points.map((p) => p[0]));
  let minZ = Math.min(...points.map((p) => p[2])),
    maxZ = Math.max(...points.map((p) => p[2]));
  if (!box.isEmpty()) {
    minX = Math.min(minX, box.min.x);
    maxX = Math.max(maxX, box.max.x);
    minZ = Math.min(minZ, box.min.z);
    maxZ = Math.max(maxZ, box.max.z);
  }
  const centerX = (minX + maxX) / 2,
    centerZ = (minZ + maxZ) / 2,
    width = Math.max(maxX - minX, 4),
    depth = Math.max(maxZ - minZ, 3);
  const padding = Math.max(0.5, Math.max(width, depth) * 0.08);
  const bounds = {
    minX: centerX - width / 2 - padding,
    minZ: centerZ - depth / 2 - padding,
    width: width + 2 * padding,
    depth: depth + 2 * padding,
  };
  const floors = [];
  if (reference?.wrapper.visible) {
    reference.wrapper.updateWorldMatrix(true, true);
    for (const object of reference.objects) {
      if (
        !object.mesh.visible ||
        !["Piso_sala", "Piso_PB_contiguo"].includes(object.mesh.name)
      )
        continue;
      object.mesh.geometry.computeBoundingBox();
      const b = object.mesh.geometry.boundingBox;
      floors.push(
        [
          [b.min.x, b.min.z],
          [b.max.x, b.min.z],
          [b.max.x, b.max.z],
          [b.min.x, b.max.z],
        ].map(([x, z]) => {
          const p = new THREE.Vector3(x, b.max.y, z).applyMatrix4(
            object.mesh.matrixWorld,
          );
          return [p.x, p.z];
        }),
      );
    }
  }
  return { bounds, floors };
}
// Map a tap through SVG's xMidYMid meet letterboxing, independent of the 3D camera.
export function planPointFromClient(clientX, clientY, rect, bounds) {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const scale = Math.min(rect.width / bounds.width, rect.height / bounds.depth);
  const x = clientX - rect.left - (rect.width - bounds.width * scale) / 2;
  const z = clientY - rect.top - (rect.height - bounds.depth * scale) / 2;
  if (x < 0 || z < 0 || x > bounds.width * scale || z > bounds.depth * scale)
    return null;
  return [bounds.minX + x / scale, bounds.minZ + z / scale];
}
