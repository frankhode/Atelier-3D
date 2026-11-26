import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import * as THREE from "three";
const server=spawn("npm",["run","preview","--","--host","127.0.0.1","--port","4180"],{stdio:"ignore",detached:process.platform!=="win32"});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
try {
  for(let i=0;i<60;i++){
    try{if((await fetch("http://127.0.0.1:4180/")).ok)break;}catch{}
    if(i===59)throw Error("Preview unavailable");await delay(250);
  }
  browser=await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--disable-dev-shm-usage"]});
  const page=await browser.newPage({viewport:{width:1000,height:800}});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
  await page.goto("http://127.0.0.1:4180/?rebotes=1");
  await page.locator("#loading").waitFor({state:"hidden",timeout:30000});
  const key="atelier3d:bounce-study:v1";
  const get=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||"null"),key);
  await page.waitForFunction(k=>!!localStorage.getItem(k),key);
  const initial=await get();
  const open=async()=>{await page.locator("#menu-toggle").click();await page.locator("[data-panel=figures]").click();};
  await open();
  await page.locator("[data-action=puppet-new]").click();
  await page.locator("[data-pose-field=preset]").selectOption("3");
  await page.locator("[data-pose-field=joint]").selectOption("lKnee");
  const rotate=async(value)=>page.locator('[data-pose-field="axis:0"]').evaluate((el,n)=>{el.value=String(n);el.dispatchEvent(new Event("input",{bubbles:true}));},value);
  await rotate(72);
  await mkdir("artifacts",{recursive:true});
  await page.screenshot({path:"artifacts/puppet-workshop.png"});
  await page.locator("[data-action=puppet-confirm]").click();
  await page.locator("#figure-aim-bar").waitFor({state:"visible"});
  await delay(250);
  const canvas=await page.locator("#render-area canvas").boundingBox();
  const camera=new THREE.PerspectiveCamera(initial.camera.fov,canvas.width/canvas.height,.01,1000000);
  camera.position.fromArray(initial.camera.position);camera.up.fromArray(initial.camera.up);camera.lookAt(...initial.camera.target);camera.updateMatrixWorld();
  const p=new THREE.Vector3(2.2,0,4.3).project(camera);
  await page.mouse.click(canvas.x+(p.x+1)*canvas.width/2,canvas.y+(1-p.y)*canvas.height/2);
  await page.locator("#figure-aim-bar").waitFor({state:"hidden"});
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||"null")?.models.length===2,key);
  await delay(850);
  let saved=await get();
  assert.equal(saved.models.at(-1).pose.lKnee[0],72);assert.deepEqual(saved.camera,initial.camera);
  await page.locator("[data-action=puppet-context]").click();
  await page.locator("[data-pose-field=joint]").selectOption("lKnee");await rotate(55);
  await delay(250);
  await page.screenshot({path:"artifacts/puppet-context.png"});
  await page.locator("[data-action=puppet-confirm]").click();
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||"null")?.models.at(-1).pose.lKnee[0]===55,key);
  saved=await get();assert.deepEqual(saved.camera,initial.camera);
  await page.setViewportSize({width:390,height:780});await delay(200);
  await page.locator("[data-action=puppet-context]").click();
  await page.locator("[data-pose-field=joint]").selectOption("lKnee");await rotate(35);
  await page.screenshot({path:"artifacts/puppet-mobile.png"});
  await page.locator("[data-action=puppet-cancel]").click();
  await page.locator("#close-panel").click();
  await page.reload();await page.locator("#loading").waitFor({state:"hidden"});
  assert.equal((await get()).models.at(-1).pose.lKnee[0],55);
  assert.deepEqual(errors,[]);
  console.log("Maniquíes: pose, apoyo, edición contextual, cancelación y recarga verificados en WebGL.");
}finally{
  await browser?.close();
  try{if(process.platform!=="win32")process.kill(-server.pid,"SIGTERM");else server.kill();}catch{}
}
