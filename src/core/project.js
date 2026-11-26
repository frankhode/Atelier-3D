import { validateSurfaces } from "./surfaces.js";
import { validatePictorial } from "./pictorial.js";
import {
  APP_FORMAT,
  SCHEMA_VERSION,
  RATIOS,
  MAX_MODEL_BYTES,
} from "./defaults.js";
const fail = (message) => {
  throw new Error(`Proyecto inválido: ${message}.`);
};
function number(n, min, max, label) {
  if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max)
    fail(label);
  return n;
}
function vector(v, label, min = -100000, max = 100000) {
  if (!Array.isArray(v) || v.length !== 3) fail(label);
  return v.map((n) => number(n, min, max, label));
}
function bool(v, label) {
  if (typeof v !== "boolean") fail(label);
  return v;
}
function text(v, label, max = 200) {
  if (typeof v !== "string" || v.length > max) fail(label);
  return v;
}
function color(v) {
  if (typeof v !== "string" || !/^#[a-f0-9]{6}$/i.test(v)) fail("color");
  return v;
}
// Reconstruct the known schema. Unknown properties are never applied to Three.js objects.
export function validateProject(input) {
  if (!input || input.format !== APP_FORMAT || input.version !== SCHEMA_VERSION)
    fail("formato o versión no compatible");
  const { camera: c, frame: f, appearance: a } = input;
  if (
    !c ||
    !f ||
    !a ||
    !Array.isArray(input.lights) ||
    input.lights.length !== 3 ||
    !Array.isArray(input.models) ||
    input.models.length > 100
  )
    fail("estructura");
  if (!["perspective", "orthographic"].includes(c.projection))
    fail("proyección");
  const position = vector(c.position, "posición de cámara"),
    target = vector(c.target, "objetivo de cámara"),
    up = vector(c.up, "vertical");
  const direction = position.map((n, i) => n - target[i]);
  const cross = [
    direction[1] * up[2] - direction[2] * up[1],
    direction[2] * up[0] - direction[0] * up[2],
    direction[0] * up[1] - direction[1] * up[0],
  ];
  if (
    Math.hypot(...direction) < 0.001 ||
    Math.hypot(...up) < 0.5 ||
    Math.hypot(...cross) < 0.0001
  )
    fail("cámara degenerada");
  if (!Object.hasOwn(RATIOS, f.ratio)) fail("proporción");
  if (!["balanced", "high"].includes(a.quality)) fail("calidad");
  const pictorial = validatePictorial(input.pictorial), surfaces = validateSurfaces(input.surfaces);
  if (pictorial.enabled && surfaces.enabled) fail("modos de iluminación simultáneos");
  const ids = new Set();
  return {
    format: APP_FORMAT,
    version: SCHEMA_VERSION,
    title: text(input.title, "título", 100),
    camera: {
      projection: c.projection,
      position,
      target,
      up,
      fov: number(c.fov, 10, 120, "ángulo de cámara"),
      orthoSize: number(c.orthoSize, 0.01, 100000, "escala ortogonal"),
      zoom: number(c.zoom, 0.01, 1000, "zoom"),
      locked: bool(c.locked, "bloqueo"),
    },
    frame: { ratio: f.ratio, thirds: bool(f.thirds, "tercios") },
    appearance: {
      exposure: number(a.exposure, 0.1, 4, "exposición"),
      ambient: number(a.ambient, 0, 2, "ambiente"),
      background: color(a.background),
      material: color(a.material),
      helpers: bool(a.helpers, "guías"),
      quality: a.quality,
    },
    pictorial,
    surfaces,
    lights: input.lights.map((l) => {
      if (!l) fail("luz");
      const pos = vector(l.position, "posición de luz"),
        aim = vector(l.target, "objetivo de luz");
      if (Math.hypot(...pos.map((n, i) => n - aim[i])) < 0.001)
        fail("dirección de luz");
      return {
        name: text(l.name, "nombre de luz"),
        enabled: bool(l.enabled, "luz activa"),
        intensity: number(l.intensity, 0, 2000, "intensidad"),
        position: pos,
        target: aim,
        angle: number(l.angle, 0.5, 85, "apertura"),
        penumbra: number(l.penumbra, 0, 1, "suavidad"),
        shadows: bool(l.shadows, "sombras"),
      };
    }),
    models: input.models.map((m) => {
      if (!m || !["builtin", "obj", "glb"].includes(m.kind) || !m.transform)
        fail("modelo");
      const id = text(m.id, "identificador", 100);
      if (!id || ids.has(id) || (m.kind === "builtin" && id !== "sala-v04"))
        fail("identificador de modelo");
      ids.add(id);
      let source = null;
      if (m.kind !== "builtin" && m.source != null) {
        source = text(
          m.source,
          "contenido de modelo",
          m.kind === "glb"
            ? Math.ceil(MAX_MODEL_BYTES / 3) * 4
            : MAX_MODEL_BYTES,
        );
        if (
          m.kind === "glb" &&
          (!/^[A-Za-z0-9+/]*={0,2}$/.test(source) || source.length % 4)
        )
          fail("contenido GLB");
      }
      if (!Array.isArray(m.hidden) || m.hidden.length > 50000)
        fail("visibilidad");
      return {
        id,
        name: text(m.name, "nombre de modelo"),
        kind: m.kind,
        source,
        visible: bool(m.visible, "visibilidad de modelo"),
        hidden: m.hidden.map((h) => text(h, "identificador de objeto", 1000)),
        transform: {
          position: vector(m.transform.position, "posición de modelo"),
          rotation: vector(m.transform.rotation, "rotación de modelo"),
          scale: number(m.transform.scale, 0.000001, 10000, "escala positiva"),
        },
      };
    }),
  };
}
export function serializeProject(project, portable = true) {
  const clean = validateProject(project);
  if (!portable)
    clean.models.forEach((m) => {
      if (m.kind !== "builtin") m.source = null;
    });
  return JSON.stringify(clean, null, portable ? 2 : 0);
}

