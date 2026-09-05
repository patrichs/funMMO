"""Consolidate materials, bind a deform rig, and author 60 fps animation clips."""
import bpy, math
import numpy as np
from math import sin, cos, pi
from mathutils import Euler, Quaternion, Vector
from pathlib import Path

scene=bpy.context.scene
parts=[o for o in scene.objects if o.type=='MESH']
# A small palette atlas collapses the solid-color surfaces into one draw call.
# The independently tiled plaid remains a second material.
materials=list(dict.fromkeys(m for o in parts for m in o.data.materials if 'Pleated plaid' not in m.name and 'Anime eyes' not in m.name))
width=512;cols=8;cell=width//cols
pixels=np.ones((width,width,4),dtype=np.float32)
for index,mat in enumerate(materials):
    x=(index%cols)*cell;y=(index//cols)*cell
    # Store display-encoded palette pixels; image sampling decodes sRGB to linear.
    rgba=list(mat.diffuse_color[:])
    rgba[:3]=[v*12.92 if v<=.0031308 else 1.055*v**(1/2.4)-.055 for v in rgba[:3]]
    pixels[y:y+cell,x:x+cell,:]=rgba
eye_mat=next(m for o in parts for m in o.data.materials if 'Anime eyes' in m.name)
eye_img=next(n.image for n in eye_mat.node_tree.nodes if n.type=='TEX_IMAGE')
eye_pixels=np.array(eye_img.pixels[:],dtype=np.float32).reshape(256,512,4)
pixels[256:,:,:]=eye_pixels
# Subtle painted cheeks on the continuous face surface.
skin_mat=next(m for m in materials if 'Skin' in m.name)
skin_rgb=np.array([v*12.92 if v<=.0031308 else 1.055*v**(1/2.4)-.055 for v in skin_mat.diffuse_color[:3]])
yy,xx=np.mgrid[0:64,0:256];fx=(xx/255-.5)*2;fz=yy/63
warm=np.exp(-((abs(fx)-.56)/.21)**2-((fz-.34)/.075)**2)*.27
pixels[192:256,0:256,:3]=skin_rgb[None,None,:]*(1-warm[:,:,None])+np.array((.96,.55,.51))[None,None,:]*warm[:,:,None]
atlas=bpy.data.images.new('Hero palette' ,width=width,height=width,alpha=True)
atlas.pixels.foreach_set(pixels.reshape(-1));atlas.pack()
palette=bpy.data.materials.new('Hero palette');palette.use_nodes=True
bsdf=palette.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value=.8;bsdf.inputs['Specular IOR Level'].default_value=.18
tex=palette.node_tree.nodes.new('ShaderNodeTexImage');tex.image=atlas
palette.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
for obj in parts:
    mat=obj.data.materials[0]
    if 'Pleated plaid' in mat.name:continue
    if 'Anime eyes' in mat.name:
        for loop in obj.data.uv_layers.active.data:loop.uv.y=.5+loop.uv.y*.5
        obj.data.materials.clear();obj.data.materials.append(palette)
        continue
    if obj.name.startswith('Face and cranium'):
        layer=obj.data.uv_layers.active or obj.data.uv_layers.new(name='UVMap')
        for poly in obj.data.polygons:
            for loop in poly.loop_indices:
                v=obj.data.vertices[obj.data.loops[loop].vertex_index].co
                layer.data[loop].uv=(max(.005,min(.495,(v.x/.26+.5)*.5)),.375+max(.005,min(.995,(v.z-1.486)/.283))*.125)
        obj.data.materials.clear();obj.data.materials.append(palette)
        continue
    index=materials.index(mat)
    uv=((index%cols+.5)/cols,(index//cols+.5)/cols)
    layer=obj.data.uv_layers.active or obj.data.uv_layers.new(name='UVMap')
    for loop in layer.data:loop.uv=uv
    obj.data.materials.clear();obj.data.materials.append(palette)

bpy.ops.object.select_all(action='DESELECT')
for obj in parts:obj.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.object.join()
hero=bpy.context.object;hero.name='Hero';hero.data.name='Hero geometry'
# Collapse redundant planar vertices while retaining the face and hair silhouette.
dec=hero.modifiers.new('Realtime triangle budget','DECIMATE');dec.ratio=.65
bpy.ops.object.modifier_apply(modifier=dec.name)
tri=hero.modifiers.new('Portable triangles','TRIANGULATE')
bpy.ops.object.modifier_apply(modifier=tri.name)

arm=bpy.data.armatures.new('Hero rig')
rig=bpy.data.objects.new('Hero rig',arm);scene.collection.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
def bone(name,head,tail,parent=None):
    b=arm.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=arm.edit_bones[parent]
    return b
bone('root',(0,0,0),(0,0,.18))
bone('hips',(0,0,.92),(0,0,1.08),'root')
bone('chest',(0,0,1.08),(0,.008,1.38),'hips')
bone('neck',(0,.008,1.38),(0,.01,1.49),'chest')
bone('head',(0,.01,1.49),(0,.01,1.76),'neck')
bone('hair_back',(0,.12,1.72),(0,.14,1.40),'head')
for s,suffix in [(1,'L'),(-1,'R')]:
    bone('hair_side.'+suffix,(s*.14,-.02,1.67),(s*.145,-.08,1.37),'head')
    bone('upper_arm.'+suffix,(s*.20,.008,1.34),(s*.324,-.002,1.15),'chest')
    bone('forearm.'+suffix,(s*.324,-.002,1.15),(s*.404,-.02,.952),'upper_arm.'+suffix)
    bone('hand.'+suffix,(s*.404,-.02,.952),(s*.43,-.024,.86),'forearm.'+suffix)
    bone('thigh.'+suffix,(s*.104,.006,.92),(s*.119,-.02,.53),'hips')
    bone('shin.'+suffix,(s*.119,-.02,.53),(s*.12,-.006,.135),'thigh.'+suffix)
    bone('foot.'+suffix,(s*.12,-.006,.135),(s*.12,-.115,.059),'shin.'+suffix)
    bone('skirt_front.'+suffix,(s*.104,.006,.92),(s*.14,-.09,.765),'hips')
    bone('skirt_back.'+suffix,(s*.104,.006,.92),(s*.14,.11,.765),'hips')
bpy.ops.object.mode_set(mode='OBJECT')
hero.parent=rig
modifier=hero.modifiers.new('Hero deformation','ARMATURE');modifier.object=rig
rig.show_in_front=True
rig.animation_data_create()
for pb in rig.pose.bones:pb.rotation_mode='QUATERNION'

def pose(name,x=0,y=0,z=0):
    b=rig.pose.bones[name];rest=b.bone.matrix_local.to_quaternion()
    b.rotation_quaternion=rest.inverted() @ Euler((x,y,z),'XYZ').to_quaternion() @ rest

clips=[('Idle',144),('Walk',72),('Run',42),('Cast',48),('Ride',120)]
for name,length in clips:
    action=bpy.data.actions.new(name);action.use_fake_user=True;action['funmmo_hero']=True
    rig.animation_data.action=action
    for frame in sorted(set(list(range(0,length+1,3))+[length])):
        scene.frame_set(frame);t=frame/length;phase=t*2*pi
        for pb in rig.pose.bones:pb.rotation_quaternion=Quaternion();pb.location=(0,0,0)
        pose('chest',.012*sin(phase))
        pose('head',0,.016*sin(phase),.022*sin(phase))
        pose('hair_back',.025*sin(phase+.7))
        for s,suffix in [(1,'L'),(-1,'R')]:
            pose('upper_arm.'+suffix,0,s*.22,0)
            pose('forearm.'+suffix,-.06,0,0)
            pose('hair_side.'+suffix,.016*sin(phase+s),0,.012*sin(phase+s))
        if name in ('Walk','Run'):
            running=name=='Run';amplitude=.62 if running else .32
            pose('chest',.065 if running else .018,0,.04*sin(phase))
            pose('head',-.04,0,-.03*sin(phase))
            rig.pose.bones['hips'].location.z=(.018 if running else .008)*(1-cos(phase*2))
            for s,suffix in [(1,'L'),(-1,'R')]:
                wave=sin(phase+(0 if s>0 else pi))
                pose('thigh.'+suffix,-amplitude*wave)
                pose('shin.'+suffix,max(0,-wave)*(.98 if running else .5))
                pose('foot.'+suffix,-max(0,-wave)*.30)
                pose('upper_arm.'+suffix,amplitude*.55*wave,s*.18)
                pose('forearm.'+suffix,-.44 if running else -.14)
                pose('skirt_front.'+suffix,-max(0,wave)*amplitude*.95)
                pose('skirt_back.'+suffix,max(0,-wave)*amplitude*.8)
                pose('hair_side.'+suffix,.06*sin(phase+.5),0,.035*sin(phase+s))
            pose('hair_back',.08+.05*sin(phase+.6))
        elif name=='Cast':
            reach=sin(pi*t)**1.2
            pose('chest',-.04*reach,0,-.12*reach)
            pose('upper_arm.R',-1.25*reach,-.15,0)
            pose('forearm.R',-.20-.32*reach)
            pose('hand.R',0,-.13*reach,0)
            pose('upper_arm.L',-.35*reach,.25,0)
            pose('forearm.L',-.50*reach)
            pose('head',.02*reach,0,.1*reach)
            pose('hair_back',-.06*sin(pi*t))
        elif name=='Ride':
            rig.pose.bones['hips'].location.z=.008*sin(phase*2)
            pose('chest',.05,0,.008*sin(phase))
            for s,suffix in [(1,'L'),(-1,'R')]:
                pose('thigh.'+suffix,-.75,-s*.52)
                pose('shin.'+suffix,.83,s*.42)
                pose('foot.'+suffix,-.15)
                pose('upper_arm.'+suffix,-.55,s*.15)
                pose('forearm.'+suffix,-.60)
                pose('skirt_front.'+suffix,-.85,-s*.30)
                skirt_bone=rig.pose.bones['skirt_front.'+suffix]
                skirt_bone.location=skirt_bone.bone.matrix_local.to_quaternion().inverted() @ Vector((0,-.025,.055))
                pose('skirt_back.'+suffix,.25,-s*.20)
        for pb in rig.pose.bones:
            pb.keyframe_insert('rotation_quaternion',frame=frame,group=pb.name)
            if pb.name=='hips' or pb.name.startswith('skirt_'):pb.keyframe_insert('location',frame=frame,group=pb.name)
    rig.animation_data.action=None
    track=rig.animation_data.nla_tracks.new();track.name=name
    strip=track.strips.new(name,0,action);strip.action_frame_start=0;strip.action_frame_end=length
    track.mute=True

rig.animation_data.action=bpy.data.actions['Idle']
scene.frame_start=0;scene.frame_end=144;scene.frame_set(0)
# A second geometric LOD shares the rig and the two materials.
lod=hero.copy();lod.data=hero.data.copy();scene.collection.objects.link(lod);lod.name='Hero LOD1'
bpy.ops.object.select_all(action='DESELECT');lod.select_set(True);bpy.context.view_layer.objects.active=lod
dec=lod.modifiers.new('Distance simplification','DECIMATE');dec.ratio=.25
bpy.ops.object.modifier_move_up(modifier=dec.name)
bpy.ops.object.modifier_apply(modifier=dec.name)
lod.data.validate(clean_customdata=True)
lod.hide_render=True;lod.hide_set(True)
hero.data.calc_loop_triangles();lod.data.calc_loop_triangles()
print({'triangles':len(hero.data.loop_triangles),'lod_triangles':len(lod.data.loop_triangles),'bones':len(arm.bones),'materials':len(hero.data.materials),'clips':[name for name,_ in clips]})
