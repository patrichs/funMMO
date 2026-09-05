export type Point = {x:number;z:number};
export const REGIONS = [
  {id:'village',name:'Embervale',x:0,z:0,color:'#91ac72',description:'Hearths, high roofs, and a road into the wild.'},
  {id:'farm',name:'Westmere Fields',x:-155,z:100,color:'#b6af70',description:'Golden crofts beneath the western hills.'},
  {id:'river',name:'Willowbrook',x:160,z:155,color:'#7eaa87',description:'A riverside hamlet on the old trade road.'},
  {id:'quarry',name:'Redstone Quarry',x:265,z:-155,color:'#aaa08a',description:'Stonecutters have fled the broken terraces.'},
  {id:'ruins',name:'Ashen Abbey',x:-245,z:-255,color:'#8a9590',description:'The bells fell silent. The dead did not.'},
  {id:'watch',name:'Northwatch',x:10,z:390,color:'#74917c',description:'The last watchtower before the deepwood.'},
] as const;
export const ROADS: Point[][] = [
  [{x:0,z:0},{x:0,z:45},{x:-80,z:65},{x:-155,z:100}],
  [{x:0,z:0},{x:0,z:45},{x:85,z:95},{x:160,z:155}],
  [{x:0,z:0},{x:80,z:-45},{x:170,z:-100},{x:265,z:-155}],
  [{x:0,z:0},{x:-70,z:-60},{x:-160,z:-160},{x:-245,z:-255}],
  [{x:160,z:155},{x:85,z:250},{x:10,z:390}],
];
export const NPCS = [
  {id:'elin',name:'Warden Elin',role:'Keeper of Embervale',x:3,z:8,region:'village'},
  {id:'mara',name:'Farmer Mara',role:'Westmere steward',x:-155,z:104,region:'farm'},
  {id:'tomas',name:'Captain Tomas',role:'Willowbrook watch',x:156,z:160,region:'river'},
  {id:'bryn',name:'Mason Bryn',role:'Redstone foreman',x:261,z:-149,region:'quarry'},
  {id:'ada',name:'Sister Ada',role:'Abbey pilgrim',x:-240,z:-249,region:'ruins'},
  {id:'orren',name:'Scout Orren',role:'Northwatch ranger',x:15,z:385,region:'watch'},
] as const;
export const MOB_TYPES = {
  wisp:{name:'Restless wisp',hp:75,damage:8,speed:2.5,aggro:5,xp:15,color:'#c4dda6'},
  boar:{name:'Bristleback boar',hp:95,damage:10,speed:3.4,aggro:8,xp:22,color:'#91634b'},
  wolf:{name:'Timber wolf',hp:85,damage:12,speed:4.8,aggro:11,xp:25,color:'#a4aaa4'},
  bandit:{name:'Roadside brigand',hp:120,damage:14,speed:4,aggro:12,xp:35,color:'#98574b'},
  skeleton:{name:'Abbey revenant',hp:140,damage:16,speed:3,aggro:10,xp:40,color:'#d4cfb4'},
  guardian:{name:'Hollow guardian',hp:320,damage:22,speed:2.6,aggro:12,xp:100,color:'#768b8c'},
} as const;
export type MobKind=keyof typeof MOB_TYPES;
export const MOB_SPAWNS: (Point & {kind:MobKind})[] = [
  ...[{x:-6,z:17},{x:6,z:20},{x:15,z:14},{x:-15,z:23},{x:0,z:29}].map(p=>({...p,kind:'wisp' as const})),
];
for(const [kind,x,z,count] of [
  ['wisp',-48,50,6],['boar',-188,143,8],['wolf',-110,210,8],['wolf',90,305,8],
  ['bandit',210,205,8],['bandit',285,-110,7],['skeleton',-285,-285,9],
  ['skeleton',-180,-310,6],['guardian',-260,-340,1],['guardian',40,430,2],['wisp',-50,345,6],
] as [MobKind,number,number,number][])for(let i=0;i<count;i++) {
  const angle=i*2.39996,radius=count===1?0:12+Math.sqrt(i)*10;
  MOB_SPAWNS.push({kind,x:x+Math.cos(angle)*radius,z:z+Math.sin(angle)*radius});
}
export const RESOURCES = [
  ...Array.from({length:6},(_,i)=>({id:`grain-${i}`,kind:'grain',name:'Lost grain sack',x:-170+(i%3)*9,z:115+Math.floor(i/3)*10})),
  ...Array.from({length:6},(_,i)=>({id:`stone-${i}`,kind:'stone',name:'Mason’s stone',x:245+(i%3)*11,z:-180-Math.floor(i/3)*12})),
];
export const QUESTS = [
  {id:'first-light',name:'A light in the thicket',npc:'elin',kind:'kill',target:'wisp',count:3,xp:75,requires:'',x:0,z:22,text:'Restless wisps crowd our lantern path. Quiet three, then return to me.'},
  {id:'westward',name:'Bread for the valley',npc:'elin',kind:'visit',target:'farm',count:1,xp:60,requires:'first-light',x:-155,z:100,text:'Follow the western road to Westmere Fields. Check on the farms, then report back.'},
  {id:'grain',name:'The scattered harvest',npc:'mara',kind:'gather',target:'grain',count:3,xp:90,requires:'',x:-161,z:120,text:'The boars scattered our grain. Bring back three different sacks from the field.'},
  {id:'boars',name:'Trouble in the crofts',npc:'mara',kind:'kill',target:'boar',count:4,xp:120,requires:'grain',x:-188,z:143,text:'Bristlebacks are tearing up the crops. Drive off four and I can sow again.'},
  {id:'brigands',name:'The broken trade road',npc:'tomas',kind:'kill',target:'bandit',count:4,xp:150,requires:'',x:210,z:205,text:'Brigands camp east of Willowbrook. Defeat four to reopen our road.'},
  {id:'northwatch',name:'A watch in the north',npc:'tomas',kind:'visit',target:'watch',count:1,xp:120,requires:'brigands',x:10,z:390,text:'Walk the northern road to Northwatch. Make sure the tower still stands, then return.'},
  {id:'stone',name:'Stones for the hearth',npc:'bryn',kind:'gather',target:'stone',count:3,xp:120,requires:'',x:256,z:-186,text:'Find three different mason’s stones on the quarry floor. The village needs new hearths.'},
  {id:'revenants',name:'The silent bells',npc:'ada',kind:'kill',target:'skeleton',count:4,xp:180,requires:'',x:-285,z:-285,text:'Four restless revenants haunt the abbey grounds. Give them peace and return to me.'},
  {id:'guardian',name:'The hollow heart',npc:'ada',kind:'kill',target:'guardian',count:1,xp:250,requires:'revenants',x:-260,z:-340,text:'The Hollow Guardian waits south of the abbey. Break its hold on these ruins.'},
  {id:'wolves',name:'Teeth in the deepwood',npc:'orren',kind:'kill',target:'wolf',count:4,xp:160,requires:'',x:90,z:305,text:'Timber wolves stalk the eastern approach. Defeat four and help our scouts return.'},
] as const;
export const SPELLS = [
  {id:'sunbolt',name:'Sunbolt',key:'1',icon:'✹',cost:0,cooldown:800,range:24,description:'25 damage · 24 m · free',color:'#ffe5a0'},
  {id:'mend',name:'Mending light',key:'2',icon:'✤',cost:25,cooldown:6000,range:0,description:'Restore 45 health · 25 mana',color:'#a0f0ba'},
  {id:'frost',name:'Frost lance',key:'3',icon:'❄',cost:15,cooldown:3500,range:28,description:'32 damage, 5 s slow · 15 mana',color:'#a1e6ff'},
  {id:'flame',name:'Fireburst',key:'4',icon:'♨',cost:30,cooldown:6000,range:22,description:'45 damage in 6 m · 30 mana',color:'#ff985d'},
  {id:'ward',name:'Stone ward',key:'5',icon:'⬡',cost:20,cooldown:15000,range:0,description:'Halve incoming damage for 8 s · 20 mana',color:'#e0cda0'},
  {id:'blink',name:'Windstep',key:'6',icon:'➶',cost:15,cooldown:8000,range:0,description:'Dash 12 m in facing direction · 15 mana',color:'#b4efdc'},
] as const;
export type SpellId=typeof SPELLS[number]['id'];
export function regionAt(x:number,z:number) {
  return REGIONS.reduce((best,r)=>Math.hypot(x-r.x,z-r.z)<Math.hypot(x-best.x,z-best.z)?r:best,REGIONS[0] as typeof REGIONS[number]);
}
export function segmentDistance(p:Point,a:Point,b:Point) {
  const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz || 1)));
  return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);
}
export function roadDistance(x:number,z:number) {
  return Math.min(...ROADS.flatMap(points=>points.slice(1).map((p,i)=>segmentDistance({x,z},points[i],p))));
}
export function riverX(z:number){return 115+Math.sin(z*.013)*22;}
