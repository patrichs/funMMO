export const WORLD_LIMIT = 42;
export const SPEED = 6;
export const SPAWN = {x: 0, z: 5};
export const HOUSE_POSITIONS = [{x:-12,z:1,r:3.5},{x:-14,z:-9,r:3.5},{x:12,z:-9,r:3.5}];
export const OBSTACLES = [...HOUSE_POSITIONS, {x:0,z:-7,r:1.9}];
export const WISP_SPAWNS = [{x:-6,z:17},{x:6,z:20},{x:15,z:14},{x:-15,z:23},{x:0,z:29}];
export function groundHeight(x:number,z:number) {
  const edge = Math.min(1, Math.max(0,(Math.hypot(x,z)-12)/25));
  return edge * (Math.sin(x*0.1)*0.7 + Math.cos(z*0.13)*0.6);
}
export type Position = {x:number;z:number};
export type Movement = {x:number;z:number;seq:number};
export function parseMovement(value:unknown): Movement | null {
  if (!value || typeof value !== 'object') return null;
  const {x,z,seq} = value as Movement;
  if (![x,z,seq].every(Number.isFinite) || !Number.isSafeInteger(seq) || seq < 0 || seq > 0xffffffff || Math.abs(x)>1 || Math.abs(z)>1) return null;
  const length=Math.max(1,Math.hypot(x,z));
  return {x:x/length,z:z/length,seq};
}
export function move(position:Position,input:Position,dt:number):Position {
  const length=Math.max(1,Math.hypot(input.x,input.z));
  const step=SPEED*Math.min(0.1,Math.max(0,dt));
  let x=Math.max(-WORLD_LIMIT,Math.min(WORLD_LIMIT,position.x+input.x/length*step));
  let z=Math.max(-WORLD_LIMIT,Math.min(WORLD_LIMIT,position.z+input.z/length*step));
  for (const obstacle of OBSTACLES) {
    const dx=x-obstacle.x,dz=z-obstacle.z,distance=Math.hypot(dx,dz),radius=obstacle.r+0.45;
    if (distance<radius) {const divisor=distance || 1;x=obstacle.x+(distance?dx/divisor:1)*radius;z=obstacle.z+(distance?dz/divisor:0)*radius;}
  }
  return {x,z};
}
export function canAttack(player:Position,enemy:Position & {hp:number},now:number,readyAt:number) {
  return enemy.hp>0 && now>=readyAt && Math.hypot(player.x-enemy.x,player.z-enemy.z)<=12;
}
export function cleanName(value:unknown) {
  return typeof value==='string' ? value.replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,18) || 'Traveler' : 'Traveler';
}
