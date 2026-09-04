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
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const a=await context.newPage(),b=await context.newPage();
  debugPage=a;
  for(const page of [a,b])page.on('pageerror',error=>errors.push(error.message));
  // Software WebGL can delay page load on shared CI CPUs. Wait for the game's
  // explicit ready signal after DOM navigation, with a bounded startup timeout.
  const navigation={waitUntil:'domcontentloaded',timeout:60_000};
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
  await b.goto('http://tooling:5173',navigation);
  await b.waitForFunction(()=>window.__game?.ready,undefined,{timeout:60_000});
  await b.getByLabel('Adventurer name').fill('Rowan');await b.getByRole('button',{name:'Enter Embervale'}).click();
  await a.waitForFunction(()=>window.__game.players.length===2);
  await b.waitForFunction(()=>window.__game?.players.length===2);
  const before=await a.evaluate(()=>window.__game.players.find(p=>p.id===window.__game.sessionId));
  await a.locator('#world').focus();await a.keyboard.down('w');await a.waitForTimeout(1100);await a.keyboard.up('w');await a.waitForTimeout(400);
  const after=await a.evaluate(()=>window.__game.players.find(p=>p.id===window.__game.sessionId));
  assert(Math.hypot(before.x-after.x,before.z-after.z)>3,'WASD must move the player');
  await b.waitForFunction(({id,x,z})=>{const p=window.__game.players.find(p=>p.id===id);return p && Math.hypot(p.x-x,p.z-z)<.5;},after);
  await a.keyboard.press('Tab');
  await a.waitForFunction(()=>Boolean(window.__game.target));
  await a.keyboard.press('1');
  await a.waitForFunction(()=>document.querySelector('#target-distance').textContent.startsWith('50 / 75'));
  await a.getByLabel('Local chat message').fill('Hello from the village! Ready to explore?');await a.getByLabel('Local chat message').press('Enter');
  await b.waitForFunction(()=>document.querySelector('#chat-lines').textContent.includes('Ready to explore?'));
  await a.screenshot({path:'/artifacts/embervale-play.png'});
  await a.waitForTimeout(1100);
  await a.getByLabel('Local chat message').fill('<img src=x onerror=alert(1)> Hello!');await a.getByLabel('Local chat message').press('Enter');
  await b.waitForFunction(()=>document.querySelector('#chat-lines').textContent.includes('Hello!'));
  assert.equal(await b.locator('#chat-lines img').count(),0,'Chat must render as text');
  await b.getByRole('button',{name:'Leave world'}).click();
  await a.waitForFunction(()=>window.__game.players.length===1);
  assert.deepEqual(errors,[]);
  fs.rmSync('/artifacts/browser-failure.png',{force:true});
  console.log('Browser checks passed: WebGL rendering, two-player join, WASD replication, targeting, safe chat, departure.');
} catch(error) {
  console.error('Browser errors:',errors);
  await debugPage?.screenshot({path:'/artifacts/browser-failure.png'}).catch(()=>{});
  throw error;
} finally {await browser.close();}
