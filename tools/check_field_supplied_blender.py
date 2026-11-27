"""Quick actual Blender integration smoke test before the main scene build.

blender --background --factory-startup --python-exit-code 17 \
  --python tools/check_field_supplied_blender.py
Only .workbuddy/field-supplied/smoke.glb is written.
"""
import json
from pathlib import Path
import sys
from types import SimpleNamespace

import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from field_people import Figures
from field_supplied import place_stick_between,_ORIGINAL_PROPS
from check_field_people import geometry
import historical_sets


def check():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    env=SimpleNamespace(sid='yudu',height=lambda x,y:0)
    f=Figures(env)
    for i in range(5):f.build(i*1.2,0,0,1.67,0,'walk','walker')
    f.build(6,0,0,1.63,0,'stand','porter')
    assert f.count==6 and len(f.people)==6 and len(f.identities)==6
    assert len(f.portrait_candidates)==6
    assert {obj['fieldSuppliedActor'] for obj in env._field_supplied_actors}=={
        'marcher-male','soldier-female','old-porter'}
    for i,obj in enumerate(env._field_supplied_actors):
        bpy.context.view_layer.update()
        points=[obj.matrix_world@Vector(point) for point in obj.bound_box]
        height=max(point.z for point in points)-min(point.z for point in points)
        assert abs(height-f.people[i][3])<1e-4
        assert all(mat.get('fieldFigureFinish') for mat in obj.data.materials)
    before=f.count
    f.build(7,0,0,1.64,0,'sit','delegate')
    f.build(8,0,0,1.67,0,'row','boatman')
    assert len(env._field_supplied_actors)==8 and f.count==before+2
    assert {o['fieldSuppliedActor'] for o in env._field_supplied_actors[-2:]}=={'seated-delegate','boatman-rowing'}
    assert not any(faces for vertices,faces,uv in f.parts.values())
    f.build(0,2,0,1.64,0,'write','guide',True)
    assert len(f.anchor)==4 and f.count==before+2
    f.flush(geometry)
    historical_sets.bedroll(0,3,0,.3)
    historical_sets.folding_chair(1.5,3,0,.2)
    assert place_stick_between(env,(3,3,0),(3.2,3.1,1.2)) is not None
    assert not any('caregiver-female' in obj.name or 'female-soldier-fixed' in obj.name for obj in bpy.data.objects)
    out=ROOT/'.workbuddy/field-supplied/smoke.glb'
    bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_extras=True,export_animations=False)
    luding=SimpleNamespace(sid='luding');luding_figures=Figures(luding)
    luding_figures.build(0,0,0,1.67,.2,'walk','walker')
    assert len(luding._field_supplied_actors)==1 and not luding_figures.parts
    assert historical_sets.bedroll is _ORIGINAL_PROPS['bedroll']
    assert historical_sets.folding_chair is _ORIGINAL_PROPS['folding_chair']
    print('FIELD_SUPPLIED_BLENDER_CHECK '+json.dumps({'passed':True,'native_people':8,
          'procedural_fallbacks':0,'luding_supplied_people':1,'prop_types':3,'cancelled_excluded':True}),flush=True)


if __name__=='__main__':check()
