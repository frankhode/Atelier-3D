import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const server=spawn('npm',['run','preview','--','--port','4179'],{stdio:['ignore','pipe','pipe']});
let browser;let output='';const errors=[];
server.stdout.on('data',v=>output+=v);server.stderr.on('data',v=>output+=v);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
 for(let i=0;i<60;i++){try{const response=await fetch('http://127.0.0.1:4179/');if(response.ok)break;}catch{}await delay(250);if(i===59)throw Error('Preview did not start: '+output);}
 browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1000,height:800}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{
   localStorage.setItem('atelier3d:composition:v1','physical-composition-untouched');
   const nativeRAF=window.requestAnimationFrame.bind(window);
   window.requestAnimationFrame=callback=>nativeRAF(time=>{
     callback(time);
     const canvas=document.querySelector('#render-area canvas');if(!canvas)return;
     const gl=canvas.getContext('webgl2');if(!gl)return;
     const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
     if(!width||!height)return;
     const pixels=new Uint8Array(width*height*4);
     gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
     window.__studyFrame={width,height,pixels,sequence:(window.__studyFrame?.sequence||0)+1};
   });
 });
 await page.goto('http://127.0.0.1:4179/?pictorico=1');
 await page.locator('#loading').waitFor({state:'hidden',timeout:30000});
 await page.waitForFunction(([x,y])=>{const f=window.__studyFrame;if(!f)return false;const at=4*(Math.round(y*f.height)*f.width+Math.round(x*f.width));return f.pixels[at]>120;},projected([4.6,3,0]),{timeout:20000});
 function projected(point){
   const from=[4.1,2.5,13.2],target=[4.1,2.65,.8],up=[0,1,0];
   const norm=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0);
   const forward=norm(target.map((x,i)=>x-from[i])),right=norm(cross(forward,up)),vertical=cross(right,forward),v=point.map((x,i)=>x-from[i]),depth=dot(v,forward),tan=Math.tan(48*Math.PI/360);
   return [(dot(v,right)/(depth*tan*1.25)+1)/2,(dot(v,vertical)/(depth*tan)+1)/2];
 }
 async function pixel(point){
   return page.evaluate(([x,y])=>{
     const f=window.__studyFrame,cx=Math.round(x*f.width),cy=Math.round(y*f.height);let total=0,count=0;
     for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const at=4*((cy+dy)*f.width+cx+dx);total+=(f.pixels[at]+f.pixels[at+1]+f.pixels[at+2])/3;count++;}
     return total/count;
   },projected(point));
 }
 const baseline={back:await pixel([4.6,3,0]),left:await pixel([0,3.6,1]),floor:await pixel([4.1,0,5])};
 console.log('Actual WebGL baseline pixels:',JSON.stringify(baseline));
 assert.ok(baseline.back>baseline.left+60,'The back wall must carry the principal light mass');
 assert.ok(baseline.left>baseline.floor+20,'The left wall must remain in a separate midtone');
 assert.ok(baseline.floor>8,'The floor must retain a dark readable value');
 assert.equal(await page.evaluate(()=>localStorage.getItem('atelier3d:composition:v1')),'physical-composition-untouched');
 await page.locator('[data-panel="lights"]').click();
 const range=page.locator('[data-path="pictorial.zones.left"]');
 await range.evaluate(el=>{el.value='0.6';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.waitForFunction(([x,y,min])=>{const f=window.__studyFrame,at=4*(Math.round(y*f.height)*f.width+Math.round(x*f.width));return f.pixels[at]>min;},[...projected([0,3.6,1]),baseline.left+40],{timeout:15000});
 const changed={back:await pixel([4.6,3,0]),left:await pixel([0,3.6,1]),floor:await pixel([4.1,0,5])};
 console.log('Actual WebGL after left-wall value change:',JSON.stringify(changed));
 assert.ok(changed.left>baseline.left+40,'The left-wall value must visibly respond to its control');
 assert.ok(Math.abs(changed.back-baseline.back)<5,'Changing the left wall must preserve the back wall');
 assert.ok(Math.abs(changed.floor-baseline.floor)<5,'Changing the left wall must preserve the floor');
 await page.locator('#close-panel').click();
 await mkdir('artifacts',{recursive:true});
 await page.screenshot({path:'artifacts/pictorial-desktop.png'});
 await page.setViewportSize({width:390,height:780});await delay(250);
 await page.screenshot({path:'artifacts/pictorial-mobile.png'});
 assert.deepEqual(errors,[],'The scene must compile its shaders and run without browser errors');
 console.log('WebGL render checks passed, including distinct plane values and a responsive painterly control.');
} catch(error) { console.error('Browser diagnostics:',errors.map(message=>message.slice(0,1800))); throw error; } finally {await browser?.close();server.kill('SIGTERM');}
