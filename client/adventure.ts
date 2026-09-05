import {NPCS,QUESTS,RESOURCES,REGIONS,ROADS,SPELLS,regionAt,riverX} from '../shared/content.js';
import type {Player,World} from '../shared/state.js';
const el=(id:string)=>document.getElementById(id)!;
export function adventure(send:(type:string,data?:unknown)=>void) {
  let world:World|undefined,player:Player|undefined,opened:string|undefined,tracked='',last=0,signature='';
  const map=el('world-map') as HTMLCanvasElement,mini=el('minimap') as HTMLCanvasElement;
  function toggleMap(){el('map-panel').hidden=!el('map-panel').hidden;if(!el('map-panel').hidden)draw(map,true);}
  el('map-open').onclick=toggleMap;el('map-close').onclick=toggleMap;
  el('dialog-close').onclick=()=>{opened=undefined;el('dialog').hidden=true;};
  el('dialog-action').onclick=()=>{if(opened)send('interact',{kind:'npc',id:opened});};
  function openNpc(id:string){opened=id;el('dialog').hidden=false;signature='';refreshDialog();}
  function nearest(p:Player){return [...NPCS.map(n=>({kind:'npc' as const,id:n.id,name:`Speak to ${n.name}`,distance:Math.hypot(p.x-n.x,p.z-n.z),range:6})),...RESOURCES.map(r=>({kind:'resource' as const,id:r.id,name:`Collect ${r.name.toLowerCase()}`,distance:Math.hypot(p.x-r.x,p.z-r.z),range:5}))].filter(v=>v.distance<=v.range).sort((a,b)=>a.distance-b.distance)[0];}
  function interact(){const near=player?nearest(player):undefined;if(!near)return;if(near.kind==='npc')openNpc(near.id);else send('interact',{kind:near.kind,id:near.id});}
  el('interact').onclick=interact;
  function refreshDialog(){
    if(!opened || !player)return;
    const npc=NPCS.find(n=>n.id===opened)!;
    if(Math.hypot(player.x-npc.x,player.z-npc.z)>8){opened=undefined;el('dialog').hidden=true;return;}
    const offered=QUESTS.filter(q=>q.npc===opened),q=offered.find(q=>player!.quests.get(q.id)?.status==='ready') ?? offered.find(q=>!player!.quests.has(q.id) && (!q.requires || player!.quests.get(q.requires)?.status==='complete')) ?? offered.find(q=>player!.quests.get(q.id)?.status==='active');
    el('dialog-name').textContent=npc.name;el('dialog-role').textContent=npc.role;
    el('dialog-title').textContent=q?.name ?? 'A friend of the valley';el('dialog-text').textContent=q?.text ?? 'Thank you for lending a hand. There are more people who need you along the roads.';
    const state=q?player.quests.get(q.id):undefined;
    el('dialog-reward').textContent=q?`${q.xp} XP · ${state ? `${state.progress} / ${q.count}`:'Quest available'}`:'';
    const button=el('dialog-action') as HTMLButtonElement;button.disabled=!q || state?.status==='active';button.textContent=!q?'All work complete':state?.status==='ready'?'Complete quest':state?.status==='active'?'Objective in progress':'Accept quest';
  }
  function objective(){
    if(!player)return;
    const active=QUESTS.filter(q=>['active','ready'].includes(player!.quests.get(q.id)?.status ?? ''));
    const q=active.find(q=>q.id===tracked) ?? active[0];
    if(!q)return;
    const ready=player.quests.get(q.id)!.status==='ready',npc=NPCS.find(n=>n.id===q.npc)!;
    return {x:ready?npc.x:q.x,z:ready?npc.z:q.z,name:ready?`Return to ${npc.name}`:q.name};
  }
  function draw(canvas:HTMLCanvasElement,full:boolean){
    if(!player || !world)return;const ctx=canvas.getContext('2d')!,size=canvas.width,span=full?1050:180,cx=full?0:player.x,cz=full?0:player.z;
    const point=(x:number,z:number)=>({x:(x-cx)/span*size+size/2,y:size/2-(z-cz)/span*size});
    ctx.fillStyle='#344f43';ctx.fillRect(0,0,size,size);
    for(const r of REGIONS){const p=point(r.x,r.z);ctx.fillStyle=r.color+'66';ctx.beginPath();ctx.arc(p.x,p.y,150/span*size,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='#86b7c0';ctx.lineWidth=full?4:8;ctx.beginPath();for(let z=-500;z<=500;z+=5){const p=point(riverX(z),z);if(z===-500)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}ctx.stroke();
    ctx.strokeStyle='#cfbb8b';ctx.lineWidth=full?2:4;
    for(const road of ROADS){ctx.beginPath();road.forEach((v,i)=>{const p=point(v.x,v.z);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.stroke();}
    const a=point(-500,500),b=point(500,-500);ctx.strokeStyle='#e2d3aa77';ctx.lineWidth=1;ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);
    if(!full)for(const e of world.enemies.values()){if(!e.hp)continue;const p=point(e.x,e.z);ctx.fillStyle='#ec927a';ctx.fillRect(p.x-2,p.y-2,4,4);}
    for(const r of RESOURCES){if(!QUESTS.some(q=>q.kind==='gather' && q.target===r.kind && player!.quests.get(q.id)?.status==='active'))continue;const p=point(r.x,r.z);ctx.fillStyle='#a8e6dc';ctx.fillRect(p.x-2,p.y-2,4,4);}
    ctx.font=full?'13px Georgia':'11px sans-serif';ctx.textAlign='center';
    for(const n of NPCS){const p=point(n.x,n.z);ctx.fillStyle='#f5d786';ctx.beginPath();ctx.arc(p.x,p.y,full?4:3,0,Math.PI*2);ctx.fill();if(full){ctx.fillStyle='#fff1cd';ctx.fillText(REGIONS.find(r=>r.id===n.region)!.name,p.x,p.y-12);}}
    const goal=objective();if(goal){const p=point(goal.x,goal.z);ctx.strokeStyle='#ffe598';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,9,0,Math.PI*2);ctx.stroke();}
    for(const p of world.players.values()){const v=point(p.x,p.z);ctx.fillStyle=p===player?'#ffffff':'#82dff1';ctx.beginPath();ctx.arc(v.x,v.y,p===player?4:3,0,Math.PI*2);ctx.fill();}
    const p=point(player.x,player.z);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(player.yaw);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(-4,-4);ctx.lineTo(4,-4);ctx.closePath();ctx.fill();ctx.restore();
    ctx.textAlign='left';ctx.fillStyle='#fff1cd';ctx.font='11px sans-serif';ctx.fillText('N ↑',10,18);ctx.fillText(full?'1 km × 1 km':'180 m',10,size-10);
  }
  function update(state:World,p:Player,now:number){
    world=state;player=p;if(now-last<180)return;last=now;
    const region=regionAt(p.x,p.z);el('zone-name').textContent=region.name;el('zone-description').textContent=region.description;
    el('mana').textContent=`${Math.floor(p.mana)} / 100 mana`;el('mana-fill').style.width=`${p.mana}%`;
    el('travel-status').textContent=p.mounted?'On horseback · R to dismount':'R · Summon travel horse';
    el('buffs').textContent=p.wardUntil>now?'⬡ Stone ward active':'';
    const near=nearest(p);el('interact').hidden=!near;el('interact').textContent=near?`E · ${near.name}`:'';
    const nextSignature=JSON.stringify([...p.quests.entries()].map(([id,q])=>[id,q.status,q.progress]))+tracked;
    if(nextSignature!==signature){
      signature=nextSignature;const list=el('quest-list');list.replaceChildren();
      const active=QUESTS.filter(q=>['active','ready'].includes(p.quests.get(q.id)?.status ?? ''));
      for(const q of active){const progress=p.quests.get(q.id)!,button=document.createElement('button');button.className='quest-entry';button.dataset.quest=q.id;button.textContent=`${progress.status==='ready'?'✓':'◇'} ${q.name}\n${progress.status==='ready'?'Return to '+NPCS.find(n=>n.id===q.npc)!.name:`${progress.progress} / ${q.count} · ${q.kind==='kill'?'Defeat':q.kind==='gather'?'Collect':'Explore'} ${q.target}`}`;button.onclick=()=>{tracked=q.id;signature='';};list.append(button);}
      if(!active.length){const p=document.createElement('p');p.textContent='Look for gold markers on the map. Speak to a local with E to accept a quest.';list.append(p);}
      el('quest-total').textContent=`${[...p.quests.values()].filter(q=>q.status==='complete').length} / ${QUESTS.length} quests completed`;
    }
    const goal=objective();el('waypoint').textContent=goal?`${goal.name} · ${Math.round(Math.hypot(p.x-goal.x,p.z-goal.z))} m`:'Visit Warden Elin by the village lanterns';
    refreshDialog();draw(mini,false);if(!el('map-panel').hidden)draw(map,true);
  }
  return {update,interact,toggleMap,openNpc,close:()=>{el('map-panel').hidden=true;el('dialog').hidden=true;opened=undefined;}};
}
