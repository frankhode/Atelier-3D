const paths = {
  objects: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  camera: '<path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  frame:
    '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M9 5v14M15 5v14M3 10h18M3 14h18"/>',
  folder: '<path d="M3 6h6l2 3h10v11H3zM3 6V4h7l2 3h7v2"/>',
  import: '<path d="M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6"/>',
  export: '<path d="M12 16V4m-4 4 4-4 4 4M4 15v6h16v-6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 3M12 17h.01"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  unlock:
    '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0M12 14v3"/>',
  fit: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/><rect x="8" y="8" width="8" height="8"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 8M4 3v7h7"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m3 16 5-5 5 5 3-3 5 5"/><circle cx="16" cy="8" r="1"/>',
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.objects}</svg>`;
export function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });
}
