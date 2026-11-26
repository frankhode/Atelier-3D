import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4179'],{stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
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
 await mkdir('artifacts',{recursive:true});
 await page.screenshot({path:'artifacts/pictorial-baseline.png'});
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
 await page.screenshot({path:'artifacts/pictorial-desktop.png'});
 await page.locator('[data-panel="lights"]').click();
 await page.locator('[data-action="pictorial-pick"]').click();
 const canvas=await page.locator('#render-area canvas').boundingBox(),pick=projected([3.2,3,0]);
 await page.mouse.click(canvas.x+pick[0]*canvas.width,canvas.y+(1-pick[1])*canvas.height);
 await page.locator('#light-aim-bar').waitFor({state:'hidden'});
 await page.waitForFunction(()=>{const saved=JSON.parse(localStorage.getItem('atelier3d:pictorial-study:v1')||'null');return saved&&Math.abs(saved.pictorial.center[0]-3.2)<.15;},undefined,{timeout:5000});
 assert.equal(await page.evaluate(()=>localStorage.getItem('atelier3d:composition:v1')),'physical-composition-untouched');
 await page.locator('#close-panel').click();
 await page.setViewportSize({width:390,height:780});await delay(250);
 await page.screenshot({path:'artifacts/pictorial-mobile.png'});
 // Verify the new surface mode against the actual framebuffer, not only light uniforms.
 await page.setViewportSize({width:1000,height:800});
 await page.goto('http://127.0.0.1:4179/?superficies=1');
 await page.locator('#loading').waitFor({state:'hidden',timeout:30000});
 await page.locator('[data-panel="lights"]').click();
 assert.equal(await page.locator('#panel-title').textContent(),'Paredes luminosas');
 assert.equal(await page.locator('input[type="range"]').count(),4);
 const setSurface=async(key,value)=>{
   await page.locator('[data-path="surfaces.'+key+'"]').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
 };
 const setSurfaces=async(values)=>page.evaluate(values=>{
   for(const [key,value] of Object.entries(values)){
     const el=document.querySelector('[data-path="surfaces.'+key+'"]');
     el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));
   }
 },values);
 const mean=()=>page.evaluate(()=>{
   const f=window.__studyFrame;if(!f)return -1;
   let sum=0,count=0;
   for(let y=Math.round(f.height*.34);y<f.height*.72;y+=5)for(let x=Math.round(f.width*.26);x<f.width*.74;x+=5){const at=4*(y*f.width+x);sum+=(f.pixels[at]+f.pixels[at+1]+f.pixels[at+2])/3;count++;}
   return sum/count;
 });
 async function freshFrame(action){
   const seq=await page.evaluate(()=>window.__studyFrame?.sequence||0);
   await action();
   await page.waitForFunction(seq=>window.__studyFrame?.sequence>seq,seq,{timeout:20000});
   await delay(250);
 }
 await freshFrame(()=>setSurfaces({left:0,right:0}));
 const surfaceMain=await mean();
 await page.locator('#close-panel').click();
 await page.screenshot({path:'artifacts/surface-main.png'});
 await page.locator('[data-panel="lights"]').click();
 await freshFrame(()=>setSurface('upper',0));
 const surfaceDark=await mean();
 await freshFrame(()=>setSurface('right',0.4));
 const surfaceFill=await mean();
 console.log('Actual WebGL surface luminances:',{surfaceMain,surfaceDark,surfaceFill});
 assert.ok(surfaceMain>surfaceDark+25,'The upper walls must visibly illuminate the room through the opening.');
 assert.ok(surfaceFill>surfaceDark+20,'A secondary area source must illuminate the room independently.');
 assert.ok(surfaceDark<5,'Zero intensities must leave the room in darkness.');
 await freshFrame(()=>setSurface('bounce',.8));
 const lateralReflected=await mean();
 console.log('Right lateral direct + indirect:',{surfaceFill,lateralReflected});
 assert.ok(lateralReflected>surfaceFill+5,'The right-hand source must generate independent diffuse bounces.');
 await page.locator('#close-panel').click();
 await page.screenshot({path:'artifacts/lateral-right.png'});
 await page.locator('[data-panel="lights"]').click();
 await page.locator('[data-action="surface-reset"]').click();
 await page.waitForFunction(()=>{const saved=JSON.parse(localStorage.getItem('atelier3d:surface-study:v1')||'null');return saved?.surfaces?.enabled&&saved.surfaces.upper===1&&saved.surfaces.right===.08;},undefined,{timeout:5000});
 assert.equal(await page.evaluate(()=>localStorage.getItem('atelier3d:composition:v1')),'physical-composition-untouched');
 await page.setViewportSize({width:390,height:780});await delay(350);
 await page.screenshot({path:'artifacts/surface-mobile.png'});
 // Isolate the upper source and confirm that real pixels in shadow respond to
 // the indirect field. Turning off the source must also turn off its bounces.
 await page.setViewportSize({width:1000,height:800});
 await page.goto('http://127.0.0.1:4179/?rebotes=1');
 await page.locator('#loading').waitFor({state:'hidden',timeout:30000});
 await page.locator('[data-panel="lights"]').click();
 assert.equal(await page.locator('[data-output="surfaces.bounce"]').textContent(),'35%');
 const shadowMean=()=>page.evaluate(()=>{
   const f=window.__studyFrame;let sum=0,count=0;
   for(let y=Math.round(f.height*.24);y<f.height*.36;y+=3)for(let x=Math.round(f.width*.54);x<f.width*.73;x+=3){
     const at=4*(y*f.width+x);sum+=(f.pixels[at]+f.pixels[at+1]+f.pixels[at+2])/3;count++;
   }
   return sum/count;
 });
 await freshFrame(()=>setSurfaces({left:0,right:0,bounce:0}));
 const shadowDirect=await shadowMean();
 await page.locator('#close-panel').click();
 await page.screenshot({path:'artifacts/bounces-direct.png'});
 await page.locator('[data-panel="lights"]').click();
 await freshFrame(()=>setSurface('bounce',.35));
 const shadow35=await shadowMean();
 await freshFrame(()=>setSurface('bounce',1));
 const shadow100=await shadowMean();
 console.log('Luminance in upper-source shadow (0,35,100% bounces):',{shadowDirect,shadow35,shadow100});
 assert.ok(shadow35>shadowDirect+8,'Reflected light must lift the shadow without an ambient source.');
 assert.ok(shadow100>shadow35+8,'Increasing the bounce gain must lift the shadow.');
 await page.locator('#close-panel').click();
 await page.screenshot({path:'artifacts/bounces-100.png'});
 await page.locator('[data-panel="lights"]').click();
 await freshFrame(()=>setSurface('upper',0));
 assert.ok(await mean()<5,'Turning off all sources also eliminates all indirect light.');
 await page.locator('[data-action="surface-reset"]').click();
 await page.waitForFunction(()=>{const saved=JSON.parse(localStorage.getItem('atelier3d:bounce-study:v1')||'null');return saved?.surfaces?.bounce===.35&&saved.surfaces.upper===1;},undefined,{timeout:5000});
 assert.equal(await page.evaluate(()=>localStorage.getItem('atelier3d:composition:v1')),'physical-composition-untouched');
 assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('atelier3d:surface-study:v1')).surfaces.enabled),'the previous surface study remains stored separately');
 await page.setViewportSize({width:390,height:780});await delay(350);
 await page.screenshot({path:'artifacts/bounces-mobile.png'});
 assert.deepEqual(errors,[],'The scene must compile its shaders and run without browser errors');
 console.log('WebGL render checks passed, including distinct plane values and a responsive painterly control.');
} catch(error) { console.error('Browser diagnostics:',errors.map(message=>message.slice(0,1800))); throw error; } finally {await browser?.close();if(process.platform==='win32'){server.kill('SIGTERM');server.stdout.destroy();server.stderr.destroy();}else{try{process.kill(-server.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}}}

