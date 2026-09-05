// Run in the restricted browser container. GPU device access is an explicit,
// optional container override; software WebGL is not a hardware FPS result.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const hash=createHash('sha256').update(fs.readFileSync('/workspace/package-lock.json')).digest('hex');
assert.equal(hash,fs.readFileSync('/security/reviewed-lock.sha256','utf8').trim());
assert.equal(hash,fs.readFileSync('/workspace/.installed-lock','utf8'));
const require=createRequire('/workspace/package.json');
const {chromium}=require('playwright-core');
const {Client}=require('@colyseus/sdk');
const gpu=process.env.FUNMMO_GPU_TEST==='1';
const args=gpu?['--enable-gpu','--use-gl=angle','--use-angle=gl-egl','--ignore-gpu-blocklist']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const browser=await chromium.launch({headless:true,args});
const guests=[];let timer;const errors=[];
try{
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://tooling:5173',{waitUntil:'domcontentloaded',timeout:60_000});
  await page.waitForFunction(()=>window.__game?.ready,undefined,{timeout:90_000});
  await page.getByLabel('Adventurer name').fill('Hero benchmark');await page.getByRole('button',{name:'Enter Embervale'}).click();
  await page.waitForFunction(()=>window.__game?.avatars.length===1);
  const renderer=await page.evaluate(()=>{
    const gl=document.querySelector('#world').getContext('webgl2');
    const ext=gl.getExtension('WEBGL_debug_renderer_info');
    return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  });
  console.log('Renderer:',renderer);
  await page.keyboard.press('c');
  await page.waitForFunction(()=>window.__game.camera.characterView && window.__game.camera.radius<4.2);
  await page.waitForTimeout(1200);
  await page.screenshot({path:'/artifacts/hero-closeup.png'});
  if(gpu)assert(!/swiftshader|llvmpipe|softpipe|software/i.test(renderer),'A hardware measurement requires a hardware renderer');
  await page.keyboard.press('r');
  await page.waitForFunction(()=>window.__game.avatars.find(a=>a.id===window.__game.sessionId)?.clip==='Ride');
  await page.waitForTimeout(600);await page.screenshot({path:'/artifacts/hero-mounted-closeup.png'});
  await page.keyboard.press('r');
  await page.waitForFunction(()=>window.__game.avatars.find(a=>a.id===window.__game.sessionId)?.clip==='Idle');
  await page.keyboard.press('5');
  await page.waitForFunction(()=>window.__game.avatars.find(a=>a.id===window.__game.sessionId)?.clip==='Cast');
  await page.waitForFunction(()=>window.__game.avatars.find(a=>a.id===window.__game.sessionId)?.clip==='Idle');
  async function measure(name){
    await page.waitForTimeout(2000);
    const result=await page.evaluate(async()=>{
      const samples=[];let last=performance.now();const started=last;
      while(performance.now()-started<10_000){await new Promise(requestAnimationFrame);const now=performance.now();samples.push(now-last);last=now;}
      const sorted=samples.slice(10).sort((a,b)=>a-b);
      return {fps:1000/(sorted.reduce((a,b)=>a+b,0)/sorted.length),p95Ms:sorted[Math.floor(sorted.length*.95)],frames:sorted.length,render:window.__game.performance,characters:window.__game.avatars.length};
    });
    console.log(name,JSON.stringify(result));return {name,...result};
  }
  const results=[await measure('one character, close view')];
  await page.keyboard.press('c');
  const client=new Client('ws://tooling:5173/game');
  for(let i=0;i<19;i++){
    const guest=await client.joinOrCreate('embervale',{name:`Load guest ${i+1}`});
    guest.onMessage('*',()=>{});guests.push(guest);
  }
  await page.waitForFunction(()=>window.__game.avatars.length===20,undefined,{timeout:30_000});
  results.push(await measure('twenty characters, idle'));
  let seq=0;
  timer=setInterval(()=>{seq++;for(const [i,guest] of guests.entries())guest.send('move',{x:i%2?.5:-.5,z:seq%120<60?-1:1,seq});},50);
  results.push(await measure('twenty characters, moving'));
  clearInterval(timer);timer=undefined;
  for(const guest of guests)guest.send('move',{x:0,z:0,seq:++seq});
  await page.screenshot({path:'/artifacts/hero-crowd.png'});
  // Cross the LOD threshold using ordinary server-controlled movement.
  for(let step=0;step<140;step++){
    guests[0].send('move',{x:-1,z:0,seq:++seq});
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  guests[0].send('move',{x:0,z:0,seq:++seq});
  await page.waitForFunction(id=>window.__game.avatars.some(a=>a.id===id && a.lod===1 && a.skinnedMeshes===2),guests[0].sessionId);
  fs.writeFileSync('/artifacts/hero-performance.json',JSON.stringify({hardware:gpu,renderer,results},null,2)+'\n');
  assert.deepEqual(errors,[]);
  if(gpu)assert(results.every(r=>r.fps>=59),'The 60 fps target was not sustained across every scenario');
  console.log('Character rendering, casting, distance LOD and performance measurement completed.');
}finally{
  clearInterval(timer);
  await Promise.allSettled(guests.map(room=>room.leave()));
  await browser.close();
}
