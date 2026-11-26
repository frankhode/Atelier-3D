// Offline diffuse light transport for the reference room. Run with:
// node scripts/bake-bounces.mjs
// No browser/GPU required. Deterministic, and independent of current slider values.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { SURFACE_PANELS, SURFACE_SPOT_ANGLE, SURFACE_SPOT_PENUMBRA } from "../src/scene/surface-lighting.js";

const groups = ["upper", "left", "right"];
const PI = Math.PI, TAU = 2 * PI, GOLDEN = 0.6180339887498949;
const EPS = 0.001, patchSize = 0.52;
const V = (x = 0, y = 0, z = 0) => [x,y,z];
const add = (a,b) => a.map((x,i)=>x+b[i]);
const sub = (a,b) => a.map((x,i)=>x-b[i]);
const scale = (a,s) => a.map(x=>x*s);
const madd = (a,b,s) => a.map((x,i)=>x+b[i]*s);
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a,b) => V(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]);
const norm = a => scale(a,1/Math.hypot(...a));
const cosOuter = Math.cos(SURFACE_SPOT_ANGLE*PI/180);
const cosInner = Math.cos(SURFACE_SPOT_ANGLE*(1-SURFACE_SPOT_PENUMBRA)*PI/180);
const source = await readFile(new URL("../public/models/sala-v04.obj",import.meta.url),"utf8");
const root = new OBJLoader().parse(source);
const triangles = [], solids = [];
let patches=0;
root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const p=mesh.geometry.attributes.position;
  const lo=V(Infinity,Infinity,Infinity),hi=V(-Infinity,-Infinity,-Infinity), faces=[];
  for(let i=0;i<p.count;i++){
    const vs=V(p.getX(i),p.getY(i),p.getZ(i));
    for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],vs[k]);hi[k]=Math.max(hi[k],vs[k]);}
  }
  const center=scale(add(lo,hi),.5);
  for(let i=0;i<p.count;i+=3){
    const [a,b,c]=[i,i+1,i+2].map(j=>V(p.getX(j),p.getY(j),p.getZ(j)));
    const e1=sub(b,a),e2=sub(c,a),raw=cross(e1,e2);
    if(Math.hypot(...raw)<1e-8)continue;
    const mid=scale(add(add(a,b),c),1/3);
    let normal=norm(raw);
    // The built-in pieces are closed convex solids (mostly boxes).
    if(dot(normal,sub(center,mid))>0)normal=scale(normal,-1);
    const n=Math.max(1,Math.ceil(Math.max(Math.hypot(...e1),Math.hypot(...e2),Math.hypot(...sub(b,c)))/patchSize));
    const t={a,e1,e2,normal,mid,n,
      min:a.map((v,k)=>Math.min(v,b[k],c[k])), max:a.map((v,k)=>Math.max(v,b[k],c[k])),
      values:new Float32Array(n*n*2*6)};
    triangles.push(t);faces.push(t);patches+=n*n;
  }
  solids.push({lo,hi,faces});
});
function bvh(items){
  const min=V(Infinity,Infinity,Infinity),max=V(-Infinity,-Infinity,-Infinity);
  for(const t of items)for(let k=0;k<3;k++){min[k]=Math.min(min[k],t.min[k]);max[k]=Math.max(max[k],t.max[k]);}
  if(items.length<=6)return {min,max,items};
  const axis=max.map((v,i)=>v-min[i]).reduce((a,v,i,arr)=>v>arr[a]?i:a,0);
  items.sort((a,b)=>a.mid[axis]-b.mid[axis]);const m=Math.floor(items.length/2);
  return {min,max,left:bvh(items.slice(0,m)),right:bvh(items.slice(m))};
}
const tree=bvh(triangles.slice());
function boxHit(node,o,d,inv,maxT){
  let near=0,far=maxT;
  for(let k=0;k<3;k++){
    if(Math.abs(d[k])<1e-12){if(o[k]<node.min[k]||o[k]>node.max[k])return false;continue;}
    let a=(node.min[k]-o[k])*inv[k],b=(node.max[k]-o[k])*inv[k];
    if(a>b)[a,b]=[b,a];
    near=Math.max(near,a);far=Math.min(far,b);
    if(near>far)return false;
  }
  return true;
}
// Möller–Trumbore; returns the nearest opaque triangle plus barycentric coordinates.
function trace(o,d,maxT=100,any=false){
  const inv=[1/d[0],1/d[1],1/d[2]];
  let best=maxT,result=null;const stack=[tree];
  const [ox,oy,oz]=o,[dx,dy,dz]=d;
  while(stack.length){
    const node=stack.pop();
    if(!boxHit(node,o,d,inv,best))continue;
    if(!node.items){stack.push(node.left,node.right);continue;}
    for(const t of node.items){
      const [ax,ay,az]=t.a,[x1,y1,z1]=t.e1,[x2,y2,z2]=t.e2;
      const px=dy*z2-dz*y2,py=dz*x2-dx*z2,pz=dx*y2-dy*x2;
      const det=x1*px+y1*py+z1*pz;
      if(Math.abs(det)<1e-11)continue;
      const invDet=1/det,tx=ox-ax,ty=oy-ay,tz=oz-az;
      const u=(tx*px+ty*py+tz*pz)*invDet;
      if(u<-1e-7||u>1+1e-7)continue;
      const qx=ty*z1-tz*y1,qy=tz*x1-tx*z1,qz=tx*y1-ty*x1;
      const v=(dx*qx+dy*qy+dz*qz)*invDet;
      if(v<-1e-7||u+v>1+1e-7)continue;
      const dist=(x2*qx+y2*qy+z2*qz)*invDet;
      if(dist<=EPS*.25||dist>=best)continue;
      if(any)return true;
      best=dist;result={t,u,v};
    }
  }
  return any?false:result;
}
function patchIndex(t,u,v) {
  const n=t.n;
  let x=Math.min(n-1e-5,Math.max(0,u*n)),y=Math.min(n-1e-5,Math.max(0,v*n));
  // Clamp numerical hits on the hypotenuse to the valid interior.
  if(x+y>=n){const s=(n-1e-5)/(x+y);x*=s;y*=s;}
  const i=Math.floor(x),j=Math.floor(y),upper=(i+j<n-1 && x-i+y-j>1)?1:0;
  return (2*(i*n+j)+upper)*6;
}
function* cells(t){
  const n=t.n;
  for(let i=0;i<n;i++)for(let j=0;j<n-i;j++)for(let upper=0;upper<=(i+j<n-1?1:0);upper++){
    const off=upper?2/3:1/3,u=(i+off)/n,v=(j+off)/n;
    yield {p:add(madd(t.a,t.e1,u),scale(t.e2,v)), index:(2*(i*n+j)+upper)*6};
  }
}
const sources=SURFACE_PANELS.flatMap(panel=>panel.samples.map(p=>({
  p,axis:norm(panel.normal),power:panel.power/panel.samples.length,group:groups.indexOf(panel.group)
})));
function direct(p,normal) {
  const result=V(),o=madd(p,normal,EPS);
  for(const s of sources){
    const delta=sub(s.p,o),r=Math.hypot(...delta),d=scale(delta,1/r),inc=dot(normal,d);
    if(inc<=0 || r<EPS)continue;
    const cone=-dot(s.axis,d);
    if(cone<=cosOuter)continue;
    if(trace(o,d,r-EPS,true))continue;
    const f=Math.min(1,Math.max(0,(cone-cosOuter)/(cosInner-cosOuter)));
    result[s.group]+=s.power*inc*f*f*(3-2*f)/Math.max(0.01,r*r);
  }
  return result;
}
console.log(triangles.length,"triangles;",patches,"surface patches");
// Store outgoing radiances for unit diffuse reflectance. At runtime the
// wall reflectance scales first-order transport once and second-order twice.
for(const t of triangles)for(const {p,index} of cells(t)){
  const e=direct(p,t.normal);
  for(let g=0;g<3;g++)t.values[index+g]=e[g]/PI;
}
console.log("First-order outgoing radiance computed");
function sampleHemisphere(n,k,count,phase){
  const u=(k+.5)/count,r=Math.sqrt(u),phi=TAU*((k*GOLDEN+phase)%1);
  const tangent=norm(cross(Math.abs(n[1])>.97?V(1,0,0):V(0,1,0),n));
  const bitangent=cross(n,tangent);
  return add(add(scale(tangent,r*Math.cos(phi)),scale(bitangent,r*Math.sin(phi))),scale(n,Math.sqrt(1-u)));
}
let cellNumber=0;
const hemisphereCount=56;
for(const t of triangles)for(const {p,index} of cells(t)){
  const o=madd(p,t.normal,EPS),phase=((cellNumber++)*.38196601125)%1;
  for(let k=0;k<hemisphereCount;k++){
    const d=sampleHemisphere(t.normal,k,hemisphereCount,phase);
    const hit=trace(o,d);
    if(!hit || dot(hit.t.normal,d)>=0)continue;
    const j=patchIndex(hit.t,hit.u,hit.v);
    for(let g=0;g<3;g++)t.values[index+3+g]+=hit.t.values[j+g]/hemisphereCount;
  }
}
console.log("Second-order outgoing radiance computed");
const min=[0.12,0.14,0.12],max=[11.08,5.46,6.38],dims=[24,13,15];
const [nx,ny,nz]=dims,layers=12,voxels=nx*ny*nz;
const field=new Float32Array(voxels*layers*3),valid=new Uint8Array(voxels);
const maxima=[V(),V()];
const sphereCount=220;
const directions=Array.from({length:sphereCount},(_,k)=>{
  const y=1-2*(k+.5)/sphereCount,r=Math.sqrt(1-y*y),phi=TAU*k*GOLDEN;
  return V(r*Math.cos(phi),y,r*Math.sin(phi));
});
function solid(p){
  for(const {lo,hi,faces} of solids){
    if(!p.every((v,k)=>v>lo[k]+EPS && v<hi[k]-EPS))continue;
    if(faces.every(t=>dot(t.normal,sub(p,t.a))<=EPS))return true;
  }
  return false;
}
const at=(x,y,z)=>((z*ny+y)*nx+x);
function samplePoint(p){
  const out=new Float32Array(36);
  for(const d of directions){
    const hit=trace(p,d);
    if(!hit || dot(hit.t.normal,d)>=0)continue;
    const j=patchIndex(hit.t,hit.u,hit.v);
    for(let k=0;k<3;k++){
      const axis=2*k+(d[k]<0?1:0),w=Math.abs(d[k])*4*PI/sphereCount;
      for(let g=0;g<3;g++){
        out[axis*3+g]+=hit.t.values[j+g]*w;
        out[(6+axis)*3+g]+=hit.t.values[j+3+g]*w;
      }
    }
  }
  return out;
}
let validCount=0;
for(let z=0;z<nz;z++){
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const p=[x,y,z].map((v,k)=>min[k]+(max[k]-min[k])*v/(dims[k]-1));
    if(solid(p))continue;
    const q=at(x,y,z),light=samplePoint(p);
    valid[q]=1;validCount++;
    for(let layer=0;layer<layers;layer++)for(let g=0;g<3;g++){
      const v=light[layer*3+g];
      field[3*(layer*voxels+q)+g]=v;
      const order=layer<6?0:1;maxima[order][g]=Math.max(maxima[order][g],v);
    }
  }
  console.log("Probe slice",z+1,"/",nz);
}
const bytes=new Uint8Array(voxels*layers*4);
for(let layer=0;layer<layers;layer++)for(let q=0;q<voxels;q++){
  if(!valid[q])continue;
  const order=layer<6?0:1;
  const base=(layer*voxels+q)*4;
  for(let g=0;g<3;g++){
    const v=field[3*(layer*voxels+q)+g]/Math.max(maxima[order][g],1e-8);
    bytes[base+g]=Math.round(255*Math.sqrt(Math.min(1,v)));
  }
  bytes[base+3]=255;
}
const result={
  version:1,dims,min,max,maxima,
  geometrySha256:createHash("sha256").update(source.trimEnd()).digest("hex"),
  panels:JSON.stringify(SURFACE_PANELS),
  angle:SURFACE_SPOT_ANGLE,penumbra:SURFACE_SPOT_PENUMBRA,
  data:Buffer.from(bytes).toString("base64")
};
await writeFile(new URL("../public/models/sala-v04-bounces.json",import.meta.url),JSON.stringify(result)+"\n");
console.log("Baked",validCount,"/",voxels,"valid probes;",bytes.length,"bytes; maxima:",maxima);
