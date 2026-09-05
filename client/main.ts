import './style.css';
import {Client,type Room} from '@colyseus/sdk';
import {Vector3,Matrix,type TransformNode} from './babylon.js';
import {type World,type ChatLine,type Effect} from '../shared/state.js';
import {groundHeight} from '../shared/world.js';
import {createWorld} from './world.js';
import {adventure} from './adventure.js';
import {SPELLS,MOB_TYPES,type MobKind,type SpellId} from '../shared/content.js';

const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=el<HTMLCanvasElement>('world');
try { boot(); } catch(error) {el('render-error').hidden=false;el('render-error').textContent=`The world could not start. Enable WebGL in your browser and reload. ${error instanceof Error?error.message:''}`;}

function boot() {
  const view=createWorld(canvas);
  // A rejected asset load stays visible; entering never silently falls back to a placeholder.
  void view.heroes.ready.catch(error=>{el('join-error').textContent=`Character could not load. Reload to retry. ${error instanceof Error?error.message:''}`;});
  let characterView=false;
  let inspectingMounted=false;
  let previousCamera={alpha:view.camera.alpha,beta:1.15,radius:9};
  let room:Room<World>|undefined,target:string|undefined,seq=0,pingAt=0,serverTime=0,timeReceived=0,connected=false,joining=false;
  let disconnectCode:number|undefined,lastNotice='';
  let toastTimer:ReturnType<typeof setTimeout>;
  const players=new Map<string,TransformNode>(),enemies=new Map<string,TransformNode>();
  const nameplates=new Map<string,HTMLElement>();
  const keys=new Set<string>();
  const mounts=new Map<string,TransformNode>();
  const client=new Client(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/game`);
  const notify=(message:string)=>{lastNotice=message;el('toast').textContent=message;el('toast').style.opacity='1';clearTimeout(toastTimer);toastTimer=setTimeout(()=>el('toast').style.opacity='0',3000);};
  const setTime=(time:number)=>{serverTime=time;timeReceived=performance.now();};
  function chat(line:ChatLine) {
    const p=document.createElement('p'),name=document.createElement('b');name.textContent=`${line.name}: `;p.append(name,document.createTextNode(line.text));
    const lines=el('chat-lines');lines.append(p);while(lines.childElementCount>30)lines.firstElementChild?.remove();lines.scrollTop=lines.scrollHeight;
  }
  const send=(type:string,data?:unknown)=>{if(connected)room?.send(type,data);};
  const journal=adventure(send);
  const cast=(spell:SpellId)=>send('cast',{spell,target});
  for(const spell of SPELLS){const button=document.createElement('button');button.id=spell.id;button.className='ability '+(spell.id==='mend'?'mint':'');button.setAttribute('aria-label',`Cast ${spell.name}`);button.title=spell.description;button.innerHTML=`<kbd>${spell.key}</kbd><span>${spell.icon}</span><small>${spell.name}</small><i id="${spell.id}-cooldown"></i>`;button.onclick=()=>cast(spell.id);el('hotbar').append(button);}
  function selectNext() {
    const player=room?.state.players.get(room.sessionId);if(!player || !room)return;
    const choices=[...room.state.enemies.entries()].filter(([,e])=>e.hp>0 && Math.hypot(player.x-e.x,player.z-e.z)<32).sort((a,b)=>Math.hypot(a[1].x-player.x,a[1].z-player.z)-Math.hypot(b[1].x-player.x,b[1].z-player.z)).map(([id])=>id);
    target=choices[(choices.indexOf(target ?? '')+1)%choices.length];
  }
  el('join-form').addEventListener('submit',async event=>{
    event.preventDefault();if(joining || connected)return;
    joining=true;el<HTMLButtonElement>('join').disabled=true;el('join-error').textContent='';
    try {
      await view.heroes.ready;
      room=await client.joinOrCreate<World>('embervale',{name:el<HTMLInputElement>('name').value});
      room.onMessage('welcome',data=>setTime(data.time));
      room.onMessage('pong',(time:number)=>{el('latency').textContent=`${Math.round(performance.now()-pingAt)} ms`;setTime(time);});
      room.onMessage('chat',chat);room.onMessage('notice',notify);
      room.onMessage('effect',(effect:Effect)=>{
        if(!['defeat','respawn'].includes(effect.kind))view.heroes.cast(effect.player);
        const mesh=effect.target?enemies.get(effect.target):players.get(effect.player);
        if(mesh)view.flash(mesh.position.add(new Vector3(0,1.4,0)),effect.kind==='heal'?'#a0f0ba':effect.kind==='frost'?'#a1e6ff':effect.kind==='flame'?'#ff985d':'#ffe5a0');
        if(effect.player===room?.sessionId && effect.kind==='defeat')notify('Enemy defeated · XP earned');
        if(effect.player===room?.sessionId && effect.kind==='respawn'){keys.clear();notify('The heartstone welcomes you back.');}
      });
      room.onLeave((code:number)=>{disconnectCode=code;connected=false;keys.clear();el('connection').textContent='Disconnected';notify('Connection lost. Leave the world and enter again to reconnect.');});
      room.onError((_code,message)=>notify(message || 'A connection error occurred.'));
      view.camera.radius=9;connected=true;el('welcome').hidden=true;el('world-caption').hidden=true;el('hud').hidden=false;el('connection').textContent='World online';
      canvas.focus();pingAt=performance.now();send('ping');
    }catch(error){el('join-error').textContent=error instanceof Error?error.message:'Cannot connect. Please try again.';}
    finally{joining=false;el<HTMLButtonElement>('join').disabled=false;}
  });
  el('leave').addEventListener('click',()=>{connected=false;void room?.leave();location.reload();});
  function frameCharacter(mounted:boolean,yaw:number){
    inspectingMounted=mounted;view.camera.radius=mounted?5.8:3.8;view.camera.beta=mounted?1.28:1.45;
    view.camera.alpha=Math.PI/2-yaw-(mounted?1.05:.25);
  }
  function inspectCharacter(){
    characterView=!characterView;
    const own=room?.state.players.get(room.sessionId);
    if(characterView){
      previousCamera={alpha:view.camera.alpha,beta:view.camera.beta,radius:view.camera.radius};
      frameCharacter(own?.mounted ?? false,own?.yaw ?? 0);
    }else{view.camera.radius=previousCamera.radius;view.camera.beta=previousCamera.beta;view.camera.alpha=previousCamera.alpha;}
    document.body.classList.toggle('character-inspection',characterView);
    el('character-view').setAttribute('aria-pressed',String(characterView));canvas.focus();
  }
  el('character-view').addEventListener('click',inspectCharacter);
  el('chat-form').addEventListener('submit',event=>{event.preventDefault();const input=el<HTMLInputElement>('chat-input');if(input.value.trim())send('chat',input.value);input.value='';input.blur();canvas.focus();});
  window.addEventListener('keydown',event=>{
    if(!connected)return;
    if(event.target instanceof HTMLInputElement){keys.clear();if(event.key==='Escape')event.target.blur();return;}
    const key=event.key.toLowerCase();
    if(['w','a','s','d','tab','1','2','3','4','5','6','e','r','m','enter',' '].includes(key))event.preventDefault();
    if(event.repeat)return;
    if(key==='tab')selectNext();else if(key==='c')inspectCharacter();else if(SPELLS.some(s=>s.key===key))cast(SPELLS.find(s=>s.key===key)!.id);else if(key==='e')journal.interact();else if(key==='r')send('mount');else if(key==='m')journal.toggleMap();else if(key==='enter'){keys.clear();el<HTMLInputElement>('chat-input').focus();}else if(key==='escape'){target=undefined;journal.close();}
    else keys.add(key);
  });
  window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur',()=>{keys.clear();send('move',{x:0,z:0,seq:++seq});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();send('move',{x:0,z:0,seq:++seq});}});
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;canvas.focus();const picked=view.scene.pick(view.scene.pointerX,view.scene.pointerY);const meta=picked?.pickedMesh?.metadata;if(meta?.target)target=meta.target;if(meta?.npc){const p=room?.state.players.get(room.sessionId),n=view.npcViews.find(v=>v.data.id===meta.npc);if(p && n && Math.hypot(p.x-n.data.x,p.z-n.data.z)<=6)journal.openNpc(meta.npc);else notify('Move within 6 m to speak.');}if(meta?.resource)send('interact',{kind:'resource',id:meta.resource});});
  setInterval(()=>{
    if(!connected)return;
    const forward=view.camera.target.subtract(view.camera.position);forward.y=0;forward.normalize();
    const right=new Vector3(forward.z,0,-forward.x);
    const movement=forward.scale(Number(keys.has('w'))-Number(keys.has('s'))).add(right.scale(Number(keys.has('d'))-Number(keys.has('a'))));
    if(movement.length()>1)movement.normalize();send('move',{x:movement.x,z:movement.z,seq:++seq});
  },50);
  setInterval(()=>{if(connected){pingAt=performance.now();send('ping');}},2000);
  view.engine.runRenderLoop(()=>{
    const dt=Math.min(.1,view.engine.getDeltaTime()/1000),blend=1-Math.exp(-14*dt),now=serverTime+performance.now()-timeReceived;
    if(room?.state.players) {
      for(const [id,state] of room.state.players) {
        let mesh=players.get(id);if(!mesh){mesh=view.heroes.create(id);mesh.position.set(state.x,groundHeight(state.x,state.z),state.z);players.set(id,mesh);}
        const goal=new Vector3(state.x,view.surfaceHeight(state.x,state.z)+(state.mounted?.48:0),state.z);
        const speed=Math.hypot(goal.x-mesh.position.x,goal.z-mesh.position.z)*14;
        const own=room.state.players.get(room.sessionId);
        view.heroes.update(id,speed,state.mounted,own?Math.hypot(state.x-own.x,state.z-own.z):0,id===room.sessionId,dt);
        if(Vector3.Distance(mesh.position,goal)>5)mesh.position.copyFrom(goal);else mesh.position=Vector3.Lerp(mesh.position,goal,blend);
        let mount=mounts.get(id);if(state.mounted && !mount){mount=view.horse(id);mounts.set(id,mount);}if(mount){mount.setEnabled(state.mounted);mount.position.set(mesh.position.x,view.surfaceHeight(mesh.position.x,mesh.position.z),mesh.position.z);mount.rotation.y=mesh.rotation.y;}
        const angle=Math.atan2(Math.sin(state.yaw-mesh.rotation.y),Math.cos(state.yaw-mesh.rotation.y));mesh.rotation.y+=angle*blend;
        if(id!==room.sessionId){
          let label=nameplates.get(id);if(!label){label=document.createElement('span');label.className='nameplate';el('nameplates').append(label);nameplates.set(id,label);}
          const point=Vector3.Project(mesh.position.add(new Vector3(0,2.8,0)),Matrix.Identity(),view.scene.getTransformMatrix(),view.camera.viewport.toGlobal(view.engine.getRenderWidth(),view.engine.getRenderHeight()));
          label.hidden=point.z<0 || point.z>1;label.textContent=state.name;label.style.left=`${point.x*canvas.clientWidth/view.engine.getRenderWidth()}px`;label.style.top=`${point.y*canvas.clientHeight/view.engine.getRenderHeight()}px`;
        }
        if(id===room.sessionId){
          if(characterView && inspectingMounted!==state.mounted)frameCharacter(state.mounted,state.yaw);
          view.camera.target.copyFrom(Vector3.Lerp(view.camera.target,mesh.position.add(new Vector3(0,characterView?(state.mounted?.8:1.05):1,0)),1-Math.exp(-5*dt)));
          el('player-name').textContent=state.name;el('health').textContent=`${state.hp} / 100`;el('health-fill').style.width=`${state.hp}%`;
          el('xp-fill').style.width=`${state.xp%250/250*100}%`;el('xp-label').textContent=`${state.xp} XP · Renown ${1+Math.floor(state.xp/250)}`;
          journal.update(room.state,state,now);view.updateLandscape(state.x,state.z);
          el('position').textContent=`${state.x.toFixed(0)}, ${state.z.toFixed(0)}`;
          for(const [name,ready] of [['sunbolt',state.attackReady],['mend',state.healReady],['frost',state.frostReady],['flame',state.flameReady],['ward',state.wardReady],['blink',state.blinkReady]] as const){const overlay=el(`${name}-cooldown`);overlay.style.display=ready>now?'flex':'none';overlay.textContent=((ready-now)/1000).toFixed(1);}
        }
      }
      for(const [id] of players)if(!room.state.players.has(id)){view.heroes.remove(id);players.delete(id);mounts.get(id)?.dispose();mounts.delete(id);nameplates.get(id)?.remove();nameplates.delete(id);}
      const own=room.state.players.get(room.sessionId);
      for(const [id,state] of room.state.enemies){
        const nearby=!!own && Math.hypot(state.x-own.x,state.z-own.z)<150;
        let mesh=enemies.get(id);if(!mesh && nearby){mesh=view.enemy(id,state.kind as MobKind);enemies.set(id,mesh);}if(!mesh)continue;
        mesh.setEnabled(nearby && state.hp>0);mesh.position.set(state.x,groundHeight(state.x,state.z)+(state.kind==='wisp'?Math.sin(performance.now()/650+state.spawnIndex)*.15:0),state.z);mesh.rotation.y=state.kind==='wisp'?performance.now()/1300:state.yaw;
      }
      for(const {data,root} of view.npcViews){
        const id='npc-'+data.id;let label=nameplates.get(id);
        if(!label){label=document.createElement('span');label.className='nameplate npc-label';el('nameplates').append(label);nameplates.set(id,label);}
        const point=Vector3.Project(root.position.add(new Vector3(0,3,0)),Matrix.Identity(),view.scene.getTransformMatrix(),view.camera.viewport.toGlobal(view.engine.getRenderWidth(),view.engine.getRenderHeight()));
        label.hidden=!own || Math.hypot(own.x-data.x,own.z-data.z)>45 || point.z<0 || point.z>1;label.textContent='✦ '+data.name;label.style.left=`${point.x*canvas.clientWidth/view.engine.getRenderWidth()}px`;label.style.top=`${point.y*canvas.clientHeight/view.engine.getRenderHeight()}px`;
      }
      el('online').textContent=`${room.state.players.size} ${room.state.players.size===1?'adventurer':'adventurers'}`;
      const enemy=target?room.state.enemies.get(target):undefined,player=room.state.players.get(room.sessionId);
      const visible=!!enemy && enemy.hp>0;el('target-panel').hidden=!visible;view.targetRing.setEnabled(visible);
      if(visible && enemy && player){const distance=Math.hypot(enemy.x-player.x,enemy.z-player.z);view.targetRing.position.set(enemy.x,groundHeight(enemy.x,enemy.z)+.1,enemy.z);el('target-fill').style.width=`${enemy.hp/enemy.maxHp*100}%`;el('target-distance').textContent=`${enemy.hp} / ${enemy.maxHp} · ${distance.toFixed(0)} m`;el('target-name').textContent=MOB_TYPES[enemy.kind as MobKind].name;el('action-hint').textContent=distance>24?'Move closer to cast':'1 Sunbolt · 3 Slow · 4 Area damage';}
    }
    view.scene.render();
  });
  // Read-only diagnostics for browser tests; no privileged server controls.
  Object.defineProperty(window,'__game',{get:()=>({connected,disconnectCode,lastNotice,ready:view.scene.isReady() && view.heroes.status==='ready',characterStatus:view.heroes.status,avatars:view.heroes.diagnostics(),camera:{radius:view.camera.radius,alpha:view.camera.alpha,beta:view.camera.beta,characterView},performance:{fps:view.engine.getFps(),width:view.engine.getRenderWidth(),height:view.engine.getRenderHeight(),activeIndices:view.scene.getActiveIndices()},sessionId:room?.sessionId,players:room?.state.players?[...room.state.players.entries()].map(([id,p])=>({id,name:p.name,x:p.x,z:p.z,hp:p.hp,xp:p.xp,mana:p.mana,mounted:p.mounted,quests:[...p.quests.entries()].map(([id,q])=>({id,status:q.status,progress:q.progress}))})):[],cameraForward:{x:Math.cos(view.camera.alpha)*-1,z:Math.sin(view.camera.alpha)*-1},target,enemies:room?.state.enemies?[...room.state.enemies.entries()].map(([id,e])=>({id,kind:e.kind,hp:e.hp,x:e.x,z:e.z})):[]})});
}
