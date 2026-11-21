"""Independently editable, modelled components of the journal guide (metres)."""
import math
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

def pigment(name,rgb,roughness=.78):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color=(*rgb,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*rgb,1);p.inputs['Roughness'].default_value=roughness
    return m

def form(name,verts,faces,mat,smooth=False):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata([tuple(v) for v in verts],[],faces);mesh.update()
    item=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(item)
    mesh.materials.append(mat)
    if smooth:
        for f in mesh.polygons:f.use_smooth=True
    return item

def sweep(name,points,radii,mat,n=12,aspect=1,fold=0):
    verts=[];faces=[];points=list(map(Vector,points))
    for j,(pt,r) in enumerate(zip(points,radii)):
        axis=(points[min(j+1,len(points)-1)]-points[max(0,j-1)]).normalized()
        u=axis.cross(Vector((0,0,1)) if abs(axis.z)<.86 else Vector((0,1,0))).normalized()
        v=axis.cross(u).normalized()
        for k in range(n):
            a=math.tau*k/n;rr=r*(1+fold*math.sin(5*a+.4*j))
            verts.append(pt+rr*(math.cos(a)*u+aspect*math.sin(a)*v))
            if j:
                i=(j-1)*n+k;q=(j-1)*n+(k+1)%n;faces.append((i,q,q+n,i+n))
    faces.extend([tuple(range(n-1,-1,-1)),tuple(range(len(verts)-n,len(verts)))])
    return form(name,verts,faces,mat,True)

def ribbon(name,a,b,mat,thickness=.002):
    points=[Vector(c) for pair in zip(a,b) for c in pair]
    length=len(points);offset=Vector((0,thickness,0))
    verts=points+[p+offset for p in points];faces=[]
    for i in range(0,length-2,2):
        faces.extend([(i,i+1,i+3,i+2),(i+length+2,i+length+3,i+length+1,i+length),
                      (i,i+2,i+2+length,i+length),(i+1,i+1+length,i+3+length,i+3)])
    faces.extend([(0,length,length+1,1),(length-2,length-1,length*2-1,length*2-2)])
    return form(name,verts,faces,mat)

def add_details(body):
    cotton=pigment('石蓝棉布',(.109,.123,.133))
    dark=pigment('反折袖口',(.068,.080,.089))
    skin=pigment('手部肤色',(.52,.295,.174),.76)
    paper=pigment('毛边纸',(.72,.60,.42));ink=pigment('石墨',(.038,.034,.030))
    cover=pigment('手记纸板封皮',(.255,.136,.058))
    leather=pigment('朱红扣带',(.34,.043,.021))
    brass=pigment('旧铜扣',(.45,.28,.082),.39)
    canvas=pigment('帆布包滚边',(.28,.177,.077))
    # Recess the original fused forearm/book volume into the jacket front.
    # The new sleeves, palms, book block and fingers occupy distinct volumes.
    body.data.materials.append(cotton)
    for v in body.data.vertices:
        x,y,z=v.co
        if .96<z<1.25 and y<-.069:
            blend=min(1,(z-.96)/.055,(1.25-z)/.048)
            v.co.y+=max(0,-y-.087)*blend*.90
    body.data.update()
    for face in body.data.polygons:
        p=face.center
        if 1.005<p.z<1.221 and p.y<.012:face.material_index=1
    body.data.update()
    def page(x,v,layer=0):
        return Vector((.036+x,-.235+.48*v+.27*abs(x)+layer,1.093+.89*v+.053*x))
    # Two stiff covers fold about the spine. Each signature has its own raised
    # edge so the stepped leaves are legible from the side and in clay mode.
    for side in [-1,1]:
        for j in range(7):
            a=.002*side;b=side*(.137-.0028*(j%3));h=.102-.0015*(j%2)
            z=.004+j*.0016
            ribbon('书帖 %s-%02d'%(side,j),[page(a,-h,z),page(b,-h,z)],[page(a,h,z),page(b,h,z)],paper,.0012)
        ribbon('手记封板 '+str(side),[page(.001*side,-.105),page(side*.143,-.105)],
               [page(.001*side,.105),page(side*.143,.105)],cover,.0035)
    sweep('书脊',[page(0,-.104,-.002),page(0,0,-.002),page(0,.104,-.002)],[.0053]*3,cover,10)
    for s in [-1,1]:
        path=[page(.016+s*.008,v,-.0045) for v in [-.104,-.06,0,.06,.104]]
        if s<0:edge=path
        else:ribbon('绕封面扣带',edge,path,leather,.0026)
    sweep('书扣铜钉',[page(.016,-.054,-.007),page(.016,-.054,-.010)],[.005,.004],brass,10)
    for side in [-1,1]:
        elbow=(side*.189,-.049,1.036)
        wrist=(side*(.114 if side==-1 else .128),-.19,1.065 if side==1 else 1.119)
        middle=Vector(elbow).lerp(Vector(wrist),.58)
        sweep('曲肘袖 '+str(side),[(side*.177,-.015,1.167),elbow,middle,wrist],[.060,.068,.056,.042],cotton,18,.93,.065)
        sweep('卷袖 '+str(side),[Vector(elbow).lerp(Vector(wrist),.81),wrist],[.049,.046],dark,18,.91,.05)
        if side==1:
            palm=page(.081,-.074,-.009)
            sweep('托书手掌',[wrist,palm+Vector((.020,.004,-.004)),palm],[.025,.036,.030],skin,14,.52)
            for j in range(4):
                a=page(.095-j*.012,-.088,-.008);b=page(.063-j*.012,-.066+j*.003,-.010)
                sweep('托书指节 %d'%j,[a,(a+b)/2+Vector((0,-.003,0)),b],[.0066,.0063,.0049],skin,9,.78)
            sweep('托书拇指',[palm,page(.108,-.032,-.011),page(.103,-.006,-.008)],[.011,.009,.006],skin,10)
        else:
            palm=Vector((-.066,-.203,1.143))
            sweep('执笔手掌',[wrist,palm+Vector((-.016,.005,-.007)),palm],[.023,.032,.025],skin,14,.62)
            for j in range(4):
                a=palm+Vector((.006,-.012+j*.006,.012-j*.009))
                b=a+Vector((.028,-.010,.006))
                sweep('执笔指节 %d'%j,[a,b,b+Vector((.007,.003,-.017))],[.007,.006,.0048],skin,9)
            sweep('执笔拇指',[palm+Vector((-.003,-.008,.018)),(-.037,-.227,1.171),(-.030,-.228,1.155)],[.009,.008,.0056],skin,9)
            sweep('木杆铅笔',[(-.083,-.208,1.234),(-.03,-.221,1.157),(-.016,-.225,1.135)],[.0044,.0043,.0018],cover,7)
            sweep('笔芯',[(-.016,-.225,1.135),(-.014,-.226,1.131)],[.0019,.00045],ink,7)
    # Fit pack seams and cap brim to the reconstructed surface rather than
    # projecting painted details into empty space.
    tree=BVHTree.FromPolygons([v.co for v in body.data.vertices],[p.vertices[:] for p in body.data.polygons])
    def touch(x,z,offset=.001):
        hit=tree.ray_cast(Vector((x,-1,z)),Vector((0,1,0)),1.8)[0]
        return hit+Vector((0,-offset,0)) if hit is not None else None
    # Rounded canvas gusset and overlapping flap, separately selectable from
    # the coat. Fit the panel to the actual silhouette using its ray-hit depth.
    bagcloth=pigment('挎包帆布',(.29,.174,.081))
    verts=[];faces=[];width=9
    for row in range(8):
        v=row/7;cz=.751+.160*v
        for col in range(width):
            u=col/(width-1);xx=.173+.114*(u-.5)+.025*(1-v)
            q=touch(xx,cz,.005)
            if q is None:q=Vector((xx,-.064,cz))
            q.y-=.013*math.sin(math.pi*u)*math.sin(math.pi*v)
            verts.append(q)
            if col and row:
                k=row*width+col;faces.append((k-width-1,k-width,k,k-1))
    edge=list(range(width))+[i*width+width-1 for i in range(1,8)]+list(range(7*width+width-2,7*width-1,-1))+[i*width for i in range(6,0,-1)]
    side_start=len(verts)
    verts.extend(verts[k]+Vector((0,.044,0)) for k in edge)
    for j,k in enumerate(edge):
        a=(j+1)%len(edge);faces.append((k,edge[a],side_start+a,side_start+j))
    form('挎包前片与侧褶',verts,faces,bagcloth,True)
    sweep('挎包包缝',[verts[k] for k in edge]+[verts[edge[0]]],[.0027]*(len(edge)+1),canvas,7)
    flap=[];fold_faces=[]
    for row in range(4):
        v=row/3
        for col in range(9):
            u=col/8
            x=.118+.112*u
            z=.909-(.042+.018*math.sin(math.pi*u))*v
            pt=touch(x,z,.016+.009*math.sin(math.pi*v))
            flap.append(pt if pt is not None else Vector((x,-.084,z)))
            if row and col:
                k=row*9+col;fold_faces.append((k-10,k-9,k,k-1))
    panel=form('挎包搭盖 · 软折边',flap,fold_faces,bagcloth,True)
    thick=panel.modifiers.new('搭盖厚度','SOLIDIFY');thick.thickness=.003
    sweep('搭盖明线',flap[-9:],[.0016]*9,canvas,7)
    strap_a=[];strap_b=[]
    for i in range(25):
        t=i/24;x=-.122+.283*t;z=1.328-.405*t
        a=touch(x-.015,z,.003);b=touch(x+.015,z,.003)
        if a is not None and b is not None:strap_a.append(a);strap_b.append(b)
    if len(strap_a)>1:ribbon('织带 · 斜背肩带',strap_a,strap_b,bagcloth,.003)
    seams=[[(.125,.895),(.144,.892),(.168,.890),(.19,.888),(.213,.881)],
           [(.130,.904),(.142,.875),(.154,.849),(.182,.84),(.205,.841)]]
    for i,line in enumerate(seams):
        edge=[q for x,z in line if (q:=touch(x,z,.002)) is not None]
        if len(edge)>1:sweep('布包盖滚边 '+str(i),edge,[.0028]*len(edge),canvas,7)
    buckle=touch(.169,.861,.022)
    if buckle is not None:sweep('布包黄铜揿扣',[buckle,buckle+Vector((0,-.004,0))],[.0068,.006],brass,14)

