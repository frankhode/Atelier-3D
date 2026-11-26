import { defaultSurfaces, surfaceDemoProject, bounceDemoProject } from "./core/surfaces.js";
import { defaultPictorial, pictorialDemoProject } from "./core/pictorial.js";
import "./ui/styles.css";
import { defaultProject, MAX_PROJECT_BYTES } from "./core/defaults.js";
import { validateProject, serializeProject } from "./core/project.js";
import { readLocal, saveLocal, downloadFile, STORAGE_KEY } from "./core/storage.js";
import { Viewport } from "./scene/renderer.js";
import { CameraRig } from "./scene/camera-rig.js";
import { Lighting } from "./scene/lighting.js";
import {
  LightAimer,
  projectToCanvas,
  findLightBlocker,
} from "./scene/light-aimer.js";
import { aimLight, lightFromView } from "./scene/light-controls.js";
import { setLightOrigin, presetOrigin } from "./scene/light-origins.js";
import { angleForDiameter, BEAM_PRESETS } from "./core/light-beam.js";
import { ModelManager, recordFromFile } from "./scene/models.js";
import { JOINTS, PRESETS, PUPPET_HEIGHT, newPuppet, copyPose } from "./core/puppets.js";
import { PoseEditor } from "./scene/pose-editor.js";
import { figureBase, nearestSupport, pickSupport, placeFigure, snapFigure } from "./scene/puppets.js";
import { Vector2, Vector3 } from "three";
import { Interface } from "./ui/interface.js";

const pictorialDemo = new URLSearchParams(location.search).get("pictorico") === "1";
const bounceDemo = !pictorialDemo && new URLSearchParams(location.search).get("rebotes") === "1";
const surfaceDemo = !pictorialDemo && (bounceDemo || new URLSearchParams(location.search).get("superficies") === "1");
const activeStorageKey = pictorialDemo ? "atelier3d:pictorial-study:v1" : bounceDemo ? "atelier3d:bounce-study:v1" : surfaceDemo ? "atelier3d:surface-study:v1" : STORAGE_KEY;
const newProject = () => pictorialDemo ? pictorialDemoProject(defaultProject()) : bounceDemo ? bounceDemoProject(defaultProject()) : surfaceDemo ? surfaceDemoProject(defaultProject()) : defaultProject();
async function boot() {
  const local = readLocal(undefined, activeStorageKey);
  const state = local.project || newProject();
  let pickingPictorial = false;
  let ui,
    saveTimer,
    targetPreview = null,
    targetTimer,
    busy = false,
    fallbackWarned = false;
  const viewport = new Viewport(document.getElementById("render-area"), state);
  const models = new ModelManager(viewport.scene, state);
  const lighting = new Lighting(viewport.scene, state);
  const rig = new CameraRig(viewport.renderer.domElement, state, () =>
    changed(),
  );
  const editor = new PoseEditor(viewport,rig,models,()=>{ui.refresh();viewport.requestRender();});
  let placing = null, placementGesture = null;
  viewport.onResize = (aspect) => {rig.resize(aspect);editor.resize(aspect);};
  viewport.onRender = () => {
    if(editor.active)editor.render();else viewport.render(rig.camera);
    updateTargetMarker();
  };
  const aimer = new LightAimer(viewport.renderer.domElement, rig, models, {
    onStart(index) {
      ui.setLightAiming(index);
      if (pickingPictorial) {
        document.getElementById("light-aim-name").textContent = "Mancha pictórica";
        document.querySelector("#light-aim-bar span").textContent = "Tocá una superficie para centrar la mancha";
        ui.hideLightTarget();
      } else {
        document.querySelector("#light-aim-bar span").textContent = "Tocá la superficie que querés iluminar";
        previewTarget(index, true);
      }
    },
    onMiss() {
      ui.notify("Tocá una superficie de la escena, no el fondo vacío.");
    },
    onPick(index, point, normal) {
      if (pickingPictorial) { state.pictorial.center = point.slice(); apply("pictorial.center"); ui.notify("Centro de la mancha actualizado."); return true; }
      const light = state.lights[index];
      const previous = { target: light.target, angle: light.angle };
      try {
        aimLight(light, point, ui.concentrateOnAim[index], normal);
        validateProject(state);
      } catch (error) {
        Object.assign(light, previous);
        ui.notify(error.message);
        return false;
      }
      lighting.apply();
      changed();
      previewTarget(index);
      describeLightPath(index, previous.angle > light.angle);
      return true;
    },
    onEnd(index, picked) {
      ui.setLightAiming(null);
      if (pickingPictorial) { pickingPictorial = false; ui.open("lights"); } else ui.focusLight(index);
      if (!picked) hideTargetMarker();
    },
  });
  function updateTargetMarker() {
    if (!ui) return;
    if(editor.active||placing){ui.hideLightTarget();return;}
    if (state.pictorial?.enabled || state.surfaces?.enabled) { ui.hideLightTarget(); return; }
    const index =
      ui.activePanel === "lights" ? ui.selectedLight : targetPreview?.index;
    if (index === undefined || index === null || !state.lights[index]) {
      ui.hideLightTarget();
      return;
    }
    const light = state.lights[index],
      canvas = viewport.renderer.domElement;
    const target = projectToCanvas(light.target, rig.camera, canvas);
    ui.showLightTarget(index, target);
    ui.showLightOrigin(
      index,
      projectToCanvas(light.position, rig.camera, canvas),
      target,
      canvas.getBoundingClientRect(),
    );
  }
  function hideTargetMarker() {
    clearTimeout(targetTimer);
    targetPreview = null;
    updateTargetMarker();
  }
  function previewTarget(index, permanent = false) {
    clearTimeout(targetTimer);
    targetPreview = { index };
    updateTargetMarker();
    if (!permanent) targetTimer = setTimeout(hideTargetMarker, 6500);
  }
  function describeLightPath(index, concentrated = false) {
    const light = state.lights[index];
    const blocker = light.shadows ? findLightBlocker(light, models) : null;
    if (!light.enabled) ui.notify("Punto actualizado. Esta luz está apagada.");
    else if (blocker)
      ui.notify(
        `El recorrido hacia ese punto está bloqueado por ${blocker.name.replaceAll("_", " ")}. Probá otra posición del origen.`,
        10000,
      );
    else
      ui.notify(
        `Punto de luz ${index + 1} actualizado${concentrated ? " con haz concentrado" : ""}.`,
      );
  }
  function save() {
    clearTimeout(saveTimer);
    rig.capture();
    const result = saveLocal(state, undefined, activeStorageKey);
    ui.status(
      result === "complete"
        ? "Guardado en este dispositivo"
        : result === "parameters"
          ? "Parámetros guardados · exportá los modelos"
          : "Guardado local no disponible",
      result !== "complete",
    );
    if (result !== "complete" && !fallbackWarned) {
      ui.notify(
        result === "parameters"
          ? "Se guardaron los parámetros. No hay espacio para los modelos: exportá una copia JSON antes de cerrar."
          : "El navegador no permite guardar. Exportá el JSON para conservar tu trabajo.",
        10000,
      );
      fallbackWarned = true;
    }
  }
  function changed() {
    viewport.requestRender();
    ui?.update();
    if (!ui) return;
    ui.status("Cambios sin guardar");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 650);
  }
  async function ensureBounces() {
    if (!state.surfaces?.enabled || !state.models.some(m=>m.id==="sala-v04" && m.visible) ||
        models.bounceStudy.ready || models.bounceStudy.error || models.bounceStudy.loading) return;
    const ok = await models.loadBounces();
    if (ui?.activePanel === "lights") ui.refresh();
    viewport.requestRender();
    if (!ok && state.surfaces?.enabled) ui?.notify(models.bounceStudy.error?.message || "No se pudo cargar la luz rebotada.");
  }
  function apply(path) {
    validateProject(state);
    if (path.startsWith("pictorial.") || path.startsWith("surfaces.")) {
      models.applyLook(); lighting.apply();
      if (path === "pictorial.enabled" || path === "surfaces.enabled") { ui.refresh(); if (state.surfaces?.enabled) void ensureBounces(); }
    }
    if (path.startsWith("camera.")) {
      rig.restore();
      if (path === "camera.locked") ui.refresh();
    }
    if (path.startsWith("lights."))
      ui.selectedLight = Number(path.split(".")[1]);
    if (path.startsWith("lights.") || path.startsWith("appearance."))
      lighting.apply();
    if (path.startsWith("models.")) {
      const record = state.models[Number(path.split(".")[1])], entry=models.entries.get(record.id);
      const oldBase = record.kind==="puppet"&&entry?figureBase(entry.wrapper):null;
      models.apply(record.id);
      if(record.kind==="puppet" && entry && record.magnet && (path.endsWith(".magnet") ||
        (path.includes(".transform.")&&!path.endsWith(".position.1")))){
        if(!snapFigure(entry,models,oldBase))ui.notify("No se encontró una superficie de apoyo en esa ubicación.");
      }
      lighting.apply();
      void ensureBounces();
    }
    if (path.startsWith("appearance.")) {
      models.material.color.set(state.appearance.material);
      models.applyLook();
      viewport.applyAppearance();
    }
    if (path.startsWith("frame.")) viewport.resize();
    changed();
  }
  async function replaceProject(next) {
    // Parse all geometry before touching the active scene: failed imports are atomic.
    finishPlacement(false);closePose();
    const staged = await models.prepareProject(next);
    models.clear();
    Object.assign(state, next);
    lighting.setSolo(null);
    ui.setSoloLight(null);
    staged.forEach((entry) => models.mount(entry));
    await ensureBounces();
    rig.restore();
    lighting.apply();
    models.material.color.set(state.appearance.material);
    models.applyLook();
    viewport.applyAppearance();
    ui.refresh();
    changed();
    const pending = state.models.filter(
      (m) => ["obj","glb"].includes(m.kind) && !m.source,
    );
    if (pending.length)
      ui.notify(
        `Volvé a importar ${pending.map((m) => m.name).join(", ")} para recuperar sus objetos.`,
        12000,
      );
  }
  async function withBusy(work) {
    if (busy) {
      ui.notify("Esperá a que termine la importación actual.");
      return;
    }
    aimer.cancel();
    hideTargetMarker();
    busy = true;
    document.getElementById("loading").hidden = false;
    try {
      await work();
    } catch (error) {
      console.error(error);
      ui.notify(
        error.message || "No se pudo abrir el archivo. Verificá su formato.",
        10000,
      );
    } finally {
      busy = false;
      document.getElementById("loading").hidden = true;
    }
  }
  function initialCamera() {
    if (state.camera.locked) return;
    Object.assign(state.camera, defaultProject().camera);
    // Keep the full 8.2 m room visible on portrait screens, preserving front orientation.
    const distance = Math.max(
      12.1,
      4.5 / (Math.tan((state.camera.fov * Math.PI) / 360) * rig.aspect),
    );
    state.camera.position[2] = state.camera.target[2] + distance;
    rig.restore();
    changed();
  }
  function finishPlacement(reopen=true){
    if(!placing)return;
    placing=null;placementGesture=null;
    document.body.classList.remove("placing-figure");
    document.getElementById("figure-aim-bar").hidden=true;
    rig.controls.enabled=!state.camera.locked;
    if(reopen)ui.open("figures");
    viewport.requestRender();
  }
  function startPlacement(id){
    if(!models.entries.has(id))return;
    aimer.cancel();hideTargetMarker();
    ui.selectedFigure=id;ui.open(null);placing=id;
    rig.controls.enabled=false;
    document.body.classList.add("placing-figure");
    document.getElementById("figure-aim-bar").hidden=false;
    viewport.requestRender();
  }
  const canvas=viewport.renderer.domElement;
  canvas.addEventListener("pointerdown",e=>{
    if(!placing)return;
    if(e.button===0&&e.isPrimary)placementGesture={x:e.clientX,y:e.clientY,id:e.pointerId};
    else placementGesture=null;
  });
  canvas.addEventListener("pointercancel",()=>placementGesture=null);
  canvas.addEventListener("pointerup",e=>{
    if(!placing)return;
    const g=placementGesture;placementGesture=null;
    if(!g||g.id!==e.pointerId||Math.hypot(e.clientX-g.x,e.clientY-g.y)>8)return;
    const r=canvas.getBoundingClientRect(), ndc=new Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);
    const point=pickSupport(models,rig.camera,ndc,placing);
    if(!point){ui.notify("Tocá una superficie horizontal visible (piso, escalón o asiento).");return;}
    const entry=models.entries.get(placing);
    placeFigure(entry,point);models.apply(placing);finishPlacement();changed();
  });
  document.getElementById("cancel-figure-aim").onclick=()=>finishPlacement();
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&placing)finishPlacement();});
  function startPose(record,contextual){
    finishPlacement(false);aimer.cancel();hideTargetMarker();
    editor.start(record,contextual);
    viewport.freeFrame=true;
    ui.open("poseEditor");viewport.resize();
  }
  function closePose(){
    editor.close();viewport.freeFrame=false;
  }
  async function confirmPose(){
    if(!editor.active)return;
    const draft=structuredClone(editor.record);
    const existing=state.models.find(m=>m.id===draft.id), contextual=editor.contextual;
    const previousBase=existing?figureBase(models.entries.get(existing.id).wrapper):null;
    if(!existing && state.models.length>=100){ui.notify("Máximo de 100 modelos por composición.");return;}
    if(!existing){
      const bounds=models.bounds();
      const center=bounds.isEmpty()?new Vector3():bounds.getCenter(new Vector3());
      const room=state.models.find(m=>m.kind==="builtin"&&m.visible);
      if(room){
        center.set(4.1,0,3.25).applyMatrix4(models.entries.get(room.id).wrapper.matrixWorld);
      }else center.y=bounds.isEmpty()?0:bounds.min.y;
      const support=nearestSupport(models,center.x,center.z,center.y,draft.id);
      draft.transform.position=(support||center).toArray();
    }
    await withBusy(async()=>{
      const entry=await models.prepare(draft);
      if(existing){models.remove(existing.id);state.models[state.models.indexOf(existing)]=draft;}
      else state.models.push(draft);
      models.mount(entry);
      if(!existing){
        const point=new Vector3(...draft.transform.position);
        placeFigure(entry,point);
      }else if(!contextual&&draft.magnet){
        const previous=models.entries.get(draft.id);
        snapFigure(previous,models,previousBase);
      }
      ui.selectedFigure=draft.id;
      closePose();
      ui.open("figures");changed();
      if(!existing)startPlacement(draft.id);
      else ui.notify("Pose aplicada. La figura vuelve a estar congelada.");
    });
  }
  const actions = {
    editor,
    closePose,
    poseInput(field,value){
      if(!editor.active)return;
      if(field==="name"){editor.nameDraft=value;return;}
      if(field==="joint"&&JOINTS.some(([id])=>id===value)){editor.joint=value;ui.refresh();viewport.requestRender();return;}
      if(field==="preset"&&value!==""){
        const preset=value.startsWith("saved:")?state.poses[Number(value.slice(6))]:PRESETS[Number(value)];
        if(preset){editor.changePose(preset.pose);ui.refresh();}return;
      }
      if(field.startsWith("axis:")){
        const axis=Number(field.slice(5)), pose=copyPose(editor.record.pose);
        pose[editor.joint][axis]=Number(value);editor.changePose(pose);
      }else if(field==="radius"){editor.radius=Number(value);viewport.requestRender();}
      else if(field==="offset")editor.offset(Number(value));
    },
    changed,
    apply,
    panelChanged: () => viewport.resize(),
    notify: (message) => ui.notify(message),
    importModel: () => document.getElementById("model-input").click(),
    lock: () => rig.lock(),
    fit: () => {
      rig.fit(models.bounds());
      ui.refresh();
    },
    action: async (name, value, id) => {
      const model = state.models.find((m) => m.id === id);
      if (name === "puppet-new") {
        if(state.models.length>=100){ui.notify("Máximo de 100 modelos por composición.");return;}
        const n=state.models.filter(m=>m.kind==="puppet").length+1;
        startPose(newPuppet("Maniquí "+n),false);
      } else if (name === "puppet-confirm") {await confirmPose();}
      else if (name === "puppet-cancel") {closePose();ui.open("figures");}
      else if (name === "puppet-view" && editor.active) editor.fit(value);
      else if (name === "puppet-reset-joint" && editor.active) {
        const pose=copyPose(editor.record.pose);pose[editor.joint]=[0,0,0];editor.changePose(pose);ui.refresh();
      } else if (name === "puppet-save-pose" && editor.active) {
        const title=editor.nameDraft.trim();
        if(!title){ui.notify("Poné un nombre a la pose.");return;}
        const found=state.poses.find(p=>p.name===title);
        if(!found&&state.poses.length>=100){ui.notify("Máximo de 100 poses guardadas.");return;}
        if(found)found.pose=copyPose(editor.record.pose);else state.poses.push({name:title,pose:copyPose(editor.record.pose)});
        editor.nameDraft="";ui.refresh();changed();ui.notify("Pose guardada en la biblioteca.");
      } else if (name === "puppet-place" && model?.kind==="puppet") startPlacement(id);
      else if (name === "puppet-context" && model?.kind==="puppet") startPose(model,true);
      else if (name === "puppet-workshop" && model?.kind==="puppet") startPose(model,false);
      else if (name === "puppet-height" && model?.kind==="puppet") {
        const height=Number(value);
        if(!Number.isFinite(height)||height<.25||height>5)return;
        model.transform.scale=height/PUPPET_HEIGHT;
        apply("models."+state.models.indexOf(model)+".transform.scale");
        ui.selectedFigure=id;ui.refresh();
      } else if (name === "puppet-snap" && model?.kind==="puppet") {
        const entry=models.entries.get(id);
        if(!snapFigure(entry,models,figureBase(entry.wrapper)))ui.notify("No se encontró apoyo debajo de la figura.");
        models.apply(id);ui.selectedFigure=id;ui.refresh();changed();
      } else if (name === "puppet-duplicate" && model?.kind==="puppet") {
        if(state.models.length>=100){ui.notify("Máximo de 100 modelos por composición.");return;}
        await withBusy(async()=>{
          const copy={...structuredClone(model),id:newPuppet("").id,name:(model.name+" · copia").slice(0,100)};
          const entry=await models.prepare(copy);
          const oldBase=figureBase(models.entries.get(id).wrapper);
          copy.transform.position[0]+=.45;
          state.models.push(copy);models.mount(entry);
          if(copy.magnet)snapFigure(entry,models,oldBase);
          ui.selectedFigure=copy.id;ui.refresh();changed();
        });
      } else if (name === "pictorial-mode") {
        state.surfaces.enabled = false; state.pictorial.enabled = value === "true"; lighting.setSolo(null); ui.setSoloLight(null); apply("pictorial.enabled");
      } else if (name === "surface-mode") {
        state.pictorial.enabled = false; state.surfaces.enabled = true; lighting.setSolo(null); ui.setSoloLight(null); hideTargetMarker(); apply("surfaces.enabled");
      } else if (name === "surface-reset") {
        state.surfaces = { ...defaultSurfaces(), enabled: true }; apply("surfaces.enabled");
      } else if (name === "pictorial-preset") {
        state.surfaces.enabled = false; state.pictorial = { ...defaultPictorial(), enabled: true }; apply("pictorial.enabled"); ui.notify("Mancha sobre fondo y escalera. Ajustá los valores de la izquierda y el piso.");
      } else if (name === "pictorial-view") {
        if (state.camera.locked) { ui.notify("Desbloqueá la cámara para usar la vista frontal."); return; }
        const demo=pictorialDemoProject(defaultProject()); state.camera=demo.camera; state.frame=demo.frame; rig.restore(); viewport.resize(); changed();
      } else if (name === "pictorial-pick") {
        pickingPictorial = true; aimer.start(0);
      } else if (name === "import") actions.importModel();
      else if (name === "projection") {
        rig.setProjection(value);
        ui.refresh();
      } else if (name === "view") {
        rig.setView(value);
        ui.refresh();
      } else if (name === "fit") {
        rig.fit(models.bounds());
        ui.refresh();
      } else if (name === "fit-model") {
        rig.fit(models.bounds(id));
        ui.open(null);
      } else if (name === "initial-camera") {
        initialCamera();
        ui.refresh();
      } else if (name === "ratio") {
        state.frame.ratio = value;
        viewport.resize();
        ui.refresh();
        changed();
      } else if (name === "aim-light") {
        const index = Number(value);
        if (Number.isInteger(index) && state.lights[index]) aimer.start(index);
      } else if (name === "show-light-target") {
        const index = Number(value);
        if (!Number.isInteger(index) || !state.lights[index]) return;
        ui.open(null);
        previewTarget(index);
        if (
          !projectToCanvas(
            state.lights[index].target,
            rig.camera,
            viewport.renderer.domElement,
          ).visible
        )
          ui.notify(
            "El punto está fuera del encuadre. Usá Apuntar en la escena para elegir uno visible.",
          );
      } else if (name === "solo-light") {
        const index = value === "clear" ? null : Number(value);
        if (
          index !== null &&
          (!Number.isInteger(index) || !state.lights[index])
        )
          return;
        const next = index === lighting.soloIndex ? null : index;
        lighting.setSolo(next);
        ui.setSoloLight(next);
        if (ui.activePanel === "lights") ui.focusLight(ui.selectedLight);
        viewport.requestRender();
        if (next !== null && !state.lights[next].enabled)
          ui.notify("Esta luz está apagada. Encendela para verla sola.");
      } else if (name === "light-origin" || name === "origin-preset") {
        const index = Number(id),
          light = state.lights[index];
        if (!Number.isInteger(index) || !light) return;
        const previous = light.position;
        try {
          const point =
            name === "origin-preset" ? presetOrigin(models, value) : value;
          setLightOrigin(light, point);
          validateProject(state);
        } catch (error) {
          light.position = previous;
          ui.notify(error.message);
          return;
        }
        ui.selectedLight = index;
        lighting.apply();
        changed();
        previewTarget(index);
        ui.syncLightLabels();
        if (light.enabled && light.shadows && findLightBlocker(light, models))
          describeLightPath(index);
      } else if (name === "light-from-view") {
        const index = Number(value),
          light = state.lights[index];
        if (!Number.isInteger(index) || !light) return;
        const previous = { position: light.position, angle: light.angle };
        try {
          lightFromView(light, rig.camera);
          validateProject(state);
        } catch (error) {
          Object.assign(light, previous);
          ui.notify(error.message);
          return;
        }
        lighting.apply();
        changed();
        previewTarget(index);
        ui.focusLight(index);
        describeLightPath(index);
      } else if (name === "beam-preset" || name === "beam-width") {
        const index = Number(id),
          light = state.lights[index];
        if (!Number.isInteger(index) || !light) return;
        try {
          const angle =
            name === "beam-width"
              ? angleForDiameter(light, Number(value))
              : BEAM_PRESETS.find((p) => p.angle === Number(value))?.angle;
          if (angle === undefined) return;
          light.angle = angle;
          lighting.apply();
          changed();
        } catch (error) {
          ui.notify(error.message);
        }
        ui.focusLight(index);
      } else if (name === "reset-lights") {
        hideTargetMarker();
        state.lights = defaultProject().lights;
        lighting.setSolo(null);
        ui.setSoloLight(null);
        ui.refresh();
        changed();
      } else if (name === "export") {
        rig.capture();
        downloadFile(
          serializeProject(state),
          `${safeName(state.title)}.atelier.json`,
        );
        ui.notify("Composición exportada con sus modelos.");
      } else if (name === "import-project")
        document.getElementById("project-input").click();
      else if (name === "save") {
        save();
        ui.notify("Guardado local actualizado.");
      } else if (name === "reset") {
        if (
          confirm(
            "¿Restablecer la sala de prueba? Exportá antes un JSON si querés conservar esta composición.",
          )
        )
          await withBusy(() => replaceProject(newProject()));
      } else if (name === "png") {
        viewport.render(rig.camera);
        viewport.renderer.domElement.toBlob((blob) => {
          if (blob) {
            downloadFile(blob, `${safeName(state.title)}.png`, "image/png");
            ui.notify("Imagen del encuadre exportada.");
          } else ui.notify("No se pudo generar la imagen.");
        }, "image/png");
      } else if (model) {
        if (name === "remove") {
          models.remove(id);
          state.models = state.models.filter((m) => m.id !== id);
        } else if (name === "show-all") {
          model.visible = true;
          model.hidden = [];
        } else if (name === "hide-all")
          model.hidden =
            models.entries.get(id)?.objects.map((o) => o.key) || [];
        else if (name.startsWith("units-"))
          model.transform.scale = {
            "units-m": 1,
            "units-cm": 0.01,
            "units-mm": 0.001,
          }[name];
        else if (name === "up-y") model.transform.rotation[0] = 0;
        else if (name === "up-z") model.transform.rotation[0] = -90;
        models.apply(id);
        models.applyLook();
        lighting.apply();
        void ensureBounces();
        ui.refresh();
        changed();
      }
    },
  };
  ui = new Interface(state, models, actions);
  document.getElementById("cancel-light-aim").onclick = () => aimer.cancel();
  document.getElementById("model-input").addEventListener("change", (event) => {
    const files = [...event.target.files];
    event.target.value = "";
    if (!files.length) return;
    withBusy(async () => {
      let added = 0;
      for (const file of files) {
        const record = await recordFromFile(file),
          existing = state.models.find((m) => m.id === record.id);
        if (existing && models.entries.has(record.id)) {
          ui.notify(`${file.name} ya está en la escena.`);
          continue;
        }
        if (state.models.length >= 100 && !existing)
          throw new Error("Máximo de 100 modelos por composición.");
        if (existing)
          ((record.transform = existing.transform),
            (record.hidden = existing.hidden),
            (record.visible = existing.visible));
        const entry = await models.prepare(record);
        if (existing) state.models[state.models.indexOf(existing)] = record;
        else state.models.push(record);
        models.mount(entry);
        added++;
      }
      ui.open("objects");
      changed();
      if (added)
        ui.notify(
          `${added} ${added === 1 ? "modelo importado" : "modelos importados"}. Podés ajustar unidades y orientación en Objetos.`,
        );
    }).finally(() => {
      ui.refresh();
      changed();
    });
  });
  document
    .getElementById("project-input")
    .addEventListener("change", (event) => {
      const file = event.target.files[0];
      event.target.value = "";
      if (!file) return;
      withBusy(async () => {
        if (file.size > MAX_PROJECT_BYTES)
          throw new Error("El proyecto supera los 96 MB.");
        const next = validateProject(JSON.parse(await file.text()));
        await replaceProject(next);
        ui.notify("Composición abierta.");
      });
    });
  viewport.onContextLost = () => {
    aimer.cancel();finishPlacement(false);
    hideTargetMarker();
    ui.notify(
      "Se interrumpió la vista 3D. Esperando que el navegador recupere el contexto…",
      12000,
    );
  };
  viewport.onContextRestored = () => {
    lighting.apply();
    viewport.requestRender();
    ui.notify("Vista 3D recuperada.");
  };
  window.addEventListener("pagehide", save);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });
  try {
    const staged = await models.prepareProject(state);
    staged.forEach((entry) => models.mount(entry));
    await ensureBounces();
    viewport.applyAppearance();
    if (!local.project && !pictorialDemo) initialCamera();
    ui.update();
    ui.status("Guardado en este dispositivo");
    if (local.error)
      ui.notify(
        "No se pudo recuperar el guardado anterior. Se abrió la sala de referencia.",
        9000,
      );
    const missing = state.models.filter(
      (m) => ["obj","glb"].includes(m.kind) && !m.source,
    );
    if (missing.length)
      ui.notify(
        `Parámetros recuperados. Volvé a importar: ${missing.map((m) => m.name).join(", ")}.`,
        12000,
      );
  } finally {
    document.getElementById("loading").hidden = true;
  }
}
function safeName(name) {
  return (name || "composicion")
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .slice(0, 70);
}
boot().catch((error) => {
  console.error(error);
  const loading = document.getElementById("loading");
  loading.hidden = false;
  loading.replaceChildren();
  const p = document.createElement("p");
  p.textContent = `No se pudo iniciar Atelier 3D. ${error.message}`;
  p.style.cssText = "max-width:420px;padding:24px;line-height:1.7";
  const help = document.createElement("p");
  help.textContent =
    "Usá un navegador actualizado con WebGL 2 y aceleración gráfica. Si el guardado falló, podés recuperar la sala de prueba.";
  help.style.cssText = "max-width:420px;padding:0 24px;line-height:1.7";
  const retry = document.createElement("button");
  retry.className = "button";
  retry.textContent = "Reintentar";
  retry.onclick = () => location.reload();
  const reset = document.createElement("button");
  reset.className = "button";
  reset.textContent = "Restablecer guardado local";
  reset.onclick = () => {
    if (confirm("¿Borrar el guardado local y volver a la sala de prueba?")) {
      try {
        localStorage.removeItem(activeStorageKey);
      } catch {}
      location.reload();
    }
  };
  loading.append(p, help, retry, reset);
});

