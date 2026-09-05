import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Client} from '@colyseus/core';
import {WorldRoom} from '../server/WorldRoom.js';
import {PlayerState,EnemyState,QuestState} from '../shared/state.js';
import {NPCS,QUESTS,MOB_SPAWNS,MOB_TYPES,RESOURCES,REGIONS,type MobKind} from '../shared/content.js';
import {WORLD_LIMIT,move} from '../shared/world.js';
function fixture(){
  const room=new WorldRoom(),p=new PlayerState({x:3,z:8}),messages:string[]=[];
  const client={sessionId:'test',send:(_type:string,message:string)=>messages.push(message)} as unknown as Client;
  room.broadcast=()=>{};room.state.players.set('test',p);
  const spawn=(id:string,kind:MobKind,x:number,z:number)=>{const e=new EnemyState({x,z,kind,hp:MOB_TYPES[kind].hp,maxHp:MOB_TYPES[kind].hp,spawnIndex:0});room.state.enemies.set(id,e);return e;};
  const advance=(ms:number)=>{room['gameTime']+=ms;};
  return {room,p,client,messages,spawn,advance};
}
test('one kilometre world has reachable, consistent content across all six regions',()=>{
  assert.equal(WORLD_LIMIT*2,1000);assert.equal(REGIONS.length,6);assert(MOB_SPAWNS.length>=70);assert.equal(QUESTS.length,10);
  for(const p of [...MOB_SPAWNS,...NPCS,...RESOURCES,...REGIONS])assert(Math.abs(p.x)<500 && Math.abs(p.z)<500);
  for(const q of QUESTS){assert(NPCS.some(n=>n.id===q.npc));if(q.requires)assert(QUESTS.some(p=>p.id===q.requires));}
  assert.equal(new Set(MOB_SPAWNS.map(s=>s.kind)).size,6);
  assert.equal(move({x:500,z:500},{x:1,z:1},.1,18).x,500);
});
test('quests require local acceptance, completed prerequisites, objectives and one local turn-in',()=>{
  const {room,p,client}=fixture();
  room['interact'](client,'npc','mara');assert.equal(p.quests.size,0,'Remote acceptance rejected');
  room['progress'](p,'kill','wisp');assert.equal(p.quests.size,0,'Kills before acceptance do not count');
  room['interact'](client,'npc','elin');assert(p.quests.has('first-light'));
  room['interact'](client,'npc','elin');assert(!p.quests.has('westward'));
  for(let i=0;i<3;i++)room['progress'](p,'kill','wisp');
  assert.equal(p.quests.get('first-light')!.status,'ready');assert.equal(p.xp,0);
  p.x=100;room['interact'](client,'npc','elin');assert.equal(p.xp,0);
  p.x=3;room['interact'](client,'npc','elin');assert.equal(p.xp,75);
  room['interact'](client,'npc','elin');assert.equal(p.xp,75);assert(p.quests.has('westward'));
  p.x=-155;p.z=100;room['tick'](50);assert.equal(p.quests.get('westward')!.status,'ready');
});
test('gathering needs the quest, proximity and distinct resource nodes per player',()=>{
  const {room,p,client}=fixture();
  const resource=RESOURCES[0];Object.assign(p,resource);room['interact'](client,'resource',resource.id);assert.equal(p.quests.size,0);
  p.x=-155;p.z=104;room['interact'](client,'npc','mara');
  room['interact'](client,'resource',resource.id);assert.equal(p.quests.get('grain')!.progress,0);
  for(const r of RESOURCES.slice(0,3)){p.x=r.x;p.z=r.z;room['interact'](client,'resource',r.id);room['interact'](client,'resource',r.id);}
  assert.equal(p.quests.get('grain')!.progress,3);assert.equal(p.quests.get('grain')!.status,'ready');
});
test('spells enforce range, mana, shared cooldown, slowing, area damage and single kill credit',()=>{
  const {room,p,client,spawn,advance}=fixture();p.x=0;p.z=0;
  const a=spawn('a','wisp',10,0),b=spawn('b','boar',13,0),far=spawn('far','wolf',30,0);
  room['cast'](client,'frost','far');assert.equal(p.mana,100);assert.equal(far.hp,85);
  p.mana=0;room['cast'](client,'frost','a');assert.equal(a.hp,75);
  p.mana=100;room['cast'](client,'frost','a');assert.equal(a.hp,43);assert.equal(p.mana,85);assert(a.slowUntil>0);
  room['cast'](client,'flame','a');assert.equal(b.hp,95,'Shared cooldown blocks spell spam');
  advance(700);room['cast'](client,'flame','a');assert.equal(a.hp,0);assert.equal(b.hp,50);assert.equal(far.hp,85);assert.equal(p.xp,15);
  advance(700);room['cast'](client,'sunbolt','a');assert.equal(p.xp,15);
});
test('healing, ward mitigation, mana recovery and collision-aware dash run on the server',()=>{
  const {room,p,client,spawn,advance}=fixture();p.hp=20;
  room['cast'](client,'mend');assert.equal(p.hp,65);assert.equal(p.mana,75);
  advance(700);room['cast'](client,'ward');assert(p.wardUntil>room['gameTime']);
  p.x=-6;p.z=17;spawn('hit','wisp',-6,17);room['tick'](50);assert.equal(p.hp,61,'Ward halves 8 damage');
  room.state.enemies.clear();p.x=-7;p.z=1;p.yaw=-Math.PI/2;advance(700);
  room['cast'](client,'blink');assert(p.x>=-8.06,'Dash cannot cross the cottage');
  const mana=p.mana;room['tick'](100);assert(p.mana>mana);
  p.x=499;p.z=100;p.yaw=Math.PI/2;advance(8100);room['cast'](client,'blink');assert.equal(p.x,500);
});
test('attacked enemies pursue, leash home, respawn, and players revive safely',()=>{
  const {room,p,client,spawn,advance}=fixture();p.x=-6;p.z=8;
  const e=spawn('wisp-0','wisp',-6,17);room['cast'](client,'sunbolt','wisp-0');
  const original=e.z;room['tick'](100);assert(e.z<original,'A ranged hit provokes pursuit');
  p.x=100;p.z=100;for(let i=0;i<20;i++)room['tick'](100);assert(Math.abs(e.z-17)<.5);
  p.x=-6;p.z=17;p.hp=1;room['tick'](100);assert.equal(p.hp,100);assert.equal(p.x,0);assert.equal(p.z,5);
  e.hp=0;room['enemyTimers'].set('wisp-0',room['gameTime']+15000);room['tick'](100);assert.equal(e.hp,0);
  advance(15000);room['tick'](50);assert.equal(e.hp,75);assert.equal(e.x,-6);
});
