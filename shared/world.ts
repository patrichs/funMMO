import {REGIONS,MOB_SPAWNS} from "./content.js";
export const WORLD_LIMIT = 500;
export const SPEED = 6;
export const SPAWN = {x: 0, z: 5};
export const HOUSE_POSITIONS = REGIONS.flatMap(region=> (region.id==='ruins' || region.id==='quarry' ? [{x:-12,z:-9}] : [{x:-12,z:1},{x:-14,z:-9},{x:12,z:-9}]).map(p=>({x:region.x+p.x,z:region.z+p.z,r:3.5})));
export const OBSTACLES = [...HOUSE_POSITIONS, {x:0,z:-7,r:1.9}, {x:10,z:378,r:3.5}, {x:-245,z:-267,r:3.5}];
export const WISP_SPAWNS = MOB_SPAWNS.slice(0,5);
export function groundHeight(x:number,z:number) {
  const hills=Math.sin(x*.012)*5+Math.cos(z*.015)*4+Math.sin((x+z)*.026)*1.5;
  // Settlements sit on gently flattened terraces; client and server share this surface.
  const nearest=REGIONS.reduce((best,r)=>Math.hypot(x-r.x,z-r.z)<Math.hypot(x-best.x,z-best.z)?r:best,REGIONS[0] as typeof REGIONS[number]);
  const flatten=Math.min(1,Math.max(0,(55-Math.hypot(x-nearest.x,z-nearest.z))/30));
  const center=nearest.id==='village'?0:Math.sin(nearest.x*.012)*5+Math.cos(nearest.z*.015)*4+Math.sin((nearest.x+nearest.z)*.026)*1.5;
  return hills*(1-flatten)+center*flatten;
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
export function move(position:Position,input:Position,dt:number,speed=SPEED):Position {
  const length=Math.max(1,Math.hypot(input.x,input.z));
  const step=speed*Math.min(0.1,Math.max(0,dt));
  let x=Math.max(-WORLD_LIMIT,Math.min(WORLD_LIMIT,position.x+input.x/length*step));
  let z=Math.max(-WORLD_LIMIT,Math.min(WORLD_LIMIT,position.z+input.z/length*step));
  for (const obstacle of OBSTACLES) {
    const dx=x-obstacle.x,dz=z-obstacle.z,distance=Math.hypot(dx,dz),radius=obstacle.r+0.45;
    if (distance<radius) {const divisor=distance || 1;x=obstacle.x+(distance?dx/divisor:1)*radius;z=obstacle.z+(distance?dz/divisor:0)*radius;}
  }
  return {x,z};
}
export function canAttack(player:Position,enemy:Position & {hp:number},now:number,readyAt:number,range=24) {
  return enemy.hp>0 && now>=readyAt && Math.hypot(player.x-enemy.x,player.z-enemy.z)<=range;
}
export function cleanName(value:unknown) {
  return typeof value==='string' ? value.replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,18) || 'Traveler' : 'Traveler';
}
