"""Anatomical head, folded cap and braid for the editable guide model (metres)."""
import math
import bpy, bmesh
from mathutils import Matrix,Vector
from recorder_parts import form,sweep,ribbon,pigment

def replace_head(body,root):
    existing=set(bpy.context.scene.objects)
    bm=bmesh.new();bm.from_mesh(body.data)
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
        plane_co=(0,0,1.366),plane_no=(0,0,1),dist=1e-6,clear_outer=True)
    bm.to_mesh(body.data);bm.free();body.data.update()
    skin=pigment('面部 · 注册肤色',(.63,.38,.24))
    hair=pigment('发辫 · 墨褐',(.025,.019,.016),.67)
    cloth=pigment('棉布软帽 · 石蓝',(.094,.112,.134))
    seam=pigment('压线 · 靛灰',(.060,.070,.079))
    skin_tint=pigment('耳廓 · 肤色',(.54,.309,.212))
    face_shader=skin.node_tree.nodes.get('Principled BSDF')
    face_shader.inputs['Roughness'].default_value=.67
    face_shader.inputs['Specular IOR Level'].default_value=.27
    src=bpy.data.images.load(str(root/'assets/valley/guide-face.webp'));src.pack()
    tex=skin.node_tree.nodes.new('ShaderNodeTexImage');tex.image=src
    skin.node_tree.links.new(tex.outputs['Color'],skin.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    def textured(name,points,faces):
        obj=form(name,points,faces,skin,True)
        layer=obj.data.uv_layers.new(name='Face registration')
        for loop in obj.data.loops:
            x,y,z=points[loop.vertex_index]
            layer.data[loop.index].uv=(.511+x*3.29,1-.907+(z-1.376)*3.62)
        return obj
    def shell(name,rows,mat,warp=None,n=48):
        vs=[];fs=[]
        for j,(z,rx,ry,y) in enumerate(rows):
            for k in range(n):
                a=2*math.pi*k/n
                xyz=(rx*math.sin(a),y-ry*math.cos(a),z)
                vs.append(warp(*xyz,a,j) if warp else xyz)
                if j:
                    p=(j-1)*n+k;q=(j-1)*n+(k+1)%n
                    fs.append((p,q,q+n,p+n))
        fs.extend([tuple(range(n-1,-1,-1)),tuple(range(len(vs)-n,len(vs)))])
        return textured(name,vs,fs) if mat==skin else form(name,vs,fs,mat,True)
    shell('颈部与下颌过渡',[(1.318,.066,.055,.028),(1.354,.061,.057,.022),(1.390,.052,.051,.011),(1.412,.054,.058,.012)],skin_tint)
    # Contour sections from chin to cranium. Facial relief is evaluated on
    # the anterior surface only, preserving the occiput and jaw in profile.
    profile=[(0,.018,.028,-.035),(.05,.040,.062,-.022),(.16,.065,.084,-.009),
             (.29,.076,.093,.001),(.43,.085,.098,.004),(.57,.086,.100,.007),
             (.72,.088,.100,.008),(.85,.079,.094,.011),(.94,.057,.072,.013),(1,.012,.027,.014)]
    def interp(t):
        for (a,*v),(b,*w) in zip(profile,profile[1:]):
            if t<=b:
                u=(t-a)/(b-a);return [p*(1-u)+q*u for p,q in zip(v,w)]
        return profile[-1][1:]
    def relief(x,t):
        gauss=lambda a,b:math.exp(-a*a-b*b)
        nose=.014*gauss(x/.012,(t-.40)/.15)+.021*gauss(x/.017,(t-.297)/.054)
        alae=.006*gauss((abs(x)-.013)/.007,(t-.278)/.038)
        cheeks=.005*gauss((abs(x)-.049)/.023,(t-.35)/.12)
        brow=.0045*gauss((abs(x)-.034)/.025,(t-.544)/.045)
        orbit=.0085*gauss((abs(x)-.034)/.024,(t-.471)/.058)
        lips=.004*gauss(x/.026,(t-.188)/.029)+.0035*gauss(x/.023,(t-.143)/.029)
        return nose+alae+cheeks+brow+lips-orbit
    def front(x,z):
        t=(z-1.376)/.238;rx,ry,cy=interp(max(0,min(1,t)))
        c=math.sqrt(max(.001,1-(x/rx)**2))
        return cy-ry*c-relief(x,t)*c**3
    rows=[]
    for i in range(57):
        t=i/56;rx,ry,cy=interp(t);rows.append((1.376+.238*t,rx,ry,cy))
    shell('面部雕刻 · 颧骨 鼻翼 眉弓 唇峰',rows,skin,
          lambda x,y,z,a,j:(x,y-relief(x,j/56)*max(0,math.cos(a))**3,z),80)
    # Upper/lower lid margins frame the corneal bulge. All same-skin UVs are
    # continuous with the head instead of colouring an eye-shaped solid white.
    for sign in [-1,1]:
        eye_x=sign*.036;eye_z=1.487
        pts=[];faces=[]
        for j in range(6):
            v=j/5
            for k in range(23):
                u=k/22;x=eye_x+(u-.5)*.032
                bow=math.sin(math.pi*u)
                z=eye_z+(.0089*v-.0040)*bow+sign*(u-.5)*.0015
                depth=bow*(.0014+.0016*math.sin(math.pi*v))
                pts.append((x,front(x,z)-depth,z))
                if j and k:
                    i=j*23+k;faces.append((i-24,i-23,i,i-1))
        textured('眼睑与眼球前缘 '+str(sign),pts,faces)
        lash=pigment('睫缘 · 柔墨褐',(.050,.033,.023),.82)
        upper=[]
        for k in range(21):
            u=.07+.86*k/20;x=eye_x+(u-.5)*.032
            z=eye_z+.0048*math.sin(math.pi*u)+sign*(u-.5)*.0015
            upper.append((x,front(x,z)-.0028,z))
        sweep('自然上睫缘 '+str(sign),upper,[.00052]*len(upper),lash,7)
        cx=sign*.084;ear=[]
        for j in range(25):
            a=math.tau*j/24
            ear.append((cx+sign*(.004+.004*math.sin(a)),.006+.018*math.cos(a),1.457+.030*math.sin(a)))
        sweep('耳轮 '+str(sign),ear,[.0041]*len(ear),skin_tint,9)
        sweep('对耳轮 '+str(sign),[(cx,.002,1.440),(cx+sign*.005,-.002,1.453),(cx+sign*.006,.009,1.465)],[.006,.004,.003],skin_tint,8)
    # A sculpted hairline follows the temples; the rear drapes down to the braid.
    hair_rows=[]
    for j in range(8):
        u=j/7;hair_rows.append((1.504+.097*u,.088*(1-.53*u**2),.099*(1-.45*u**2),.011))
    shell('鬓角与发冠',hair_rows,hair,
          lambda x,y,z,a,j:(x,y,z-(1-j/7)*(.008+.080*((1-math.cos(a))*.5)**2)),64)
    fine_hair=pigment('散发 · 暖墨褐',(.043,.029,.019),.58)
    for side in [-1,1]:
        for strand in range(14):
            points=[];r=[]
            for k in range(13):
                t=k/12
                x=side*(.056+.0016*strand+.015*math.sin(t*2.5)+.0018*math.sin(t*7+strand*.83))
                z=1.547-.080*t-.0011*strand
                y=front(min(.080,max(-.080,x)),z)-.0017-.0008*math.sin(t*4+strand)
                points.append((x,y,z));r.append(.00044*(1-.76*t))
            sweep('鬓边细发 %s-%02d'%(side,strand),points,r,fine_hair,5)
    for strand in range(3):
        pts=[];r=[]
        for k in range(29):
            t=k/28;a=2*math.pi*(strand/3+t*2.3);rad=.013*(1-.45*t)
            pts.append((-.058+math.cos(a)*rad-.018*t,.079+math.sin(a)*rad-.03*t,1.465-.172*t))
            r.append(.0145*(1-.45*t))
        sweep('三股发辫 '+str(strand+1),pts,r,hair,9)
        for accent in [-1,1]:
            edge=[(p[0]+accent*.004,p[1]-.008,p[2]+.0015*math.sin(k*.8)) for k,p in enumerate(pts)]
            sweep('辫股细纹 %s-%s'%(strand,accent),edge,[.00072*(1-.45*k/28) for k in range(29)],fine_hair,5)
    # The crown leans to the back. Six subtly gathered panels and a separate
    # curved visor give the cap a recognisable silhouette even without imagery.
    caprows=[(1.529,.087,.101,.009),(1.538,.094,.109,.010),(1.560,.104,.114,.012),
             (1.585,.105,.112,.017),(1.606,.094,.102,.019),(1.626,.065,.078,.019),(1.634,.018,.025,.019)]
    def gather(x,y,z,a,j):
        g=.0043*math.cos(6*a+.33)*math.sin(math.pi*j/(len(caprows)-1))
        return (x+g*math.sin(a)-j*.0016,y-g*math.cos(a),z+.0018*math.sin(3*a)-.0014*j*(1+.55*math.sin(a)))
    shell('六片式软帽冠',caprows,cloth,gather,60)
    for k in range(6):
        a=k*math.pi/3-.055
        pts=[gather(rx*math.sin(a),cy-ry*math.cos(a),z,a,i) for i,(z,rx,ry,cy) in enumerate(caprows[1:-1],1)]
        sweep('帽冠拼缝 '+str(k),pts,[.00125]*len(pts),seam,6)
    upper=[];lower=[]
    for k in range(33):
        a=(k/32-.5)*math.pi
        x=.097*math.sin(a);y=.008-.094*math.cos(a);z=1.541-.006*abs(math.sin(a))
        upper.append((x,y,z));lower.append((x*1.04,y-.038*math.cos(a)**.7,z-.011*math.cos(a)))
    ribbon('双层弧形帽檐',upper,lower,cloth,-.0034)
    sweep('帽檐包边',lower,[.00175]*len(lower),seam,7)
    pivot=Vector((0,.014,1.358))
    gesture=Matrix.Translation(pivot)@Matrix.Rotation(-.10,4,'Z')@Matrix.Rotation(.085,4,'X')@Matrix.Translation(-pivot)
    for part in set(bpy.context.scene.objects)-existing:
        part.matrix_world=gesture@part.matrix_world

