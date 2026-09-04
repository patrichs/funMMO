import {Room, type Client} from '@colyseus/core';
import {PlayerState,EnemyState,WorldState,type World,type Effect} from '../shared/state.js';
import {SPAWN,WISP_SPAWNS,parseMovement,move,canAttack,cleanName,type Movement} from '../shared/world.js';

export class WorldRoom extends Room<{state:World}> {
  state=new WorldState();
  maxClients=20;
  autoDispose=false;
  private movementInputs=new Map<string, Movement & {at:number}>();
  private chatTimes=new Map<string,number>();
  private enemyTimers=new Map<string,number>();
  private gameTime=0;

  onCreate() {
    this.patchRate=50;
    this.maxMessagesPerSecond=60;
    WISP_SPAWNS.forEach((point,i)=>this.state.enemies.set(`wisp-${i}`,new EnemyState({...point,spawnIndex:i})));
    this.onMessage('move',(client,data:unknown)=>{
      const input=parseMovement(data),player=this.state.players.get(client.sessionId);
      if (!input || !player || input.seq<=player.seq) return;
      player.seq=input.seq;
      this.movementInputs.set(client.sessionId,{...input,at:this.gameTime});
    });
    this.onMessage('attack',(client,data:unknown)=>{
      const player=this.state.players.get(client.sessionId);
      if (!player || typeof data!=='string') return;
      const enemy=this.state.enemies.get(data);
      if (!enemy || !canAttack(player,enemy,this.gameTime,player.attackReady)) {client.send('notice','Move closer to a living wisp.');return;}
      player.attackReady=this.gameTime+800;
      enemy.hp=Math.max(0,enemy.hp-25);
      this.effect({kind:'attack',player:client.sessionId,target:data});
      if (enemy.hp===0) {
        player.kills=Math.min(65535,player.kills+1);player.xp=Math.min(65535,player.xp+15);
        this.enemyTimers.set(data,this.gameTime+8000);
        this.effect({kind:'defeat',player:client.sessionId,target:data});
      }
    });
    this.onMessage('heal',(client)=>{
      const player=this.state.players.get(client.sessionId);
      if (!player || player.hp===100 || this.gameTime<player.healReady) return;
      player.hp=Math.min(100,player.hp+40);player.healReady=this.gameTime+6000;
      this.effect({kind:'heal',player:client.sessionId});
    });
    this.onMessage('chat',(client,data:unknown)=>{
      const player=this.state.players.get(client.sessionId);
      if (!player || typeof data!=='string' || this.gameTime-(this.chatTimes.get(client.sessionId) ?? -1000)<1000) return;
      const text=data.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,160);
      if (!text) return;
      this.chatTimes.set(client.sessionId,this.gameTime);
      this.broadcast('chat',{name:player.name,text});
    });
    this.onMessage('ping',(client)=>client.send('pong',this.gameTime));
    this.setSimulationInterval(dt=>this.tick(Math.min(dt,100)),50);
  }

  onJoin(client:Client,options:{name?:unknown}={}) {
    const player=new PlayerState();player.x=SPAWN.x;player.z=SPAWN.z;player.name=cleanName(options?.name);
    this.state.players.set(client.sessionId,player);
    client.send('welcome',{time:this.gameTime});
  }
  onLeave(client:Client) {
    this.state.players.delete(client.sessionId);this.movementInputs.delete(client.sessionId);this.chatTimes.delete(client.sessionId);
  }
  private effect(effect:Effect) {this.broadcast('effect',effect);}
  private tick(dt:number) {
    this.gameTime+=dt;
    for (const [id,player] of this.state.players) {
      const input=this.movementInputs.get(id);
      if (input && this.gameTime-input.at<250) {
        const next=move(player,input,dt/1000);player.x=next.x;player.z=next.z;
        if (input.x || input.z) player.yaw=Math.atan2(input.x,input.z);
      }
    }
    for (const [id,enemy] of this.state.enemies) {
      const ready=this.enemyTimers.get(id) ?? 0;
      if (enemy.hp===0) {
        if (this.gameTime>=ready) enemy.hp=75;
        continue;
      }
      if (this.gameTime<ready) continue;
      const near=[...this.state.players.entries()].find(([,p])=>Math.hypot(p.x-enemy.x,p.z-enemy.z)<3.5);
      if (near) {
        const [playerId,player]=near;
        player.hp=Math.max(0,player.hp-10);this.enemyTimers.set(id,this.gameTime+1400);
        if (player.hp===0) {
          player.hp=100;player.x=SPAWN.x;player.z=SPAWN.z;this.movementInputs.delete(playerId);
          this.effect({kind:'respawn',player:playerId});
        }
      }
    }
  }
}
