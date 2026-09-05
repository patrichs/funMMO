import {ArcRotateCamera,Color3,Color4,DirectionalLight,Engine,HemisphericLight,Mesh,MeshBuilder,Scene,ShadowGenerator,StandardMaterial,TransformNode,Vector3,VertexBuffer,VertexData} from './babylon.js';
import {groundHeight,HOUSE_POSITIONS,WORLD_LIMIT} from '../shared/world.js';
import {REGIONS,ROADS,NPCS,RESOURCES,roadDistance,regionAt,riverX,MOB_TYPES,type MobKind} from '../shared/content.js';
import {heroFactory} from './hero.js';

export function createWorld(canvas:HTMLCanvasElement) {
  // Match the visible path and plaza surfaces so soles rest above their geometry.
  const surfaceHeight=(x:number,z:number)=>groundHeight(x,z)+(roadDistance(x,z)<3.2?.32:REGIONS.some(r=>Math.hypot(x-r.x,z-r.z)<11)?.075:.025);
  const engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true});
  engine.setHardwareScalingLevel(Math.max(1,window.devicePixelRatio/1.5));
  const scene=new Scene(engine);
  scene.clearColor=new Color4(.68,.82,.83,1);
  scene.imageProcessingConfiguration.toneMappingEnabled=true;
  scene.fogMode=Scene.FOGMODE_LINEAR;scene.fogStart=110;scene.fogEnd=235;scene.fogColor=new Color3(.68,.82,.83);
  const camera=new ArcRotateCamera('camera',-Math.PI*.64,1.15,48,new Vector3(0,1,0),scene);
  camera.attachControl(canvas,true);
  camera.lowerRadiusLimit=2.6;camera.upperRadiusLimit=65;camera.lowerBetaLimit=.4;camera.upperBetaLimit=1.55;camera.wheelPrecision=25;camera.panningSensibility=0;camera.minZ=.1;camera.maxZ=350;
  const pointers=camera.inputs.attached.pointers as {buttons?:number[]};if(pointers) pointers.buttons=[2];
  camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
  const ambient=new HemisphericLight('sky',new Vector3(0,1,0),scene);ambient.intensity=.65;ambient.groundColor=new Color3(.28,.37,.26);
  const sun=new DirectionalLight('sun',new Vector3(-.5,-1,.4),scene);sun.position=new Vector3(25,45,-25);sun.intensity=.85;sun.diffuse=new Color3(1,.89,.7);
  const shadows=new ShadowGenerator(1024,sun);shadows.useBlurExponentialShadowMap=true;shadows.blurKernel=20;shadows.darkness=.25;
  shadows.bias=.001;shadows.normalBias=.03;
  const heroes=heroFactory(scene,shadows);
  const material=(name:string,color:string,emissive=false)=>{const m=new StandardMaterial(name,scene);m.diffuseColor=Color3.FromHexString(color).toLinearSpace();m.specularColor=Color3.Black();if(emissive)m.emissiveColor=m.diffuseColor.scale(.65);return m;};
  const grass=material('meadow','#8caa6e'),dirt=material('warm earth','#c9b48a'),bark=material('bark','#786343'),leaf=material('pine needles','#466e56'),leafLight=material('sunlit needles','#71916a'),stone=material('weathered stone','#9ba798'),cream=material('plaster','#efe0b9'),roof=material('terracotta','#a96549'),wood=material('dark timber','#645747'),gold=material('lantern light','#ffe0a0',true),crystalMat=material('heartstone','#9ee6d0',true),water=material('distant water','#739fad');
  const finish=(mesh:Mesh,mat:StandardMaterial,x:number,y:number,z:number,shadow=true)=>{mesh.material=mat;mesh.position.set(x,y,z);mesh.receiveShadows=true;return mesh;};
  // 100 terrain tiles and batched decoration; only nearby chunks are enabled.
  const chunks:{x:number;z:number;meshes:Mesh[]}[]=[];
  const terrainMat=material('countryside','#ffffff');
  const terrainColors=REGIONS.map(r=>Color3.FromHexString(r.color).toLinearSpace());
  let seed=62;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let cx=-450;cx<=450;cx+=100)for(let cz=-450;cz<=450;cz+=100){
    const meshes:Mesh[]=[],batches=new Map<StandardMaterial,Mesh[]>();
    const ground=MeshBuilder.CreateGround('land',{width:100,height:100,subdivisions:20,updatable:true},scene);
    const positions=ground.getVerticesData(VertexBuffer.PositionKind)!;
    for(let i=0;i<positions.length;i+=3)positions[i+1]=groundHeight(positions[i]+cx,positions[i+2]+cz);
    ground.updateVerticesData(VertexBuffer.PositionKind,positions);
    const normals:number[]=[];VertexData.ComputeNormals(positions,ground.getIndices()!,normals);ground.updateVerticesData(VertexBuffer.NormalKind,normals);
    const colors:number[]=[];
    for(let i=0;i<positions.length;i+=3){
      const x=positions[i]+cx,z=positions[i+2]+cz,weights=REGIONS.map(r=>1/(1000+(x-r.x)**2+(z-r.z)**2)**2),total=weights.reduce((sum,w)=>sum+w,0);
      const color=terrainColors.reduce((c,v,i)=>c.add(v.scale(weights[i]/total)),Color3.Black());
      colors.push(color.r,color.g,color.b,1);
    }
    ground.setVerticesData(VertexBuffer.ColorKind,colors);
    ground.position.set(cx,0,cz);ground.material=terrainMat;ground.receiveShadows=true;meshes.push(ground);
    const batch=(mesh:Mesh,mat:StandardMaterial,x:number,y:number,z:number)=>{mesh.position.set(x,y,z);mesh.material=mat;mesh.isPickable=false;const list=batches.get(mat) ?? [];list.push(mesh);batches.set(mat,list);};
    for(let i=0;i<24;i++){
      const x=cx+(random()-.5)*100,z=cz+(random()-.5)*100;
      if(REGIONS.some(r=>Math.hypot(x-r.x,z-r.z)<30) || roadDistance(x,z)<7 || Math.abs(x-riverX(z))<9)continue;
      const y=groundHeight(x,z),size=1+random()*1.3;
      if(regionAt(x,z).id==='farm' && random()<.7)continue;
      batch(MeshBuilder.CreateCylinder('trunk',{diameter:.55*size,height:3*size,tessellation:5},scene),bark,x,y+1.5*size,z);
      if(random()<(cz>220?.2:.7)){
        for(let tier=0;tier<2;tier++){
          const crown=MeshBuilder.CreateSphere('oak canopy',{diameter:(5-tier)*size,segments:6},scene);crown.scaling.y=.8;
          batch(crown,tier?leafLight:leaf,x+(tier?.7:-.4)*size,y+(3.5+tier)*size,z);
        }
      }else for(let tier=0;tier<2;tier++)batch(MeshBuilder.CreateCylinder('pine crown',{diameterBottom:(4.5-tier)*size,diameterTop:0,height:4*size,tessellation:6},scene),tier?leafLight:leaf,x,y+(3+tier*1.7)*size,z);
    }
    for(let i=0;i<6;i++){
      const x=cx+(random()-.5)*100,z=cz+(random()-.5)*100;if(roadDistance(x,z)<6)continue;
      const rock=MeshBuilder.CreatePolyhedron('rock',{type:1,size:.4+random()*1.3},scene);rock.scaling.y=.65;batch(rock,stone,x,groundHeight(x,z)+.2,z);
    }
    for(const [mat,list] of batches){const merged=Mesh.MergeMeshes(list,true,true);if(merged){merged.material=mat;merged.isPickable=false;meshes.push(merged);}}
    for(const m of meshes)m.freezeWorldMatrix();chunks.push({x:cx,z:cz,meshes});
  }
  const disc=(name:string,x:number,z:number,r:number,mat:StandardMaterial)=>finish(MeshBuilder.CreateCylinder(name,{diameter:r*2,height:.05,tessellation:32},scene),mat,x,groundHeight(x,z)+.04,z,false);
  // Paths follow the same height surface as movement, with a continuous ribbon.
  for(const [index,road] of ROADS.entries()){
    const points:Vector3[][]=[[],[]];
    for(let n=1;n<road.length;n++){
      const a=road[n-1],b=road[n],length=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.ceil(length/2);
      for(let i=0;i<=steps;i++)for(let side=0;side<2;side++){
        const x=a.x+(b.x-a.x)*i/steps+(side?1:-1)*(b.z-a.z)/length*3,z=a.z+(b.z-a.z)*i/steps-(side?1:-1)*(b.x-a.x)/length*3;
        points[side].push(new Vector3(x,groundHeight(x,z)+.3,z));
      }
    }
    finish(MeshBuilder.CreateRibbon('road '+index,{pathArray:points,sideOrientation:Mesh.DOUBLESIDE},scene),dirt,0,0,0,false);
  }
  const riverEdges=[-1,1].map(side=>Array.from({length:251},(_,i)=>{const z=-500+i*4,x=riverX(z)+side*4;return new Vector3(x,groundHeight(x,z)+.16,z);}));
  finish(MeshBuilder.CreateRibbon('Willow brook',{pathArray:riverEdges,sideOrientation:Mesh.DOUBLESIDE},scene),water,0,0,0,false);
  // Road crossings form raised timber fords over the shallow stream.
  for(const road of ROADS)for(let i=1;i<road.length;i++){
    const a=road[i-1],b=road[i],steps=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z));
    for(let k=0;k<steps;k++){const x=a.x+(b.x-a.x)*k/steps,z=a.z+(b.z-a.z)*k/steps;
      if(Math.abs(x-riverX(z))<5){const plank=finish(MeshBuilder.CreateBox('ford plank',{width:6.3,height:.15,depth:1.1},scene),wood,x,groundHeight(x,z)+.22,z,false);plank.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);}
    }
  }
  for(const r of REGIONS)disc('settlement square',r.x,r.z,11,dirt);
  // A low-poly sanctuary anchors the village.
  const base=disc('sanctuary base',0,-7,2.7,stone);base.position.y+=.09;
  finish(MeshBuilder.CreateCylinder('plinth',{diameter:3.3,height:.8,tessellation:8},scene),stone,0,.45,-7);
  const heart=finish(MeshBuilder.CreatePolyhedron('heartstone',{type:1,size:1.15},scene),crystalMat,0,2.4,-7);
  heart.scaling.set(.75,1.5,.75);
  const ring=finish(MeshBuilder.CreateTorus('heartstone ring',{diameter:4,thickness:.09,tessellation:48},scene),gold,0,1.1,-7,false);
  ring.rotation.x=.15;
  for(const house of HOUSE_POSITIONS) {
    const {x,z}=house,y=groundHeight(x,z);
    finish(MeshBuilder.CreateBox('cottage wall',{width:5,height:3.5,depth:4.5},scene),cream,x,y+1.75,z);
    const roofMesh=finish(MeshBuilder.CreateCylinder('cottage roof',{diameterBottom:7.6,diameterTop:0,height:2.5,tessellation:4},scene),roof,x,y+4.3,z);roofMesh.rotation.y=Math.PI/4;roofMesh.scaling.z=.95;
    finish(MeshBuilder.CreateBox('door',{width:1.05,height:2,depth:.1},scene),wood,x,y+1,z+2.29);
    for(const offset of [-1.5,1.5]) {finish(MeshBuilder.CreateBox('window frame',{width:.95,height:1,depth:.14},scene),wood,x+offset,y+2,z+2.3);finish(MeshBuilder.CreateBox('window glow',{width:.7,height:.72,depth:.16},scene),gold,x+offset,y+2,z+2.31,false);}
    finish(MeshBuilder.CreateBox('chimney',{width:.65,height:2.5,depth:.7},scene),stone,x-1.6,y+4.5,z-.8);
    for(const off of [-2.45,2.45])finish(MeshBuilder.CreateBox('timber',{width:.18,height:3.5,depth:4.65},scene),wood,x+off,y+1.75,z);
  }
  // Farm plots, haystacks and fences give the western settlement a working landscape.
  const crop=material('golden wheat','#d6bc64');
  for(let field=0;field<3;field++){
    const x=-185+field*22,z=78;
    const rows=[-1,1].map(side=>Array.from({length:11},(_,i)=>new Vector3(x+side*8,groundHeight(x+side*8,z+i*2)+.12,z+i*2)));
    finish(MeshBuilder.CreateRibbon('tilled field',{pathArray:rows,sideOrientation:Mesh.DOUBLESIDE},scene),dirt,0,0,0,false);
    const stalks:Mesh[]=[];
    for(let row=0;row<7;row++)for(let col=0;col<8;col++){
      const px=x-7+row*2,pz=z+2+col*2,m=finish(MeshBuilder.CreateCylinder('wheat',{diameter:.4,height:.9,tessellation:4},scene),crop,px,groundHeight(px,pz)+.45,pz,false);stalks.push(m);
    }
    Mesh.MergeMeshes(stalks,true,true);
    finish(MeshBuilder.CreateSphere('haystack',{diameter:3,segments:6},scene),crop,x+8,groundHeight(x+8,z+22)+1,z+22);
  }
  for(const r of REGIONS.filter(r=>r.id==='watch' || r.id==='ruins' || r.id==='quarry')){
    const x=r.x,z=r.z-12,y=groundHeight(x,z);
    if(r.id==='quarry')for(let i=0;i<6;i++)finish(MeshBuilder.CreateBox('quarry cut',{width:9,height:2+i*.4,depth:5},scene),stone,x-18+i*7,groundHeight(x-18+i*7,z-22)+1,z-22);
    else {
      finish(MeshBuilder.CreateCylinder('stone tower',{diameter:7,height:r.id==='watch'?13:8,tessellation:8},scene),stone,x,y+(r.id==='watch'?6.5:4),z);
      for(let i=0;i<8;i++){const angle=i*Math.PI/4;finish(MeshBuilder.CreateBox('battlement',{size:1.25},scene),stone,x+Math.sin(angle)*3,y+(r.id==='watch'?13:8),z+Math.cos(angle)*3);}
      if(r.id==='ruins')for(const side of [-1,1])for(let i=0;i<4;i++)finish(MeshBuilder.CreateCylinder('abbey column',{height:3+i%2*2,diameter:1.1,tessellation:8},scene),stone,x+side*10,groundHeight(x+side*10,z-i*6)+1.5+i%2,z-i*6);
    }
  }
  for(const z of [8,15,25])for(const side of [-1,1]) {
    const x=side*4,y=groundHeight(x,z);
    finish(MeshBuilder.CreateCylinder('lantern post',{height:2.4,diameter:.13,tessellation:6},scene),wood,x,y+1.2,z);
    finish(MeshBuilder.CreateBox('lantern',{size:.38},scene),gold,x,y+2.4,z,false);
    finish(MeshBuilder.CreateCylinder('lantern cap',{diameterBottom:.7,diameterTop:0,height:.35,tessellation:4},scene),wood,x,y+2.7,z);
  }
  const fenceMat=wood;
  for(const side of [-1,1])for(let i=0;i<4;i++) {
    const x=side*(5+i*2),z=7;
    finish(MeshBuilder.CreateBox('fence post',{width:.16,height:1.1,depth:.16},scene),fenceMat,x,.55,z);
    if(i<3)finish(MeshBuilder.CreateBox('fence rail',{width:2,height:.12,depth:.12},scene),fenceMat,x+side,.7,z);
  }
  const bodyMat=material('warden coat','#3c6466'),skin=material('skin','#e0bd8b'),boots=material('leather','#495149'),trim=material('robe trim','#dac17e');
  const otherMat=material('traveling coat','#805c70'),wispMat=material('wisp light','#c4dda6',true),wispCore=material('wisp core','#eff4b5',true);
  function character(id:string,own:boolean) {
    const root=new TransformNode(id,scene);
    const part=(name:string,shape:'sphere'|'box'|'cylinder',size:Vector3,y:number,mat:StandardMaterial,x=0,z=0)=>{
      const m=shape==='sphere'?MeshBuilder.CreateSphere(name,{diameter:1,segments:8},scene):shape==='box'?MeshBuilder.CreateBox(name,{size:1},scene):MeshBuilder.CreateCylinder(name,{height:1,diameterTop:.8,diameterBottom:1,tessellation:8},scene);
      m.scaling.copyFrom(size);m.position.set(x,y,z);m.parent=root;m.material=mat;shadows.addShadowCaster(m);return m;
    };
    part('robe','cylinder',new Vector3(.72,.7,.52),1.25,own?bodyMat:otherMat);
    part('belt','cylinder',new Vector3(.73,.12,.54),1.05,trim);
    part('head','sphere',new Vector3(.52,.6,.52),1.85,skin);
    part('hair','sphere',new Vector3(.57,.26,.54),2.09,wood,0,-.04);
    part('nose','box',new Vector3(.12,.13,.14),1.85,skin,0,.28);
    for(const side of [-1,1]){part('eye','sphere',new Vector3(.055,.055,.035),1.95,boots,side*.12,.25);part('hand','sphere',new Vector3(.2,.22,.2),.86,skin,side*.52);}
    for(const side of [-1,1]) {part('leg','cylinder',new Vector3(.24,.7,.25),.58,boots,side*.2);part('boot','box',new Vector3(.26,.2,.4),.12,boots,side*.2);part('arm','cylinder',new Vector3(.22,.65,.23),1.25,own?bodyMat:otherMat,side*.52);}
    part('staff','cylinder',new Vector3(.08,2,.08),1.25,wood,.7,.08);
    part('staff light','sphere',new Vector3(.22,.3,.22),2.3,gold,.7,.08);
    return root;
  }
  function wisp(id:string) {
    const root=new TransformNode(id,scene);
    const shell=MeshBuilder.CreatePolyhedron('wisp shell',{type:1,size:.55},scene);shell.parent=root;shell.material=wispMat;shell.position.y=1.25;shell.metadata={target:id};
    const core=MeshBuilder.CreateSphere('wisp core',{diameter:.55,segments:8},scene);core.parent=root;core.position.y=1.35;core.material=wispCore;core.metadata={target:id};
    for(const side of [-1,1]) {const ear=MeshBuilder.CreatePolyhedron('wisp fin',{type:1,size:.24},scene);ear.scaling.set(1.6,.5,.7);ear.parent=root;ear.position.set(side*.65,1.5,0);ear.material=wispMat;ear.metadata={target:id};}
    return root;
  }
  function enemy(id:string,kind:MobKind){
    if(kind==='wisp')return wisp(id);
    if(kind==='bandit' || kind==='skeleton'){
      const root=character(id,false),mat=material(kind+' armor',MOB_TYPES[kind].color);
      for(const m of root.getChildMeshes()){m.metadata={target:id};if(['robe','hood','head','hair'].includes(m.name))m.material=mat;}
      return root;
    }
    const root=new TransformNode(id,scene),mat=material(kind+' hide',MOB_TYPES[kind].color);
    const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number)=>{const m=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);m.material=mat;m.parent=root;m.position.set(x,y,z);m.metadata={target:id};return m;};
    if(kind==='guardian'){
      box('stone torso',1.8,2,1,0,2,0);box('stone head',1,1,1,0,3.5,0);
      for(const side of [-1,1]){box('stone leg',.55,1.2,.7,side*.55,.6,0);box('stone arm',.55,1.7,.65,side*1.2,2,0);}
    }else{
      box('body',kind==='boar'?1.1:.7,.85,1.7,0,.9,0);box('head',.65,.6,.8,0,1.25,1);
      for(const side of [-1,1]){box('ear',.18,.35,.25,side*.25,1.65,1);for(const z of [-.6,.6])box('leg',.2,.65,.25,side*.36,.35,z);}
      box('tail',.15,.18,.7,0,1,-1.05);
    }
    return root;
  }
  function horse(id:string){
    const root=new TransformNode(id+' mount',scene),mat=material('chestnut','#986b48');
    const part=(w:number,h:number,d:number,x:number,y:number,z:number)=>{const m=MeshBuilder.CreateBox('horse',{width:w,height:h,depth:d},scene);m.parent=root;m.material=mat;m.position.set(x,y,z);};
    part(.56,.9,1.9,0,1.1,0);part(.5,1,.55,0,1.75,.8);part(.5,.45,.85,0,2.1,1);
    for(const side of [-1,1])for(const z of [-.65,.65])part(.18,.85,.2,side*.23,.43,z);
    return root;
  }
  const npcViews=NPCS.map(n=>{const root=character('npc-'+n.id,false);root.position.set(n.x,groundHeight(n.x,n.z),n.z);for(const m of root.getChildMeshes()){m.metadata={npc:n.id};shadows.removeShadowCaster(m as Mesh);}return {data:n,root};});
  for(const r of RESOURCES){const m=finish(MeshBuilder.CreatePolyhedron(r.name,{type:1,size:.5},scene),r.kind==='grain'?crop:crystalMat,r.x,groundHeight(r.x,r.z)+.55,r.z,false);m.metadata={resource:r.id};}
  let lastCull=0;
  function updateLandscape(x:number,z:number){
    if(performance.now()-lastCull<350)return;lastCull=performance.now();
    for(const chunk of chunks){const visible=Math.hypot(chunk.x-x,chunk.z-z)<260;for(const m of chunk.meshes)m.setEnabled(visible);}
    sun.position.set(x+25,groundHeight(x,z)+45,z-25);
  }
  updateLandscape(0,0);
  const targetRing=finish(MeshBuilder.CreateTorus('target ring',{diameter:2,thickness:.065,tessellation:40},scene),gold,0,.08,0,false);targetRing.setEnabled(false);
  const effects:{mesh:Mesh;life:number}[]=[];
  const flash=(at:Vector3,color:string)=>{const m=material('effect',color,true);const mesh=MeshBuilder.CreateSphere('spell',{diameter:.5,segments:8},scene);mesh.material=m;mesh.position.copyFrom(at);effects.push({mesh,life:1});};
  scene.onBeforeRenderObservable.add(()=>{
    const time=performance.now()/1000;heart.rotation.y=time*.2;heart.position.y=2.4+Math.sin(time)*.12;
    for(let i=effects.length-1;i>=0;i--) {const e=effects[i];e.life-=engine.getDeltaTime()/450;e.mesh.scaling.setAll(1+(1-e.life)*4);(e.mesh.material as StandardMaterial).alpha=Math.max(0,e.life);if(e.life<=0){e.mesh.material?.dispose();e.mesh.dispose();effects.splice(i,1);}}
  });
  window.addEventListener('resize',()=>engine.resize());
  return {engine,scene,camera,heroes,character,enemy,horse,npcViews,targetRing,flash,updateLandscape,surfaceHeight};
}
