"""Author the Luding exhibit in metres. Blender and the web viewer use its GLB finishes."""
from pathlib import Path
import json
import math
import random
import bpy
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
LIB=ROOT/'assets/luding/surfaces'
OLD=ROOT/'assets/valley'
WALK=json.loads((LIB.parent/'walk.json').read_text(encoding='utf8'))

def srgb(hexcode):
    channels=[int(hexcode[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in channels)+(1.,)

def uv_mesh(obj,kind,span):
    mesh=obj.data
    values=np.empty(len(mesh.vertices)*3,np.float32)
    mesh.vertices.foreach_get('co',values);points=values.reshape(-1,3)
    idx=np.empty(len(mesh.loops),np.int32);mesh.loops.foreach_get('vertex_index',idx)
    p=points[idx]
    if kind=='ground':
        uv=.5+np.arcsinh(p[:,:2]/105)/(2*math.asinh(2450/105))
        # Wetness and aerial registration are still available for editorial tooling.
    elif kind=='water':
        uv=np.stack((.5+p[:,0]/145,.5+p[:,1]/280),axis=1)
    elif kind=='waves':
        uv=p[:,:2]/4.75
    elif kind=='timber':
        # Grain follows each separate hewn member including horizontal beams and diagonal braces.
        parent=list(range(len(points)))
        def root(i):
            while parent[i]!=i:
                parent[i]=parent[parent[i]];i=parent[i]
            return i
        for e in mesh.edges:
            a,b=e.vertices;parent[root(a)]=root(b)
        islands={}
        for i in range(len(points)):islands.setdefault(root(i),[]).append(i)
        coords=np.empty((len(points),2),np.float32)
        for indices in islands.values():
            block=points[indices];local=block-block.mean(axis=0)
            _,axes=np.linalg.eigh(local.T@local);long=axes[:,-1];side=axes[:,-2]
            coords[indices]=np.stack((block@long/2.9,(block@side)/.39),axis=1)
        uv=coords[idx]
    else:
        count=np.empty(len(mesh.polygons),np.int32);mesh.polygons.foreach_get('loop_total',count)
        normals=np.empty(len(mesh.polygons)*3,np.float32);mesh.polygons.foreach_get('normal',normals)
        axis=np.repeat(np.argmax(abs(normals.reshape(-1,3)),axis=1),count)
        uv=np.stack((np.where(axis==0,p[:,1],p[:,0]),np.where(axis==2,p[:,1],p[:,2])),axis=1)/span
    name='Finish' if kind!='waves' else 'Current'
    layer=mesh.uv_layers.get(name) or mesh.uv_layers.new(name=name)
    layer.data.foreach_set('uv',np.ascontiguousarray(uv,dtype=np.float32).ravel())
    return name

def foliage(env,geometry):
    rng=random.Random(8841)
    pts=[];faces=[];uv=[];normals=[]
    for x,y,z,h,w in env.trees:
        distance=math.hypot(x,y)
        if distance>1050 or rng.random()>(.54 if distance<175 else .21 if distance<430 else .042):continue
        if h>10:h*=.71;w*=.69
        variant=int(rng.random()<(.46 if distance<145 else .21))
        angle=math.atan2(x,-y)+rng.uniform(-.15,.15);w=min(w,h*1.1)
        foot=env.height(x,y)-.23
        for j in range(3):
            a=angle+j*math.pi/3;size=1 if j==0 else .69
            dx=math.cos(a)*w*.52*size;dy=math.sin(a)*w*.52*size
            k=len(pts)
            # Slightly curved crossed boughs keep volume from oblique angles.
            for t in (0,1):
                for f in (-1,0,1):
                    bend=(1-abs(f))*.11*w
                    pts.append((x+f*dx-bend*math.sin(a),y+f*dy+bend*math.cos(a),foot+h*t*(1 if j==0 else .86)))
                    u=(variant+(.5+f*.49))/2
                    uv.append((u,.012+.976*t))
                    normals.append(tuple(Vector((f*.48*math.cos(a),f*.48*math.sin(a),1)).normalized()))
            faces.extend([(k,k+1,k+4,k+3),(k+1,k+2,k+5,k+4)])
    o=geometry('Gorge floodplain woodland',pts,faces,'riparian_crown',uv,True)
    o.data.normals_split_custom_set_from_vertices(normals)
    o['treeLayer']=True

def dress_scene(env,ground,geometry):
    foliage(env,geometry)
    ground['authoredLuding']=True
    ground['walkVersion']=1
    # Images with real normal and roughness information are embedded into the exported glTF.
    library={
        'bridge_plank':('wood-color.jpg','wood-normal.jpg','wood-rough.jpg',1),
        'rock':('rock-color.jpg','rock-normal.jpg','rock-rough.jpg',3.7),
        'gorge_schist':('rock-color.jpg','rock-normal.jpg','rock-rough.jpg',3.7),
        'wet_schist':('rock-color.jpg','rock-normal.jpg',None,3.7),
        'schist_seam':('rock-color.jpg','rock-normal.jpg',None,3.7),
        'pavilion_sign':('bridge-plaque.jpg',None,None,1),
        'riparian_crown':('riparian.png',None,None,1),
        'jade_water':('river-color.jpg','river-normal.jpg',None,1),
        'ground_dadu__dadu-wide':('gorge-ground.jpg',None,None,1)
    }
    swatches={'timber':('beam-grain.jpg',2.4),'chestnut':('beam-grain.jpg',2.1),'wood':('beam-grain.jpg',2.6),'plankwall':('wood-color.jpg',2.4),
              'tile':('slate.jpg',2.8),'stone':('wall',1.85),'lightstone':('chisel',1.8),
              'dressed_stone':('chisel',1.8),'limewash':('lime',2.3),'sand':('bank-shingle',2.2),'reedmat':('field-reed',1.2),
              'bag':('field-canvas',.46),'bagflap':('field-canvas',.46),'face_worker':('worker-face',1),'face_guide':('guide-face',1)}
    palette={'iron':'56534c','iron_near':'595650','iron_far':'514d43','trousers':'535a56','coatlight':'858171',
             'coatblue':'6b787f','coatslate':'69756d','capblue':'647178','capbrim':'444c51','hair':'35302a',
             'skin':'b49475','sole':'38352f','shoe':'504d47','recess':'262722','tarred':'4e4034','mulecoat':'6b5948',
             'muzzle':'53483c','clay':'8b6149','fieldgrass':'6c7853','hemp':'928063','leather':'66523d',
             'wraps':'8a8676','seam':'57635f','brass':'a1875c','buttons':'48483d','tilerib':'575c59'}
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH':continue
        mat=o.data.materials[0];name=mat.name
        if name in library:
            col,norm,rough,span=library[name]
        elif name in swatches:
            col,span=swatches[name];norm=rough=None
        else:col=norm=rough=None;span=1.
        layer=None
        if name.startswith('ground_'):
            for a in list(o.data.color_attributes):o.data.color_attributes.remove(a)
            layer=uv_mesh(o,'ground',1.)
        elif name=='jade_water':
            layer=uv_mesh(o,'water',1.);uv_mesh(o,'waves',1.)
        elif col:
            layer=o.data.uv_layers[0].name if name in ('bridge_plank','riparian_crown','pavilion_sign','face_worker','face_guide') else uv_mesh(o,'timber' if col=='beam-grain.jpg' else 'surface',span)
        if mat.get('ludingFinish'):continue
        mat['ludingFinish']=True;mat.use_nodes=True;mat.use_backface_culling=False
        nodes=mat.node_tree.nodes;links=mat.node_tree.links;nodes.clear()
        bs=nodes.new('ShaderNodeBsdfPrincipled');out=nodes.new('ShaderNodeOutputMaterial');links.new(bs.outputs[0],out.inputs['Surface'])
        bs.inputs['Base Color'].default_value=srgb(palette.get(name,'b6ad9a'))
        bs.inputs['Roughness'].default_value=.84
        def tex(file,uvname,linear=False):
            path=(LIB/file) if '.' in file else OLD/(file+'.webp')
            image=bpy.data.images.load(str(path),check_existing=True)
            if linear:image.colorspace_settings.name='Non-Color'
            node=nodes.new('ShaderNodeTexImage');node.image=image
            coords=nodes.new('ShaderNodeUVMap');coords.uv_map=uvname;links.new(coords.outputs['UV'],node.inputs[0])
            return node
        if col:
            image=tex(col,layer)
            links.new(image.outputs['Color'],bs.inputs['Base Color'])
            if name=='riparian_crown':
                alpha=nodes.new('ShaderNodeMath');alpha.operation='GREATER_THAN';alpha.inputs[1].default_value=.41
                links.new(image.outputs['Alpha'],alpha.inputs[0])
                # A captured canopy has its own fine-scale lighting. Crossed bough faces
                # must not turn black and yellow on opposite sides of the same tree.
                transparent=nodes.new('ShaderNodeBsdfTransparent')
                path=nodes.new('ShaderNodeLightPath');emission=nodes.new('ShaderNodeEmission')
                links.new(image.outputs['Color'],emission.inputs['Color'])
                visible=nodes.new('ShaderNodeMixShader')
                links.new(path.outputs['Is Camera Ray'],visible.inputs[0])
                links.new(bs.outputs[0],visible.inputs[1]);links.new(emission.outputs[0],visible.inputs[2])
                cutout=nodes.new('ShaderNodeMixShader')
                links.new(alpha.outputs[0],cutout.inputs[0]);links.new(transparent.outputs[0],cutout.inputs[1])
                links.new(visible.outputs[0],cutout.inputs[2]);links.new(cutout.outputs[0],out.inputs['Surface'])
        if norm:
            nm=nodes.new('ShaderNodeNormalMap');nm.uv_map='Current' if name=='jade_water' else layer
            nm.inputs['Strength'].default_value=.53 if name=='jade_water' else .68
            links.new(tex(norm,nm.uv_map,True).outputs[0],nm.inputs['Color']);links.new(nm.outputs[0],bs.inputs['Normal'])
        if rough:links.new(tex(rough,layer,True).outputs[0],bs.inputs['Roughness'])
        if name.startswith('iron'):
            bs.inputs['Metallic'].default_value=.68;bs.inputs['Roughness'].default_value=.53
        if name=='jade_water':
            bs.inputs['Roughness'].default_value=.22;bs.inputs['Metallic'].default_value=.23
        if name=='wet_schist':bs.inputs['Roughness'].default_value=.37

def render_proofs():
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
    scene.cycles.max_bounces=4;scene.cycles.transparent_max_bounces=8
    for o in scene.objects:
        if o.type=='MESH' and o.data.materials[0].name=='iron_far':o.hide_render=True
    scene.world=bpy.data.worlds.new('Gorge sky');scene.world.use_nodes=True
    tree=scene.world.node_tree;sky=tree.nodes.new('ShaderNodeTexEnvironment')
    sky.image=bpy.data.images.load(str(LIB/'sky.jpg'),check_existing=True)
    tree.links.new(sky.outputs['Color'],tree.nodes['Background'].inputs[0])
    tree.nodes['Background'].inputs[1].default_value=1.15
    bpy.ops.object.light_add(type='SUN');sun=bpy.context.object;sun.data.energy=3.4;sun.data.angle=.075
    sun.data.color=(1.,.85,.70)
    sun.rotation_euler=Vector((-1.34,1.96,-1.65)).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam
    cam.data.sensor_fit='VERTICAL';cam.data.sensor_height=32;cam.data.lens=16/math.tan(math.radians(21))
    cam.data.clip_start=.035;cam.data.clip_end=13000
    scene.render.resolution_x=1120;scene.render.resolution_y=700;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.73
    scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=92
    folder=ROOT/'output/luding-standard';folder.mkdir(parents=True,exist_ok=True)
    stills=LIB.parent/'stills';stills.mkdir(exist_ok=True)
    half=WALK['span']/2
    for shot in WALK['stops']:
        x=shot['metres']-half;eye=WALK['floorAtCentre']+WALK['sag']*(min(half,abs(x))/half)**2+WALK['eyeHeight']
        p=shot['pitch'];a=shot['yaw'];cam.location=(x,-shot['z'],eye)
        direction=Vector((-math.sin(a)*math.cos(p),math.cos(a)*math.cos(p),-math.sin(p)))
        cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
        scene.render.image_settings.file_format='JPEG'
        scene.render.filepath=str(folder/('blender-'+shot['id']+'.jpg'));bpy.ops.render.render(write_still=True)
        scene.render.image_settings.file_format='WEBP';scene.render.image_settings.quality=88
        bpy.data.images['Render Result'].save_render(str(stills/(shot['id']+'.webp')),scene=scene)
