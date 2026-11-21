"""Produce editable construction collections and untextured geometric proof renders."""
from pathlib import Path
from types import SimpleNamespace
import math,random,sys
import bpy,bmesh
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import history_south as art
from field_waterfronts import vessel
from field_dwellings import village_house
from field_people import Figures

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/model-review';OUT.mkdir(exist_ok=True,parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
def collect(name):
    col=bpy.data.collections.new(name);scene.collection.children.link(col);return col

def mat(name,col):
    m=bpy.data.materials.get(name)
    if m is None:
        m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True
        p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*col,1);p.inputs['Roughness'].default_value=.82
    return m

palette={'boat_oak':(.29,.143,.061),'deckplank':(.39,.24,.12),'tarred':(.065,.044,.027),'timber':(.17,.085,.04),
         'reedmat':(.53,.39,.19),'wood':(.34,.21,.11),'tile':(.15,.17,.18),'limewash':(.75,.72,.64),'earth':(.57,.37,.20)}
def publish(col,location):
    objects=[]
    for (component,material),(pts,faces) in art.B.items():
        mesh=bpy.data.meshes.new(component);mesh.from_pydata(pts,[],faces);mesh.update()
        obj=bpy.data.objects.new(component+' · '+material,mesh);col.objects.link(obj)
        obj.location=location;mesh.materials.append(mat(material,palette.get(material,(.38,.36,.30))));objects.append(obj)
    return objects
def env(site):return SimpleNamespace(sid=site,rng=random.Random(9),height=lambda x,y:0,houses=[])
def boat(name,pos,kind,l,w):
    art.B={};art.part('Hull')
    vessel(env('anshun'),0,0,l,w,kind=kind)
    col=collect(name);return col,publish(col,pos)

hull,parts=boat('01 安顺场 · 翘首木船',(0,0,0),'crescent',10.5,2.2)
crew=collect('船工 · 与渡船共用米制')
people=Figures(env('anshun'))
people.build(3.32,.05,.19,1.68,1.03,'row','boatman')
def crew_part(name,verts,faces,surface,uv,smooth):
    m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update()
    obj=bpy.data.objects.new(name,m);crew.objects.link(obj)
    for poly in m.polygons:poly.use_smooth=smooth
    m.materials.append(mat(surface,(.27,.29,.28)))
    return obj
people.flush(crew_part)
bpy.context.view_layer.update()
shell=next(obj for obj in parts if obj.name.startswith('01_double'))
assert abs(shell.dimensions.x-10.5)<.001 and abs(shell.dimensions.y-2.2)<.001
cut,cut_parts=boat('02 船体剖视 · 揭示内部构件',(0,6,0),'crescent',10.5,2.2)
for obj in cut_parts:
    # Remove the near half of the shell and near longitudinal rubbing strips.
    # The floorboards, ribs and seats remain available as complete separate parts.
    if obj.name.startswith('06_thwarts'):obj.location.z+=.38
    if not obj.name.startswith(('01_double','03_plank','05_slatted')):continue
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-6,
        plane_co=(0,0,0),plane_no=(0,1,0),clear_inner=True)
    bm.to_mesh(obj.data);bm.free();obj.data.update()
cargo,_=boat('03 赤水 · 篷船',(0,12,0),'cargo',8.8,2.1)
housing=[]
for i,(sid,title) in enumerate([('yudu','赣南封火墙铺屋'),('chishui','河埠挑廊木屋'),('baxi','高地平顶石木民居')]):
    art.B={};art.part('Envelope')
    village_house(env(sid),0,0,6.4,4.6,3.2,lambda x,y,turn,name,build:build())
    col=collect('0'+str(4+i)+' '+title)
    publish(col,(i*11-11,23,0));housing.append(col)

master=collect('07 行记员 · 可编辑零件')
with bpy.data.libraries.load(str(OUT/'行记员.blend'),link=False) as (src,dst):dst.objects=src.objects
for obj in dst.objects:
    if obj and obj.type=='MESH':master.objects.link(obj);obj.location.x+=12
studio=collect('Studio')
camdata=bpy.data.cameras.new('Orthographic inspection');cam=bpy.data.objects.new('审查镜头',camdata);studio.objects.link(cam);scene.camera=cam
def aim(obj,pt):obj.rotation_euler=(Vector(pt)-obj.location).to_track_quat('-Z','Y').to_euler()
def view(target,vector,width):
    cam.location=Vector(target)+Vector(vector);aim(cam,target);camdata.type='ORTHO';camdata.ortho_scale=width
def lamp(name,location,energy,radius):
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=radius
    obj=bpy.data.objects.new(name,data);studio.objects.link(obj);obj.location=location
    return obj
key=lamp('Large key',(-6,-6,9),2000,7);fill=lamp('Broad fill',(6,3,7),1200,8)
world=bpy.data.worlds.new('Neutral studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.54,.54,.54,1);world.node_tree.nodes['Background'].inputs[1].default_value=.54;scene.world=world
neutral=mat('无纹理 · 白模',(.55,.54,.51));cols=[hull,crew,cut,cargo,*housing,master]
scene.render.engine='CYCLES';scene.cycles.samples=10;scene.cycles.use_denoising=True
scene.render.resolution_x=840;scene.render.resolution_y=540;scene.render.resolution_percentage=100
def render(name,show,focus,vector,width):
    for col in cols:col.hide_render=col not in show
    for light,offset in [(key,(-.76,-.83,1.18)),(fill,(.65,.45,.8))]:
        light.location=Vector(focus)+Vector(offset)*width;aim(light,focus)
        light.data.energy=width**2*(36 if light==key else 15);light.data.size=width*.72
    scene.view_layers[0].material_override=neutral
    view(focus,vector,width)
    if name!='clay-face-and-book':
        bpy.context.view_layer.update()
        inv=cam.matrix_world.inverted()
        points=[inv@(obj.matrix_world@Vector(corner)) for col in show for obj in col.objects
                if obj.type=='MESH' for corner in obj.bound_box]
        left,right=min(p.x for p in points),max(p.x for p in points)
        low,high=min(p.y for p in points),max(p.y for p in points)
        cam.location+=cam.rotation_euler.to_matrix()@Vector(((left+right)/2,(low+high)/2,0))
        camdata.ortho_scale=max(width,(right-left)*1.13,(high-low)*scene.render.resolution_x/scene.render.resolution_y*1.14)
    scene.render.filepath=str(OUT/(name+'.png'))
    bpy.ops.render.render(write_still=True)
render('clay-boat-section',[cut],(0,6,.52),(4,-10,5.6),12)
render('clay-boat-and-crew',[hull,crew],(0,0,.68),(4.8,-11,5.9),12.2)
render('clay-roof-frame',housing,(0,23,1.5),(7,-28,16),32)
# Lift the one selected roof stack to show the actual trusses below.
for obj in housing[1].objects:
    if obj.name.startswith('05_'):obj.location.z+=1.65
render('clay-house-exploded',[housing[1]],(0,23,3.28),(7,-12,6.7),15.8)
for obj in housing[1].objects:
    if obj.name.startswith('05_'):obj.location.z-=1.65
render('clay-character',[master],(12,0,.83),(1,-3.3,1.1),2.93)
render('clay-face-and-book',[master],(12,-.04,1.30),(.51,-2.15,.43),1.21)
for col in cols:col.hide_render=False
scene.view_layers[0].material_override=None
view((0,12,1.3),(10,-32,21),37)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.color_type='MATERIAL'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'渡船与民居构件.blend'),compress=True)
print('GEOMETRY PROOF',len(parts),'original boat parts,',len(cut_parts),'cutaway parts,',len(master.objects),'figure objects')

