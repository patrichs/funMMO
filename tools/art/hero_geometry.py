"""Build the original hero in Blender. Run through Blender's Python console/MCP.

Set HERO_ROOT to the repository root before executing. No downloads or packages.
Geometry faces -Y; Z is up; dimensions are meters. See docs/CHARACTER.md.
"""
import bpy
import math
from math import sin, cos, pi, exp
from mathutils import Vector
from pathlib import Path

ROOT = Path(HERO_ROOT)
scene = bpy.context.scene
if scene.name != 'funMMO Hero':
    scene = bpy.data.scenes.get('funMMO Hero') or bpy.data.scenes.new('funMMO Hero')
    bpy.context.window.scene = scene
for obj in list(scene.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
for action in list(bpy.data.actions):
    if action.get('funmmo_hero'):
        bpy.data.actions.remove(action)
scene.render.fps = 60
scene.render.fps_base = 1
scene.unit_settings.system = 'METRIC'
parts = []

def material(name, hex_color, roughness=.8):
    m = bpy.data.materials.new('Hero ' + name)
    m.use_nodes = True
    rgb = [int(hex_color[i:i+2], 16)/255 for i in (0, 2, 4)]
    linear = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m.diffuse_color = (*linear, 1)
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*linear, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Specular IOR Level'].default_value = .22
    return m

skin = material('Skin', 'F4C5AB')
blush = material('Warm cheek', 'EFAF9B')
lip = material('Lip', 'BC7975')
line = material('Lashes and seams', '493843')
hair = material('Golden blonde', 'EAC387', .55)
hair_light = material('Hair light', 'F8DBA5', .6)
hair_shadow = material('Hair lowlight', 'B9915D', .8)
hoodie = material('Lavender cotton', 'B8ABDC')
rib = material('Ribbed lavender', 'A79ACD')
seam = material('Lavender seams', '8C80B2')
cord = material('Drawstrings', 'DCD2EF')
navy = material('Navy cloth', '282B43')
white = material('Sneaker leather', 'F3EEF2')
sole = material('Rubber sole', 'D6D1DE')
eye_white = material('Eye white', 'FFF7ED', .5)
iris = material('Blue iris', '4293C5', .4)
iris_dark = material('Iris rim', '245073')
iris_light = material('Iris light', '92CDEA')
pupil = material('Pupil', '172D46')

def mesh(name, vertices, faces, mat, bone=None, uvs=None, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    data.materials.append(mat)
    for poly in data.polygons:
        poly.use_smooth = smooth
    if uvs:
        uv = data.uv_layers.new(name='UVMap')
        for poly in data.polygons:
            for loop in poly.loop_indices:
                uv.data[loop].uv = uvs[data.loops[loop].vertex_index]
    if bone:
        obj.vertex_groups.new(name=bone).add(list(range(len(vertices))), 1, 'REPLACE')
    parts.append(obj)
    return obj

def tube(name, centers, widths, depths, mat, bone=None, sides=20, caps=True, ripple=0):
    """Elliptical swept surface, local section X horizontal, second axis sideways."""
    vertices, faces, uvs = [], [], []
    centers = [Vector(p) for p in centers]
    for j, c in enumerate(centers):
        tangent = (centers[min(j+1,len(centers)-1)]-centers[max(0,j-1)]).normalized()
        axis = Vector((1,0,0))
        if abs(tangent.dot(axis))>.95: axis=Vector((0,1,0))
        u=(axis-tangent*axis.dot(tangent)).normalized()
        v=tangent.cross(u).normalized()
        for i in range(sides+1):
            a=2*pi*i/sides
            r=1+ripple*sin(a*6+j*1.7)*sin(pi*j/(len(centers)-1))
            vertices.append(c+u*cos(a)*widths[j]*r+v*sin(a)*depths[j]*r)
            uvs.append((i/sides,j/(len(centers)-1)))
            if j and i:
                k=j*(sides+1)+i
                faces.append((k-sides-2,k-sides-1,k,k-1))
    if caps:
        faces.append(tuple(range(sides-1,-1,-1)))
        start=(len(centers)-1)*(sides+1)
        faces.append(tuple(start+i for i in range(sides)))
    return mesh(name, vertices, faces, mat, bone, uvs)

def path(name, points, radius, mat, bone=None, sides=6):
    return tube(name,points,[radius]*len(points),[radius]*len(points),mat,bone,sides)

def ellipsoid(name, center, scale, mat, bone=None, segments=24, rings=12):
    verts, faces=[],[]
    for j in range(rings+1):
        a=pi*j/rings
        for i in range(segments):
            b=2*pi*i/segments
            verts.append((center[0]+scale[0]*sin(a)*cos(b),center[1]+scale[1]*sin(a)*sin(b),center[2]+scale[2]*cos(a)))
            if j:
                k=j*segments+i
                n=j*segments+(i+1)%segments
                faces.append((k-segments,n-segments,n,k))
    return mesh(name,verts,faces,mat,bone)

# Sculpted head surface: jaw taper, broad eye plane, cheek and integrated nose.
head_rings=[(1.486,.018,.035,-.034),(1.501,.052,.064,-.026),(1.525,.085,.085,-.012),
            (1.557,.111,.101,0),(1.59,.126,.110,.004),(1.626,.135,.116,.006),
            (1.665,.138,.118,.008),(1.705,.136,.118,.012),(1.749,.125,.110,.016),
            (1.79,.097,.089,.02),(1.818,.045,.05,.02),(1.825,.002,.003,.02)]
verts,faces=[],[]
for j,(z,rx,ry,cy) in enumerate(head_rings):
    for i in range(64):
        a=2*pi*i/64
        x=rx*sin(a)
        c=cos(a)
        y=cy-ry*(c**.42 if c>0 else c)
        if c>0:
            y-=.018*exp(-(x/.018)**2-((z-1.591)/.032)**2)
        verts.append((x,y,z))
        if j:
            k=j*64+i;n=j*64+(i+1)%64
            faces.append((k-64,n-64,n,k))
head=mesh('Face and cranium',verts,faces,skin,'head')
sub=head.modifiers.new('Silhouette polish','SUBSURF');sub.levels=1
bpy.context.view_layer.objects.active=head;head.select_set(True)
bpy.ops.object.modifier_apply(modifier=sub.name);head.select_set(False)

tube('Neck',[(0,.02,1.35),(0,.016,1.41),(0,.012,1.47),(0,.005,1.52)], [.063,.06,.053,.059],[.057,.052,.05,.055],skin,'neck',24)
for s in [-1,1]:
    ellipsoid('Ear', (s*.136,.012,1.617),(.024,.023,.041),skin,'head',20,12)
    ellipsoid('Ear hollow',(s*.15,-.006,1.619),(.008,.008,.024),blush,'head',16,8)

def face_y(x,z):
    return -.115 + .012*(abs(x)/.125)**2 + .015*((z-1.64)/.14)**2

def eye_patch(name,s,w,h,mat,offset=0,zcenter=1.652,xcenter=.057,segments=40):
    """Convex almond, lifted outer corner, smoothly domed eye surface."""
    verts=[(s*xcenter,face_y(s*xcenter,zcenter)-.005-offset,zcenter)]
    faces=[]
    for j in range(1,6):
        r=j/5
        for i in range(segments):
            a=2*pi*i/segments
            dx=w*cos(a)*r
            dz=h*sin(a)*(abs(sin(a))**.16)*r+dx*.15
            x=s*(xcenter+dx);z=zcenter+dz
            verts.append((x,face_y(x,z)-.004*(1-r*r)-offset,z))
            k=1+(j-1)*segments+i;n=1+(j-1)*segments+(i+1)%segments
            if j==1:faces.append((0,k,n))
            else:faces.append((k-segments,k,n,n-segments))
    obj=mesh(name,verts,faces,mat,'head')
    # Both sides use the same surface winding despite mirrored coordinates.
    if s<0:
        for poly in obj.data.polygons: poly.flip()
    return obj

# A single curved eye surface clips the iris naturally at the eyelids.
import numpy as np
eyew,eyeh=512,256
ey,ex=np.mgrid[0:eyeh,0:eyew];u=(ex+.5)/eyew;v=(ey+.5)/eyeh
rgba=np.ones((eyeh,eyew,4),dtype=np.float32);rgba[:,:,:3]=(.995,.968,.929)
r=np.sqrt(((u-.5)/.205)**2+((v-.5)/.88)**2)
angle=np.arctan2((v-.5)/.88,(u-.5)/.205)
blue=np.stack([.17+.23*(1-v),.37+.36*(1-v),.57+.31*(1-v)],axis=2)
blue*=1+(.06*np.sin(angle*32)+.035*np.sin(angle*57))[:,:,None]
rgba[:,:,:3][r<1]=blue[r<1]
rgba[:,:,:3][(r>.87)&(r<1)]=(.09,.19,.30)
pupilmask=((u-.5)/.070)**2+((v-.59)/.50)**2<1
rgba[:,:,:3][pupilmask]=(.06,.12,.21)
for cx,cy,rx,ry in [(.435,.77,.041,.103),(.575,.30,.025,.060)]:
    rgba[:,:,:3][((u-cx)/rx)**2+((v-cy)/ry)**2<1]=(.99,.99,1)
eyeimage=bpy.data.images.new('Hero painted eyes',width=eyew,height=eyeh,alpha=True)
eyeimage.pixels.foreach_set(rgba.reshape(-1));eyeimage.pack()
eyemat=material('Anime eyes','FFFFFF',.7)
tex=eyemat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=eyeimage
eyemat.node_tree.links.new(tex.outputs['Color'],eyemat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

for s in [-1,1]:
    # Upper lashes supply the eyeliner without a heavy lower ring.
    eye=eye_patch('Almond eye',s,.041,.016,eyemat,.0025)
    layer=eye.data.uv_layers.new(name='UVMap')
    for poly in eye.data.polygons:
        for loop in poly.loop_indices:
            p=eye.data.vertices[eye.data.loops[loop].vertex_index].co
            dx=s*p.x-.057
            layer.data[loop].uv=(.5+dx/.082,.5+(p.z-1.652-dx*.15)/.032)
    x=s*.056;z=1.652;y=face_y(x,z)-.007
    # Swept upper lash curve and two outer flicks.
    pts=[]
    for i in range(17):
        a=pi*i/16;dx=.041*cos(a);zz=z+.0165*sin(a)+dx*.15
        xx=s*(.057+dx);pts.append((xx,face_y(xx,zz)-.002,zz))
    path('Upper lashes',pts,.0018,line,'head')
    for n in range(2):
        xx=s*(.094-n*.006);zz=1.661+n*.005
        path('Lash flick',[(xx,face_y(xx,zz)-.002,zz),(xx+s*.01,-.108,zz+.004+n*.002)],.0016,line,'head')
    pts=[]
    for i in range(13):
        t=i/12;xx=s*(.023+t*.073);zz=1.689+.009*sin(t*pi)+t*.001
        pts.append((xx,face_y(xx,zz)+.001,zz))
    path('Soft blonde brow',pts,.0031,hair_shadow,'head')
    # Small warm cheeks lie just on the face.
    # Warm blush is baked into the face's surface palette during export.
path('Smile',[(x,-.108+.012*(x/.024)**2,1.549+.003*(x/.024)**2) for x in [-.024,-.018,-.009,0,.009,.018,.024]],.0014,lip,'head')
path('Lower lip light',[(-.012,-.109,1.544),(0,-.112,1.542),(.011,-.109,1.544)],.0011,blush,'head')
ellipsoid('Nose tip',(0,-.129,1.589),(.008,.007,.009),skin,'head',20,10)

# Oversized hoodie, with controlled low amplitude folds rather than dense cloth sim.
zs=[.945,.958,.99,1.035,1.09,1.16,1.23,1.29,1.34,1.375,1.393,1.405]
rx=[.19,.212,.222,.227,.218,.222,.237,.253,.24,.205,.119,.071]
ry=[.117,.126,.133,.137,.131,.137,.146,.139,.129,.102,.072,.062]
body=tube('Hoodie body',[(0,.01,z) for z in zs],rx,ry,hoodie,None,48,ripple=.022)
for v in body.data.vertices:
    z=v.co.z;w=max(0,min(1,(z-1.07)/.28))
    for bone,weight in [('hips',1-w),('chest',w)]:
        if weight>0:(body.vertex_groups.get(bone) or body.vertex_groups.new(name=bone)).add([v.index],weight,'REPLACE')
tube('Ribbed hem',[(0,.008,.923),(0,.008,.928),(0,.008,.952),(0,.008,.962)],[.192,.199,.202,.203],[.116,.12,.123,.124],rib,'hips',48,ripple=.008)
for i in range(88):
    a=2*pi*i/88
    path('Hem knit',[(.200*cos(a),.008+.121*sin(a),.927),(.204*cos(a),.008+.125*sin(a),.957)],.00065,seam,'hips',4)

# Hood drapes down the back. Opening is a rolled ellipse around the neckline.
verts,faces=[],[]
for j in range(13):
    t=j/12
    for i in range(33):
        a=pi*i/32
        x=cos(a)*(.119+.055*sin(t*pi))
        y=.036+sin(a)*(.095+.098*sin(t*pi/2))
        z=1.411-t*.22+abs(cos(a))*.025
        verts.append((x,y,z))
        if j and i:
            k=j*33+i;faces.append((k-34,k-33,k,k-1))
hood=mesh('Folded hood',verts,faces,hoodie,'chest')
sol=hood.modifiers.new('Hood thickness','SOLIDIFY');sol.thickness=.006
bpy.context.view_layer.objects.active=hood;hood.select_set(True);bpy.ops.object.modifier_apply(modifier=sol.name);hood.select_set(False)
path('Hood outer seam',[(cos(a)*.119,.036+sin(a)*.193,1.191+abs(cos(a))*.025) for a in [pi*i/40 for i in range(41)]],.003,seam,'chest')
path('Neckline roll',[(.11*cos(a),.022+.078*sin(a),1.396+.021*sin(a)) for a in [2*pi*i/48 for i in range(49)]],.011,hoodie,'chest',8)

# Kangaroo pocket has its own draped surface and stitched side openings.
outline=[(-.14,1.015),(-.151,1.03),(-.112,1.115),(.112,1.115),(.151,1.03),(.14,1.015)]
def pocket_y(x,z):
    return .01-.135*math.sqrt(max(.05,1-(x/.225)**2))-.004
pv=[];pf=[]
for j in range(9):
    t=j/8;z=1.015+t*.100;w=.142-.03*t
    for i in range(17):
        x=(i/8-1)*w
        pv.append((x,pocket_y(x,z)-.002*sin(i*pi/16)*sin(t*pi),z))
        if j and i:
            k=j*17+i;pf.append((k-18,k-17,k,k-1))
mesh('Kangaroo pocket',pv,pf,hoodie,'chest')
path('Pocket stitching',[(x,pocket_y(x,z)-.001,z) for x,z in outline+[outline[0]]],.0009,seam,'chest')
for s in [-1,1]:
    path('Pocket opening',[(s*x,pocket_y(x,z)-.001,z) for x,z in [(.12,1.095),(.135,1.061),(.146,1.033)]],.0022,seam,'chest')
    path('Drawstring',[(s*.046,-.060,1.401),(s*.048,-.136,1.343),(s*.049,-.142,1.27),(s*.055,-.143,1.232)],.003,cord,'chest',8)
    tube('Drawstring tip',[(s*.055,-.143,1.231),(s*.055,-.143,1.214)],[.0037,.0037],[.0037,.0037],sole,'chest',8)
    # A pose, wrist .42 m from center; ample clearance for skinning.
    centers=[(s*.165,.008,1.327),(s*.215,.008,1.333),(s*.265,.005,1.29),(s*.295,0,1.22),
             (s*.324,-.002,1.15),(s*.351,-.004,1.08),(s*.379,-.007,1.022),(s*.39,-.01,.992),(s*.395,-.014,.974)]
    widths=[.066,.082,.087,.084,.082,.085,.09,.077,.051]
    sleeve=tube('Oversized sleeve',centers,widths,[w*.95 for w in widths],hoodie,None,28,ripple=.048)
    suffix='L' if s>0 else 'R'
    for v in sleeve.data.vertices:
        w=max(0,min(1,(1.24-v.co.z)/.10))
        for bone,weight in [('upper_arm.'+suffix,1-w),('forearm.'+suffix,w)]:
            if weight>0:(sleeve.vertex_groups.get(bone) or sleeve.vertex_groups.new(name=bone)).add([v.index],weight,'REPLACE')
    cuff=tube('Wrist cuff',[(s*.395,-.014,.986),(s*.400,-.017,.969),(s*.409,-.02,.943)],[.053,.050,.047],[.048,.045,.041],rib,'forearm.'+suffix,28)
    for i in range(28):
        a=2*pi*i/28
        path('Cuff knit',[(s*.400+.050*cos(a),-.017+.046*sin(a),.972),(s*.408+.044*cos(a),-.02+.039*sin(a),.951)],.0007,seam,'forearm.'+suffix,4)
    palm=ellipsoid('Palm',(s*.424,-.02,.915),(.03,.020,.042),skin,'hand.'+suffix,20,12)
    for n in range(4):
        xx=s*(.407+n*.014);base=.897+(.006 if n==3 else 0)
        length=[.044,.053,.049,.037][n]
        tube('Finger',[(xx,-.023,base),(xx+s*.003,-.025,base-length*.5),(xx+s*.005,-.026,base-length),(xx+s*.005,-.026,base-length-.003)], [.007,.0067,.0055,.0015],[.007,.0067,.0055,.0015],skin,'hand.'+suffix,8)
    tube('Thumb',[(s*.407,-.019,.93),(s*.39,-.029,.907),(s*.385,-.034,.89),(s*.386,-.034,.885)],[.011,.01,.008,.002],[.01,.009,.008,.002],skin,'hand.'+suffix,10)

# A seamless woven plaid image, generated as a design texture inside Blender.
import numpy as np
size=512
yy,xx=np.mgrid[0:size,0:size]/size
col=np.empty((size,size,4),dtype=np.float32);col[:,:,:3]=(.065,.070,.14);col[:,:,3]=1
for axis in [xx,yy]:
    for c,w,rgb in [(.26,.105,(.23,.19,.37)),(.72,.035,(.36,.30,.49)),(.38,.010,(.54,.47,.66)),(.17,.007,(.46,.39,.59))]:
        mask=np.abs(axis-c)<w
        col[:,:,:3][mask]=col[:,:,:3][mask]*.32+np.array(rgb)*.68
weave=1+.045*np.sin(xx*size*pi)*np.sin(yy*size*pi)
col[:,:,:3]*=weave[:,:,None]
img=bpy.data.images.new('Original navy lavender plaid',width=size,height=size,alpha=True)
img.pixels.foreach_set(col.reshape(-1));img.pack()
plaid=material('Pleated plaid','FFFFFF')
tex=plaid.node_tree.nodes.new('ShaderNodeTexImage');tex.image=img
plaid.node_tree.links.new(tex.outputs['Color'],plaid.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
verts,faces,uvs=[],[],[]
sections=120
for j in range(7):
    t=j/6
    for i in range(sections+1):
        a=2*pi*i/sections
        fold=[0,.006,.007,-.009,-.01,0][i%6]*(.35+t*.65)
        x=(.198+.061*t+fold)*cos(a);y=(.135+.060*t+fold)*sin(a)+.012;z=.94-.173*t
        verts.append((x,y,z));uvs.append((i/sections*8,1.75*(1-t)))
        if j and i:
            k=j*(sections+1)+i;faces.append((k-sections-2,k-sections-1,k,k-1))
skirt=mesh('Plaid pleats',verts,faces,plaid,None,uvs,smooth=False)
for v in skirt.data.vertices:
    x,y,z=v.co
    # Four skirt bones keep the fabric clear of the thighs while running/riding.
    side='L' if x>=0 else 'R';front='front' if y<.012 else 'back'
    w=max(0,min(1,(.92-z)/.105))
    for bone,weight in [('hips',1-w),('skirt_'+front+'.'+side,w)]:
        if weight>0:(skirt.vertex_groups.get(bone) or skirt.vertex_groups.new(name=bone)).add([v.index],weight,'REPLACE')
sol=skirt.modifiers.new('Fabric thickness','SOLIDIFY');sol.thickness=.003
bpy.context.view_layer.objects.active=skirt;skirt.select_set(True);bpy.ops.object.modifier_apply(modifier=sol.name);skirt.select_set(False)
# Opaque shorts under the skirt, with no hidden body geometry.
tube('Shorts waistband',[(0,.015,.885),(0,.015,.94)],[.17,.17],[.10,.11],navy,'hips',32)

for s in [-1,1]:
    suffix='L' if s>0 else 'R'
    tube('Under skirt shorts',[(s*.105,.003,.91),(s*.105,.003,.86),(s*.109,0,.785)],[.077,.080,.078],[.080,.082,.08],navy,'thigh.'+suffix,24)
    centers=[(s*.109,0,.79),(s*.115,-.009,.68),(s*.117,-.019,.57),
             (s*.119,-.020,.53),(s*.120,-.013,.48),(s*.122,.002,.405),(s*.122,.010,.34),(s*.12,.006,.26),(s*.12,0,.17),(s*.12,-.006,.124)]
    widths=[.076,.065,.045,.043,.042,.048,.049,.037,.028,.029]
    depths=[.078,.068,.046,.046,.040,.049,.047,.035,.029,.034]
    leg=tube('Leg',centers,widths,depths,skin,None,28)
    for v in leg.data.vertices:
        w=max(0,min(1,(.58-v.co.z)/.11))
        for bone,weight in [('thigh.'+suffix,1-w),('shin.'+suffix,w)]:
            if weight>0:(leg.vertex_groups.get(bone) or leg.vertex_groups.new(name=bone)).add([v.index],weight,'REPLACE')
    tube('Ankle sock',[(s*.12,0,.213),(s*.12,0,.205),(s*.12,-.003,.135),(s*.12,-.016,.105)],[.031,.031,.030,.038],[.032,.032,.035,.048],navy,'shin.'+suffix,24)
    # Rounded sneaker volumes, leather panels, tongue and crossed laces.
    tube('Sneaker upper',[(s*.12,-.043,.034),(s*.12,-.043,.05),(s*.12,-.040,.075),(s*.12,-.026,.096),(s*.12,.002,.117),(s*.12,.013,.132)],[.052,.053,.050,.046,.035,.028],[.117,.116,.108,.092,.058,.036],white,'foot.'+suffix,32)
    tube('Sneaker outsole',[(s*.12,-.044,.014),(s*.12,-.044,.02),(s*.12,-.044,.035),(s*.12,-.044,.041)],[.053,.056,.056,.053],[.119,.122,.12,.115],sole,'foot.'+suffix,32)
    ellipsoid('Shoe tongue',(s*.12,-.025,.11),(.029,.055,.012),white,'foot.'+suffix,20,8)
    for row in range(5):
        y=-.085+row*.016;z=.113+row*.0038
        for flip in [-1,1]:
            path('Sneaker lace',[(s*.12-flip*.026,y,z),(s*.12,y+.008,z+.005),(s*.12+flip*.024,y+.016,z)],.0018,cord,'foot.'+suffix,5)
    for side in [-1,1]:
        path('Leather panel seam',[(s*.12+side*.043,-.106,.062),(s*.12+side*.051,-.05,.079),(s*.12+side*.043,.015,.09),(s*.12+side*.032,.05,.073)],.0011,sole,'foot.'+suffix,5)
    path('Toe cap seam',[(s*.12+.044*cos(a),-.071-.058*sin(a),.093) for a in [pi*i/20 for i in range(21)]],.0012,sole,'foot.'+suffix,5)

# Hair is sculpted tapered ribbons with thickness, layered from crown to tips.
def bezier(points,t):
    p=[Vector(v) for v in points]
    while len(p)>1:p=[a.lerp(b,t) for a,b in zip(p,p[1:])]
    return p[0]

def lock(name, controls, width, mat=hair, bone='head', detail=True):
    verts,faces=[],[];rows=18;cols=8
    for j in range(rows+1):
        t=j/rows;c=bezier(controls,t)
        tangent=(bezier(controls,min(1,t+.002))-bezier(controls,max(0,t-.002))).normalized()
        normal=Vector((c.x,c.y-.015,max(0,c.z-1.68)*.45)).normalized()
        u=tangent.cross(normal).normalized()
        if u.length<.1:u=Vector((1,0,0))
        n=u.cross(tangent).normalized()
        w=width*(.34+.82*sin(pi*t*.88))*(1-t**4)+.0005
        for i in range(cols+1):
            q=2*i/cols-1
            v=c+u*q*w+n*(1-q*q)*width*.24
            verts.append(v)
            if j and i:
                k=j*(cols+1)+i;faces.append((k-cols-2,k-cols-1,k,k-1))
    obj=mesh(name,verts,faces,mat,bone)
    sol=obj.modifiers.new('Hair volume','SOLIDIFY');sol.thickness=.002
    bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.modifier_apply(modifier=sol.name);obj.select_set(False)
    if detail:
        for q,m,r in [(-.68,hair_shadow,.00075),(.15,hair_light,.0011)]:
            pts=[]
            for j in range(3,16):
                t=j/rows;c=bezier(controls,t);tangent=(bezier(controls,t+.002)-bezier(controls,t-.002)).normalized()
                normal=Vector((c.x,c.y-.015,max(0,c.z-1.68)*.45)).normalized()
                u=tangent.cross(normal).normalized();n=u.cross(tangent).normalized()
                w=width*(.34+.82*sin(pi*t*.88))*(1-t**4)+.0005
                pts.append(c+u*q*w+n*((1-q*q)*width*.24+.0015))
            path('Hair strand accent',pts,r,m,bone,4)
    return obj

# Back cap ends above the nape; locks provide the actual layered silhouette.
verts,faces=[],[]
for j in range(17):
    t=j/16
    for i in range(65):
        a=2*pi*i/64
        max_theta=(.68+.5*abs(cos(a))) if sin(a)<-.2 else 2.18
        theta=.02+t*max_theta
        verts.append((.145*sin(theta)*cos(a),.02+.129*sin(theta)*sin(a),1.69+.153*cos(theta)))
        if j and i:
            k=j*65+i;faces.append((k-66,k-65,k,k-1))
mesh('Hair foundation',verts,faces,hair,'head')
for i in range(13):
    a=-.08+pi*1.16*i/12
    x=cos(a);y=sin(a)
    lock('Layered back hair',[(x*.075,.02+y*.063,1.815),(x*.16,.025+y*.143,1.74),
         (x*.15,.045+y*.156,1.48),(x*(.13+.028*sin(i*2)),.04+y*.128,1.365+.025*sin(i*1.9))],.041,hair if i%3 else hair_light,'hair_back',True)
for s in [-1,1]:
    # Sweeping center part; the face remains clearly visible between the bangs.
    for i in range(4):
        lock('Curtain fringe',[(s*(.007+i*.016),-.044+i*.014,1.836-i*.003),
             (s*(.055+i*.025),-.152+i*.009,1.854-i*.022),
             (s*(.083+i*.018),-.157+i*.015,1.682-i*.029),
             (s*(.147+i*.012),-.084+i*.007,1.64-i*.028)],.027 if i<2 else .032,hair if i%2 else hair_light)
    for i in range(4):
        lock('Face framing lock',[(s*(.123+i*.006),-.033+i*.018,1.752-i*.016),
             (s*(.16+i*.006),-.078+i*.025,1.602),
             (s*(.115+i*.021),-.137+i*.020,1.448),
             (s*(.152+i*.023),-.092+i*.023,1.355+i*.015)],.024,hair,'hair_side.'+('L' if s>0 else 'R'))
    lock('Crown sweep',[(s*.016,.002,1.84),(s*.134,.034,1.85),(s*.175,.13,1.69),(s*.166,.136,1.5)],.041,hair_light)
    lock('Fine silhouette strand',[(s*.11,-.01,1.80),(s*.20,-.02,1.74),(s*.20,-.056,1.58),(s*.171,-.062,1.55)],.009,hair_light,detail=False)

# Refine the main cloth and skin silhouettes without subdividing decorative detail.
for obj in parts:
    if obj.name.startswith(('Hoodie body','Oversized sleeve','Leg.','Leg','Palm')):
        bpy.context.view_layer.objects.active=obj;obj.select_set(True)
        mod=obj.modifiers.new('Smooth garment silhouette','SUBSURF');mod.levels=1
        bpy.ops.object.modifier_apply(modifier=mod.name);obj.select_set(False)
# Adult face proportions; hair retains length below the chin.
for obj in parts:
    names={g.name for g in obj.vertex_groups}
    if names and names.issubset({'head','hair_back','hair_side.L','hair_side.R'}):
        is_hair='Hair' in obj.active_material.name or 'blonde' in obj.active_material.name
        for v in obj.data.vertices:
            v.co.x*=.92
            v.co.z=1.49+(v.co.z-1.49)*(.91 if is_hair else .84)
            if not is_hair:v.co.y*=.96
# Ensure portable outward normals for glTF's back-face culling.
import bmesh
for obj in parts:
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data);bm.free()
print('Hero geometry complete:' ,len(parts),'mesh pieces;',sum(len(p.data.polygons) for p in parts),'faces before joining')
