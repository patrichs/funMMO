import {schema,t} from '@colyseus/schema';
export const PlayerState = schema({
  name:t.string().default('Traveler'), x:t.float32().default(0), z:t.float32().default(0), yaw:t.float32().default(0),
  hp:t.uint8().default(100), xp:t.uint16().default(0), kills:t.uint16().default(0),
  attackReady:t.float64().default(0), healReady:t.float64().default(0), seq:t.uint32().default(0)
},'PlayerState');
export const EnemyState = schema({
  x:t.float32(),z:t.float32(),hp:t.uint8().default(75),spawnIndex:t.uint8()
},'EnemyState');
export const WorldState = schema({players:t.map(PlayerState),enemies:t.map(EnemyState)},'WorldState');
export type World = InstanceType<typeof WorldState>;
export type Player = InstanceType<typeof PlayerState>;
export type Enemy = InstanceType<typeof EnemyState>;
export type ChatLine = {name:string;text:string};
export type Effect = {kind:'attack'|'heal'|'defeat'|'respawn';player:string;target?:string};
