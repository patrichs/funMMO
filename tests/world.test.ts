import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMovement,move,canAttack,cleanName,WORLD_LIMIT} from '../shared/world.js';
test('hostile movement cannot inject coordinates or inflate speed',()=>{
  for (const value of [null,{}, {x:Infinity,z:0,seq:1},{x:100,z:0,seq:1},{x:0,z:0,seq:-1}]) assert.equal(parseMovement(value),null);
  const input=parseMovement({x:1,z:1,seq:1})!;
  assert(Math.abs(Math.hypot(input.x,input.z)-1)<1e-10);
  const next=move({x:0,z:5},input,99);
  assert(Math.hypot(next.x,next.z-5)<=0.60001);
});
test('movement respects zone bounds and building collisions',()=>{
  assert.equal(move({x:WORLD_LIMIT,z:0},{x:1,z:0},0.1).x,WORLD_LIMIT);
  const next=move({x:-8,z:1},{x:-1,z:0},0.1);
  assert(Math.hypot(next.x+12,next.z-1)>=3.95-1e-8);
});
test('combat requires living target, range and server cooldown',()=>{
  const player={x:0,z:0};
  assert(canAttack(player,{x:24,z:0,hp:75},800,800));
  assert(!canAttack(player,{x:24.1,z:0,hp:75},800,800));
  assert(!canAttack(player,{x:1,z:0,hp:0},800,800));
  assert(!canAttack(player,{x:1,z:0,hp:75},799,800));
});
test('names are bounded plain text',()=>{
  assert.equal(cleanName('<img>'), 'img');assert.equal(cleanName(null),'Traveler');assert.equal(cleanName('a'.repeat(100)).length,18);
});
