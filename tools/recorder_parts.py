"""Independently editable, modelled components of the journal guide (metres)."""
import math
import bpy,bmesh
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
    paper=pigment('毛边纸',(.76,.66,.49),.94);ink=pigment('石墨',(.038,.034,.030),.88)
    cover=pigment('手记纸板封皮',(.255,.136,.058))
    leather=pigment('朱红扣带',(.34,.043,.021))
    brass=pigment('旧铜扣',(.45,.28,.082),.39)
    canvas=pigment('帆布包滚边',(.28,.177,.077))
    # Keep the registered trousers, puttees and shoes. The old torso includes
    # painted arms and a fused book; replace that volume rather than layering a
    # second jacket over it and exposing projection seams at the shoulders.
    bm=bmesh.new();bm.from_mesh(body.data)
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
        plane_co=(0,0,.736),plane_no=(0,0,1),dist=1e-6,clear_outer=True)
    bm.to_mesh(body.data);bm.free();body.data.update()
    profile=[(.720,.176,.117,.024),(.760,.180,.117,.024),(.880,.158,.102,.019),
             (.970,.156,.101,.017),(1.075,.166,.105,.018),(1.180,.179,.109,.022),
             (1.255,.194,.104,.023),(1.290,.183,.087,.024),(1.315,.143,.070,.022),
             (1.338,.070,.055,.019),(1.352,.066,.052,.018)]
    def coat_section(z):
        for (a,*v),(b,*w) in zip(profile,profile[1:]):
            if z<=b:
                u=max(0,min(1,(z-a)/(b-a)));return [p*(1-u)+q*u for p,q in zip(v,w)]
        return profile[-1][1:]
    vertices=[];faces=[];segments=72;rows=49
    for j in range(rows):
        z=.720+(1.352-.720)*j/(rows-1);rx,ry,cy=coat_section(z)
        for k in range(segments):
            a=math.tau*k/segments
            dr=(.0025*math.sin(7*a+z*22)+.0018*math.sin(13*a-z*42))*math.sin(math.pi*j/(rows-1))
            x=(rx+dr)*math.sin(a);y=cy-(ry+dr)*math.cos(a)
            y-=max(0,math.cos(a))**6*.0028*math.sin((z-.8)*48+x*31)
            hem=.006*math.sin(4*a+.5)*max(0,1-(z-.720)/.08)
            vertices.append((x,y,z+hem))
            if j:
                p=(j-1)*segments+k;q=(j-1)*segments+(k+1)%segments
                faces.append((p,q,q+segments,p+segments))
    faces.extend([tuple(range(segments-1,-1,-1)),tuple(range(len(vertices)-segments,len(vertices)))])
    coat=form('棉布上衣 · 连续肩胸与下摆',vertices,faces,cotton,True)
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
        # The book rests in the supporting hand, open towards the eyes. Layer
        # offsets follow the page normal instead of sliding sheets backwards.
        return Vector((.036+x,-.255+.80*v+.20*abs(x)-.60*layer,1.112+.60*v+.040*x+.80*layer))
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
    # The released red clasp lies over the lower page rather than disappearing
    # behind the open covers; it keeps the portrait's red notebook identifier.
    loose_a=[];loose_b=[]
    for i in range(10):
        v=-.036-i*.009
        a=page(.007,v,.020);b=page(.020,v,.020)
        if v<-.105:
            a.z-=(abs(v)-.105)*.65;b.z-=(abs(v)-.105)*.65
        loose_a.append(a);loose_b.append(b)
    ribbon('朱红扣带 · 打开后搭在书页上',loose_a,loose_b,leather,.0017)
    pin=page(.0135,-.053,.022)
    sweep('扣带黄铜铆点',[pin,pin+Vector((0,-.0007,.0009))],[.0027,.0026],brass,12)
    for side in [-1,1]:
        elbow=(side*.189,-.049,1.036)
        wrist=(side*(.114 if side==-1 else .128),-.19,1.065 if side==1 else 1.119)
        middle=Vector(elbow).lerp(Vector(wrist),.58)
        controls=list(map(Vector,[(side*.100,.020,1.260),(side*.166,.014,1.237),
                                 (side*.188,-.014,1.139),elbow,middle,wrist]))
        radii=[.045,.066,.067,.071,.055,.042];path=[];widths=[]
        for j in range(len(controls)-1):
            p0=controls[max(0,j-1)];p1=controls[j];p2=controls[j+1];p3=controls[min(len(controls)-1,j+2)]
            for k in range(8):
                t=k/8
                path.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
                u=t*t*(3-2*t);widths.append(radii[j]*(1-u)+radii[j+1]*u)
        path.append(controls[-1]);widths.append(radii[-1])
        sweep('曲肘袖 '+str(side),path,widths,cotton,24,.93,.045)
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
            tip=page(-.050,.037,.017)
            axis=Vector((-.55,.15,.82)).normalized()
            pencil=pigment('铅笔 · 暖杉木',(.30,.155,.065),.72)
            cut=pigment('削尖木纤维',(.58,.39,.19),.90)
            sweep('六棱木杆铅笔',[tip+axis*.124,tip+axis*.015],[.0038,.0038],pencil,6)
            sweep('削尖木端',[tip+axis*.015,tip+axis*.003],[.0038,.0012],cut,8)
            sweep('接触纸面的笔芯',[tip+axis*.003,tip],[.0012,.00025],ink,8)
    # Slightly irregular written strokes and ruling sit on the top signature.
    # They are geometry, so the page remains legible without a baked illustration.
    import random
    rng=random.Random(1935)
    marks=[];mark_faces=[]
    def stroke(a,b,width=.00042):
        d=Vector((b[0]-a[0],b[1]-a[1]));n=Vector((-d.y,d.x)).normalized()*width
        i=len(marks)
        marks.extend([page(a[0]+n.x,a[1]+n.y,.0185),page(a[0]-n.x,a[1]-n.y,.0185),
                      page(b[0]-n.x,b[1]-n.y,.0185),page(b[0]+n.x,b[1]+n.y,.0185)])
        mark_faces.append((i,i+1,i+2,i+3))
    for left,right in [(-.125,-.018),(.022,.122)]:
        for row in range(8):
            v=.077-row*.020
            for col in range(rng.randrange(6,10)):
                x=left+(right-left)*col/10
                stroke((x,v),(x+.005+rng.random()*.003,v+rng.uniform(-.001,.001)))
                if (col+row)%3==0:stroke((x+.003,v+.004),(x+.0035,v-.004),.00032)
        stroke((left,.092),(right-.018,.092),.00065)
    form('纸页上的石墨观察记录',marks,mark_faces,ink)
    fold=pigment('翻起纸角',(.84,.76,.60),.96)
    form('右页翻起的纸角',[page(.110,.101,.018),page(.136,.101,.018),page(.136,.074,.018),page(.116,.082,.024)],
         [(0,1,3),(1,2,3)],fold)
    # Fit pack seams and cap brim to the reconstructed surface rather than
    # projecting painted details into empty space.
    tree=BVHTree.FromPolygons([v.co for v in coat.data.vertices],[p.vertices[:] for p in coat.data.polygons])
    def touch(x,z,offset=.001):
        hit=tree.ray_cast(Vector((x,-1,z)),Vector((0,1,0)),1.8)[0]
        return hit+Vector((0,-offset,0)) if hit is not None else None
    thread=pigment('棉线 · 褪靛',(.18,.19,.18),.96)
    buttons=pigment('磨旧牛角扣',(.045,.041,.034),.63)
    # A raised button stand and stitched pocket mouth connect the textured coat
    # to real garment construction in the face-and-hands camera.
    a=[];b=[]
    for i in range(22):
        z=1.307-i*.022
        p=touch(-.008,z,.0018);q=touch(.018,z,.0018)
        if p is not None and q is not None:a.append(p);b.append(q)
    if len(a)>1:ribbon('衣襟 · 实体搭门',a,b,cotton,.0018)
    for index,z in enumerate([1.291,1.230,1.004,.925,.846]):
        p=touch(.006,z,.004)
        if p is None:continue
        sweep('牛角四眼扣 '+str(index),[p,p+Vector((0,-.0023,0))],[.0052,.0048],buttons,16)
        for sx in [-1,1]:
            for sz in [-1,1]:
                h=p+Vector((sx*.0015,-.0027,sz*.0015))
                sweep('扣眼 '+str(index),[h,h+Vector((0,-.0003,0))],[.00065,.00065],ink,6)
    for side in [-1,1]:
        line=[q for x,z in [(side*.045,.870),(side*.082,.876),(side*.123,.865),(side*.144,.846)]
              if (q:=touch(x,z,.0026)) is not None]
        if len(line)>1:sweep('袋口明线 '+str(side),line,[.0011]*len(line),thread,7)
    collar=[];outer=[]
    for i in range(47):
        a=.18+(math.tau-.36)*i/46
        x=.066*math.sin(a);y=.016-.064*math.cos(a)
        collar.append((x,y,1.371+.008*math.cos(a)))
        outer.append((x*1.16,y-.009*math.cos(a),1.324+.012*math.cos(a)))
    ribbon('立领 · 包住后颈的软棉领',collar,outer,cotton,.0023)
    sweep('领缘细包边',collar,[.00145]*len(collar),thread,8)
    # A closed satchel and a continuous front/back strap replace the fused,
    # projected bag silhouette. No strip is discarded at an empty ray hit.
    bagcloth=pigment('挎包帆布',(.29,.174,.081))
    bpy.ops.mesh.primitive_cube_add(size=1,location=(.195,-.118,.822))
    bag=bpy.context.object;bag.name='帆布挎包 · 闭合圆角包体';bag.scale=(.161,.086,.185)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bag.data.materials.append(bagcloth)
    bevel=bag.modifiers.new('软包圆角','BEVEL');bevel.width=.011;bevel.segments=4
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for f in bag.data.polygons:f.use_smooth=True
    outline=[(.127,.737),(.263,.737),(.270,.747),(.270,.895),(.263,.905),(.127,.905),(.120,.895),(.120,.747),(.127,.737)]
    sweep('挎包侧褶包缝',[(x,-.161,z) for x,z in outline],[.0014]*len(outline),canvas,8)
    flap=[];fold_faces=[]
    for row in range(4):
        v=row/3
        for col in range(9):
            u=col/8
            x=.110+.170*u
            z=.922-(.050+.013*math.sin(math.pi*u))*v
            flap.append(Vector((x,-.165-.004*math.sin(math.pi*v)*math.sin(math.pi*u),z)))
            if row and col:
                k=row*9+col;fold_faces.append((k-10,k-9,k,k-1))
    panel=form('挎包搭盖 · 软折边',flap,fold_faces,bagcloth,True)
    thick=panel.modifiers.new('搭盖厚度','SOLIDIFY');thick.thickness=.003
    sweep('搭盖明线',flap[-9:],[.0016]*9,canvas,7)
    for rear in [False,True]:
        strap_a=[];strap_b=[]
        for i in range(37):
            t=i/36;x=-.128+.310*t;z=1.295-.383*t;rx,ry,cy=coat_section(z)
            y=cy+(-1 if not rear else 1)*ry*math.sqrt(max(.025,1-(x/rx)**2))
            blend=max(0,min(1,(t-.78)/.22));blend=blend*blend*(3-2*blend)
            y=y*(1-blend)+(-.170 if not rear else -.073)*blend
            y+=.005 if rear else -.005
            strap_a.append((x-.0145,y,z));strap_b.append((x+.0145,y,z))
        ribbon('织带 · 连续斜背肩带 '+str(rear),strap_a,strap_b,bagcloth,.0025)
        for edge in [strap_a,strap_b]:sweep('肩带边缘明线',edge,[.00065]*len(edge),canvas,6)
    sweep('布包黄铜揿扣',[(.195,-.170,.865),(.195,-.173,.865)],[.0068,.006],brass,16)

