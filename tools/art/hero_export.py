"""Export selected, self-contained glTF assets and an isolated editable .blend."""
import bpy, json
from pathlib import Path
root=Path(HERO_ROOT)
scene=bpy.context.scene
rig=scene.objects['Hero rig'];hero=scene.objects['Hero'];lod=scene.objects['Hero LOD1']
output=root/'public'/'characters'/'hero';output.mkdir(parents=True,exist_ok=True)
rig.animation_data.action=None
for pb in rig.pose.bones:pb.rotation_quaternion=(1,0,0,0);pb.location=(0,0,0)
scene.frame_set(0)
for obj,filename in [(hero,'hero.glb'),(lod,'hero-lod1.glb')]:
    bpy.ops.object.select_all(action='DESELECT')
    obj.hide_set(False);obj.hide_render=False;obj.select_set(True);rig.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(output/filename),export_format='GLB',use_selection=True,use_active_scene=True,
        export_yup=True,export_skins=True,export_animations=True,export_animation_mode='ACTIONS',
        export_frame_range=False,export_frame_step=1,export_force_sampling=True,
        export_morph=False,export_cameras=False,export_lights=False,export_extras=False,
        export_draco_mesh_compression_enable=False,export_image_format='AUTO')
    if obj==lod:obj.hide_set(True);obj.hide_render=True
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(0)
for image in bpy.data.images:
    if image.name.startswith(('Hero palette','Original navy lavender plaid')) and not image.packed_file:image.pack()
source=root/'assets'/'characters'/'hero';source.mkdir(parents=True,exist_ok=True)
# Write only this scene and its dependencies, preserving any unrelated open scene.
render_path=scene.render.filepath
scene.render.filepath='//renders/hero.png'
bpy.data.libraries.write(str(source/'hero.blend'),{scene},path_remap='RELATIVE',fake_user=True,compress=True)
scene.render.filepath=render_path
stats={'format':'glTF 2.0','heightMeters':round(max(v.co.z for v in hero.data.vertices),3),'animationFps':60,
       'bones':len(rig.data.bones),'materials':2,'animations':['Idle','Walk','Run','Cast','Ride'],
       'lods':[{'file':f,'triangles':len(o.data.polygons),'bytes':(output/f).stat().st_size} for o,f in [(hero,'hero.glb'),(lod,'hero-lod1.glb')]]}
(output/'manifest.json').write_text(json.dumps(stats,indent=2)+'\n')
print(stats)
