import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';

const lock=fs.readFileSync('/workspace/package-lock.json');
const hash=createHash('sha256').update(lock).digest('hex');
assert.equal(hash,fs.readFileSync('/security/reviewed-lock.sha256','utf8').trim());
assert.equal(hash,fs.readFileSync('/workspace/.installed-lock','utf8'));
const require=createRequire('/workspace/package.json');
const {chromium}=require('playwright-core');
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
let debugPage;
try {
  // Independent sessions also avoid two heavy WebGL tabs sharing one renderer
  // process during startup on software-rendered CI machines.
  const options={viewport:{width:1100,height:800},reducedMotion:'reduce'};
  const context=await browser.newContext(options),otherContext=await browser.newContext(options);
  const a=await context.newPage(),b=await otherContext.newPage();
  debugPage=a;
  for(const page of [a,b]){page.on('pageerror',error=>errors.push(error.message));page.on('websocket',socket=>socket.on('framesent',frame=>{assert(Buffer.byteLength(frame.payload)<=2048,'Client messages must fit the bounded transport payload');}));page.on('console',msg=>{if(['warning','error'].includes(msg.type()))console.log('Browser console:',msg.text());});}
  // Software WebGL can delay page load on shared CI CPUs. Wait for the game's
  // explicit ready signal after DOM navigation, with a bounded startup timeout.
  const navigation={waitUntil:'domcontentloaded',timeout:60_000};
  await a.bringToFront();
  for(let attempt=0;attempt<30;attempt++) {
    try {await a.goto('http://tooling:5173',navigation);break;}
    catch(error){
      if(attempt===29 || !/net::ERR_(CONNECTION_REFUSED|CONNECTION_RESET|EMPTY_RESPONSE)/.test(error.message))throw error;
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
  }
  await a.waitForFunction(()=>window.__game?.ready,undefined,{timeout:60_000});
  await a.screenshot({path:'/artifacts/embervale-welcome.png'});
  await a.getByLabel('Adventurer name').fill('Birch');await a.getByRole('button',{name:'Enter Embervale'}).click();
  await a.waitForFunction(()=>window.__game?.connected && window.__game.players.length===1);
  await a.waitForFunction(()=>window.__game.avatars.some(a=>a.id===window.__game.sessionId && a.skinnedMeshes===2 && a.clip==='Idle'));
  await a.keyboard.press('c');await a.waitForFunction(()=>window.__game.camera.characterView && window.__game.camera.radius<4.2);await a.waitForTimeout(600);
  await a.screenshot({path:'/artifacts/hero-in-game.png'});
  await a.keyboard.press('c');
  assert.equal(await a.locator('#hotbar button').count(),6);
  assert.equal(await a.evaluate(()=>new Set(window.__game.enemies.map(e=>e.kind)).size),6);
  await a.keyboard.press('e');
  await a.getByRole('button',{name:'Accept quest',exact:true}).click();
  await a.waitForFunction(()=>window.__game.players.find(p=>p.id===window.__game.sessionId).quests.some(q=>q.id==='first-light' && q.status==='active'));
  await a.getByRole('button',{name:'Close conversation'}).click();
  await a.keyboard.press('m');await a.locator('#map-panel').waitFor({state:'visible'});
  await a.waitForFunction(()=>document.querySelector('#world-map').getContext('2d').getImageData(20,20,1,1).data[3]===255);
  await a.screenshot({path:'/artifacts/embervale-map.png'});
  console.log('Quest acceptance and world map passed.');
  await a.getByRole('button',{name:'Close world map'}).click();
  await a.keyboard.press('r');await a.waitForFunction(()=>window.__game.players.find(p=>p.id===window.__game.sessionId).mounted);
  await a.waitForFunction(()=>window.__game.avatars.find(a=>a.id===window.__game.sessionId)?.clip==='Ride');
  await a.screenshot({path:'/artifacts/hero-mounted.png'});
  await a.keyboard.press('r');await a.waitForFunction(()=>!window.__game.players.find(p=>p.id===window.__game.sessionId).mounted);
  await b.bringToFront();
  await b.goto('http://tooling:5173',navigation);
  await b.waitForFunction(()=>window.__game?.ready,undefined,{timeout:60_000});
  await b.getByLabel('Adventurer name').fill('Rowan');await b.getByRole('button',{name:'Enter Embervale'}).click();
  await a.waitForFunction(()=>window.__game.players.length===2);
  await b.waitForFunction(()=>window.__game?.players.length===2);
  console.log('Two players joined.');
  await a.bringToFront();
  const before=await a.evaluate(()=>window.__game.players.find(p=>p.id===window.__game.sessionId));
  await a.locator('#world').focus();await a.keyboard.down('w');
  await a.waitForFunction(()=>window.__game.avatars.find(a=>a.id===window.__game.sessionId)?.clip==='Run');
  await a.waitForTimeout(1100);await a.keyboard.up('w');await a.waitForTimeout(400);
  const after=await a.evaluate(()=>window.__game.players.find(p=>p.id===window.__game.sessionId));
  assert(Math.hypot(before.x-after.x,before.z-after.z)>3,'WASD must move the player');
  await b.waitForFunction(({id,x,z})=>{const p=window.__game.players.find(p=>p.id===id);return p && Math.hypot(p.x-x,p.z-z)<.5;},after);
  await a.keyboard.press('Tab');
  await a.waitForFunction(()=>Boolean(window.__game.target));
  await a.keyboard.press('1');
  await a.waitForFunction(()=>window.__game.enemies.find(e=>e.id===window.__game.target)?.hp===50);
  console.log('Movement and Sunbolt passed.');
  await a.waitForTimeout(700);await a.keyboard.press('3');
  await a.waitForFunction(()=>window.__game.enemies.find(e=>e.id===window.__game.target)?.hp===18);
  // Finish the live fight before taking screenshots and exercising chat. Software
  // rendering can make those steps longer than the character's survival time.
  await a.waitForTimeout(700);await a.keyboard.press('1');
  await a.waitForFunction(()=>window.__game.enemies.find(e=>e.id===window.__game.target)?.hp===0);
  // Leave the spawn area before chat and screenshots: on software renderers
  // those steps can outlast the defeated enemy's 15-second respawn timer.
  await travel(0,5);
  await a.getByLabel('Local chat message').fill('Hello from the village! Ready to explore?');await a.getByLabel('Local chat message').press('Enter');
  await b.waitForFunction(()=>document.querySelector('#chat-lines').textContent.includes('Ready to explore?'));
  await a.screenshot({path:'/artifacts/embervale-play.png'});
  await a.waitForTimeout(1100);
  await a.getByLabel('Local chat message').fill('<img src=x onerror=alert(1)> Hello!');await a.getByLabel('Local chat message').press('Enter');
  await b.waitForFunction(()=>document.querySelector('#chat-lines').textContent.includes('Hello!'));
  assert.equal(await b.locator('#chat-lines img').count(),0,'Chat must render as text');
  await b.getByRole('button',{name:'Leave world'}).click();
  await a.bringToFront();
  await a.waitForFunction(()=>window.__game.players.length===1);
  await a.waitForFunction(()=>window.__game.avatars.length===1);
  // Travel using the real keyboard controls; diagnostics only read camera and state.
  async function travel(x,z){
    const held=new Set();const deadline=Date.now()+65_000;
    await a.locator('#world').focus();
    try {
      while(Date.now()<deadline){
        const state=await a.evaluate(()=>({p:window.__game.players.find(p=>p.id===window.__game.sessionId),f:window.__game.cameraForward}));
        const dx=x-state.p.x,dz=z-state.p.z,length=Math.hypot(dx,dz);
        if(length<2)return;
        const f=state.f,r={x:f.z,z:-f.x},forward=(dx*f.x+dz*f.z)/length,right=(dx*r.x+dz*r.z)/length;
        const next=new Set();if(Math.abs(forward)>.4)next.add(forward>0?'w':'s');if(Math.abs(right)>.4)next.add(right>0?'d':'a');
        for(const key of held)if(!next.has(key)){await a.keyboard.up(key);held.delete(key);}
        for(const key of next)if(!held.has(key)){await a.keyboard.down(key);held.add(key);}
        await a.waitForTimeout(length<8?100:350);
      }
      throw new Error('Keyboard travel did not reach destination');
    }finally{for(const key of held)await a.keyboard.up(key);await a.waitForTimeout(300);}
  }
  await a.locator('#world').focus();
  await a.waitForTimeout(6200);await a.keyboard.press('r');
  await a.waitForFunction(()=>window.__game.players.find(p=>p.id===window.__game.sessionId).mounted);
  await travel(-35,8);await travel(-155,104);
  await a.keyboard.press('e');await a.getByRole('button',{name:'Accept quest',exact:true}).click();
  await a.waitForFunction(()=>window.__game.players.find(p=>p.id===window.__game.sessionId).quests.some(q=>q.id==='grain'));
  await a.getByRole('button',{name:'Close conversation'}).click();
  if(await a.evaluate(()=>window.__game.players.find(p=>p.id===window.__game.sessionId).mounted))await a.keyboard.press('r');
  for(const [index,x] of [-170,-161,-152].entries()){
    await travel(x,115);await a.keyboard.press('e');
    await a.waitForFunction(count=>window.__game.players.find(p=>p.id===window.__game.sessionId).quests.find(q=>q.id==='grain')?.progress===count,index+1);
  }
  await a.waitForFunction(()=>window.__game.players.find(p=>p.id===window.__game.sessionId).quests.find(q=>q.id==='grain')?.status==='ready');
  await travel(-155,104);await a.keyboard.press('e');await a.getByRole('button',{name:'Complete quest',exact:true}).click();
  await a.waitForFunction(()=>window.__game.players.find(p=>p.id===window.__game.sessionId).quests.find(q=>q.id==='grain')?.status==='complete');
  await a.getByRole('button',{name:'Close conversation'}).click();
  await a.screenshot({path:'/artifacts/embervale-westmere.png'});
  assert.deepEqual(errors,[]);
  fs.rmSync('/artifacts/browser-failure.png',{force:true});
  console.log('Browser checks passed: WebGL rendering, two-player join, WASD replication, NPC quest acceptance, maps, mounting, six spells, frost damage, safe chat, departure, horseback travel and gathering quest turn-in.');
} catch(error) {
  console.error('Browser errors:',errors);
  console.error('Game diagnostics:',await debugPage?.evaluate(()=>{const g=window.__game;return g?{connected:g.connected,disconnectCode:g.disconnectCode,lastNotice:g.lastNotice,players:g.players,target:g.target,enemy:g.enemies.find(e=>e.id===g.target)}:null;}).catch(()=>null));
  await debugPage?.screenshot({path:'/artifacts/browser-failure.png'}).catch(()=>{});
  throw error;
} finally {await browser.close();}
