import {ArcRotateCamera,Color3,Color4,DirectionalLight,Engine,HemisphericLight,Mesh,MeshBuilder,Scene,ShadowGenerator,StandardMaterial,TransformNode,Vector3,VertexBuffer,VertexData} from './babylon.js';
import {groundHeight,HOUSE_POSITIONS} from '../shared/world.js';

export function createWorld(canvas:HTMLCanvasElement) {
  const engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true});
  engine.setHardwareScalingLevel(Math.max(1,window.devicePixelRatio/1.5));
  const scene=new Scene(engine);
  scene.clearColor=new Color4(.68,.82,.83,1);
  scene.imageProcessingConfiguration.toneMappingEnabled=true;
  scene.fogMode=Scene.FOGMODE_LINEAR;scene.fogStart=48;scene.fogEnd=105;scene.fogColor=new Color3(.68,.82,.83);
  const camera=new ArcRotateCamera('camera',-Math.PI*.64,1.05,27,new Vector3(0,1,6),scene);
  camera.attachControl(canvas,true);
  camera.lowerRadiusLimit=9;camera.upperRadiusLimit=36;camera.lowerBetaLimit=.4;camera.upperBetaLimit=1.3;camera.wheelPrecision=25;camera.panningSensibility=0;camera.minZ=.2;
  const pointers=camera.inputs.attached.pointers as {buttons?:number[]};if(pointers) pointers.buttons=[2];
  camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
  const ambient=new HemisphericLight('sky',new Vector3(0,1,0),scene);ambient.intensity=.65;ambient.groundColor=new Color3(.28,.37,.26);
  const sun=new DirectionalLight('sun',new Vector3(-.5,-1,.4),scene);sun.position=new Vector3(25,45,-25);sun.intensity=.85;sun.diffuse=new Color3(1,.89,.7);
  const shadows=new ShadowGenerator(2048,sun);shadows.useBlurExponentialShadowMap=true;shadows.blurKernel=20;shadows.darkness=.25;
  shadows.bias=.001;shadows.normalBias=.03;
  const material=(name:string,color:string,emissive=false)=>{const m=new StandardMaterial(name,scene);m.diffuseColor=Color3.FromHexString(color).toLinearSpace();m.specularColor=Color3.Black();if(emissive)m.emissiveColor=m.diffuseColor.scale(.65);return m;};
  const grass=material('meadow','#8caa6e'),dirt=material('warm earth','#c9b48a'),bark=material('bark','#786343'),leaf=material('pine needles','#466e56'),leafLight=material('sunlit needles','#71916a'),stone=material('weathered stone','#9ba798'),cream=material('plaster','#efe0b9'),roof=material('terracotta','#a96549'),wood=material('dark timber','#645747'),gold=material('lantern light','#ffe0a0',true),crystalMat=material('heartstone','#9ee6d0',true),water=material('distant water','#739fad');
  const finish=(mesh:Mesh,mat:StandardMaterial,x:number,y:number,z:number,shadow=true)=>{mesh.material=mat;mesh.position.set(x,y,z);mesh.receiveShadows=true;if(shadow)shadows.addShadowCaster(mesh);return mesh;};
  const ground=MeshBuilder.CreateGround('meadow',{width:104,height:104,subdivisions:70,updatable:true},scene);
  const positions=ground.getVerticesData(VertexBuffer.PositionKind)!;
  for(let i=0;i<positions.length;i+=3)positions[i+1]=groundHeight(positions[i],positions[i+2]);
  ground.updateVerticesData(VertexBuffer.PositionKind,positions);
  const normals:number[]=[];VertexData.ComputeNormals(positions,ground.getIndices()!,normals);ground.updateVerticesData(VertexBuffer.NormalKind,normals);ground.material=grass;ground.receiveShadows=true;
  finish(MeshBuilder.CreateGround('horizon',{width:600,height:600},scene),water,0,-2.2,0,false);
  const disc=(name:string,x:number,z:number,r:number,mat:StandardMaterial)=>finish(MeshBuilder.CreateCylinder(name,{diameter:r*2,height:.05,tessellation:48},scene),mat,x,groundHeight(x,z)+.03,z,false);
  disc('village clearing',0,-2,12,dirt);
  const pathEdges=[-1,1].map(side=>Array.from({length:33},(_,i)=>{const z=7+i,x=Math.sin(z*.12)*1.4+side*2.1;return new Vector3(x,groundHeight(x,z)+.08,z);}));
  finish(MeshBuilder.CreateRibbon('forest path',{pathArray:pathEdges,sideOrientation:Mesh.DOUBLESIDE},scene),dirt,0,0,0,false);
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
  let seed=62;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<105;i++) {
    const x=(random()-.5)*94,z=(random()-.5)*94;
    if(Math.hypot(x,z)<18 || Math.abs(x)<6 && z>0 || Math.abs(x)<19 && z<5 && z>-17)continue;
    const size=.8+random()*.7,y=groundHeight(x,z);
    finish(MeshBuilder.CreateCylinder('pine trunk',{diameter:.55*size,height:3*size,tessellation:6},scene),bark,x,y+1.5*size,z);
    for(let tier=0;tier<3;tier++)finish(MeshBuilder.CreateCylinder('pine crown',{diameterBottom:(4.5-tier)*size,diameterTop:0,height:3.5*size,tessellation:7},scene),tier===2?leafLight:leaf,x,y+(3+tier*1.15)*size,z);
  }
  for(let i=0;i<80;i++) {
    const x=(random()-.5)*85,z=(random()-.5)*85;
    if(Math.abs(x)<4 || Math.hypot(x,z)<15)continue;
    const rock=finish(MeshBuilder.CreatePolyhedron('fieldstone',{type:1,size:.2+random()*.6},scene),stone,x,groundHeight(x,z)+.15,z);rock.scaling.y=.6;
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
    part('robe','cylinder',new Vector3(.85,1.05,.65),1,own?bodyMat:otherMat);
    part('belt','cylinder',new Vector3(.86,.13,.66),1.05,trim);
    part('head','sphere',new Vector3(.52,.6,.52),1.85,skin);
    part('hood','sphere',new Vector3(.65,.48,.58),2.07,own?bodyMat:otherMat,0,-.07);
    for(const side of [-1,1]) {part('boot','box',new Vector3(.25,.45,.4),.3,boots,side*.22);part('arm','cylinder',new Vector3(.22,.65,.23),1.25,own?bodyMat:otherMat,side*.52);}
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
  const targetRing=finish(MeshBuilder.CreateTorus('target ring',{diameter:2,thickness:.065,tessellation:40},scene),gold,0,.08,0,false);targetRing.setEnabled(false);
  const effects:{mesh:Mesh;life:number}[]=[];
  const flash=(at:Vector3,color:string)=>{const m=material('effect',color,true);const mesh=MeshBuilder.CreateSphere('spell',{diameter:.5,segments:8},scene);mesh.material=m;mesh.position.copyFrom(at);effects.push({mesh,life:1});};
  scene.onBeforeRenderObservable.add(()=>{
    const time=performance.now()/1000;heart.rotation.y=time*.2;heart.position.y=2.4+Math.sin(time)*.12;
    for(let i=effects.length-1;i>=0;i--) {const e=effects[i];e.life-=engine.getDeltaTime()/450;e.mesh.scaling.setAll(1+(1-e.life)*4);(e.mesh.material as StandardMaterial).alpha=Math.max(0,e.life);if(e.life<=0){e.mesh.material?.dispose();e.mesh.dispose();effects.splice(i,1);}}
  });
  window.addEventListener('resize',()=>engine.resize());
  return {engine,scene,camera,character,wisp,targetRing,flash};
}
