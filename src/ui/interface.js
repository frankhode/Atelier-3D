import { icon, hydrateIcons } from "./icons.js";
import { RATIOS } from "../core/defaults.js";
import { BEAM_PRESETS, beamDiameter } from "../core/light-beam.js";
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const get = (object, path) =>
  path.split(".").reduce((value, key) => value[key], object);
const set = (object, path, value) => {
  const parts = path.split("."),
    key = parts.pop();
  (parts.length ? get(object, parts.join(".")) : object)[key] = value;
};
const labels = {
  objects: ["ESCENA", "Objetos"],
  camera: ["PUNTO DE VISTA", "Cámara"],
  lights: ["CLAROSCURO", "Iluminación"],
  frame: ["COMPOSICIÓN", "Encuadre"],
  project: ["TU TALLER", "Archivo"],
};
export class Interface {
  constructor(state, models, actions) {
    this.state = state;
    this.models = models;
    this.actions = actions;
    this.activePanel = null;
    this.selectedLight = 0;
    this.concentrateOnAim = [true, true, true];
    this.soloLight = null;
    this.panel = document.getElementById("panel");
    this.body = document.getElementById("panel-body");
    hydrateIcons();
    document
      .querySelectorAll("[data-panel]")
      .forEach((b) =>
        b.addEventListener("click", () =>
          this.open(
            this.activePanel === b.dataset.panel ? null : b.dataset.panel,
          ),
        ),
      );
    document.getElementById("close-panel").onclick = () => this.open(null);
    document.getElementById("import-model").onclick = () =>
      actions.importModel();
    document.getElementById("camera-lock").onclick = () => {
      actions.lock();
      this.refresh();
    };
    document.getElementById("fit-camera").onclick = () => actions.fit();
    document.getElementById("lighting-solo").onclick = () =>
      actions.action("solo-light", "clear");
    document.getElementById("help-button").onclick = () =>
      document.getElementById("help-dialog").showModal();
    document.getElementById("close-help").onclick = () =>
      document.getElementById("help-dialog").close();
    document.getElementById("help-dialog").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) {
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          e.currentTarget.close();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.open(null);
    });
    document.addEventListener("pointerdown", (e) => {
      if (this.activePanel && !e.target.closest("#panel, .dock, dialog"))
        this.open(null);
    });
    this.body.addEventListener("input", (e) => this.handleInput(e));
    this.body.addEventListener("change", (e) => {
      if (e.target.dataset.beamWidth !== undefined) {
        this.handleInput(e);
        return;
      }
      if (
        e.target.type !== "range" &&
        !["number", "text", "color"].includes(e.target.type)
      )
        this.handleInput(e);
    });
    this.body.addEventListener("click", (e) => this.handleAction(e));
    this.body.addEventListener(
      "toggle",
      (event) => {
        if (event.target.matches(".light-card[open]"))
          this.selectedLight = Number(event.target.dataset.light);
      },
      true,
    );
    this.update();
  }
  range(path, label, min, max, step = 1, suffix = "") {
    const value = get(this.state, path);
    return `<label class="field"><span class="field-label">${label}<output data-output="${path}" data-suffix="${suffix}">${value}${suffix}</output></span><input aria-label="${label}" data-path="${path}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
  }
  toggle(path, label) {
    return `<label class="toggle-row"><span>${label}</span><input type="checkbox" data-path="${path}" ${get(this.state, path) ? "checked" : ""}></label>`;
  }
  triple(path, label) {
    return `<div class="field"><span class="field-label">${label}</span><div class="triple">${["X", "Y", "Z"].map((axis, i) => `<label>${axis}<input type="number" aria-label="${label} ${axis}" data-path="${path}.${i}" value="${Number(get(this.state, path)[i].toFixed(3))}" step="any" min="-100000" max="100000"></label>`).join("")}</div></div>`;
  }
  open(name) {
    this.activePanel = name;
    this.panel.hidden = !name;
    document.body.classList.toggle("panel-open", !!name);
    document
      .querySelectorAll("[data-panel]")
      .forEach((b) =>
        b.setAttribute(
          "aria-expanded",
          b.dataset.panel === name ? "true" : "false",
        ),
      );
    if (name) this.refresh();
  }
  refresh() {
    if (!this.activePanel) return;
    const [kicker, title] = labels[this.activePanel];
    document.getElementById("panel-kicker").textContent = kicker;
    document.getElementById("panel-title").textContent = title;
    this.body.innerHTML = this[this.activePanel]();
    this.body.scrollTop = 0;
  }
  update() {
    const c = this.state.camera;
    document.getElementById("scene-title").textContent =
      this.state.title || "Sin título";
    document.getElementById("scene-subtitle").textContent =
      this.state.models.some((m) => m.kind === "builtin")
        ? "8,20 × 6,50 × 5,60 m · Sala de referencia"
        : `${this.state.models.length} modelos en la composición`;
    document.getElementById("projection-label").textContent =
      c.projection === "perspective" ? "Perspectiva" : "Ortogonal";
    const lock = document.getElementById("camera-lock");
    lock.innerHTML = icon(c.locked ? "lock" : "unlock");
    lock.classList.toggle("active", c.locked);
    lock.setAttribute(
      "aria-label",
      c.locked ? "Desbloquear cámara" : "Bloquear cámara",
    );
    lock.title = c.locked ? "Desbloquear cámara" : "Bloquear cámara";
    document.getElementById("fit-camera").disabled = c.locked;
    // Keep coordinates in step with navigation without replacing focused controls.
    if (this.activePanel === "camera")
      this.body
        .querySelectorAll(
          'input[data-path^="camera.position"], input[data-path^="camera.target"], input[data-path="camera.zoom"]',
        )
        .forEach((input) => {
          if (document.activeElement !== input)
            input.value = Number(
              get(this.state, input.dataset.path).toFixed(3),
            );
        });
  }
  focusLight(index) {
    this.selectedLight = index;
    this.open("lights");
    const card = this.body.querySelector(`[data-light="${index}"].light-card`);
    card?.scrollIntoView?.({ block: "nearest" });
    card
      ?.querySelector('[data-action="aim-light"]')
      ?.focus({ preventScroll: true });
  }
  setSoloLight(index) {
    this.soloLight = index;
    const badge = document.getElementById("lighting-solo");
    badge.hidden = index === null;
    badge.textContent = index === null ? "" : `Solo luz ${index + 1} · Salir`;
  }
  setLightAiming(index) {
    const active = index !== null;
    document.body.classList.toggle("aiming-light", active);
    document.getElementById("light-aim-bar").hidden = !active;
    document
      .querySelectorAll(".topbar, .view-tools, .dock, #panel")
      .forEach((el) => {
        el.inert = active;
      });
    if (active) {
      this.open(null);
      document.getElementById("light-aim-name").textContent =
        `Luz ${index + 1} · ${this.state.lights[index].name}${this.state.lights[index].enabled ? "" : " (apagada)"}`;
      document.getElementById("cancel-light-aim").focus();
    }
  }
  showLightTarget(index, screen) {
    const marker = document.getElementById("light-target-marker");
    marker.hidden = !screen.visible;
    marker.style.left = `${screen.x}px`;
    marker.style.top = `${screen.y}px`;
    marker.querySelector(".target-label").textContent =
      `Punto de luz ${index + 1}`;
  }
  hideLightTarget() {
    document.getElementById("light-target-marker").hidden = true;
  }
  handleInput(event) {
    const el = event.target;
    if (el.dataset.concentrate !== undefined) {
      this.concentrateOnAim[Number(el.dataset.concentrate)] = el.checked;
      return;
    }
    if (el.dataset.beamWidth !== undefined) {
      if (event.type === "change" && el.value !== "" && el.checkValidity())
        this.actions.action("beam-width", el.value, el.dataset.beamWidth);
      return;
    }
    if (el.dataset.filter !== undefined) {
      const term = el.value.toLocaleLowerCase();
      this.body.querySelectorAll(".object-row").forEach((row) => {
        row.hidden = !row.textContent.toLocaleLowerCase().includes(term);
      });
      return;
    }
    if (el.dataset.object !== undefined) {
      const m = this.state.models.find((m) => m.id === el.dataset.model);
      if (el.checked)
        m.hidden = m.hidden.filter((key) => key !== el.dataset.object);
      else if (!m.hidden.includes(el.dataset.object))
        m.hidden.push(el.dataset.object);
      this.models.apply(m.id);
      this.actions.changed();
      return;
    }
    if (
      !el.dataset.path ||
      (el.type === "number" && el.value === "") ||
      (el.type !== "checkbox" && !el.checkValidity())
    )
      return;
    // Selects/checkboxes emit both input and change: process once per value.
    const path = el.dataset.path,
      previous = get(this.state, path);
    const value =
      el.type === "checkbox"
        ? el.checked
        : ["number", "range"].includes(el.type)
          ? Number(el.value)
          : el.value;
    if (previous === value) return;
    set(this.state, path, value);
    try {
      this.actions.apply(path);
    } catch (error) {
      set(this.state, path, previous);
      el.value = previous;
      this.actions.notify(error.message);
      return;
    }
    const output = [...this.body.querySelectorAll("[data-output]")].find(
      (o) => o.dataset.output === path,
    );
    if (output) output.textContent = `${value}${output.dataset.suffix}`;
    if (path.startsWith("lights.")) this.syncLightLabels();
    this.update();
  }
  syncLightLabels() {
    this.body.querySelectorAll("[data-target-summary]").forEach((el) => {
      el.textContent = this.targetSummary(
        this.state.lights[Number(el.dataset.targetSummary)],
      );
    });
    this.body.querySelectorAll("[data-beam-width]").forEach((el) => {
      if (el !== document.activeElement)
        el.value = Number(
          beamDiameter(this.state.lights[Number(el.dataset.beamWidth)]).toFixed(
            2,
          ),
        );
    });
    this.body
      .querySelectorAll('[data-action="beam-preset"]')
      .forEach((button) => {
        const active =
          Math.abs(
            this.state.lights[Number(button.dataset.id)].angle -
              Number(button.dataset.value),
          ) < 0.01;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
  }
  targetSummary(light) {
    return (
      light.target
        .map(
          (n, i) =>
            `${["X", "Y", "Z"][i]} ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`,
        )
        .join(" · ") + " m"
    );
  }
  handleAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    this.actions.action(
      button.dataset.action,
      button.dataset.value,
      button.dataset.id,
    );
  }
  objects() {
    return `<div class="section"><button class="button full" data-action="import">${icon("plus")}Importar OBJ / GLB</button><p class="hint">Mostrá u ocultá cada pieza. Los modelos se agregan sin invertir sus ejes.</p></div><input class="object-filter" type="text" placeholder="Buscar un objeto…" aria-label="Buscar un objeto" data-filter>${this.state.models
      .map((m, i) => {
        const entry = this.models.entries.get(m.id),
          count = entry?.objects.length || 0;
        return `<details class="model-card" ${i === 0 ? "open" : ""}><summary>${icon("objects")}<span class="model-name">${esc(m.name)}</span><span class="count">${count}</span></summary><div class="model-content">${this.toggle(`models.${i}.visible`, "Modelo visible")}<div class="model-actions"><button class="button" data-action="fit-model" data-id="${esc(m.id)}">${icon("fit")}Encuadrar</button>${m.kind !== "builtin" ? `<button class="icon-button" aria-label="Quitar ${esc(m.name)}" data-action="remove" data-id="${esc(m.id)}">${icon("trash")}</button>` : ""}</div>${!entry ? '<p class="hint">Modelo pendiente: volvé a importar el archivo original para recuperar su geometría.</p>' : ""}<details class="advanced"><summary>Posición, unidades y orientación</summary>${this.triple(`models.${i}.transform.position`, "Posición (m)")}${this.triple(`models.${i}.transform.rotation`, "Rotación (°)")}<label class="field"><span class="field-label">Escala uniforme</span><input type="number" aria-label="Escala uniforme" data-path="models.${i}.transform.scale" value="${m.transform.scale}" min="0.000001" max="10000" step="0.001"></label><div class="button-row"><button class="button" data-action="units-m" data-id="${m.id}">m</button><button class="button" data-action="units-cm" data-id="${m.id}">cm</button><button class="button" data-action="units-mm" data-id="${m.id}">mm</button></div><div class="button-row"><button class="button" data-action="up-y" data-id="${m.id}">Y arriba</button><button class="button" data-action="up-z" data-id="${m.id}">Z arriba</button></div><p class="hint">La escala convierte unidades a metros. Z arriba rota −90° sobre X, sin reflexión.</p></details><div class="button-row"><button class="button" data-action="show-all" data-id="${m.id}">Mostrar piezas</button><button class="button" data-action="hide-all" data-id="${m.id}">Ocultar piezas</button></div>${(entry?.objects || []).map((o) => `<label class="object-row"><span title="${esc(o.name)}">${esc(o.name.replaceAll("_", " "))}</span><input type="checkbox" aria-label="Mostrar ${esc(o.name)}" data-object="${o.key}" data-model="${m.id}" ${!m.hidden.includes(o.key) ? "checked" : ""}></label>`).join("")}</div></details>`;
      })
      .join(
        "",
      )}<p class="hint">${this.models.entries.size} modelos · ${[...this.models.entries.values()].reduce((n, e) => n + e.objects.length, 0)} piezas</p>`;
  }
  camera() {
    const c = this.state.camera;
    return `${this.toggle("camera.locked", "Bloquear cámara")}<p class="hint">El candado conserva la posición, el objetivo y la óptica de la cámara.</p><fieldset ${c.locked ? "disabled" : ""}><div class="segmented"><button data-action="projection" data-value="perspective" class="${c.projection === "perspective" ? "active" : ""}">Perspectiva</button><button data-action="projection" data-value="orthographic" class="${c.projection === "orthographic" ? "active" : ""}">Ortogonal</button></div><h3 class="section-title">Vistas ortogonales</h3><div class="preset-grid">${[
      ["front", "Frente"],
      ["back", "Dorso"],
      ["left", "Izquierda"],
      ["right", "Derecha"],
      ["top", "Superior"],
      ["bottom", "Inferior"],
    ]
      .map(
        ([v, l]) =>
          `<button data-action="view" data-value="${v}">${l}</button>`,
      )
      .join(
        "",
      )}</div>${c.projection === "perspective" ? this.range("camera.fov", "Campo de visión", 10, 120, 1, "°") : this.range("camera.zoom", "Zoom ortogonal", 0.1, 10, 0.1, "×")}<button class="button full" data-action="fit">${icon("fit")}Encuadrar todos los objetos</button><button class="button full" data-action="initial-camera">${icon("reset")}Volver a la sala</button><details class="advanced"><summary>Posición y punto de interés</summary>${this.triple("camera.position", "Posición (m)")}${this.triple("camera.target", "Mirar hacia (m)")}</details></fieldset><p class="hint">Frente mira desde +Z: X crece hacia la derecha. Las vistas ortogonales permiten medir sin convergencia.</p>`;
  }
  lights() {
    return `<p class="hint">Elegí dónde iluminar y ajustá el ancho del haz por separado.</p>${this.state.lights
      .map(
        (
          light,
          i,
        ) => `<details class="light-card" data-light="${i}" ${i === this.selectedLight ? "open" : ""}>
      <summary><span class="light-number">${i + 1}</span><span>${esc(light.name)}</span></summary>
      <div class="light-content">
        ${this.toggle(`lights.${i}.enabled`, "Luz encendida")}
        <button class="button full ${this.soloLight === i ? "active" : ""}" data-action="solo-light" data-value="${i}" aria-pressed="${this.soloLight === i}">${icon("eye")}${this.soloLight === i ? "Mostrar todas las luces" : "Ver solo esta luz"}</button>
        ${this.soloLight === i ? '<p class="hint">Vista temporal: solo esta luz, sin ambiente. Podés salir con el botón superior.</p>' : ""}
        <div class="light-target-controls">
          <h3 class="section-title">Hacia dónde ilumina</h3>
          <label class="toggle-row"><span>Concentrar al apuntar</span><input type="checkbox" data-concentrate="${i}" aria-label="Concentrar luz ${i + 1} al apuntar" ${this.concentrateOnAim[i] ? "checked" : ""}></label>
          <button class="button primary full" data-action="aim-light" data-value="${i}">${icon("target")}Apuntar en la escena</button>
          <p class="hint">Tocá una superficie. Con Concentrar, el haz se reduce a un máximo aproximado de 1,50 m para distinguir el destino; después podés ampliarlo.</p>
          <div class="target-summary"><span data-target-summary="${i}">${esc(this.targetSummary(light))}</span><button class="button" data-action="show-light-target" data-value="${i}" aria-label="Ver punto de luz ${i + 1}">${icon("eye")}Ver punto</button></div>
          <details class="advanced"><summary>Ajuste preciso del punto</summary>${this.triple(`lights.${i}.target`, "Punto iluminado (m)")}</details>
        </div>
        <div class="light-origin-controls">
          <h3 class="section-title">Desde dónde llega</h3>
          <button class="button full" data-action="light-from-view" data-value="${i}">${icon("camera")}Luz desde esta vista</button>
          <p class="hint">Mueve el origen a la cámara. Cambia el recorrido de la luz y de las sombras.</p>
        </div>
        ${this.range(`lights.${i}.intensity`, "Intensidad", 0, 500, 1, " cd")}
        <h3 class="section-title">Ancho del haz</h3>
        <div class="beam-presets">${BEAM_PRESETS.map((preset) => `<button class="button ${Math.abs(light.angle - preset.angle) < 0.01 ? "active" : ""}" aria-pressed="${Math.abs(light.angle - preset.angle) < 0.01}" data-action="beam-preset" data-id="${i}" data-value="${preset.angle}">${preset.label}</button>`).join("")}</div>
        <label class="field"><span class="field-label">Ancho a esa distancia (m)</span><input type="number" data-beam-width="${i}" aria-label="Ancho del haz de luz ${i + 1} en metros" value="${Number(beamDiameter(light).toFixed(2))}" min="0.01" step="any"></label>
        <p class="hint">Ancho aproximado. En una superficie oblicua, la mancha se alarga.</p>
        ${this.range(`lights.${i}.penumbra`, "Borde suave", 0, 1, 0.05)}
        ${this.toggle(`lights.${i}.shadows`, "Proyectar sombras")}
        <details class="advanced"><summary>Origen de la luz y ángulo preciso</summary>${this.triple(`lights.${i}.position`, "Origen (m)")}<label class="field"><span class="field-label">Semiángulo del haz (°)</span><input type="number" aria-label="Semiángulo de luz ${i + 1}" data-path="lights.${i}.angle" value="${light.angle}" min="0.5" max="85" step="any"></label></details>
      </div>
    </details>`,
      )
      .join(
        "",
      )}<div class="section">${this.range("appearance.ambient", "Luz ambiente", 0, 1, 0.01)}${this.range("appearance.exposure", "Exposición", 0.1, 4, 0.05)}${this.toggle("appearance.helpers", "Mostrar guías de luces y ejes")}</div><button class="button full" data-action="reset-lights">${icon("reset")}Restablecer iluminación</button><p class="hint">La luz ambiente aclara las sombras sin rebotes físicos. Para estudiar contrastes profundos, reducí su intensidad.</p>`;
  }
  frame() {
    return `<div class="section"><h3 class="section-title">Proporción de la imagen</h3><div class="ratio-buttons">${Object.entries(
      RATIOS,
    )
      .map(
        ([key, ratio]) =>
          `<button data-action="ratio" data-value="${key}" class="${this.state.frame.ratio === key ? "active" : ""}"><span class="ratio-shape" style="width:${ratio ? 22 * ratio : 30}px"></span>${key === "free" ? "Pantalla" : key}</button>`,
      )
      .join(
        "",
      )}</div>${this.toggle("frame.thirds", "Guía de tercios")}<p class="hint">4:5 corresponde a un estudio vertical de 40 × 50 cm. El encuadre se conserva al exportar la imagen.</p></div><div class="section"><h3 class="section-title">Apariencia</h3><label class="field"><span class="field-label">Material neutro</span><select aria-label="Valor del material neutro" data-path="appearance.material">${[
      ["#d8d8d8", "Gris claro"],
      ["#c5c5c5", "Gris medio"],
      ["#888888", "Gris oscuro"],
    ]
      .map(
        ([value, label]) =>
          `<option value="${value}" ${this.state.appearance.material === value ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select></label><label class="color-row">Fondo<input type="color" aria-label="Color del fondo" data-path="appearance.background" value="${this.state.appearance.background}"></label><label class="field"><span class="field-label">Calidad</span><select data-path="appearance.quality" aria-label="Calidad de renderizado"><option value="balanced" ${this.state.appearance.quality === "balanced" ? "selected" : ""}>Equilibrada · móvil</option><option value="high" ${this.state.appearance.quality === "high" ? "selected" : ""}>Alta · sombras 2048</option></select></label></div><button class="button primary full" data-action="png">${icon("image")}Exportar imagen PNG</button><p class="hint">Imagen del encuadre a la resolución actual, sin controles ni guías.</p>`;
  }
  project() {
    return `<div class="section"><label class="field"><span class="field-label">Nombre de la composición</span><input type="text" aria-label="Nombre de la composición" data-path="title" value="${esc(this.state.title)}" maxlength="100"></label><div class="measure"><span>Guardado</span><strong>En este navegador</strong></div><p class="hint">Los parámetros se guardan automáticamente. Los modelos también, cuando hay espacio. Conservá una copia JSON para trasladar o recuperar el trabajo.</p></div><div class="section"><h3 class="section-title">Composición portable</h3><button class="button primary full" data-action="export">${icon("export")}Exportar JSON con modelos</button><button class="button full" data-action="import-project">${icon("import")}Abrir composición JSON</button><p class="hint">El JSON incluye cámara, encuadre, luces, visibilidad y los OBJ / GLB importados. Abrir un proyecto reemplaza la composición actual.</p></div><div class="section"><button class="button full" data-action="save">${icon("folder")}Guardar ahora</button><button class="button danger full" data-action="reset">${icon("reset")}Restablecer escena de prueba</button></div><div class="measure"><span>Atelier 3D</span><strong>v0.2.1</strong></div><p class="hint">Todo el procesamiento ocurre en tu dispositivo. Los archivos importados no se envían a ningún servidor.</p>`;
  }
  notify(message, duration = 6500) {
    clearTimeout(this.toastTimer);
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.hidden = false;
    this.toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, duration);
  }
  status(message, error = false) {
    const el = document.getElementById("save-status");
    el.textContent = message;
    el.classList.toggle("error", error);
  }
}
