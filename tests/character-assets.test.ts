import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('character exports are bounded, self-contained, valid skinned meshes with all animation clips',()=>{
  for(const [file,budget] of [['hero.glb',55_000],['hero-lod1.glb',15_000]] as const){
    const bytes=fs.readFileSync(`public/characters/hero/${file}`);
    assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);
    assert.equal(bytes.readUInt32LE(8),bytes.length);assert(bytes.length<3_000_000);
    const jsonLength=bytes.readUInt32LE(12);
    const asset=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
    const binary=bytes.subarray(28+jsonLength);
    assert.equal(asset.buffers.length,1);assert.equal(asset.buffers[0].uri,undefined);
    for(const image of asset.images){assert.equal(image.uri,undefined);assert.equal(typeof image.bufferView,'number');}
    assert.equal(asset.materials.length,2);assert.equal(asset.skins.length,1);assert.equal(asset.skins[0].joints.length,24);
    assert.deepEqual(asset.animations.map((a:{name:string})=>a.name).sort(),['Cast','Idle','Ride','Run','Walk']);
    const components:Record<string,number>={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
    const widths:Record<number,number>={5121:1,5123:2,5125:4,5126:4};
    function values(index:number){
      const a=asset.accessors[index],v=asset.bufferViews[a.bufferView],n=components[a.type],width=widths[a.componentType];
      assert(n && width && !a.sparse);const out:number[][]=[];
      const offset=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??n*width;
      for(let i=0;i<a.count;i++){
        const row=[];
        for(let j=0;j<n;j++){
          const at=offset+i*stride+j*width;assert(at+width<=binary.length);
          const value=a.componentType===5126?binary.readFloatLE(at):width===4?binary.readUInt32LE(at):width===2?binary.readUInt16LE(at):binary.readUInt8(at);
          assert(Number.isFinite(value));row.push(value);
        }
        out.push(row);
      }
      return out;
    }
    let triangles=0;
    for(const mesh of asset.meshes)for(const primitive of mesh.primitives){
      const p=values(primitive.attributes.POSITION),weights=values(primitive.attributes.WEIGHTS_0),joints=values(primitive.attributes.JOINTS_0);
      assert.equal(p.length,weights.length);assert.equal(p.length,joints.length);
      for(const row of p)assert(row.every(v=>Math.abs(v)<3));
      for(const row of weights)assert(Math.abs(row.reduce((a,b)=>a+b,0)-1)<.001);
      for(const row of joints)assert(row.every(v=>v>=0 && v<24));
      const indices=values(primitive.indices).flat();assert.equal(indices.length%3,0);
      assert(indices.every(v=>v<p.length));triangles+=indices.length/3;
    }
    assert(triangles>10_000 && triangles<=budget);
    for(const animation of asset.animations){
      assert(animation.channels.length>=24);
      for(const sampler of animation.samplers){
        const times=values(sampler.input).flat();assert(times.length>=2);
        assert(times.at(-1)!>0 && times.at(-1)!<=2.5);
        assert(times.every((t,i)=>i===0 || t>times[i-1]));
      }
    }
  }
});
