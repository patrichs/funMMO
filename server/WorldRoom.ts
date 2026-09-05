import {Room, type Client} from '@colyseus/core';
import {PlayerState,EnemyState,QuestState,WorldState,type World,type Effect,type Player,type Enemy} from '../shared/state.js';
import {SPAWN,parseMovement,move,cleanName,type Movement} from '../shared/world.js';
import {MOB_SPAWNS,MOB_TYPES,NPCS,QUESTS,RESOURCES,REGIONS,SPELLS,type MobKind,type SpellId} from '../shared/content.js';

const readyField={sunbolt:'attackReady',mend:'healReady',frost:'frostReady',flame:'flameReady',ward:'wardReady',blink:'blinkReady'} as const;
const distance=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
export class WorldRoom extends Room<{state:World}> {
  state=new WorldState();
  maxClients=20;
  autoDispose=false;
  private movementInputs=new Map<string, Movement & {at:number}>();
  private chatTimes=new Map<string,number>();
  private enemyTimers=new Map<string,number>();
  private gathered=new Map<string,Set<string>>();
  private gameTime=0;
  private threats=new Map<string,string>();

  onCreate() {
    this.patchRate=50;this.maxMessagesPerSecond=60;
    MOB_SPAWNS.forEach((point,i)=>{const spec=MOB_TYPES[point.kind];this.state.enemies.set(`${point.kind}-${i}`,new EnemyState({...point,hp:spec.hp,maxHp:spec.hp,spawnIndex:i}));});
    this.onMessage('move',(client,data:unknown)=>{
      const input=parseMovement(data),player=this.state.players.get(client.sessionId);
      if (!input || !player || input.seq<=player.seq) return;
      player.seq=input.seq;this.movementInputs.set(client.sessionId,{...input,at:this.gameTime});
    });
    this.onMessage('cast',(client,data:unknown)=>{
      if(!data || typeof data!=='object')return;
      const {spell,target}=data as {spell:unknown;target:unknown};
      if(typeof spell==='string' && SPELLS.some(s=>s.id===spell) && (target===undefined || typeof target==='string'))this.cast(client,spell as SpellId,target as string|undefined);
    });
    this.onMessage('attack',(client,data:unknown)=>{if(typeof data==='string')this.cast(client,'sunbolt',data);});
    this.onMessage('heal',client=>this.cast(client,'mend'));
    this.onMessage('interact',(client,data:unknown)=>{
      if(!data || typeof data!=='object')return;
      const {kind,id}=data as {kind:unknown;id:unknown};
      if((kind==='npc' || kind==='resource') && typeof id==='string')this.interact(client,kind,id);
    });
    this.onMessage('mount',client=>{
      const p=this.state.players.get(client.sessionId);if(!p)return;
      if(this.gameTime<p.combatUntil){client.send('notice','You cannot saddle up in combat.');return;}
      p.mounted=!p.mounted;client.send('notice',p.mounted?'Travel horse summoned · R to dismount':'Back on foot.');
    });
    this.onMessage('chat',(client,data:unknown)=>{
      const player=this.state.players.get(client.sessionId);
      if (!player || typeof data!=='string' || this.gameTime-(this.chatTimes.get(client.sessionId) ?? -1000)<1000) return;
      const text=data.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,160);
      if (!text) return;
      this.chatTimes.set(client.sessionId,this.gameTime);this.broadcast('chat',{name:player.name,text});
    });
    this.onMessage('ping',client=>client.send('pong',this.gameTime));
    this.setSimulationInterval(dt=>this.tick(Math.min(dt,100)),50);
  }
  onJoin(client:Client,options:{name?:unknown}={}) {
    const player=new PlayerState();player.x=SPAWN.x;player.z=SPAWN.z;player.name=cleanName(options?.name);
    this.state.players.set(client.sessionId,player);client.send('welcome',{time:this.gameTime});
  }
  onLeave(client:Client) {
    this.state.players.delete(client.sessionId);this.movementInputs.delete(client.sessionId);this.chatTimes.delete(client.sessionId);this.gathered.delete(client.sessionId);
  }
  private effect(effect:Effect) {this.broadcast('effect',effect);}
  private progress(player:Player,kind:string,target:string) {
    for(const q of QUESTS) {
      const progress=player.quests.get(q.id);
      if(q.kind!==kind || q.target!==target || !progress || progress.status!=='active')continue;
      progress.progress=Math.min(q.count,progress.progress+1);
      if(progress.progress===q.count)progress.status='ready';
    }
  }
  private interact(client:Client,kind:'npc'|'resource',id:string) {
    const player=this.state.players.get(client.sessionId);if(!player)return;
    if(kind==='resource') {
      const resource=RESOURCES.find(r=>r.id===id);if(!resource || distance(player,resource)>5)return;
      const active=QUESTS.find(q=>q.kind==='gather' && q.target===resource.kind && player.quests.get(q.id)?.status==='active');
      if(!active){client.send('notice','Accept the local gathering quest first.');return;}
      const used=this.gathered.get(client.sessionId) ?? new Set<string>();
      if(used.has(id)){client.send('notice','You already collected this one. Look for another.');return;}
      used.add(id);this.gathered.set(client.sessionId,used);this.progress(player,'gather',resource.kind);
      client.send('notice',`Collected ${resource.name.toLowerCase()}.`);return;
    }
    const npc=NPCS.find(n=>n.id===id);if(!npc || distance(player,npc)>6)return;
    const quests=QUESTS.filter(q=>q.npc===id);
    const ready=quests.find(q=>player.quests.get(q.id)?.status==='ready');
    if(ready){player.quests.get(ready.id)!.status='complete';player.xp=Math.min(0xffffffff,player.xp+ready.xp);client.send('notice',`${ready.name} complete · +${ready.xp} XP. Speak again for more work.`);return;}
    const available=quests.find(q=>!player.quests.has(q.id) && (!q.requires || player.quests.get(q.requires)?.status==='complete'));
    if(available){player.quests.set(available.id,new QuestState());client.send('notice',`${npc.name}: ${available.text}`);return;}
    const active=quests.find(q=>player.quests.get(q.id)?.status==='active');
    client.send('notice',active?`${npc.name}: ${active.text}`:`${npc.name}: Safe travels, friend. You have our thanks.`);
  }
  private cast(client:Client,id:SpellId,target?:string) {
    const p=this.state.players.get(client.sessionId),spell=SPELLS.find(s=>s.id===id)!;if(!p)return;
    if(this.gameTime<p[readyField[id]] || this.gameTime<p.globalReady)return;
    if(p.mana<spell.cost){client.send('notice','Not enough mana. It regenerates over time.');return;}
    const enemy=target?this.state.enemies.get(target):undefined;
    if(spell.range && (!enemy || enemy.hp===0 || distance(p,enemy)>spell.range)){client.send('notice',`Choose a living target within ${spell.range} metres.`);return;}
    if(id==='mend' && p.hp===100)return;
    p.mounted=false;p.mana-=spell.cost;p[readyField[id]]=this.gameTime+spell.cooldown;p.globalReady=this.gameTime+650;
    if(id==='mend') {p.hp=Math.min(100,p.hp+45);this.effect({kind:'heal',player:client.sessionId});}
    else if(id==='ward'){p.wardUntil=this.gameTime+8000;this.effect({kind:'ward',player:client.sessionId});}
    else if(id==='blink') {
      const direction={x:Math.sin(p.yaw),z:Math.cos(p.yaw)};
      // Sweep small collision-aware steps so Windstep cannot pass through buildings.
      for(let i=0;i<20;i++){const next=move(p,direction,.1);p.x=next.x;p.z=next.z;}
      this.movementInputs.delete(client.sessionId);this.effect({kind:'blink',player:client.sessionId});
    } else if(enemy && target) {
      p.combatUntil=this.gameTime+6000;
      const victims=id==='flame'?[...this.state.enemies.entries()].filter(([,e])=>e.hp>0 && distance(e,enemy)<=6):[[target,enemy] as [string,Enemy]];
      for(const [enemyId,victim] of victims) {
        this.threats.set(enemyId,client.sessionId);
        victim.hp=Math.max(0,victim.hp-(id==='sunbolt'?25:id==='frost'?32:45));
        if(id==='frost')victim.slowUntil=this.gameTime+5000;
        this.effect({kind:id==='sunbolt'?'attack':id,player:client.sessionId,target:enemyId});
        if(victim.hp===0) {
          this.threats.delete(enemyId);
          const spec=MOB_TYPES[victim.kind as MobKind];p.kills=Math.min(65535,p.kills+1);p.xp=Math.min(0xffffffff,p.xp+spec.xp);
          this.progress(p,'kill',victim.kind);this.enemyTimers.set(enemyId,this.gameTime+15000);
          this.effect({kind:'defeat',player:client.sessionId,target:enemyId});
        }
      }
    }
  }
  private tick(dt:number) {
    this.gameTime+=dt;
    for (const [id,player] of this.state.players) {
      player.mana=Math.min(100,player.mana+dt*.008);
      const input=this.movementInputs.get(id);
      if(input && this.gameTime-input.at<250) {
        const next=move(player,input,dt/1000,player.mounted?18:6);player.x=next.x;player.z=next.z;
        if(input.x || input.z)player.yaw=Math.atan2(input.x,input.z);
      }
      for(const region of REGIONS)if(distance(player,region)<24)this.progress(player,'visit',region.id);
    }
    for(const [id,enemy] of this.state.enemies) {
      const home=MOB_SPAWNS[enemy.spawnIndex],spec=MOB_TYPES[enemy.kind as MobKind],ready=this.enemyTimers.get(id) ?? 0;
      if(enemy.hp===0){if(this.gameTime>=ready){enemy.hp=spec.hp;enemy.x=home.x;enemy.z=home.z;enemy.slowUntil=0;}continue;}
      const threatId=this.threats.get(id),threat=threatId?this.state.players.get(threatId):undefined;
      if(threatId && (!threat || distance(threat,home)>32))this.threats.delete(id);
      const nearest: [string,Player]|undefined=threat && threatId && distance(threat,home)<=32 ? [threatId,threat] : [...this.state.players.entries()].filter(([,p])=>distance(p,enemy)<spec.aggro && distance(p,home)<32).sort((a,b)=>distance(a[1],enemy)-distance(b[1],enemy))[0];
      const goal=nearest?.[1] ?? home,dist=distance(enemy,goal);
      if(dist>(nearest?2.2:.4)) {
        const speed=spec.speed*(this.gameTime<enemy.slowUntil ? .35 : 1),next=move(enemy,{x:(goal.x-enemy.x)/dist,z:(goal.z-enemy.z)/dist},dt/1000,speed);
        enemy.yaw=Math.atan2(goal.x-enemy.x,goal.z-enemy.z);enemy.x=next.x;enemy.z=next.z;
      }
      if(!nearest){if(distance(enemy,home)<1)enemy.hp=Math.min(spec.hp,enemy.hp+1);continue;}
      if(dist>2.8 || this.gameTime<ready)continue;
      const [playerId,player]=nearest;
      player.mounted=false;player.combatUntil=this.gameTime+6000;
      player.hp=Math.max(0,player.hp-Math.ceil(spec.damage*(this.gameTime<player.wardUntil ? .5 : 1)));this.enemyTimers.set(id,this.gameTime+1600);
      if(player.hp===0) {
        player.hp=100;player.mana=100;player.x=SPAWN.x;player.z=SPAWN.z;player.wardUntil=0;player.combatUntil=0;this.movementInputs.delete(playerId);
        for(const [enemyId,threat] of this.threats)if(threat===playerId)this.threats.delete(enemyId);
        this.effect({kind:'respawn',player:playerId});
      }
    }
  }
}
