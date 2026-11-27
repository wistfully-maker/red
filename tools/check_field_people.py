"""Blender integration check for historical identities, proportions and materials."""
import json
import math
from pathlib import Path
import sys
from types import SimpleNamespace
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from field_people import Figures
from field_personnel import identity_for


def geometry(name,vertices,faces,material,uv=None,smooth_faces=False):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    mat=bpy.data.materials.get(material) or bpy.data.materials.new(material)
    mesh.materials.append(mat)
    if uv:
        layer=mesh.uv_layers.new(name='FaceUV')
        for loop in mesh.loops:layer.data[loop.index].uv=uv[loop.vertex_index]
    if smooth_faces:
        for face in mesh.polygons:face.use_smooth=True
    return obj


def check():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    assert identity_for('zunyi','delegate','sit',0,0)=='red_army'
    assert identity_for('baxi','local','stand',0,0)=='civilian'
    assert identity_for('lianghekou','local','sit',12,8)=='civilian'
    proportional=Figures(SimpleNamespace(sid='yudu',use_supplied_people=False))
    proportional.build(0,0,0,1.67,0,'walk','walker')
    points=[point for vertices,faces,uv in proportional.parts.values() for point in vertices]
    assert min(point[2] for point in points)>-1e-6
    assert abs(max(point[2] for point in points)-1.67)<.02
    assert all(all(math.isfinite(value) for value in point) for point in points)
    coat_points,coat_faces,_=proportional.parts[(False,'fig_army_cloth')]
    tree=BVHTree.FromPolygons(coat_points,coat_faces)
    gaps=[]
    for point in proportional.parts[(False,'fig_canvas')][0]:
        if -.18<point[0]<.14 and .91<point[2]<1.37 and point[1]<-.02:
            hit,normal,index,distance=tree.ray_cast(Vector((point[0],-1,point[2])),Vector((0,1,0)),2)
            if hit is not None:gaps.append(hit.y-point[1])
    assert gaps and min(gaps)>.001, ('Strap intersects the actual coat surface',min(gaps))
    figures=Figures(SimpleNamespace(sid='yudu',use_supplied_people=False))
    for i,(role,pose) in enumerate([('walker','walk'),('local','greet'),('porter','stand'),
                                   ('boatman','row'),('red_army','climb'),('soldier','write')]):
        figures.build(i*1.8,0,0,1.67,0,pose,role)
    assert hasattr(figures,'identities'), 'Missing explicit identity audit for historical figures'
    assert [record['identity'] for record in figures.identities]==[
        'red_army','civilian','porter','boatman','red_army','red_army']
    assert hasattr(figures,'portrait_candidates') and len(figures.portrait_candidates)==6
    assert [record[-1] for record in figures.portrait_candidates]==[True,False,False,False,True,True]
    before=len(figures.people)
    figures.build(1,2,3,1.64,.2,'write','guide',True)
    assert len(figures.people)==before and len(figures.anchor)==4
    figures.flush(geometry)
    objects=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
    assert objects and all(obj.get('fieldFigureVersion')==2 for obj in objects)
    materials={obj.data.materials[0] for obj in objects}
    assert all(mat.get('fieldFigureFinish') for mat in materials)
    assert any(mat.name=='fig_army_cloth' for mat in materials)
    assert any(mat.name=='fig_civil_umber' for mat in materials)
    assert all(obj.data.uv_layers for obj in objects if obj.data.materials[0].get('fieldCloth'))
    assert all(len(obj.data.vertices)>0 for obj in objects)
    output=ROOT/'.workbuddy/field-people-check'
    output.mkdir(exist_ok=True,parents=True)
    bpy.ops.export_scene.gltf(filepath=str(output/'figures.glb'),export_format='GLB',export_extras=True,
                              export_animations=False)
    legacy=Figures(SimpleNamespace(sid='luding'))
    legacy.build(0,0,0,1.67,0,'walk','walker')
    assert not legacy.parts and len(legacy.env._field_supplied_actors)==1, 'Luding must use supplied historical people'
    print('FIELD_PEOPLE_CHECK '+json.dumps({'passed':True,'figures':before,
          'materials':len(materials),'strap_min_front_clearance':min(gaps),
          'luding_supplied_historical_people':True}),flush=True)


if __name__=='__main__':check()
