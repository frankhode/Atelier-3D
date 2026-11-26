import { Euler, Quaternion, MathUtils } from "three";

// Poses use local joint rotations in degrees. A figure's transform remains
// independent of the pose, so placement never changes individual joints.
export const PUPPET_HEIGHT = 1.75;
export const JOINTS = [
  ["pelvis", "Pelvis"], ["waist", "Cintura"], ["chest", "Tórax"],
  ["neck", "Cuello"], ["head", "Cabeza"],
  ...[["l", "izq."], ["r", "der."]].flatMap(([s, side]) => [
    [s+"Shoulder", "Hombro "+side], [s+"Elbow", "Codo "+side],
    [s+"Wrist", "Muñeca "+side], [s+"Hip", "Cadera "+side],
    [s+"Knee", "Rodilla "+side], [s+"Ankle", "Tobillo "+side],
  ]),
];
export const neutralPose = () => Object.fromEntries(JOINTS.map(([id])=>[id,[0,0,0]]));

// Conservative artistic articulation limits, not a clinical range-of-motion
// model. Each control has an anatomical name and friendly positive direction.
// The sign converts the UI value into the local Euler rotation of the rig.
const control=(axis,label,min,max,sign=1)=>({axis,label,min,max,sign});
export function jointControls(id){
  const side=id.startsWith("l")?1:-1;
  if(id.endsWith("Knee"))return [control(0,"Flexión de rodilla",0,145)];
  if(id.endsWith("Elbow"))return [control(0,"Flexión de codo",0,150,-1),control(1,"Giro del antebrazo",-80,80,side)];
  if(id.endsWith("Shoulder"))return [
    control(0,"Brazo adelante / atrás",-45,165,-1),
    control(2,"Separar brazo / acercar",-30,145,side),
    control(1,"Rotación del brazo",-85,85,side)];
  if(id.endsWith("Hip"))return [
    control(0,"Muslo adelante / atrás",-30,120,-1),
    control(2,"Separar pierna / acercar",-20,45,side),
    control(1,"Rotación de cadera",-40,45,side)];
  if(id.endsWith("Wrist"))return [control(0,"Flexión / extensión",-65,75,-1),control(2,"Inclinación lateral",-25,35,side)];
  if(id.endsWith("Ankle"))return [control(0,"Punta abajo / arriba",-30,60),control(2,"Inclinación del tobillo",-15,20,side)];
  const torso={
    pelvis:[control(0,"Basculación de pelvis",-20,25),control(1,"Giro de pelvis",-30,30),control(2,"Inclinación de pelvis",-15,15)],
    waist:[control(0,"Inclinar torso adelante / atrás",-25,50),control(1,"Giro de cintura",-30,30),control(2,"Inclinación lateral",-25,25)],
    chest:[control(0,"Flexión del tórax",-20,30),control(1,"Giro del tórax",-30,30),control(2,"Inclinación del tórax",-20,20)],
    neck:[control(0,"Cuello abajo / arriba",-25,35),control(1,"Giro de cuello",-35,35),control(2,"Inclinar cuello",-25,25)],
    head:[control(0,"Mirar abajo / arriba",-40,45),control(1,"Giro de cabeza",-65,65),control(2,"Inclinar cabeza",-30,30)]
  };
  return torso[id]??[];
}
export function validatePose(pose) {
  if (!pose || typeof pose !== "object") throw Error("Pose inválida.");
  return Object.fromEntries(JOINTS.map(([id]) => {
    const v=pose[id];
    if (!Array.isArray(v)||v.length!==3||v.some(n=>!Number.isFinite(n)||Math.abs(n)>180)) throw Error("Articulación inválida: "+id);
    return [id,v.slice()];
  }));
}
export const copyPose = validatePose;
const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
// Only drafts are constrained. A scene saved by an older version still loads
// literally; editing and confirming a draft is the explicit migration.
export function constrainPose(pose){
  const v=copyPose(pose), constrained=neutralPose();
  for(const [id] of JOINTS){
    for(const c of jointControls(id)){
      constrained[id][c.axis]=clamp(v[id][c.axis]*c.sign,c.min,c.max)*c.sign || 0;
    }
  }
  return constrained;
}
export function setJointControl(pose,id,axis,value){
  const v=constrainPose(pose), c=jointControls(id).find(c=>c.axis===axis);
  if(c&&Number.isFinite(value))v[id][axis]=clamp(value,c.min,c.max)*c.sign||0;
  return v;
}
export const ANATOMICAL_RIG = "anatomical-v1";
export function jointRotationOrder(id,rig){
  return rig===ANATOMICAL_RIG && /(?:Shoulder|Hip)$/.test(id)?"XZY":"XYZ";
}
export function migrateLegacyPose(pose){
  const v=copyPose(pose);
  for(const [id] of JOINTS){
    if(jointRotationOrder(id,ANATOMICAL_RIG)==="XYZ")continue;
    const e=new Euler(...v[id].map(MathUtils.degToRad),"XYZ");
    const q=new Quaternion().setFromEuler(e);
    const converted=new Euler().setFromQuaternion(q,"XZY");
    v[id]=[converted.x,converted.y,converted.z].map(x=>Math.round(MathUtils.radToDeg(x)));
  }
  return constrainPose(v);
}
// The initial studies were sketched using the original rig; convert to the
// anatomical frame before applying refinements expressed in its local axes.
const makePose = (changes, refined={}) => constrainPose({...migrateLegacyPose({...neutralPose(), ...changes}),...refined});
export function mirrorPose(pose){
  const v=copyPose(pose);
  return Object.fromEntries(JOINTS.map(([id])=>{
    const other=/^[lr](Shoulder|Elbow|Wrist|Hip|Knee|Ankle)$/.test(id)?(id[0]==="l"?"r":"l")+id.slice(1):id;
    const [x,y,z]=v[other];return [id,[x,-y||0,-z||0]];
  }));
}
const relaxed={lShoulder:[0,0,10],rShoulder:[0,0,-10]};
const contrapposto=makePose({
  pelvis:[-2,6,7],waist:[3,-4,-17],chest:[-2,-5,-3],neck:[-1,3,0],head:[0,5,2],
  lHip:[0,-5,-7],rHip:[-7,6,-15],rKnee:[17,0,0],rAnkle:[-10,0,5],lAnkle:[2,0,0],
  lShoulder:[4,-5,8],rShoulder:[-7,4,-13],lElbow:[-7,0,0],rElbow:[-13,0,0]
});
export const PRESETS = [
  {name:"De pie", pose:makePose({lShoulder:[0,0,12], rShoulder:[0,0,-12]})},
  {name:"Sentado", support:"pelvis", pose:makePose({lHip:[-90,0,5],rHip:[-90,0,-5],lKnee:[90,0,0],rKnee:[90,0,0],lShoulder:[-12,0,10],rShoulder:[-12,0,-10],lElbow:[-65,0,0],rElbow:[-65,0,0]})},
  {name:"Caminando", pose:makePose({lHip:[-28,0,0],rHip:[23,0,0],lKnee:[8,0,0],rKnee:[32,0,0],lAnkle:[15,0,0],rAnkle:[-22,0,0],lShoulder:[20,0,10],rShoulder:[-25,0,-10],lElbow:[-12,0,0],rElbow:[-22,0,0]})},
  {name:"Subiendo escalón",pose:makePose({lHip:[-60,0,0],lKnee:[85,0,0],lAnkle:[-25,0,0],rHip:[10,0,0],rKnee:[8,0,0],rAnkle:[-18,0,0],waist:[8,0,0],lShoulder:[12,0,10],rShoulder:[-20,0,-10],rElbow:[-40,0,0]})},
  {name:"Arrodillado",pose:makePose({lHip:[-15,0,5],rHip:[-15,0,-5],lKnee:[120,0,0],rKnee:[120,0,0],lAnkle:[45,0,0],rAnkle:[45,0,0],lShoulder:[-12,0,10],rShoulder:[-12,0,-10]})},
  {name:"Contraposto · peso izquierdo",pose:contrapposto},
  {name:"Contraposto · peso derecho",pose:mirrorPose(contrapposto)},
];

// Ten starting studies from the numbered composition and its final gaze
// diagram. Whole-pose rotation is independent of the scene object transform:
// the reclining figure can still be translated and rotated normally.
export const COMPOSITION_PRESETS=[
  {name:"01 · Chica agachada",height:1.63,rotation:[0,20,0],pose:makePose({
    pelvis:[3,0,-5],waist:[19,8,4],chest:[-4,8,-4],head:[-6,28,-4],
    lHip:[-98,0,13],lKnee:[122,0,0],lAnkle:[-24,0,0],rHip:[-10,0,-8],rKnee:[132,0,0],rAnkle:[38,0,0],
    lShoulder:[-30,-38,8],lElbow:[-65,10,0],lWrist:[-15,0,-8],
    rShoulder:[-35,58,-8],rElbow:[-83,-20,0],rWrist:[-5,0,10]
  },{rShoulder:[-47,84,-4],rElbow:[-52,-20,0]})},
  {name:"02 · Chica de pie, mira arriba",height:1.66,rotation:[0,12,0],pose:makePose({
    ...relaxed,pelvis:[-2,0,3],waist:[-2,5,-4],chest:[-3,6,0],head:[-20,42,-3],neck:[-8,10,0],
    lHip:[0,0,-3],rHip:[-3,1,-2],rKnee:[5,0,0],rAnkle:[-1,0,-1],lElbow:[-8,0,0],rElbow:[-11,0,0]
  })},
  {name:"03 · Hombre, manos en cintura",height:1.78,pose:makePose({
    pelvis:[-2,0,-2],waist:[0,0,3],lHip:[0,0,3],rHip:[-4,0,-3],rKnee:[6,0,0],rAnkle:[-2,0,4],
    lShoulder:[0,-75,32],rShoulder:[0,75,-32],lElbow:[-100,0,0],rElbow:[-100,0,0],lWrist:[-15,0,5],rWrist:[-15,0,-5]
  },{lShoulder:[-7,-85,37],rShoulder:[-7,85,-40],lElbow:[-94,0,0],rElbow:[-94,0,0],lWrist:[63,0,-11],rWrist:[55,0,13]})},
  {name:"04 · Hombre en la escalera",height:1.78,rotation:[0,67,0],pose:makePose({
    pelvis:[0,-5,0],waist:[8,0,0],head:[-9,9,0],lHip:[-56,0,4],lKnee:[79,0,0],lAnkle:[-23,0,0],
    rHip:[9,0,-4],rKnee:[8,0,0],rAnkle:[-17,0,0],lShoulder:[10,0,9],lElbow:[-14,0,0],
    rShoulder:[-25,6,-20],rElbow:[-38,12,0],rWrist:[-12,0,-8]
  })},
  {name:"05 · Chica sentada en escalones",height:1.65,support:"pelvis",rotation:[0,-58,0],pose:makePose({
    pelvis:[-3,0,-3],waist:[23,12,4],chest:[7,16,1],neck:[3,12,0],head:[4,49,-5],
    lHip:[-108,0,10],rHip:[-88,0,-9],lKnee:[125,0,0],rKnee:[106,0,0],lAnkle:[-14,0,0],rAnkle:[-15,0,0],
    lShoulder:[-42,-28,9],rShoulder:[-42,35,-12],lElbow:[-70,5,0],rElbow:[-82,-5,0],lWrist:[8,0,0],rWrist:[-5,0,4]
  },{lShoulder:[-51,-49,1],lElbow:[-66,5,0],rShoulder:[-52,19,-8],rElbow:[-45,-5,0]})},
  {name:"06 · Mujer apoyada en baranda",height:1.69,rotation:[0,55,0],pose:makePose({
    pelvis:[2,0,4],waist:[7,-8,-3],chest:[6,-6,0],neck:[10,-6,0],head:[19,-33,4],
    lHip:[-24,0,0],lKnee:[34,0,0],lAnkle:[-10,0,0],rHip:[0,0,-4],rKnee:[5,0,0],rAnkle:[-5,0,0],
    lShoulder:[-29,-8,10],lElbow:[-66,5,0],lWrist:[-9,0,0],rShoulder:[-38,18,-20],rElbow:[-59,-12,0],rWrist:[-7,0,-3]
  },{lShoulder:[-49,-16,-2],lElbow:[-61,5,0]})},
  {name:"07 · Niño asomado a la baranda",height:1.25,rotation:[0,-8,0],pose:makePose({
    pelvis:[4,0,0],waist:[17,0,3],chest:[8,-4,-2],neck:[9,0,0],head:[21,9,7],
    lHip:[-4,0,4],rHip:[-7,0,-4],lKnee:[7,0,0],rKnee:[11,0,0],lAnkle:[-7,0,0],rAnkle:[-8,0,0],
    lShoulder:[-52,-15,22],rShoulder:[-48,17,-20],lElbow:[-85,-10,0],rElbow:[-79,10,0],lWrist:[8,0,10],rWrist:[7,0,-5]
  },{lShoulder:[-57,-15,34],rShoulder:[-68,46,-11],lElbow:[-112,-10,0],rElbow:[-109,10,0]})},
  {name:"08 · Niña asomada desde arriba",height:1.17,rotation:[0,15,0],pose:makePose({
    pelvis:[4,0,2],waist:[25,0,-5],chest:[10,-6,-2],neck:[8,0,0],head:[24,-15,-8],
    lHip:[-3,0,2],rHip:[-8,0,-5],lKnee:[5,0,0],rKnee:[12,0,0],lAnkle:[-4,0,0],rAnkle:[-8,0,0],
    lShoulder:[-46,-7,15],rShoulder:[-53,12,-24],lElbow:[-79,0,0],rElbow:[-90,10,0],lWrist:[12,0,5],rWrist:[8,0,-8]
  },{lShoulder:[-76,-47,11],rShoulder:[-58,18,-23],lElbow:[-96,0,0],rElbow:[-123,10,0]})},
  {name:"09 · Hombre recostado en sillón",height:1.80,support:"torso",rotation:[-90,0,-90],pose:makePose({
    pelvis:[0,0,0],waist:[-5,5,0],chest:[-3,-5,0],neck:[4,0,0],head:[6,4,0],
    lHip:[-8,0,40],lKnee:[30,0,0],lAnkle:[-10,0,0],rHip:[-67,-5,-10],rKnee:[104,0,0],rAnkle:[-24,0,0],
    lShoulder:[25,5,68],lElbow:[-8,0,0],lWrist:[7,0,5],
    rShoulder:[-29,68,-14],rElbow:[-112,-5,0],rWrist:[-14,0,-6]
  },{lShoulder:[-92,78,112],lElbow:[-68,0,0]})},
  {name:"10 · Mujer de espaldas",height:1.72,rotation:[0,-158,0],pose:makePose({
    ...relaxed,pelvis:[-2,5,-6],waist:[2,-7,9],chest:[0,-4,-3],neck:[3,-8,0],head:[-1,-19,3],
    rHip:[0,-3,6],lHip:[-8,4,2],lKnee:[15,0,0],lAnkle:[-7,0,4],rAnkle:[0,0,0],
    lShoulder:[3,0,8],lElbow:[-7,0,0],rShoulder:[0,75,-35],rElbow:[-107,0,0],rWrist:[-15,0,-5]
  },{rShoulder:[17,72,-46],rElbow:[-109,0,0]})}
];

export function newPuppet(name, pose = PRESETS[0].pose) {
  return {id:"puppet-"+crypto.randomUUID(), name, kind:"puppet", source:null, visible:true, hidden:[],
    pose:constrainPose(pose), poseRig:ANATOMICAL_RIG, magnet:true, transform:{position:[0,0,0],rotation:[0,0,0],scale:1}};
}
