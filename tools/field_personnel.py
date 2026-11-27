"""Human-scale historical people, with explicit civilian/military separation.

Existing `walker` calls are the marching/meeting parties in the route's historic
builders. Local residents, porters and boatmen remain distinct roles. These are
anonymous interpretive figures, without weapons or named historical likenesses.
The contemporary recorder and the approved Luding scene use their existing path.
"""
from collections import Counter
import json
import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
MEDIA=ROOT/'assets/valley'


def identity_for(sid,role,pose,x,y):
    if role in ('red_army','soldier','walker','delegate'):
        return 'red_army'
    # The original northern builders use pack=False for seated delegates.
    # Narrow pose/location rules preserve other residents in these same towns.
    if role=='local' and sid=='lianghekou' and pose=='sit' and -4<x<4 and -.4<y<3.9:
        return 'red_army'
    if role=='local' and sid=='baxi' and pose in ('sit','greet') and -5.1<x<5.1 and -2<y<1.6:
        return 'red_army'
    return role if role in ('boatman','porter') else 'civilian'


def build_person(f,x,y,z,height,yaw,pose,role):
    identity=identity_for(getattr(f.env,'sid',''),role,pose,x,y)
    army=identity=='red_army';boatman=identity=='boatman';porter=identity=='porter'
    f.count+=1;f.is_guide=False;f.people.append((x,y,z,height))
    f.identities.append({'identity':identity,'source_role':role,'pose':pose,
                         'position':[x,y,z],'height':height})
    f.portrait_candidates.append((x,y,z,height,yaw,pose,army))
    f.pivot=Vector((x,y,z));f.yaw=yaw;f.scale=height/(1.663 if army else 1.664)
    appearance=getattr(f,'appearance_index',0) or f.count
    phase=1 if appearance%2 else -1
    female=(appearance%11==4 and not boatman and role!='delegate')
    coat=('fig_army_cloth' if army else 'fig_civil_umber' if boatman or porter else
          ['fig_civil_indigo','fig_civil_taupe','fig_civil_slate'][appearance%3])
    coat_vertex_start=len(f.parts[(False,coat)][0])
    coat_face_start=len(f.parts[(False,coat)][1])
    trousers='fig_army_trousers' if army else 'fig_civil_trousers'
    alias={'skin':'fig_skin','hair':'fig_hair','face_worker':'fig_face_worker',
           'face_guide':'fig_face_worker','capblue':'fig_army_cap','capbrim':'fig_cap_brim',
           'seam':'fig_seam','straw':'fig_straw','hemp':'fig_hemp'}
    original_mesh=f.mesh
    def mesh(points,faces,material,uv=None):
        original_mesh(points,faces,alias.get(material,material),uv)
    f.mesh=mesh
    try:
        seated=pose=='sit';scribe=pose in ('write','read');walking=pose in ('walk','climb')
        hip=.53 if seated else .88
        # Articulated hips, knees and ankles rather than straight cylinders.
        for side in (-1,1):
            stride=.235*side*phase if walking else .024*side
            lift=.115 if pose=='climb' and side==phase else 0
            knee=(side*.103,-.29 if seated else -.065+stride*.60,.46 if seated else .49+lift*.45)
            ankle=(side*.111,-.37 if seated else stride,.112+lift)
            if army or porter:
                cuff_z=.342+lift
                cuff_y=ankle[1]+(knee[1]-ankle[1])*(cuff_z-ankle[2])/(knee[2]-ankle[2])
                knee_in=Vector(knee)+Vector((0,-.008,.029))
                knee_out=Vector(knee).lerp(Vector((side*.108,cuff_y,cuff_z)),.24)
                knee_out.y+=.008
                leg=[(side*.086,.01,hip),(side*.104,knee[1]*.47,hip*.63+knee[2]*.37),
                     knee_in,knee,knee_out,(side*.108,cuff_y,cuff_z)]
                f.tube(leg,[.096,.100,.082,.072,.076,.063],trousers,18,.86)
            else:
                f.tube([(side*.086,.01,hip),(side*.104,knee[1]*.47,hip*.63+knee[2]*.37),
                        knee,(side*.108,(knee[1]+ankle[1])*.5,.29+lift*.78),ankle],
                       [.096,.100,.072,.068,.043],trousers,16,.86)
            # Loose knee fabric and a reinforced cuff create independent volume.
            if army or porter:
                rows=[]
                for j in range(7):
                    zz=ankle[2]+.014+j*.037
                    t=(zz-ankle[2])/(knee[2]-ankle[2]);yy=ankle[1]+(knee[1]-ankle[1])*t
                    radius=.047+.019*j/6
                    rows.append((ankle[0],yy,zz,radius,radius*.89))
                f.rings(rows,'fig_wraps',18,.008)
                spiral=[]
                for j in range(96):
                    t=j/95;zz=ankle[2]+.014+.222*t
                    yy=ankle[1]+(knee[1]-ankle[1])*(zz-ankle[2])/(knee[2]-ankle[2])
                    radius=.0485+.019*t;angle=t*math.tau*5.7
                    spiral.append((ankle[0]+radius*math.sin(angle),yy-radius*.90*math.cos(angle),zz))
                f.tube(spiral,[.0018]*len(spiral),'fig_wrap_edge',5)
            fx,fy=ankle[:2];foot=lift
            f.rings([(fx,fy-.045,foot+.015,.051,.118),(fx,fy-.047,foot+.029,.055,.121),
                     (fx,fy-.048,foot+.040,.055,.122)],'fig_sole',18)
            f.rings([(fx,fy-.048,foot+.040,.054,.117),(fx,fy-.045,foot+.064,.055,.111),
                     (fx,fy-.019,foot+.087,.050,.083),(fx,fy,foot+.117,.042,.056)],'fig_shoe',18)
            f.tube([(fx-.037,fy-.113,foot+.052),(fx,fy-.128,foot+.057),
                    (fx+.037,fy-.113,foot+.052)],[.0025]*3,'fig_stitch',6)
        lean=-.030 if walking else 0
        f.rings([(0,.012,hip-.09,.163,.112),(0,.008,hip+.008,.171,.119),
                 (0,.009,hip+.085,.158,.109),(0,lean,hip+.19,.149,.109),
                 (0,lean,hip+.31,.162,.116),(0,lean+.006,hip+.425,.189,.108),
                 (0,lean+.012,hip+.475,.171,.087),(0,lean+.012,hip+.493,.082,.061)],coat,28,.028)
        # Tailored hem, collar, front placket and shoulder seams remain geometry.
        f.rings([(0,.009,hip-.080,.165,.114),(0,.009,hip-.059,.168,.116)],coat,28,.022)
        f.rings([(0,.008,hip+.475,.077,.064),(0,.006,hip+.520,.069,.058)],coat,24,.008)
        f.rings([(0,.009,hip+.487,.057,.052),(0,.006,hip+.565,.053,.049)],'fig_skin',18)
        f.panel((.012,-.119+lean,hip+.205),.020,.47,.009,coat)
        for j in range(5):
            zz=hip+.018+j*.085
            if army:
                f.oval((.013,-.128+lean,zz),(.006,.004,.006),'fig_buttons',9)
            else:
                f.tube([(-.015,-.123+lean,zz),(.018,-.128+lean,zz),(.034,-.122+lean,zz+.005)],
                       [.0038]*3,'fig_frog_clasp',7)
        if army:
            for side in (-1,1):
                f.panel((side*.101,-.116+lean,hip+.285),.084,.090,.009,coat)
                f.panel((side*.101,-.128+lean,hip+.326),.092,.029,.010,coat)
                f.oval((side*.101,-.135+lean,hip+.324),(.004,.003,.004),'fig_buttons',8)
            f.rings([(0,.007,hip+.055,.171,.122),(0,.007,hip+.083,.172,.123)],'fig_belt',28)
            f.panel((0,-.126,hip+.071),.029,.026,.008,'fig_buckle')
            for side in (-1,1):
                lapel=[(side*.022,-.065,hip+.515),(side*.082,-.100,hip+.478),
                       (side*.051,-.126,hip+.455),(side*.011,-.094,hip+.488)]
                f.mesh(lapel,[(0,1,2,3)],coat)
                centre=sum((Vector(point) for point in lapel),Vector())/4
                red=[tuple(centre+(Vector(point)-centre)*.62+Vector((0,-.0035,0))) for point in lapel]
                f.mesh(red,[(0,1,2,3)],'fig_cap_star')
        head_z=hip+.545
        f.head(head_z,female,'straw' if boatman else None)
        # Cover the fitted skull at the crown; the older hair/cap profiles left
        # scalp intersections visible from a slightly raised portrait camera.
        if army:
            f.oval((0,.009,head_z+.180),(.086,.099,.068),'fig_hair',24)
        else:
            f.rings([(0,.014,head_z+.163,.085,.098),(0,.011,head_z+.205,.085,.102),
                     (0,.008,head_z+.235,.069,.090),(0,.004,head_z+.251,.039,.057),
                     (0,.003,head_z+.256,.005,.008)],'fig_hair',28)
        if army:
            cap_rows=[(0,.004,head_z+.158,.095,.112),(0,.004,head_z+.181,.098,.114),
                      (-.006,.009,head_z+.199,.111,.127),(-.009,.010,head_z+.229,.108,.123),
                      (-.010,.010,head_z+.246,.082,.097),(0,.012,head_z+.253,.012,.025)]
            cap_vertices=[];cap_faces=[];n=32
            for j,(cx,cy,zz,rx,ry) in enumerate(cap_rows):
                for i in range(n):
                    angle=i*math.tau/n
                    octant=(angle+math.pi/8)%(math.pi/4)-math.pi/8
                    softness=.12+.88*math.cos(math.pi/8)/math.cos(octant)
                    cap_vertices.append((cx+rx*math.sin(angle)*softness,
                                         cy-ry*math.cos(angle)*softness,zz))
                    if j:
                        k=(j-1)*n+i;q=(j-1)*n+(i+1)%n
                        cap_faces.append((k,q,q+n,k+n))
            cap_faces.extend([tuple(reversed(range(n))),tuple(range(len(cap_vertices)-n,len(cap_vertices)))])
            f.mesh(cap_vertices,cap_faces,'fig_army_cap')
            for i in range(8):
                seam=[cap_vertices[j*n+i*4] for j in range(1,len(cap_rows))]
                f.tube(seam,[.0011]*len(seam),'fig_seam',5)
            brim=[(0,-.075,head_z+.171)]
            for j in range(21):
                angle=math.pi*j/20
                brim.append((.100*math.cos(angle),-.066-.088*math.sin(angle),
                             head_z+.169-.012*math.sin(angle)))
            f.mesh(brim,[(0,j+1,j+2) for j in range(20)],'fig_cap_brim')
        # Small sculpted eyelids, brows and lips support the fitted face texture.
        for side in (-1,1):
            f.tube([(side*.019,-.096,head_z+.117),(side*.034,-.102,head_z+.122),
                    (side*.050,-.090,head_z+.117)],[.0024,.0028,.0021],'fig_eyelid',8)
            f.tube([(side*.019,-.094,head_z+.135),(side*.036,-.099,head_z+.141),
                    (side*.052,-.086,head_z+.135)],[.0032,.0038,.0024],'fig_brow',8)
        f.tube([(-.023,-.101,head_z+.043),(0,-.111,head_z+.046),(.023,-.101,head_z+.043)],
               [.0018,.0022,.0018],'fig_lip',8)
        if army:
            # Restrained cloth star, confined to explicitly military caps.
            points=[]
            for i in range(10):
                angle=math.pi/2+i*math.pi/5;radius=.014 if i%2==0 else .006
                points.append((radius*math.cos(angle),-.123,head_z+.202+radius*math.sin(angle)))
            f.mesh(points,[tuple(range(10))],'fig_cap_star')
        elif porter:
            f.rings([(0,.01,head_z+.174,.090,.103),(0,.012,head_z+.199,.091,.106),
                     (-.009,.018,head_z+.229,.078,.094)],'fig_headcloth',24,.035)
        for side in (-1,1):
            shoulder=(side*.183,lean,hip+.427)
            if scribe:
                elbow=(side*.243,-.056,hip+.193)
                wrist=(side*.11,-.236,hip+.244 if side<0 else hip+.204)
                tip=(side*.053,-.27,wrist[2]-.035)
            elif pose=='row':
                elbow=(side*.255,-.13,hip+.275)
                wrist=(side*.21,-.29,hip+.28+side*.10)
                tip=(side*.18,-.33,wrist[2]-.007)
            elif pose in ('greet','point') and side>0:
                elbow=(side*.28,-.08,hip+.26)
                wrist=(side*.33,-.17,hip+.49)
                tip=(side*.34,-.18,hip+.565)
            else:
                swing=side*phase*.112 if walking else 0
                elbow=(side*.227,-.025-swing,hip+.183)
                wrist=(side*.237,-.045-swing*1.6,hip-.036)
                tip=(wrist[0],wrist[1]-.006,wrist[2]-.071)
            f.oval((side*.168,lean,hip+.413),(.077,.074,.080),coat,16)
            f.tube([shoulder,Vector(shoulder).lerp(Vector(elbow),.36),elbow,
                    Vector(elbow).lerp(Vector(wrist),.60),wrist],
                   [.074,.077,.063,.058,.045],coat,18,.91)
            f.tube([Vector(elbow).lerp(Vector(wrist),.87),wrist],[.052,.050],coat,16)
            f.hand(wrist,tip)
            # Three short raised fabric folds mark the flexed elbow.
            for j in range(3):
                centre=Vector(elbow).lerp(Vector(wrist),.12+j*.075)
                f.tube([centre+Vector((-.047,-.023,0)),centre+Vector((0,-.055,.003)),
                        centre+Vector((.047,-.023,0))],[.0026]*3,coat,7)
        if army and role in ('walker','red_army','soldier'):
            def coat_front(xx,zz):
                levels=[-.09,.008,.085,.19,.31,.425,.475,.493]
                rx=float(np.interp(zz,levels,[.163,.171,.158,.149,.162,.189,.171,.082]))
                ry=float(np.interp(zz,levels,[.112,.119,.109,.109,.116,.108,.087,.061]))
                cy=float(np.interp(zz,levels,[.012,.008,.009,lean,lean,lean+.006,lean+.012,lean+.012]))
                return cy-ry*math.sqrt(max(.005,1-(xx/rx)**2))-.016
            strap_points=[(-.151,.054,hip+.425),(-.151,.035,hip+.482),(-.151,-.061,hip+.478)]
            for xx,zz in [(-.135,.43),(-.095,.34),(-.025,.23),(.061,.12),(.143,.025),(.204,-.025)]:
                strap_points.append((xx,min(coat_front(xx,zz),-.16 if xx>.18 else 1),hip+zz))
            vertices=[];faces=[]
            coat_points,coat_faces,_=f.parts[(False,coat)]
            coat_tree=BVHTree.FromPolygons(coat_points[coat_vertex_start:],
                [tuple(index-coat_vertex_start for index in face) for face in coat_faces[coat_face_start:]])
            ray_direction=Vector((-math.sin(yaw),math.cos(yaw),0))
            for j,point in enumerate(strap_points):
                tangent=Vector(strap_points[min(j+1,len(strap_points)-1)])-Vector(strap_points[max(0,j-1)])
                across=Vector((tangent.z,0,-tangent.x)).normalized()*.019
                for depth in (.0025,-.0025):
                    for sign in (-1,1):
                        p=Vector(point)+across*sign;p.y+=depth
                        if j>=2:
                            hit,normal,index,distance=coat_tree.ray_cast(Vector(f.transform((p.x,-1,p.z))),ray_direction,3*f.scale)
                            if hit is not None:p.y=min(p.y,distance/f.scale-1-.009+depth)
                            else:p.y=min(p.y,coat_front(p.x,p.z-hip)+depth)
                        vertices.append(tuple(p))
                if j:
                    a=4*(j-1);b=4*j
                    faces.extend([(a,a+1,b+1,b),(a+2,b+2,b+3,a+3),(a,b,b+2,a+2),(a+1,a+3,b+3,b+1)])
            faces.extend([(0,2,3,1),tuple(range(len(vertices)-4,len(vertices)))])
            f.mesh(vertices,faces,'fig_canvas')
            # A slumped oval pouch and curved flap replace the rigid box proxy.
            f.rings([(.204,-.119,hip-.174,.055,.030),(.210,-.122,hip-.147,.093,.049),
                     (.211,-.121,hip-.088,.108,.058),(.207,-.118,hip-.006,.103,.054),
                     (.201,-.113,hip+.035,.088,.039)],'fig_canvas',24,.035)
            flap=[];flap_faces=[]
            for j in range(7):
                t=j/6
                for i in range(9):
                    u=i/8;xx=.204+(u-.5)*.207
                    yy=-.174-.010*math.sin(math.pi*u)*math.sin(math.pi*t)+.015*t*t
                    zz=hip+.023-.105*t+.008*math.cos((u-.5)*math.pi)*t
                    flap.append((xx,yy,zz))
                    if i and j:
                        q=j*9+i;flap_faces.append((q-10,q-9,q,q-1))
            f.mesh(flap,flap_faces,'fig_canvas_flap')
            f.oval((.206,-.178,hip-.053),(.007,.004,.007),'fig_buttons',9)
            if appearance%3!=1:
                f.tube([(-.145,.145,hip+.302),(.145,.145,hip+.302)],
                       [.083,.083],'fig_bedroll',18)
                for sx in (-.105,.105):
                    f.rings([(sx,.145,hip+.218,.012,.012),(sx,.145,hip+.390,.012,.012)],'fig_canvas',8)
        if porter:
            f.panel((0,.145,hip+.19),.29,.27,.14,'fig_bundle')
            for sx in (-.11,.11):
                f.strap([(sx,.17,hip+.31),(sx,.03,hip+.47),(sx,-.11,hip+.32)],.027,'fig_hemp')
        if scribe:
            f.panel((0,-.255,hip+.255),.182,.128,.024,'fig_pages',-.43)
            f.panel((0,-.271,hip+.256),.191,.137,.007,'fig_book',-.43)
            f.tube([(-.061,-.276,hip+.265),(-.094,-.267,hip+.348)],
                   [.0032,.0032],'fig_pencil',7)
        if pose=='row':
            f.tube([(.45,-.33,hip+.53),(.17,-.33,hip+.39),(-.18,-.33,hip+.175),
                    (-1.72,-.33,hip-.75)],[.017,.023,.025,.025],'fig_oar',10)
            f.mesh([(-1.65,-.35,hip-.72),(-1.83,-.38,hip-.74),(-2.18,-.40,hip-1.0),
                    (-2.10,-.36,hip-1.11),(-1.80,-.32,hip-.90)],[(0,1,2,3,4)],'fig_oar')
    finally:
        f.mesh=original_mesh;f.is_guide=False


# Explicit colour/finish names avoid silently inheriting the old generic palette.
FINISH={
    'fig_army_cloth':('687480','field-cotton'),
    'fig_army_trousers':('606a72','field-cotton'),
    'fig_army_cap':('6b7781','field-cotton'),
    'fig_civil_umber':('776650','field-canvas'),
    'fig_civil_indigo':('73797d','field-cotton'),
    'fig_civil_taupe':('948571','field-cotton'),
    'fig_civil_slate':('738078','field-cotton'),
    'fig_civil_trousers':('5c635e','field-cotton'),
    'fig_canvas':('8e8066','field-canvas'),'fig_canvas_flap':('88795f','field-canvas'),
    'fig_bundle':('8b7c60','field-canvas'),'fig_bedroll':('7f897f','field-canvas'),
    'fig_wraps':('9a9686','field-cotton'),'fig_wrap_edge':('77796f',None),
    'fig_skin':('b7967b',None),'fig_hair':('302c29',None),
    'fig_face_worker':('ffffff','worker-face'),'fig_straw':('aa9874','field-reed'),
    'fig_headcloth':('706f64','field-cotton'),'fig_hemp':('a39172',None),
    'fig_cap_brim':('52616c',None),'fig_seam':('65717a',None),
    'fig_eyelid':('8e705f',None),'fig_brow':('55473d',None),'fig_lip':('9f7669',None),
    'fig_buttons':('504e45',None),'fig_belt':('6c6453',None),'fig_buckle':('827965',None),
    'fig_shoe':('4b4a43','field-cotton'),'fig_sole':('393932',None),
    'fig_stitch':('7b7769',None),'fig_fold_edge':('7b8588',None),
    'fig_cap_star':('9e4139',None),'fig_frog_clasp':('8f8b78',None),
    'fig_pages':('d9cfb4',None),'fig_book':('887252',None),
    'fig_pencil':('66513a',None),'fig_oar':('937956','field-oak'),
}


def finish_figure(obj,name,identities):
    mat=obj.data.materials[0]
    if not mat.get('fieldFigureFinish'):
        hexcode,texture=FINISH[name]
        rgb=np.array([int(hexcode[i:i+2],16)/255 for i in (0,2,4)],dtype=np.float32)
        linear=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
        mat.use_nodes=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links;nodes.clear()
        bsdf=nodes.new('ShaderNodeBsdfPrincipled');output=nodes.new('ShaderNodeOutputMaterial')
        links.new(bsdf.outputs['BSDF'],output.inputs['Surface'])
        bsdf.inputs['Base Color'].default_value=tuple(linear)+(1,)
        bsdf.inputs['Roughness'].default_value=.91 if name!='fig_skin' else .76
        bsdf.inputs['Specular IOR Level'].default_value=.24
        mat.diffuse_color=tuple(linear)+(1,)
        if texture:
            image_name='Field figure '+name
            image=bpy.data.images.get(image_name)
            if image is None:
                original=bpy.data.images.load(str(MEDIA/(texture+'.webp')),check_existing=True)
                image=original.copy();image.name=image_name
                image.scale(512 if texture=='worker-face' else 256,512 if texture=='worker-face' else 256)
                if texture!='worker-face':
                    pixels=np.array(image.pixels[:],dtype=np.float32).reshape(-1,4)
                    luminance=pixels[:,:3]@np.array([.213,.715,.072])
                    yy,xx=np.mgrid[0:image.size[1],0:image.size[0]]
                    weave=(np.sin(xx*math.tau/8)*np.sin(yy*math.tau/8)).ravel()
                    luminance=np.clip(1+.20*(luminance/max(.01,float(luminance.mean()))-1)+.024*weave,.89,1.07)
                    pixels[:,:3]=np.clip(luminance[:,None]*rgb,0,1)
                    image.pixels[:]=pixels.ravel()
                image.pack()
            tex=nodes.new('ShaderNodeTexImage');tex.image=image
            links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
            mat['fieldCloth']=texture!='worker-face'
            if texture!='worker-face':
                # A small tangent-space weave normal remains an actual glTF map,
                # so the online native material has the same cloth relief.
                normal_name='Field weave '+name
                normal_image=bpy.data.images.get(normal_name)
                if normal_image is None:
                    normal_image=bpy.data.images.new(normal_name,width=128,height=128)
                    yy,xx=np.mgrid[0:128,0:128]
                    nx=.085*np.cos(xx*math.tau/4)*np.sin(yy*math.tau/4)
                    ny=.085*np.sin(xx*math.tau/4)*np.cos(yy*math.tau/4)
                    nz=np.sqrt(np.maximum(0,1-nx*nx-ny*ny))
                    normal_image.colorspace_settings.name='Non-Color'
                    pixels=np.stack((nx*.5+.5,ny*.5+.5,nz*.5+.5,np.ones_like(nx)),axis=2)
                    normal_image.pixels[:]=pixels.astype(np.float32).ravel();normal_image.pack()
                normal_tex=nodes.new('ShaderNodeTexImage');normal_tex.image=normal_image
                normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.55
                links.new(normal_tex.outputs['Color'],normal.inputs['Color'])
                links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
        mat['fieldFigureFinish']=True;mat['fieldFigureVersion']=2
    if not obj.data.uv_layers and mat.get('fieldCloth'):
        layer=obj.data.uv_layers.new(name='ClothUV')
        for face in obj.data.polygons:
            axis=max(range(3),key=lambda i:abs(face.normal[i]))
            for index in face.loop_indices:
                point=obj.data.vertices[obj.data.loops[index].vertex_index].co
                layer.data[index].uv=((point.y if axis==0 else point.x)/.060,
                                     (point.y if axis==2 else point.z)/.060)
    obj['fieldFigureVersion']=2
    obj['historicalFigureIdentities']=json.dumps(dict(Counter(item['identity'] for item in identities)))
    obj['historicalFigurePoses']=json.dumps(dict(Counter(item['pose'] for item in identities)))
