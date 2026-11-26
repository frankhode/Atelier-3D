import * as THREE from "three";
import { PUPPET_HEIGHT } from "../core/puppets.js";

// The sculptural pieces deliberately remain separate, like a wooden artist's
// mannequin. Joint pivots are independent; there is no pedestal or skinning.
export function buildPuppet(pose, material = new THREE.MeshStandardMaterial({color:0xb6b6b6,roughness:0.92})) {
  const root=new THREE.Group(), joints=new Map();
  const sphere=new THREE.SphereGeometry(1,20,14);
  const segment=new THREE.CapsuleGeometry(1,1,6,16);
  const shape=(parent,name,xyz,scale,geo=sphere)=>{
    const m=new THREE.Mesh(geo,material);
    m.name=name; m.position.set(...xyz); m.scale.set(...scale);
    m.castShadow=m.receiveShadow=true; m.userData.joint=parent.userData.joint;
    parent.add(m); return m;
  };
  const joint=(parent,id,xyz,r=0.035)=>{
    const g=new THREE.Group();g.name=id;g.position.set(...xyz);g.userData.joint=id;parent.add(g);joints.set(id,g);
    if(r)shape(g,id+" · articulación",[0,0,0],[r,r,r]);
    return g;
  };
  const pelvis=joint(root,"pelvis",[0,0.92,0],0);
  shape(pelvis,"Pelvis",[0,0.028,0],[.156,.105,.095]);
  const waist=joint(pelvis,"waist",[0,.135,0],.065);
  shape(waist,"Abdomen",[0,.055,0],[.105,.102,.077]);
  const chest=joint(waist,"chest",[0,.145,0],.063);
  shape(chest,"Tórax",[0,.092,0],[.174,.157,.097]);
  const neck=joint(chest,"neck",[0,.235,0],.039);
  shape(neck,"Cuello",[0,.035,0],[.046,.053,.044]);
  const head=joint(neck,"head",[0,.078,0],0);
  shape(head,"Cabeza",[0,.097,.014],[.087,.122,.091]);
  shape(head,"Nariz",[0,.086,.092],[.019,.028,.022]);
  for(const [s,side] of [["l",1],["r",-1]]){
    const shoulder=joint(chest,s+"Shoulder",[side*.179,.165,0],.047);
    shape(shoulder,"Brazo",[0,-.145,0],[.043,.096,.044],segment);
    const elbow=joint(shoulder,s+"Elbow",[0,-.295,0],.034);
    shape(elbow,"Antebrazo",[0,-.125,0],[.035,.079,.034],segment);
    const wrist=joint(elbow,s+"Wrist",[0,-.255,0],.026);
    shape(wrist,"Mano",[0,-.075,.005],[.039,.082,.024]);
    const hip=joint(pelvis,s+"Hip",[side*.086,-.045,0],.057);
    shape(hip,"Muslo",[0,-.194,0],[.065,.134,.062],segment);
    const knee=joint(hip,s+"Knee",[0,-.397,0],.044);
    shape(knee,"Pierna",[0,-.18,0],[.044,.12,.045],segment);
    const ankle=joint(knee,s+"Ankle",[0,-.393,0],.031);
    shape(ankle,"Pie",[0,-.043,.052],[.053,.042,.112]);
  }
  root.userData.puppet=true;
  // Normalize nominal standing height and floor once, not on every pose.
  root.updateMatrixWorld(true);
  const neutral=new THREE.Box3().setFromObject(root,true);
  const size=PUPPET_HEIGHT/(neutral.max.y-neutral.min.y);
  const outer=new THREE.Group();root.scale.setScalar(size); root.position.y=-neutral.min.y*size;outer.add(root);
  applyPuppetPose({joints},pose); outer.updateMatrixWorld(true);
  return {root:outer,joints};
}
export function applyPuppetPose(puppet,pose){
  for(const [id,j] of puppet.joints)j.rotation.set(...pose[id].map(THREE.MathUtils.degToRad));
  puppet.root?.updateMatrixWorld(true);
}
export function applyFigureTransform(root,transform){
  root.position.fromArray(transform.position);
  root.rotation.set(...transform.rotation.map(THREE.MathUtils.degToRad));
  root.scale.setScalar(transform.scale);root.updateMatrixWorld(true);
}
function surfaceMeshes(models, excludeId){
  const list=[];
  for(const [id,entry] of models.entries){
    if(id===excludeId||!entry.wrapper.visible||entry.record.kind==="puppet")continue;
    entry.wrapper.updateMatrixWorld(true);
    for(const o of entry.objects){
      let visible=true;
      for(let node=o.mesh;node;node=node.parent)if(!node.visible){visible=false;break;}
      if(visible)list.push(o.mesh);
    }
  }
  return list;
}
const normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
function supports(hit){
  if(!hit.face)return false;
  normal.copy(hit.face.normal).applyMatrix3(normalMatrix.getNormalMatrix(hit.object.matrixWorld)).normalize();
  // OBJ geometry may use reversed winding. Downward ray selects upper
  // surfaces; reject vertical sides and prefer upward-facing triangles.
  return normal.y > .45;
}
export function pickSupport(models,camera,ndc,excludeId){
  camera.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObjects(surfaceMeshes(models,excludeId),false);
  // Do not select a surface through an intervening wall.
  return hits.length && supports(hits[0]) ? hits[0].point.clone() : null;
}
export function nearestSupport(models,x,z,nearY,excludeId){
  const meshes=surfaceMeshes(models,excludeId);
  const bounds=new THREE.Box3();
  for(const mesh of meshes)bounds.expandByObject(mesh);
  if(bounds.isEmpty())return null;
  const ray=new THREE.Raycaster(new THREE.Vector3(x,Math.max(bounds.max.y+.1,nearY+1),z),new THREE.Vector3(0,-1,0));
  const hits=ray.intersectObjects(meshes,false).filter(supports);
  // Prefer the top of a solid stair to the floor underneath it.
  const staircase=hits.find(h=>/^(peldano|peldaño|descanso)/i.test(h.object.name));
  if(staircase && nearY<=staircase.point.y+.35){
    const closerAbove=hits.find(h=>h.point.y>staircase.point.y+.01 && Math.abs(h.point.y-nearY)<Math.abs(staircase.point.y-nearY));
    if(!closerAbove)return staircase.point.clone();
  }
  hits.sort((a,b)=>Math.abs(a.point.y-nearY)-Math.abs(b.point.y-nearY));
  return hits[0]?.point.clone()??null;
}
export function figureBase(wrapper){
  return new THREE.Box3().setFromObject(wrapper,true).min.y;
}
export function figureContact(wrapper){
  wrapper.updateMatrixWorld(true);
  const bottom=figureBase(wrapper), center=new THREE.Vector3(), v=new THREE.Vector3();
  let count=0;
  wrapper.traverse(o=>{
    if(!o.isMesh||!o.visible)return;
    const position=o.geometry.attributes.position;
    for(let i=0;i<position.count;i++){
      v.fromBufferAttribute(position,i).applyMatrix4(o.matrixWorld);
      if(v.y<=bottom+.008){center.add(v);count++;}
    }
  });
  if(count)center.divideScalar(count);
  else center.copy(wrapper.position);
  center.y=bottom;
  return center;
}
export function snapFigure(entry,models,nearY){
  const contact=figureContact(entry.wrapper);
  const support=nearestSupport(models,contact.x,contact.z,nearY,entry.record.id);
  if(!support)return false;
  entry.record.transform.position[1]+=support.y-contact.y;
  applyFigureTransform(entry.wrapper,entry.record.transform);
  return true;
}
export function placeFigure(entry,point){
  const {record,wrapper}=entry;
  record.transform.position[0]=point.x;
  record.transform.position[2]=point.z;
  applyFigureTransform(wrapper,record.transform);
  const contact=figureContact(wrapper);
  for(const [i,axis] of ["x","y","z"].entries())record.transform.position[i]+=point[axis]-contact[axis];
  applyFigureTransform(wrapper,record.transform);
}
