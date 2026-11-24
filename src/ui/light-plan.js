import { lightPlanData } from "../scene/light-origins.js";
export function lightPlanMarkup(models, light, index) {
  const { bounds: b, floors } = lightPlanData(models, light);
  const radius = Math.max(b.width, b.depth) * 0.018;
  const [x, , z] = light.position,
    [tx, , tz] = light.target;
  return `<svg viewBox="${b.minX} ${b.minZ} ${b.width} ${b.depth}" preserveAspectRatio="xMidYMid meet" data-plan-min-x="${b.minX}" data-plan-min-z="${b.minZ}" data-plan-width="${b.width}" data-plan-depth="${b.depth}" aria-hidden="true">
    <defs><marker id="plan-arrow-${index}" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 6 3 0 6Z" fill="#e3c78e"/></marker></defs>
    ${floors.map((points) => `<polygon class="plan-floor" points="${points.map((p) => p.join(",")).join(" ")}"/>`).join("")}
    <line class="plan-light-path" x1="${x}" y1="${z}" x2="${tx}" y2="${tz}" marker-end="url(#plan-arrow-${index})"/>
    <circle class="plan-origin" cx="${x}" cy="${z}" r="${radius}"/>
    <circle class="plan-destination" cx="${tx}" cy="${tz}" r="${radius * 1.1}"/>
    <path class="plan-destination" d="M${tx - radius * 1.7} ${tz}H${tx + radius * 1.7}M${tx} ${tz - radius * 1.7}V${tz + radius * 1.7}"/>
  </svg>`;
}
export function planBoundsFromElement(svg) {
  return {
    minX: Number(svg.dataset.planMinX),
    minZ: Number(svg.dataset.planMinZ),
    width: Number(svg.dataset.planWidth),
    depth: Number(svg.dataset.planDepth),
  };
}
