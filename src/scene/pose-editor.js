import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildPuppet, applyPuppetPose, applyFigureTransform, figureBase } from "./puppets.js";
import { constrainPose, migrateLegacyPose, ANATOMICAL_RIG } from "../core/puppets.js";

// One WebGL context. The workshop has an independent scene, while contextual
// editing temporarily substitutes a draft in the real scene, keeping the
// existing lighting rig, shadow casters and bounce field intact.
export class PoseEditor {
  constructor(viewport, rig, models, onSelect){
    Object.assign(this,{viewport,rig,models,onSelect});
    this.canvas=viewport.renderer.domElement;
    this.ray=new THREE.Raycaster();
  }
  start(record, contextual=false){
    this.close();
    this.record=structuredClone(record);this.record.pose=record.poseRig===ANATOMICAL_RIG?constrainPose(record.pose):migrateLegacyPose(record.pose);this.record.poseRig=ANATOMICAL_RIG;this.contextual=contextual;this.radius=1;
    this.joint="lShoulder";this.nameDraft="";
    this.original=contextual?this.models.entries.get(record.id):null;
    this.material=contextual && this.original ? this.original.objects[0].mesh.material :
      new THREE.MeshStandardMaterial({color:0xb9b9b9,roughness:.96});
    this.preview=buildPuppet(this.record.pose,this.material,this.record.poseRotation,this.record.poseRig);
    applyFigureTransform(this.preview.root, contextual?this.record.transform:{position:[0,0,0],rotation:[0,0,0],scale:1});
    if(!contextual){
      this.preview.root.position.y-=figureBase(this.preview.root);
      this.workshop=new THREE.Scene();this.workshop.background=new THREE.Color(0x34383b);
      this.workshop.add(this.preview.root,new THREE.HemisphereLight(0xf8f8f8,0x626262,1.8));
      const light=new THREE.DirectionalLight(0xffffff,2.2);light.position.set(3,5,4);this.workshop.add(light);
      this.grid=new THREE.GridHelper(4,16,0x777777,0x4e5455);this.grid.position.y=-.003;this.workshop.add(this.grid);
    } else this.initialY=this.record.transform.position[1];
    this.marker=new THREE.Mesh(new THREE.SphereGeometry(.04,16,12),new THREE.MeshBasicMaterial({color:0xffc884,wireframe:true,depthTest:false}));
    this.marker.renderOrder=1000;
    this.camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,10000);
    this.rig.controls.enabled=false;
    this.controls=new OrbitControls(this.camera,this.canvas);
    this.controls.enableDamping=false;
    this.controls.minZoom=.15;this.controls.maxZoom=12;
    this.controls.addEventListener("change",()=>this.viewport.requestRender());
    this.down=(e)=>{if(e.button===0&&e.isPrimary)this.gesture={id:e.pointerId,x:e.clientX,y:e.clientY};else this.gesture=null;};
    this.up=(e)=>{
      const g=this.gesture;this.gesture=null;
      if(!g||g.id!==e.pointerId||Math.hypot(e.clientX-g.x,e.clientY-g.y)>7)return;
      const r=this.canvas.getBoundingClientRect();
      this.ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),this.camera);
      const hit=this.ray.intersectObject(this.preview.root,true)[0];
      if(hit?.object.userData.joint){this.joint=hit.object.userData.joint;this.onSelect?.();}
    };
    this.cancelGesture=()=>this.gesture=null;
    this.canvas.addEventListener("pointerdown",this.down);
    this.canvas.addEventListener("pointerup",this.up);
    this.canvas.addEventListener("pointercancel",this.cancelGesture);
    this.fit("front");
  }
  get active(){return !!this.record;}
  fit(view="front"){
    const box=new THREE.Box3().setFromObject(this.preview.root,true);
    const center=box.getCenter(new THREE.Vector3());
    const size=box.getSize(new THREE.Vector3());
    this.controls.target.copy(center);
    const dirs={front:[0,.08,1],left:[-1,.08,0],right:[1,.08,0],back:[0,.08,-1],three:[1,.6,1]};
    this.camera.position.copy(center).add(new THREE.Vector3(...(dirs[view]||dirs.front)).normalize().multiplyScalar(Math.max(3,size.length()*2)));
    this.camera.zoom=1;
    this.viewSize=Math.max(size.y,size.x,size.z,.4)*1.25;
    this.resize(this.viewport.width/this.viewport.height||1);
    this.controls.update();this.viewport.requestRender();
  }
  resize(aspect){
    if(!this.active)return;
    const h=this.viewSize/Math.min(1,aspect);
    this.camera.left=-h*aspect/2;this.camera.right=h*aspect/2;this.camera.top=h/2;this.camera.bottom=-h/2;
    this.camera.updateProjectionMatrix();
  }
  changePose(pose, rotation){
    this.record.pose=constrainPose(pose);
    if(rotation)this.record.poseRotation=rotation.slice();
    applyPuppetPose(this.preview,this.record.pose,this.record.poseRotation);
    if(!this.contextual){this.preview.root.position.y-=figureBase(this.preview.root);this.preview.root.updateMatrixWorld(true);}
    this.viewport.requestRender();
  }
  offset(value){
    this.record.transform.position[1]=this.initialY+value;
    applyFigureTransform(this.preview.root,this.record.transform);this.viewport.requestRender();
  }
  render(){
    const {renderer,scene}=this.viewport,root=this.preview.root;
    this.preview.joints.get(this.joint).getWorldPosition(this.marker.position);
    this.marker.scale.setScalar(Math.max(.2,this.contextual?this.record.transform.scale:1));
    const target=this.contextual?scene:this.workshop;
    const originalVisible=this.original?.wrapper.visible;
    const previousPlanes=renderer.clippingPlanes, exposure=renderer.toneMappingExposure;
    if(this.contextual){
      if(this.original)this.original.wrapper.visible=false;
      target.add(root);
      const b=new THREE.Box3().setFromObject(root,true);
      b.expandByScalar(this.radius);
      renderer.clippingPlanes=[
        new THREE.Plane(new THREE.Vector3(1,0,0),-b.min.x),new THREE.Plane(new THREE.Vector3(-1,0,0),b.max.x),
        new THREE.Plane(new THREE.Vector3(0,1,0),-b.min.y),new THREE.Plane(new THREE.Vector3(0,-1,0),b.max.y),
        new THREE.Plane(new THREE.Vector3(0,0,1),-b.min.z),new THREE.Plane(new THREE.Vector3(0,0,-1),b.max.z),
      ];
    }else renderer.toneMappingExposure=1;
    target.add(this.marker);
    try{renderer.render(target,this.camera);}finally{
      target.remove(this.marker);
      if(this.contextual){target.remove(root);if(this.original)this.original.wrapper.visible=originalVisible;}
      renderer.clippingPlanes=previousPlanes;renderer.toneMappingExposure=exposure;
    }
  }
  close(){
    if(!this.active)return;
    this.controls.dispose();
    this.canvas.removeEventListener("pointerdown",this.down);
    this.canvas.removeEventListener("pointerup",this.up);
    this.canvas.removeEventListener("pointercancel",this.cancelGesture);
    const geos=new Set();this.preview.root.traverse(o=>{if(o.geometry)geos.add(o.geometry);});
    geos.forEach(g=>g.dispose());
    this.marker.geometry.dispose();this.marker.material.dispose();
    if(!this.contextual){this.material.dispose();this.grid.geometry.dispose();this.grid.material.dispose();}
    this.record=null;this.preview=null;this.original=null;this.workshop=null;
    this.rig.controls.enabled=!this.rig.state.camera.locked;
    this.viewport.requestRender();
  }
}
