import { defaultSurfaces } from "./surfaces.js";
import { defaultPictorial } from "./pictorial.js";
export const APP_FORMAT = "atelier-3d";
export const SCHEMA_VERSION = 1;
export const MAX_MODEL_BYTES = 32 * 1024 * 1024;
export const MAX_PROJECT_BYTES = 96 * 1024 * 1024;
export const RATIOS = {
  free: null,
  "4:5": 4 / 5,
  "5:4": 5 / 4,
  "1:1": 1,
  "3:2": 3 / 2,
  "2:3": 2 / 3,
  "16:9": 16 / 9,
};
export function defaultProject() {
  return {
    format: APP_FORMAT,
    version: SCHEMA_VERSION,
    title: "Sala de doble altura",
    camera: {
      projection: "perspective",
      position: [4.1, 2.5, 12.9],
      target: [4.1, 2.65, 0.8],
      up: [0, 1, 0],
      fov: 48,
      orthoSize: 8,
      zoom: 1,
      locked: false,
    },
    frame: { ratio: "free", thirds: false },
    appearance: {
      exposure: 1.35,
      ambient: 0.12,
      background: "#34383b",
      material: "#c5c5c5",
      helpers: false,
      quality: "balanced",
    },
    pictorial: defaultPictorial(),
    surfaces: defaultSurfaces(),
    lights: [
      {
        name: "Principal · abertura superior",
        enabled: true,
        intensity: 210,
        position: [10.1, 5.05, 0.65],
        target: [2.8, 0.4, 2.9],
        angle: 48,
        penumbra: 0.35,
        shadows: true,
      },
      {
        name: "Relleno · puerta ventana",
        enabled: true,
        intensity: 42,
        position: [-2, 2.1, 3.2],
        target: [5, 0.4, 2.5],
        angle: 65,
        penumbra: 0.7,
        shadows: true,
      },
      {
        name: "Residual · aberturas derechas",
        enabled: true,
        intensity: 20,
        position: [10, 1.8, 4.4],
        target: [4, 0.3, 3.9],
        angle: 65,
        penumbra: 0.8,
        shadows: true,
      },
    ],
    poses: [],
    models: [
      {
        id: "sala-v04",
        name: "Sala · arquitectura v04",
        kind: "builtin",
        source: null,
        visible: true,
        hidden: [],
        transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
      },
    ],
  };
}

