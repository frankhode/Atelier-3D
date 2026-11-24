export const PICTORIAL_ZONES = ['back', 'stairs', 'left', 'floor', 'other'];
export function defaultPictorial() {
  return {
    enabled: false, center: [4.6, 2.35, 0.7], radius: [4.9, 1.8, 2.8],
    rotation: 20, softness: 0.75, strength: 0.7, shadow: 0.12, form: 0.18,
    zones: { back: 0.18, stairs: 0.16, left: 0.28, floor: 0.1, other: 0.18 },
    receives: { back: true, stairs: true, left: false, floor: false, other: false }
  };
}
export function validatePictorial(input) {
  const d = defaultPictorial();
  if (input === undefined) return d;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Estudio pictórico inválido.');
  const n=(v,min,max)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error('Valor pictórico fuera de rango.');return v;};
  const b=v=>{if(typeof v!=='boolean')throw new Error('Estado pictórico inválido.');return v;};
  const vector=(v,min,max)=>{if(!Array.isArray(v)||v.length!==3)throw new Error('Coordenadas pictóricas inválidas.');return v.map(x=>n(x,min,max));};
  return {
    enabled:b(input.enabled), center:vector(input.center,-100000,100000), radius:vector(input.radius,0.05,100000),
    rotation:n(input.rotation,-180,180), softness:n(input.softness,0.01,1),
    strength:n(input.strength,0,1), shadow:n(input.shadow,0,1), form:n(input.form,0,1),
    zones:Object.fromEntries(PICTORIAL_ZONES.map(z=>[z,n(input.zones?.[z],0,1)])),
    receives:Object.fromEntries(PICTORIAL_ZONES.map(z=>[z,b(input.receives?.[z])]))
  };
}
export function pictorialZone(name) {
  if (/barrote|pasamanos/i.test(name)) return 'rails';
  if (/peldano|peldaño|descanso/i.test(name)) return 'stairs';
  if (/^muro_fondo$/i.test(name)) return 'back';
  if (/muro_izq|dintel_izquierdo|montante|travesano_superior|umbral/i.test(name)) return 'left';
  if (/^piso|^losa/i.test(name)) return 'floor';
  return 'other';
}
export function pictorialMask(p, point) {
  const a=p.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const x=point[0]-p.center[0],y=point[1]-p.center[1],z=point[2]-p.center[2];
  const r=Math.hypot((c*x+s*y)/p.radius[0],(-s*x+c*y)/p.radius[1],z/p.radius[2]);
  const t=Math.max(0,Math.min(1,(r-(1-p.softness))/p.softness));
  return 1-t*t*(3-2*t);
}
export function pictorialDemoProject(project) {
  project.title='Estudio pictórico · escalera';
  project.pictorial={...defaultPictorial(),enabled:true};
  project.camera={projection:'perspective',position:[4.1,2.5,13.2],target:[4.1,2.65,0.8],up:[0,1,0],fov:48,orthoSize:8,zoom:1,locked:false};
  project.frame={ratio:'5:4',thirds:false};
  const room=project.models.find(m=>m.id==='sala-v04');
  if(room)room.hidden=['0/2','0/14'];
  return project;
}
