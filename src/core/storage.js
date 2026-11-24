import { serializeProject, validateProject } from "./project.js";
export const STORAGE_KEY = "atelier3d:composition:v1";
export function readLocal(storage) {
  try {
    storage ??= globalThis.localStorage;
    const data = storage.getItem(STORAGE_KEY);
    return data
      ? { project: validateProject(JSON.parse(data)), error: null }
      : { project: null, error: null };
  } catch (error) {
    return { project: null, error };
  }
}
export function saveLocal(project, storage) {
  try {
    storage ??= globalThis.localStorage;
    storage.setItem(STORAGE_KEY, serializeProject(project));
    return "complete";
  } catch {
    try {
      storage.setItem(STORAGE_KEY, serializeProject(project, false));
      return "parameters";
    } catch {
      return "unavailable";
    }
  }
}
export function downloadFile(content, name, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
