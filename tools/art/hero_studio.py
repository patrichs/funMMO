"""Set up a neutral preview scene for inspecting the exported character."""
import bpy
from mathutils import Vector
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.render.resolution_x=1000
scene.render.resolution_y=1200
scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Hero studio world')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.27,.29,.35,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
for name,loc,energy,size in [('Hero Key',(-2,-3,4),150,3),('Hero Fill',(2,-1,2),60,2),('Hero Rim',(1,2,3),160,2)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj)
    obj.location=loc;obj.rotation_euler=(Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Hero portrait')
obj=bpy.data.objects.new('Hero portrait',data);scene.collection.objects.link(obj)
obj.location=(1.6,-5,2.0);obj.rotation_euler=(Vector((0,0,.94))-obj.location).to_track_quat('-Z','Y').to_euler()
data.type='ORTHO';data.ortho_scale=2.08;scene.camera=obj
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.render.filepath=str(Path(HERO_ROOT)/'artifacts'/'hero-studio.png')
