"""Measured bridge craftsmanship and natural riverbank dressing for Luding.

These additions are interpretive surface detail, not a survey of the 1935 town.
All coordinates are metres in the same scene as the walk cameras.
"""
import math
import random
from pathlib import Path

import bpy
from mathutils import Vector


def craft_bridge(env, geometry):
    """Broken tile courses, pinned chain ends and irregular masonry joints."""
    rng = random.Random(19350529)
    from luding_keyframe import available
    batches = {}

    def mesh(verts, faces, mat):
        vv, ff = batches.setdefault(mat, ([], []))
        start = len(vv)
        vv.extend(verts)
        ff.extend(tuple(start + i for i in face) for face in faces)

    def block(cx, cy, cz, width, depth, height, mat, bevel=.018):
        # A shallow chamfer catches the light without softening the stone mass.
        w, d = width / 2, depth / 2
        b = min(bevel, w * .2, d * .2)
        outline = [(-w+b,-d),(w-b,-d),(w,-d+b),(w,d-b),
                   (w-b,d),(-w+b,d),(-w,d-b),(-w,-d+b)]
        vs = [(cx+x,cy+y,cz+z) for z in (-height/2,height/2) for x,y in outline]
        mesh(vs, [tuple(range(7,-1,-1)),tuple(range(8,16))] +
             [(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)], mat)

    def tube(points, radius, mat, sides=8):
        verts=[]
        for j, point in enumerate(points):
            tangent=(Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])).normalized()
            across=tangent.cross(Vector((0,0,1)))
            if across.length<.01: across=tangent.cross(Vector((0,1,0)))
            across.normalize(); up=tangent.cross(across)
            verts.extend(tuple(Vector(point)+radius*(math.cos(i*math.tau/sides)*across+
                         math.sin(i*math.tau/sides)*up)) for i in range(sides))
        faces=[(j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i)
               for j in range(len(points)-1) for i in range(sides)]
        mesh(verts,faces,mat)

    half=103.67/2
    for side in (-1,1):
        centre=side*(half+2.2)
        w,d,z,rise=6.5,8.7,13.6,2.3
        ridge=max(w*.145,w*.5-d*.38)

        def roof_point(u,t,s):
            edge=abs(u)/(w*.5)
            return (centre+u*((1-t)*ridge/(w*.5)+t),s*t*d*.5,
                    z+rise*(1-t)**.76+.13*t**6+.20*max(0,(edge-.8)/.2)**2*t**3)

        # Lapped clay tiles have individual lips and a low rolled profile.
        # Courses get closer towards the ridge, following the curved roof.
        columns=34; rows=19
        for slope in (-1,1):
            for row in range(rows):
                t0=max(.022,row/rows-.018);t1=min(1.,(row+1)/rows+.008)
                for col in range(columns):
                    u0=-w*.5+col*w/columns+.003
                    u1=-w*.5+(col+1)*w/columns-.003
                    vertices=[]
                    variation=rng.uniform(-.009,.009)
                    for j in range(3):
                        t=t0+(t1-t0)*j/2
                        for k in range(5):
                            u=u0+(u1-u0)*k/4
                            px,py,pz=roof_point(u,t,slope)
                            roll=.037*math.sin(k*math.pi/4)**2
                            vertices.append((px,py,pz+.031+roll+variation+.019*(j==2)))
                    faces=[(j*5+k,j*5+k+1,j*5+k+6,j*5+k+5) for j in range(2) for k in range(4)]
                    # Exposed lower clay edges are geometry, not painted lines.
                    vertices.extend((a,b,c-.025) for a,b,c in vertices[10:15])
                    faces.extend((10+k,11+k,16+k,15+k) for k in range(4))
                    mesh(vertices,faces,'luding_clay_'+str(rng.choices(range(4),[5,3,2,1])[0]))
        # Tile courses turn around the two hipped ends.
        for end in (-1,1):
            for row in range(2,rows):
                t0=row/rows-.016;t1=min(1.,(row+1)/rows+.008)
                cols=max(3,int(2*d*t1/.26))
                for col in range(cols):
                    vertices=[]
                    for j,t in enumerate((t0,t1)):
                        for k in range(5):
                            u=-1+2*(col+k/4)/cols
                            vertices.append((centre+end*(ridge*(1-t)+w*.5*t),d*.5*t*u,
                              z+rise*(1-t)**.76+.13*t**6+.20*abs(u)**4*t**3+
                              .033+.035*math.sin(k*math.pi/4)**2+.016*j))
                    mesh(vertices,[(k,k+1,k+6,k+5) for k in range(4)],'luding_clay_'+str(rng.randrange(3)))
        # Main ridge: short overlapping half-round covers and restrained end caps.
        for j in range(11):
            px=centre-ridge+.025+j*(2*ridge-.05)/11
            tube([(px+.19*k/4, .064*math.cos(k*math.pi/4),z+rise+.08+.064*math.sin(k*math.pi/4))
                  for k in range(5)],.035,'luding_clay_1',6)

        # Large staggered stones face the river; small masonry scans alone
        # cannot carry the bridgehead's nine-metre structural scale.
        riverface=centre-side*2.65
        for row in range(16):
            low=.24+row*.595
            y=-3.6-rng.uniform(.15,.65)
            while y<3.6:
                size=rng.uniform(.64,1.30);left=max(-3.59,y);right=min(3.59,y+size-.028)
                if right>left:
                    protrusion=rng.uniform(.055,.13)
                    block(riverface-side*protrusion,(left+right)/2,low+.275,
                          .15,right-left,.546+rng.uniform(-.018,.018),
                          'luding_masonry_'+str(rng.randrange(3)),.028)
                y+=size
        # A coping course and the actual transfer of the hand chains into stone.
        for y in (-3.30,-2.63,2.63,3.30):
            if available('kf-stone-platform'):continue
            block(centre,y,9.91,5.34,.62,.18,'luding_masonry_1',.035)
        for y in (-1.55,1.55):
            # Small dressed terminal stones take the handrail chains at their
            # actual height, avoiding unsupported, pipe-like drooping ends.
            block(side*(half+.30),y,10.55,.32,.34,1.27,'luding_masonry_1',.025)
            for level in (.64,1.25):
                h=9.9+level
                tube([(side*half,y,h),(side*(half+.30),y,h)],.054,'luding_anchor')
                block(side*(half+.30),y,h,.10,.38,.13,'luding_anchor',.014)
                # Forged collar and the pin passing across it.
                tube([(side*(half+.30),y-.18,h),(side*(half+.30),y+.18,h)],.042,'luding_anchor')
                for yy in (y-.192,y+.192):
                    tube([(side*(half+.30)-.025,yy,h),(side*(half+.30)+.025,yy,h)],.065,'luding_anchor')
        # Dark iron shoes reinforce the timber's stone threshold.
        for dx in (-1.8,0,1.8):
            for y in (-2.6,2.6):
                if available('kf-pavilion'):continue
                block(centre+dx,y,10.34,.405,.405,.31,'luding_anchor',.014)

    # Close the former tree pit now that the tree stands clear of the landing.
    if not available('kf-stone-platform'):
        block(61.57,-1.51,9.955,1.30,2.07,.085,'dressed_stone')
    for mat,(vs,fs) in batches.items():
        if available('kf-pavilion') and mat.startswith('luding_clay_'):continue
        o=geometry('Luding craft / '+mat,vs,fs,mat)
        o['craftDetail']=True


def place_backbasket():
    """Place the optional user basket on the visible east landing in metres."""
    path=Path(__file__).resolve().parents[1]/'assets/luding/props/bamboo-backbasket.glb'
    if not path.exists(): return
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects=[o for o in bpy.context.selected_objects if o.type=='MESH']
    if len(objects)!=1:
        raise ValueError('Expected one prepared bamboo-backbasket mesh')
    obj=objects[0]
    # Bake importer transforms before measuring; preserve the supplied UVs,
    # colour texture and source metadata. The normalized asset stays untouched.
    world=obj.matrix_world.copy();obj.parent=None
    obj.data.transform(world);obj.matrix_world.identity()
    corners=[Vector(c) for c in obj.bound_box]
    low=Vector(tuple(min(p[i] for p in corners) for i in range(3)))
    high=Vector(tuple(max(p[i] for p in corners) for i in range(3)))
    extent=max(high.x-low.x,high.y-low.y)
    if extent<=0:raise ValueError('The prepared basket has no horizontal extent')
    scale=.52/extent
    obj.rotation_euler=(0,0,.45);obj.scale=(scale,scale,scale)
    bpy.context.view_layer.update()
    corners=[obj.matrix_world@Vector(c) for c in obj.bound_box]
    bottom=Vector(((min(v.x for v in corners)+max(v.x for v in corners))/2,
                   (min(v.y for v in corners)+max(v.y for v in corners))/2,
                   min(v.z for v in corners)))
    # Stone paving tops at 9.9975 m. This spot is clear of the wooden column
    # shoe and stays entirely inside the pavilion stop's upward-tilted frame.
    floor=10.
    from luding_keyframe import surface_height
    for landing in bpy.context.scene.objects:
        if landing.get('keyframeAsset')=='kf-stone-platform':
            value=surface_height(landing,56.8,-2.2)
            if value is not None:floor=value+.003
    obj.location=Vector((56.8,-2.2,floor))-bottom
    obj['contributedProp']='bamboo-backbasket'
    obj['placedMetres']=[56.8,-2.2,floor]
    obj['intrinsicDimensionsMetres']=[float(high[i]-low[i])*scale for i in range(3)]
    print('BASKET_PLACED',list(obj.location),list(obj['intrinsicDimensionsMetres']),flush=True)
    return obj
