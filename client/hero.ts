import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader.js';
import type {AssetContainer,InstantiatedEntries} from '@babylonjs/core/assetContainer.js';
import type {AnimationGroup} from '@babylonjs/core/Animations/animationGroup.js';
import type {PBRMaterial} from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import {GLTFLoaderAnimationStartMode} from '@babylonjs/loaders/glTF/glTFFileLoader.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_specular.js';
import {Mesh,TransformNode,type Scene,type ShadowGenerator} from './babylon.js';

type Clip='Idle'|'Walk'|'Run'|'Cast'|'Ride';
type Model={entries:InstantiatedEntries;root:TransformNode;clips:Map<Clip,AnimationGroup>};
type Avatar={root:TransformNode;models:Model[];lod:number;clip:Clip;previous?:Clip;fade:number;castUntil:number;visible:boolean};

/** Shared geometry/materials; each player gets an independent deform rig. */
export function heroFactory(scene:Scene,shadows:ShadowGenerator){
  let containers:AssetContainer[]=[];
  let status:'loading'|'ready'|'error'='loading';
  const avatars=new Map<string,Avatar>();
  const ready=Promise.all(['hero.glb','hero-lod1.glb'].map(file=>LoadAssetContainerAsync(`/characters/hero/${file}`,scene,{
    pluginOptions:{gltf:{animationStartMode:GLTFLoaderAnimationStartMode.NONE}},
  }))).then(loaded=>{
    containers=loaded;
    for(const container of containers){
      for(const group of container.animationGroups)group.stop();
      if(!['Idle','Walk','Run','Cast','Ride'].every(name=>container.animationGroups.some(group=>group.name===name)))throw new Error('Character animation clips are missing.');
      for(const mesh of container.meshes){mesh.isPickable=false;mesh.receiveShadows=false;}
      for(const material of container.materials)if(material.getClassName()==='PBRMaterial'){
        const pbr=material as PBRMaterial;pbr.directIntensity=1.35;pbr.specularIntensity=.25;
      }
    }
    status='ready';
  }).catch(error=>{status='error';throw error;});

  function create(id:string){
    if(status!=='ready')throw new Error('Character assets are still loading.');
    const root=new TransformNode(id,scene);
    const models=containers.map((container,lod)=>{
      const modelRoot=new TransformNode(`${id}-detail-${lod}`,scene);modelRoot.parent=root;
      // The glTF loader converts Blender's -Y forward to Babylon's +Z.
      modelRoot.scaling.setAll(1.15);
      const entries=container.instantiateModelsToScene(name=>`${id}/${lod}/${name}`,false,{doNotInstantiate:true});
      for(const node of entries.rootNodes)node.parent=modelRoot;
      const clips=new Map<Clip,AnimationGroup>();
      for(const group of entries.animationGroups){group.stop();clips.set(group.name.split('/').at(-1) as Clip,group);}
      for(const mesh of modelRoot.getChildMeshes()){
        mesh.isPickable=false;mesh.receiveShadows=false;mesh.alwaysSelectAsActiveMesh=true;
        shadows.addShadowCaster(mesh as Mesh);
      }
      modelRoot.setEnabled(lod===0);
      return {entries,root:modelRoot,clips};
    });
    const avatar:Avatar={root,models,lod:0,clip:'Idle',fade:1,castUntil:0,visible:true};
    avatars.set(id,avatar);
    models[0].clips.get('Idle')!.start(true).setWeightForAllAnimatables(1);
    return root;
  }
  function update(id:string,speed:number,mounted:boolean,distance:number,own:boolean,dt:number){
    const avatar=avatars.get(id);if(!avatar)return;
    const visible=own || distance<120;
    // Hysteresis avoids flickering between models near the threshold.
    const lod=own?0:distance>(avatar.lod===0?26:22)?1:0;
    if(lod!==avatar.lod || visible!==avatar.visible){
      for(const model of avatar.models){for(const group of model.clips.values())group.stop();model.root.setEnabled(false);}
      avatar.lod=lod;avatar.visible=visible;avatar.previous=undefined;avatar.fade=1;
      avatar.models[lod].root.setEnabled(visible);
      if(visible)avatar.models[lod].clips.get(avatar.clip)!.start(true).setWeightForAllAnimatables(1);
    }
    if(!visible)return;
    const clip:Clip=mounted?'Ride':performance.now()<avatar.castUntil?'Cast':speed>.4?'Run':'Idle';
    const model=avatar.models[avatar.lod];
    if(clip!==avatar.clip){
      if(avatar.previous)model.clips.get(avatar.previous)?.stop();
      avatar.previous=avatar.clip;avatar.clip=clip;avatar.fade=0;
      model.clips.get(clip)!.start(clip!=='Cast',clip==='Run'?1.15:1).setWeightForAllAnimatables(0);
    }
    avatar.fade=Math.min(1,avatar.fade+dt/.16);
    model.clips.get(avatar.clip)!.setWeightForAllAnimatables(avatar.fade);
    if(avatar.previous){
      const previous=model.clips.get(avatar.previous)!;previous.setWeightForAllAnimatables(1-avatar.fade);
      if(avatar.fade===1){previous.stop();avatar.previous=undefined;}
    }
  }
  function cast(id:string){
    const avatar=avatars.get(id);if(!avatar)return;
    avatar.castUntil=performance.now()+780;
    if(avatar.clip==='Cast')avatar.models[avatar.lod].clips.get('Cast')!.restart();
  }
  function remove(id:string){
    const avatar=avatars.get(id);if(!avatar)return;
    for(const model of avatar.models){
      for(const mesh of model.root.getChildMeshes())shadows.removeShadowCaster(mesh as Mesh);
      model.entries.dispose();model.root.dispose();
    }
    avatar.root.dispose();avatars.delete(id);
  }
  return {ready,create,update,cast,remove,get status(){return status;},diagnostics:()=>[...avatars].map(([id,a])=>({id,lod:a.lod,clip:a.clip,visible:a.visible,skinnedMeshes:a.models[a.lod].root.getChildMeshes().filter(m=>m.skeleton).length}))};
}
