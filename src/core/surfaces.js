// Relative source strengths. Independent from the existing point-light settings.
export const SURFACE_GROUPS = [
  { key: "upper", label: "Planta alta · luz principal" },
  { key: "left", label: "Exterior izquierdo · ventanal" },
  { key: "front", label: "Exterior frontal · relleno" },
];
export function defaultSurfaces() {
  return { enabled: false, upper: 1, left: 0.12, front: 0.08, bounce: 0.35 };
}
export function validateSurfaces(input) {
  if (input === undefined) return defaultSurfaces();
  if (!input || typeof input.enabled !== "boolean")
    throw new Error("Modo de superficies inválido.");
  const result = { enabled: input.enabled };
  for (const { key } of SURFACE_GROUPS) {
    const value = input[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 2)
      throw new Error("Intensidad de superficie fuera de rango.");
    result[key] = value;
  }
  // Previously saved surface compositions retain their exact direct-light view.
  const bounce = input.bounce === undefined ? 0 : input.bounce;
  if (typeof bounce !== "number" || !Number.isFinite(bounce) || bounce < 0 || bounce > 2)
    throw new Error("Intensidad de rebotes fuera de rango.");
  result.bounce = bounce;
  return result;
}
export function surfaceDemoProject(project) {
  project.title = "Estudio de paredes luminosas";
  project.surfaces.enabled = true;
  project.surfaces.bounce = 0;
  return project;
}
export function bounceDemoProject(project) {
  surfaceDemoProject(project);
  project.title = "Estudio de luz rebotada";
  project.surfaces.bounce = defaultSurfaces().bounce;
  return project;
}
