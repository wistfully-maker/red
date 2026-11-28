"""Focused read-only actor/architecture intersection review of exported scenes."""
from pathlib import Path
import hashlib, json, math, sys
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/scene-layout';OUT.mkdir(exist_ok=True,parents=True)


def inspect(sid,phase='before'):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/landscapes'/(sid+'.glb')))
    bpy.context.view_layer.update()
    static=[]
    for o in bpy.context.scene.objects:
        if o.type!='MESH' or o.get('fieldSuppliedActor') or o.get('journalGuide'):continue
        if o.name.startswith(('People','Continuous terrain','Individual','Branch','Fine folded','Textured trunk')):continue
        if o.data.materials and o.data.materials[0].name.startswith('ground_'):continue
        verts=[o.matrix_world@v.co for v in o.data.vertices]
        static.append((o.name,BVHTree.FromPolygons(verts,[p.vertices[:] for p in o.data.polygons])))
    rows=[];actor_trees=[]
    for o in bpy.context.scene.objects:
        if not o.get('fieldSuppliedActor'):continue
        floor=o['placementFloor']
        # Exclude foot/floor contact. Only actual triangle intersections above
        # the ankles are reported, avoiding a ground-support false positive.
        verts=[o.matrix_world@v.co for v in o.data.vertices]
        faces=[p.vertices[:] for p in o.data.polygons if min(verts[i].z for i in p.vertices)>floor+.18]
        tree=BVHTree.FromPolygons(verts,faces)
        intersections={name:len(tree.overlap(other)) for name,other in static}
        intersections={k:v for k,v in intersections.items() if v}
        actor_trees.append((o,BVHTree.FromPolygons(verts,[p.vertices[:] for p in o.data.polygons])))
        rows.append({'asset':o['fieldSuppliedActor'],'position':list(o.location),
                     'yaw':o['authorYaw'],'intersectionsAboveAnkles':intersections})
        if sid=='chishui' and o['fieldSuppliedActor']=='boatman-rowing':
            for name,other in static:
                hits=tree.overlap(other)
                if not hits:continue
                points=[verts[i] for a,b in hits for i in faces[a]]
                print('BOATMAN_CONTACT',name,'low',list(map(min,zip(*points))),
                      'high',list(map(max,zip(*points))),flush=True)
    pairs=[]
    for i,(a,tree) in enumerate(actor_trees):
        for b,other in actor_trees[i+1:]:
            hits=tree.overlap(other)
            if hits:pairs.append({'a':a.name,'b':b.name,'intersectingTrianglePairs':len(hits)})
    source=ROOT/'assets/models/landscapes'/(sid+'.glb')
    report={'station':sid,'phase':phase,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
            'actors':rows,'actorIntersections':pairs,
            'collisionScope':'All actor triangles against other actors; actor triangles above ankles against scene geometry, excluding intentional sole/floor contact.'}
    if sid=='lianghekou':
        delegates=[o for o in bpy.context.scene.objects if o.get('fieldSuppliedActor')=='seated-delegate']
        assert len(delegates)==6
        assert all(abs(o['placementFloor']-.165)<1e-6 for o in delegates)
        assert all(abs(o['authorYaw']-(math.pi if o.location.y<0 else 0))<1e-6 for o in delegates)
        report['meeting']={'tableCentre':[0,-1.2,.165],'tableSize':[5.6,1.8,.89],
            'courtyardPavingTop':.1625,'supportGapMetres':.0025,
            'templeStepFrontY':1.345,'backRowY':.5,'frontRowY':-2.9,
            'chairSupportCount':6,'chairsFaceTable':True}
    if sid=='luding':
        carving=next(o for o in bpy.context.scene.objects if o.name=='Supplied carving')
        points=[carving.matrix_world@Vector(p) for p in carving.bound_box]
        report['tableFrame']={'low':list(map(min,zip(*points))),'high':list(map(max,zip(*points))),
            'quaternion':list(carving.rotation_quaternion),'rotationMode':carving.rotation_mode}
        assert (carving.matrix_world.to_3x3()@Vector((0,0,1))).z<0,'Table frame was not turned upright'
        walk=json.loads((ROOT/'assets/luding/walk.json').read_text(encoding='utf-8'))
        bpy.ops.object.camera_add();cam=bpy.context.object;scene=bpy.context.scene;scene.camera=cam
        cam.data.sensor_fit='VERTICAL';cam.data.sensor_height=32;cam.data.lens=16/math.tan(math.radians(21))
        scene.render.resolution_x=1120;scene.render.resolution_y=700;report['existingWalkStills']=[]
        half=walk['span']/2
        for shot in walk['stops']:
            x=shot['metres']-half;z=walk['floorAtCentre']+walk['sag']*(min(half,abs(x))/half)**2+walk['eyeHeight']
            pitch=shot['pitch'];yaw=shot['yaw'];cam.location=(x,-shot['z'],z)
            cam.rotation_euler=Vector((-math.sin(yaw)*math.cos(pitch),math.cos(yaw)*math.cos(pitch),-math.sin(pitch))).to_track_quat('-Z','Y').to_euler()
            bpy.context.view_layer.update()
            frame=[world_to_camera_view(scene,cam,p) for p in points]
            visible=(any(p.z>0 for p in frame) and max(p.x for p in frame)>0 and min(p.x for p in frame)<1
                     and max(p.y for p in frame)>0 and min(p.y for p in frame)<1)
            report['existingWalkStills'].append({'id':shot['id'],'tableInCameraFrustum':visible})
    if phase=='after':
        assert not pairs,(sid,'actor intersections',pairs)
        assert not any(row['intersectionsAboveAnkles'] for row in rows),(sid,'static intersections',rows)
        report['passed']=True
    (OUT/(sid+'-'+phase+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('LAYOUT_REVIEW',json.dumps(report,ensure_ascii=False),flush=True)
    if phase=='candidates' and sid=='liping':
        actor=next(o for o in bpy.context.scene.objects if o.get('fieldSuppliedActor')=='farmer-greeting')
        base=actor.location.copy();clear=[]
        for y in [-7.5,-8,-8.5,-9.5,-10.5,-11.5,-12.5]:
            for x in [-6,-5,-4,-3,-2,-1,0,1,2,3,4,5]:
                offset=Vector((x,y,.24))-base
                verts=[actor.matrix_world@v.co+offset for v in actor.data.vertices]
                tree=BVHTree.FromPolygons(verts,[p.vertices[:] for p in actor.data.polygons])
                if any(tree.overlap(other) for _,other in static):continue
                others=[o for o in bpy.context.scene.objects if o.get('fieldSuppliedActor') and o!=actor]
                if any((Vector((x,y,0))-Vector((o.location.x,o.location.y,0))).length<1 for o in others):continue
                clear.append([x,y,.24])
        print('CLEAR_CANDIDATES',clear,flush=True)
    if phase=='candidates' and sid=='chishui':
        actor=next(o for o in bpy.context.scene.objects if o.get('fieldSuppliedActor')=='boatman-rowing')
        base=actor.location.copy();clear=[]
        for dz in [0,.05,.1,.15,.2,.25]:
            for dx,dy in [(0,0),(.2,0),(-.2,0),(0,.2),(0,-.2),(.4,0),(-.4,0),(0,.4),(0,-.4),(.6,0),(-.6,0),(0,.6),(0,-.6)]:
                offset=Vector((dx,dy,dz));verts=[actor.matrix_world@v.co+offset for v in actor.data.vertices]
                faces=[p.vertices[:] for p in actor.data.polygons if min(verts[i].z for i in p.vertices)>base.z+dz+.18]
                tree=BVHTree.FromPolygons(verts,faces)
                hits=sum(len(tree.overlap(other)) for name,other in static)
                if hits==0:clear.append([dx,dy,dz])
        print('CLEAR_BOATMAN_OFFSETS',clear,flush=True)


if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:]
    for sid in args[1:]:inspect(sid,args[0])
