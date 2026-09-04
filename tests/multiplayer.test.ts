import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client,type Room} from '@colyseus/sdk';
import {startServer} from '../server/index.js';
import type {World} from '../shared/state.js';
import WebSocket from 'ws';

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(condition:()=>boolean,message:string) {
  for(let i=0;i<100;i++){if(condition())return;await sleep(30);}
  throw new Error(message);
}
test('two real clients share movement, server-validated combat, chat and departures', {timeout:20000}, async()=>{
  const server=await startServer(2570);
  const clients:Room<World>[]=[];
  try {
    const rejected=await new Promise<number>((resolve,reject)=>{
      const socket=new WebSocket('ws://127.0.0.1:2570/invalid/path?sessionId=unreserved');
      socket.on('close',resolve);socket.on('error',reject);
    });
    assert.equal(rejected,1008,'A connection without a reserved seat must be rejected.');
    const client=new Client('ws://127.0.0.1:2570');
    for(const name of ['Birch','Rowan']) {
      const room=await client.joinOrCreate<World>('embervale',{name});
      for(const type of ['welcome','effect','notice','chat'])room.onMessage(type,()=>{});
      clients.push(room);
    }
    const [a,b]=clients;
    assert.equal(a.roomId,b.roomId);
    await waitFor(()=>a.state.players.size===2 && b.state.players.size===2,'Both players must be visible.');
    const original=b.state.players.get(a.sessionId)!.z;
    a.send('move',{x:999,z:999,seq:1});a.send('attack','wisp-0');
    await sleep(150);
    assert.equal(b.state.players.get(a.sessionId)!.z,original);
    assert.equal(a.state.enemies.get('wisp-0')!.hp,75);
    let seq=1;
    const walking=setInterval(()=>a.send('move',{x:0,z:1,seq:++seq}),50);
    await sleep(750);clearInterval(walking);a.send('move',{x:0,z:0,seq:++seq});
    await waitFor(()=>b.state.players.get(a.sessionId)!.z>original+3,'Movement must reach the other client.');
    const stopped=b.state.players.get(a.sessionId)!.z;
    await sleep(450);assert(Math.abs(b.state.players.get(a.sessionId)!.z-stopped)<.4);
    a.send('attack','wisp-0');a.send('attack','wisp-0');a.send('attack','wisp-0');
    await waitFor(()=>a.state.enemies.get('wisp-0')!.hp===50,'First valid attack should damage the wisp.');
    assert.equal(a.state.players.get(a.sessionId)!.xp,0);
    await sleep(850);a.send('attack','wisp-0');
    await waitFor(()=>a.state.enemies.get('wisp-0')!.hp===25,'Cooldown should allow a second hit.');
    await sleep(850);a.send('attack','wisp-0');
    await waitFor(()=>b.state.enemies.get('wisp-0')!.hp===0,'Defeat should replicate.');
    assert.equal(a.state.players.get(a.sessionId)!.xp,15);
    a.send('attack','wisp-0');await sleep(100);assert.equal(a.state.players.get(a.sessionId)!.xp,15);
    const chat:unknown[]=[];b.onMessage('chat',data=>chat.push(data));a.send('chat','Hello forest');
    await waitFor(()=>chat.length===1,'Chat must reach the other player.');
    assert.deepEqual(chat[0],{name:'Birch',text:'Hello forest'});
    await a.leave();clients.shift();await waitFor(()=>b.state.players.size===1,'Leaving players must disappear.');
  } finally {await Promise.allSettled(clients.map(c=>c.leave()));await server.gracefullyShutdown(false);}
});
