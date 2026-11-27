"""Refine the registered four-view guide sculpt in Blender; pack the studio master."""
from pathlib import Path
import math
import sys
import json
import bpy
import numpy as np
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from recorder_parts import add_details
from recorder_head import replace_head

ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
data=np.load(ROOT/'tools/recorder-sculpt.npz')
pts=data['positions'].copy()
# Add fine central facial relief where a four-view silhouette cannot resolve
# the nose bridge or cheekbones. Dimensions are in metres.
x,y,z=pts.T
front=np.clip((-y-.018)/.059,0,1)
pts[:,1]-=front*(.022*np.exp(-(x/.021)**2-((z-1.424)/.024)**2)+
                  .011*np.exp(-(x/.014)**2-((z-1.458)/.039)**2))
pts[:,2]-=pts[:,2].min()
faces=data['faces']
mesh=bpy.data.meshes.new('Registered quad surface')
mesh.from_pydata(pts.tolist(),[],faces.tolist());mesh.update()
body=bpy.data.objects.new('行记员 · 四视图造型母体',mesh);scene.collection.objects.link(body)
body['identity']='Fictional field-journal guide'
body['anchors']='Soft slate cap / diagonal canvas satchel / brick-red bound notebook'
mesh.polygons.foreach_set('use_smooth',np.ones(len(mesh.polygons),dtype=bool))
uv=mesh.uv_layers.new(name='Registered projections');uv.data.foreach_set('uv',data['uv'].ravel())
mat=bpy.data.materials.new('Field journal · painted cotton & skin');mat.use_nodes=True
shader=mat.node_tree.nodes.get('Principled BSDF')
shader.inputs['Roughness'].default_value=.92
shader.inputs['Specular IOR Level'].default_value=.22
image=bpy.data.images.load(str(ROOT/'assets/valley/recorder-atlas.webp'));image.pack()
texture=mat.node_tree.nodes.new('ShaderNodeTexImage');texture.image=image
mat.node_tree.links.new(texture.outputs['Color'],shader.inputs['Base Color'])
mesh.materials.append(mat)
bpy.context.view_layer.objects.active=body;body.select_set(True)
smooth=body.modifiers.new('Soft cloth surface','SMOOTH');smooth.factor=.26;smooth.iterations=2
bpy.ops.object.modifier_apply(modifier=smooth.name)
simplify=body.modifiers.new('Preserve outline and wrist silhouettes','DECIMATE')
simplify.ratio=.64
bpy.ops.object.modifier_apply(modifier=simplify.name)
add_details(body)
replace_head(body,ROOT)
fabric_sets={'field-cotton':('石蓝棉布','反折袖口','棉布软帽 · 石蓝'),
             'field-canvas':('挎包帆布','帆布包滚边','手记纸板封皮')}
cloth_materials=set()
for swatch,names in fabric_sets.items():
    scan=bpy.data.images.load(str(ROOT/('assets/valley/'+swatch+'.webp')));scan.pack()
    for name in names:
        material=bpy.data.materials.get(name)
        if not material:continue
        nodes=material.node_tree.nodes;links=material.node_tree.links
        source=nodes.new('ShaderNodeTexImage');source.image=scan
        mapping=nodes.new('ShaderNodeUVMap');mapping.uv_map='Cut cloth'
        links.new(mapping.outputs['UV'],source.inputs['Vector'])
        if swatch=='field-cotton':
            dye=nodes.new('ShaderNodeMixRGB');dye.blend_type='MULTIPLY';dye.inputs[0].default_value=1.
            dye.inputs[2].default_value=(.72,.65,.60,1)
            links.new(source.outputs['Color'],dye.inputs[1]);links.new(dye.outputs[0],nodes.get('Principled BSDF').inputs['Base Color'])
        else:links.new(source.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
        cloth_materials.add(material)
for obj in bpy.context.scene.objects:
    if obj.type!='MESH' or not any(m in cloth_materials for m in obj.data.materials):continue
    m=obj.data;prior=m.uv_layers.active
    layer=m.uv_layers.new(name='Cut cloth')
    for face in m.polygons:
        n=face.normal
        for idx in face.loop_indices:
            x,y,z=m.vertices[m.loops[idx].vertex_index].co
            a,b=((x,y) if abs(n.z)>.70 else (y,z) if abs(n.x)>abs(n.y) else (x,z))
            repeat=.075 if any(mat.name in fabric_sets['field-cotton'] for mat in m.materials) else .14
            layer.data[idx].uv=(a/repeat,b/repeat)
    if prior is not None:m.uv_layers.active=prior;prior.active_render=True
# Batch the fine strands, graphite marks and stitching by finish. Individual
# garment and face components remain recorded in extras without hundreds of
# draw calls in the shared web character.
groups={}
for obj in list(scene.objects):
    if obj.type=='MESH' and len(obj.data.materials)==1:
        groups.setdefault(obj.data.materials[0].name,[]).append(obj)
for finish,objects in groups.items():
    if len(objects)<2:continue
    bpy.ops.object.select_all(action='DESELECT')
    names=[o.name for o in objects]
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    joined=bpy.context.object;joined.name='行记员 / '+finish
    joined['components']=names
body['detailVersion']='recorder-study-20261125'
scene['identity']='Same registered portrait / soft cap / braid / canvas satchel / red journal clasp'
for obj in scene.objects:
    if obj.type!='MESH':continue
    finishes={m.name for m in obj.data.materials}
    if finishes&{'毛边纸','翻起纸角'}:obj['journalSurface']='paper'
    if '石墨' in finishes:obj['journalSurface']='ink'
    if finishes&{'散发 · 暖墨褐','睫缘 · 柔墨褐','棉线 · 褪靛','压线 · 靛灰'}:obj['journalMicrodetail']=True
models=ROOT/'assets/models'
candidate=models/'journal-recorder-next.glb'
bpy.ops.export_scene.gltf(filepath=str(candidate),export_format='GLB',
    export_extras=True,export_yup=True,export_animations=False,export_image_format='JPEG',
    export_image_quality=94,export_meshopt_compression_enable=True,
    export_meshopt_extension='EXT_meshopt_compression')
candidate.replace(models/'journal-recorder.glb')
parts=[o for o in scene.objects if o.type=='MESH']
stats={'version':'recorder-study-20261125','meshes':len(parts),
       'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in parts),
       'fileBytes':(models/'journal-recorder.glb').stat().st_size,
       'identity':'Registered portrait retained; soft cap, braid, satchel and brick-red journal clasp',
       'changes':['Rebuilt continuous jacket and closed satchel','Book supported at a reading angle','Pencil point on top page','Graphite notes and turned paper corner',
                  'Stand collar, button stand, four-hole buttons and pocket stitching','Temple wisps, braid strands and eyelid margins']}
# The project contains its packed albedo and a neutral studio, ready to inspect.
def aim(obj,point):
    obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
camdata=bpy.data.cameras.new('Character study')
cam=bpy.data.objects.new('Review camera',camdata);scene.collection.objects.link(cam)
cam.location=(.97,-3.1,1.43);aim(cam,(0,0,.88));camdata.type='ORTHO';camdata.ortho_scale=2.0;scene.camera=cam
for name,xy,energy,size in [('Large soft key',(-2.1,-3,3.8),370,3),('Fill', (2.7,-.8,2.5),160,2.6)]:
    lamp=bpy.data.lights.new(name,'AREA');lamp.energy=energy;lamp.shape='DISK';lamp.size=size
    obj=bpy.data.objects.new(name,lamp);scene.collection.objects.link(obj);obj.location=xy;aim(obj,(0,0,.88))
world=bpy.data.worlds.new('Paper studio');world.color=(.27,.25,.20);scene.world=world
world.use_nodes=True
world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.33,.34,.36,1)
world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.55
scene.render.engine='CYCLES';scene.cycles.samples=40;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=8
scene.view_settings.view_transform='AgX'
try:scene.view_settings.look='AgX - Medium High Contrast'
except TypeError:pass
scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.color_type='TEXTURE'
out=ROOT/'output/model-review';out.mkdir(parents=True,exist_ok=True)
(out/'recorder-upgrade.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'行记员.blend'),compress=True)
if '--preview' in sys.argv:
    scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=94
    for name,position,target,scale in [
        ('recorder-full',(.70,-3.1,1.43),(0,-.03,.86),1.95),
        ('recorder-close',(.43,-2.0,1.51),(0,-.045,1.285),.83),
        ('recorder-writing',(.54,-1.50,1.94),(.020,-.17,1.12),.47)]:
        cam.location=position;aim(cam,target);camdata.ortho_scale=scale
        scene.render.resolution_x=1100;scene.render.resolution_y=1100
        scene.render.filepath=str(out/(name+'.jpg'))
        bpy.ops.render.render(write_still=True)
print('RECORDER MASTER',sum(o.type=='MESH' for o in scene.objects),'separate meshes;',len(body.data.polygons),'body faces',tuple(round(i,3) for i in body.dimensions))

