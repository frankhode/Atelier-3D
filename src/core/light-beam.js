// Width on the plane perpendicular to the beam at its target, in scene metres.
export function beamDistance(light) {
  return Math.hypot(...light.position.map((v, i) => v - light.target[i]));
}
export function beamDiameter(light) {
  return 2 * beamDistance(light) * Math.tan((light.angle * Math.PI) / 180);
}
export function angleForDiameter(light, diameter) {
  const distance = beamDistance(light);
  if (!Number.isFinite(diameter) || diameter <= 0 || distance < 0.001)
    throw new Error("Indicá un ancho positivo para el haz.");
  const angle = (Math.atan(diameter / (2 * distance)) * 180) / Math.PI;
  if (angle < 0.5 || angle > 85)
    throw new Error(
      "Ese ancho queda fuera del alcance de la luz. Elegí un valor menos extremo.",
    );
  return angle;
}
export const BEAM_PRESETS = [
  { label: "Concentrado", angle: 8 },
  { label: "Medio", angle: 25 },
  { label: "Amplio", angle: 55 },
];
