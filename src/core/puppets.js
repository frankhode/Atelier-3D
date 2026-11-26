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
const makePose = (changes) => ({...neutralPose(), ...changes});
export const PRESETS = [
  {name:"De pie", pose:makePose({lShoulder:[0,0,12], rShoulder:[0,0,-12]})},
  {name:"Sentado", pose:makePose({lHip:[-90,0,5],rHip:[-90,0,-5],lKnee:[90,0,0],rKnee:[90,0,0],lShoulder:[-12,0,10],rShoulder:[-12,0,-10],lElbow:[-65,0,0],rElbow:[-65,0,0]})},
  {name:"Caminando", pose:makePose({lHip:[-28,0,0],rHip:[23,0,0],lKnee:[8,0,0],rKnee:[32,0,0],lAnkle:[15,0,0],rAnkle:[-22,0,0],lShoulder:[20,0,10],rShoulder:[-25,0,-10],lElbow:[-12,0,0],rElbow:[-22,0,0]})},
  {name:"Subiendo escalón",pose:makePose({lHip:[-60,0,0],lKnee:[85,0,0],lAnkle:[-25,0,0],rHip:[10,0,0],rKnee:[8,0,0],rAnkle:[-18,0,0],waist:[8,0,0],lShoulder:[12,0,10],rShoulder:[-20,0,-10],rElbow:[-40,0,0]})},
  {name:"Arrodillado",pose:makePose({lHip:[-15,0,5],rHip:[-15,0,-5],lKnee:[120,0,0],rKnee:[120,0,0],lAnkle:[-55,0,0],rAnkle:[-55,0,0],lShoulder:[-12,0,10],rShoulder:[-12,0,-10]})},
];
export function validatePose(pose) {
  if (!pose || typeof pose !== "object") throw Error("Pose inválida.");
  return Object.fromEntries(JOINTS.map(([id]) => {
    const v=pose[id];
    if (!Array.isArray(v)||v.length!==3||v.some(n=>!Number.isFinite(n)||Math.abs(n)>180)) throw Error("Articulación inválida: "+id);
    return [id,v.slice()];
  }));
}
export const copyPose = validatePose;
export function newPuppet(name, pose = PRESETS[0].pose) {
  return {id:"puppet-"+crypto.randomUUID(), name, kind:"puppet", source:null, visible:true, hidden:[],
    pose:copyPose(pose), magnet:true, transform:{position:[0,0,0],rotation:[0,0,0],scale:1}};
}
