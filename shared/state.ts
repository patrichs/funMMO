import {schema,t} from '@colyseus/schema';
export const QuestState=schema({status:t.string().default('active'),progress:t.uint8().default(0)},'QuestState');
export const PlayerState = schema({
  name:t.string().default('Traveler'), x:t.float32().default(0), z:t.float32().default(0), yaw:t.float32().default(0),
  hp:t.uint8().default(100),mana:t.float32().default(100),xp:t.uint32().default(0),kills:t.uint16().default(0),
  attackReady:t.float64().default(0), healReady:t.float64().default(0),frostReady:t.float64().default(0),flameReady:t.float64().default(0),wardReady:t.float64().default(0),blinkReady:t.float64().default(0),
  wardUntil:t.float64().default(0),globalReady:t.float64().default(0),combatUntil:t.float64().default(0),mounted:t.boolean().default(false),
  quests:t.map(QuestState),seq:t.uint32().default(0)
},'PlayerState');
export const EnemyState = schema({
  x:t.float32().default(0),z:t.float32().default(0),hp:t.uint16().default(75),maxHp:t.uint16().default(75),kind:t.string().default('wisp'),
  yaw:t.float32().default(0),slowUntil:t.float64().default(0),spawnIndex:t.uint16().default(0)
},'EnemyState');
export const WorldState = schema({players:t.map(PlayerState),enemies:t.map(EnemyState)},'WorldState');
export type World = InstanceType<typeof WorldState>;
export type Player = InstanceType<typeof PlayerState>;
export type Enemy = InstanceType<typeof EnemyState>;
export type ChatLine = {name:string;text:string};
export type Effect = {kind:'attack'|'heal'|'defeat'|'respawn'|'frost'|'flame'|'ward'|'blink';player:string;target?:string};
