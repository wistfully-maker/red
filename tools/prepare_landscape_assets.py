"""Inspect and compact supplied geography assets without editing source GLBs."""
from pathlib import Path
import hashlib
import json
import math
import bpy
import bmesh
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
DOWNLOADS=Path('C:/Users/李冠桥/Downloads')
OUT=ROOT/'assets/landscape-props'
REVIEW=ROOT/'output/landscape-assets'
SOURCES=[
 ('dirt-path','泥土路面3d模型.glb',6500,1536,'surface'),
 ('snow-path','雪覆小径3d模型.glb',7000,1536,'surface'),
 ('cracked-soil','干裂泥土3d模型_副本.glb',6500,1536,'surface'),
 ('grass-terrain','草地地形3d模型.glb',6500,1536,'surface'),
 ('soil-hill','泥土山丘3d模型.glb',6500,1024,'hill'),
 ('sandstone-peak','沙漠岩山3d模型.glb',5500,1024,'hill'),
 ('rock-peak','岩石山峰3d模型_副本.glb',6500,1536,'hill'),
 ('snow-cliff','雪山岩崖3d模型.glb',7000,1536,'hill'),
 ('dead-tree','枯树3d模型_副本.glb',8500,1024,'tree'),
 ('pale-dead-tree','白色树木3d模型 (2).glb',8500,1024,'tree'),
 ('gravel-surface','tripo_convert_0a05eb54-6568-46f5-8893-4bb4aaf8a184.glb',6500,1536,'surface'),
]


def measure(obj):
    points=[obj.matrix_world@v.co for v in obj.data.vertices]
    low=Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    obj.data.calc_loop_triangles()
    return low,high,len(obj.data.loop_triangles)


def preview(path,key,kind):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    obj=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    low,high,count=measure(obj);centre=(low+high)/2;span=max(high-low)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=10;scene.cycles.use_denoising=True
    scene.world=bpy.data.worlds.new('Asset inspection sky');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.60,.65,.68,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.70
    bpy.ops.object.light_add(type='AREA',location=centre+Vector((-1.5,-2.0,3))*span)
    lamp=bpy.context.object;lamp.data.energy=300*span*span;lamp.data.shape='DISK';lamp.data.size=span*3
    lamp.rotation_euler=(centre-lamp.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=span*1.48
    scene.render.resolution_x=640;scene.render.resolution_y=520;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=91;scene.view_settings.view_transform='AgX'
    for label,direction in [('view',(1.1,-1.7,1.1)),('top',(0,-.15,2.5))]:
        cam.location=centre+Vector(direction).normalized()*span*4;cam.rotation_euler=(centre-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(REVIEW/(key+'-'+label+'.jpg'));bpy.ops.render.render(write_still=True)
    return {'trianglesReimported':count,'dimensionsReimported':list(high-low)}


def prepare(key,filename,budget,limit,kind):
    source=DOWNLOADS/filename
    digest=hashlib.sha256(source.read_bytes()).hexdigest()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    if not objects:raise ValueError('No geometry in '+filename)
    world={o:o.matrix_world.copy() for o in objects}
    original=0
    for o in objects:
        o.data.calc_loop_triangles();original+=len(o.data.loop_triangles)
        o.data=o.data.copy();o.parent=None;o.matrix_world.identity();o.data.transform(world[o]);o.data.update()
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1:bpy.ops.object.join()
    obj=bpy.context.object
    if not obj.data.uv_layers:raise ValueError('Missing UV '+filename)
    bm=bmesh.new();bm.from_mesh(obj.data);before=len(bm.verts)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1.e-6);after=len(bm.verts)
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    _,_,count=measure(obj)
    if count>budget:
        mod=obj.modifiers.new('Web geography budget','DECIMATE');mod.ratio=(budget-1)/count;mod.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    low,high,count=measure(obj)
    span=max(high.x-low.x,high.y-low.y);pivot=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))
    for vertex in obj.data.vertices:vertex.co=(vertex.co-pivot)/span
    obj.data.update();obj.name='Landscape asset / '+key;obj.data.name=obj.name
    textures=[]
    for mat in obj.data.materials:
        mat.name='Geo '+key+' / '+mat.name;mat['nativeLandscapeFinish']=True;mat['landscapeAsset']=key
        if not mat.use_nodes:continue
        for node in mat.node_tree.nodes:
            if node.type!='TEX_IMAGE' or not node.image:continue
            im=node.image;old=list(im.size)
            if max(old)>limit:
                im.scale(round(old[0]*limit/max(old)),round(old[1]*limit/max(old)))
            im.pack();textures.append({'name':im.name,'before':old,'after':list(im.size),'colourSpace':im.colorspace_settings.name})
    obj['landscapeAsset']=key;obj['sourceAsset']=filename;obj['sourceSHA256']=digest
    obj['assetKind']=kind;obj['normalisedHorizontalSpan']=1.
    output=OUT/(key+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_extras=True,
                              export_animations=False,export_image_format='WEBP',export_image_quality=88)
    low,high,_=measure(obj)
    record={'key':key,'source':str(source),'sourceSHA256':digest,'sourceBytes':source.stat().st_size,
            'originalTriangles':original,'originalVertices':before,'weldedVertices':after,'triangles':count,
            'output':str(output),'outputBytes':output.stat().st_size,'kind':kind,
            'dimensions':list(high-low),'textures':textures,'pivot':'bottom centre; Blender Z up; normalised horizontal span 1m'}
    record.update(preview(output,key,kind))
    (REVIEW/(key+'.json')).write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf8')
    print('LANDSCAPE_ASSET',key,count,record['outputBytes'],record['dimensions'],flush=True)
    return record


if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True);REVIEW.mkdir(parents=True,exist_ok=True)
    records=[prepare(*row) for row in SOURCES]
    (REVIEW/'assets-manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf8')
    print('LANDSCAPE_ASSET_BATCH_COMPLETE',len(records),flush=True)
