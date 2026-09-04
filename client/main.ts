import './style.css';
import {Client,type Room} from '@colyseus/sdk';
import {Vector3,Matrix,type TransformNode} from './babylon.js';
import {type World,type ChatLine,type Effect} from '../shared/state.js';
import {groundHeight} from '../shared/world.js';
import {createWorld} from './world.js';

const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=el<HTMLCanvasElement>('world');
try { boot(); } catch(error) {el('render-error').hidden=false;el('render-error').textContent=`The world could not start. Enable WebGL in your browser and reload. ${error instanceof Error?error.message:''}`;}

function boot() {
  const view=createWorld(canvas);
  let room:Room<World>|undefined,target:string|undefined,seq=0,pingAt=0,serverTime=0,timeReceived=0,connected=false,joining=false;
  let toastTimer:ReturnType<typeof setTimeout>;
  const players=new Map<string,TransformNode>(),enemies=new Map<string,TransformNode>();
  const nameplates=new Map<string,HTMLElement>();
  const keys=new Set<string>();
  const client=new Client(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/game`);
  const notify=(message:string)=>{el('toast').textContent=message;el('toast').style.opacity='1';clearTimeout(toastTimer);toastTimer=setTimeout(()=>el('toast').style.opacity='0',3000);};
  const setTime=(time:number)=>{serverTime=time;timeReceived=performance.now();};
  function chat(line:ChatLine) {
    const p=document.createElement('p'),name=document.createElement('b');name.textContent=`${line.name}: `;p.append(name,document.createTextNode(line.text));
    const lines=el('chat-lines');lines.append(p);while(lines.childElementCount>30)lines.firstElementChild?.remove();lines.scrollTop=lines.scrollHeight;
  }
  const send=(type:string,data?:unknown)=>{if(connected)room?.send(type,data);};
  const attack=()=>{if(target)send('attack',target);else notify('Press TAB or click a wisp to choose your target.');};
  function selectNext() {
    const player=room?.state.players.get(room.sessionId);if(!player || !room)return;
    const choices=[...room.state.enemies.entries()].filter(([,e])=>e.hp>0 && Math.hypot(player.x-e.x,player.z-e.z)<32).sort((a,b)=>Math.hypot(a[1].x-player.x,a[1].z-player.z)-Math.hypot(b[1].x-player.x,b[1].z-player.z)).map(([id])=>id);
    target=choices[(choices.indexOf(target ?? '')+1)%choices.length];
  }
  el('join-form').addEventListener('submit',async event=>{
    event.preventDefault();if(joining || connected)return;
    joining=true;el<HTMLButtonElement>('join').disabled=true;el('join-error').textContent='';
    try {
      room=await client.joinOrCreate<World>('embervale',{name:el<HTMLInputElement>('name').value});
      room.onMessage('welcome',data=>setTime(data.time));
      room.onMessage('pong',(time:number)=>{el('latency').textContent=`${Math.round(performance.now()-pingAt)} ms`;setTime(time);});
      room.onMessage('chat',chat);room.onMessage('notice',notify);
      room.onMessage('effect',(effect:Effect)=>{
        const mesh=effect.target?enemies.get(effect.target):players.get(effect.player);
        if(mesh)view.flash(mesh.position.add(new Vector3(0,1.4,0)),effect.kind==='heal'?'#a0f0ba':'#ffe5a0');
        if(effect.player===room?.sessionId && effect.kind==='defeat')notify('+15 XP · A little peace returns to the forest.');
        if(effect.player===room?.sessionId && effect.kind==='respawn'){keys.clear();notify('The heartstone welcomes you back.');}
      });
      room.onLeave(()=>{connected=false;keys.clear();el('connection').textContent='Disconnected';notify('Connection lost. Leave the world and enter again to reconnect.');});
      room.onError((_code,message)=>notify(message || 'A connection error occurred.'));
      connected=true;el('welcome').hidden=true;el('world-caption').hidden=true;el('hud').hidden=false;el('connection').textContent='World online';
      canvas.focus();pingAt=performance.now();send('ping');
    }catch(error){el('join-error').textContent=error instanceof Error?error.message:'Cannot connect. Please try again.';}
    finally{joining=false;el<HTMLButtonElement>('join').disabled=false;}
  });
  el('leave').addEventListener('click',()=>{connected=false;void room?.leave();location.reload();});
  el('attack').addEventListener('click',attack);el('heal').addEventListener('click',()=>send('heal'));
  el('chat-form').addEventListener('submit',event=>{event.preventDefault();const input=el<HTMLInputElement>('chat-input');if(input.value.trim())send('chat',input.value);input.value='';input.blur();canvas.focus();});
  window.addEventListener('keydown',event=>{
    if(!connected)return;
    if(event.target instanceof HTMLInputElement){keys.clear();if(event.key==='Escape')event.target.blur();return;}
    const key=event.key.toLowerCase();
    if(['w','a','s','d','tab','1','2','enter',' '].includes(key))event.preventDefault();
    if(event.repeat)return;
    if(key==='tab')selectNext();else if(key==='1')attack();else if(key==='2')send('heal');else if(key==='enter'){keys.clear();el<HTMLInputElement>('chat-input').focus();}else if(key==='escape')target=undefined;
    else keys.add(key);
  });
  window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur',()=>{keys.clear();send('move',{x:0,z:0,seq:++seq});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();send('move',{x:0,z:0,seq:++seq});}});
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;canvas.focus();const picked=view.scene.pick(view.scene.pointerX,view.scene.pointerY);if(picked?.pickedMesh?.metadata?.target)target=picked.pickedMesh.metadata.target;});
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
        let mesh=players.get(id);if(!mesh){mesh=view.character(id,id===room.sessionId);mesh.position.set(state.x,groundHeight(state.x,state.z),state.z);players.set(id,mesh);}
        const goal=new Vector3(state.x,groundHeight(state.x,state.z),state.z);
        if(Vector3.Distance(mesh.position,goal)>5)mesh.position.copyFrom(goal);else mesh.position=Vector3.Lerp(mesh.position,goal,blend);
        const angle=Math.atan2(Math.sin(state.yaw-mesh.rotation.y),Math.cos(state.yaw-mesh.rotation.y));mesh.rotation.y+=angle*blend;
        if(id!==room.sessionId){
          let label=nameplates.get(id);if(!label){label=document.createElement('span');label.className='nameplate';el('nameplates').append(label);nameplates.set(id,label);}
          const point=Vector3.Project(mesh.position.add(new Vector3(0,2.8,0)),Matrix.Identity(),view.scene.getTransformMatrix(),view.camera.viewport.toGlobal(view.engine.getRenderWidth(),view.engine.getRenderHeight()));
          label.hidden=point.z<0 || point.z>1;label.textContent=state.name;label.style.left=`${point.x*canvas.clientWidth/view.engine.getRenderWidth()}px`;label.style.top=`${point.y*canvas.clientHeight/view.engine.getRenderHeight()}px`;
        }
        if(id===room.sessionId){
          view.camera.target=Vector3.Lerp(view.camera.target,mesh.position.add(new Vector3(0,1,0)),1-Math.exp(-5*dt));
          el('player-name').textContent=state.name;el('health').textContent=`${state.hp} / 100`;el('health-fill').style.width=`${state.hp}%`;
          el('xp-fill').style.width=`${Math.min(100,state.xp/150*100)}%`;el('xp-label').textContent=`${state.xp} XP · Level 1`;el('quest-progress').textContent=`${Math.min(3,state.kills)} / 3`;el('quest-check').textContent=state.kills>=3?'✓':'◇';
          el('position').textContent=`${state.x.toFixed(0)}, ${state.z.toFixed(0)}`;
          for(const [name,ready] of [['attack',state.attackReady],['heal',state.healReady]] as const){const overlay=el(`${name}-cooldown`);overlay.style.display=ready>now?'flex':'none';overlay.textContent=((ready-now)/1000).toFixed(1);}
        }
      }
      for(const [id,mesh] of players)if(!room.state.players.has(id)){mesh.dispose();players.delete(id);nameplates.get(id)?.remove();nameplates.delete(id);}
      for(const [id,state] of room.state.enemies){let mesh=enemies.get(id);if(!mesh){mesh=view.wisp(id);enemies.set(id,mesh);}mesh.setEnabled(state.hp>0);mesh.position.set(state.x,groundHeight(state.x,state.z)+Math.sin(performance.now()/650+state.spawnIndex)*.15,state.z);mesh.rotation.y=performance.now()/1300;}
      el('online').textContent=`${room.state.players.size} ${room.state.players.size===1?'adventurer':'adventurers'}`;
      const enemy=target?room.state.enemies.get(target):undefined,player=room.state.players.get(room.sessionId);
      const visible=!!enemy && enemy.hp>0;el('target-panel').hidden=!visible;view.targetRing.setEnabled(visible);
      if(visible && enemy && player){const distance=Math.hypot(enemy.x-player.x,enemy.z-player.z);view.targetRing.position.set(enemy.x,groundHeight(enemy.x,enemy.z)+.1,enemy.z);el('target-fill').style.width=`${enemy.hp/75*100}%`;el('target-distance').textContent=`${enemy.hp} / 75 · ${distance.toFixed(0)} m`;el('action-hint').textContent=distance>12?'Move closer to cast Sunbolt':'1 Sunbolt · 2 Mending light';}
    }
    view.scene.render();
  });
  // Read-only diagnostics for browser tests; no privileged server controls.
  Object.defineProperty(window,'__game',{get:()=>({connected,ready:view.scene.isReady(),sessionId:room?.sessionId,players:room?[...room.state.players.entries()].map(([id,p])=>({id,name:p.name,x:p.x,z:p.z,hp:p.hp,xp:p.xp})):[],target})});
}
