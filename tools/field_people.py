"""Clothed figure meshes for the historical landscape. All dimensions in metres.
Local -Y faces the observer. Rings specify shoulders, jaw, hems and fabric folds
independently, so a writing, rowing or walking pose retains human proportions.
"""
from collections import defaultdict
import math
from mathutils import Vector

TAU=math.tau

class Figures:
    def __init__(self,env):
        self.env=env
        self.parts=defaultdict(lambda:[[],[],[]])
        self.count=0
        self.pivot=Vector((0,0,0))
        self.yaw=0
        self.scale=1
        self.is_guide=False
        self.anchor=None
        self.people=[]
        self.identities=[]
        self.portrait_candidates=[]
        self.appearance_index=0
        self.scene_people_edits=[]
        from field_supplied import bind_scene
        bind_scene(env)

    def transform(self,p):
        x,y,z=p;c,s=math.cos(self.yaw),math.sin(self.yaw)
        return tuple(self.pivot+self.scale*Vector((x*c-y*s,x*s+y*c,z-.015)))

    def mesh(self,pts,faces,mat,uv=None):
        vs,fs,coords=self.parts[(self.is_guide,mat)];k=len(vs)
        vs.extend(self.transform(p) for p in pts)
        fs.extend(tuple(k+i for i in f) for f in faces)
        if uv is not None:coords.extend(uv)

    def rings(self,rows,mat,n=14,fold=0):
        vs=[];faces=[]
        for j,(x,y,z,rx,ry) in enumerate(rows):
            for i in range(n):
                a=i*TAU/n
                wave=1+fold*(.64*math.cos(5*a+j*.32)+.36*math.sin(3*a-j*.7))
                vs.append((x+rx*math.sin(a)*wave,y-ry*math.cos(a)*wave,z))
                if j:
                    k=(j-1)*n+i;b=(j-1)*n+(i+1)%n
                    faces.append((k,b,b+n,k+n))
        faces += [tuple(reversed(range(n))),tuple(range(len(vs)-n,len(vs)))]
        self.mesh(vs,faces,mat)

    def oval(self,c,r,mat,n=12):
        rows=[]
        for i in range(9):
            a=-math.pi*.5+math.pi*i/8
            rows.append((c[0],c[1],c[2]+r[2]*math.sin(a),max(.0002,r[0]*math.cos(a)),max(.0002,r[1]*math.cos(a))))
        self.rings(rows,mat,n)

    def tube(self,pts,radii,mat,n=8,oval=.9):
        pts=list(map(Vector,pts));vs=[];fs=[]
        for j,p in enumerate(pts):
            d=(pts[min(j+1,len(pts)-1)]-pts[max(0,j-1)]).normalized()
            guide=Vector((0,1,0)) if abs(d.y)<.93 else Vector((1,0,0))
            a=d.cross(guide).normalized();b=d.cross(a).normalized()
            for i in range(n):
                ang=i*TAU/n
                vs.append(p+radii[j]*(a*math.cos(ang)+b*math.sin(ang)*oval))
                if j:
                    k=(j-1)*n+i;q=(j-1)*n+(i+1)%n
                    fs.append((k,q,q+n,k+n))
        fs.extend([tuple(reversed(range(n))),tuple(range(len(vs)-n,len(vs)))])
        self.mesh(vs,fs,mat)

    def panel(self,c,w,h,thick,mat,tilt=0):
        # Bevelled corners preserve the soft profile of a pocket or journal.
        outline=[(-.46,-.5),(.46,-.5),(.5,-.45),(.5,.45),(.46,.5),(-.46,.5),(-.5,.45),(-.5,-.45)]
        vs=[]
        for t in (-thick*.5,thick*.5):
            for x,z in outline:
                dz=h*z
                vs.append((c[0]+w*x,c[1]+t+dz*math.sin(tilt),c[2]+dz*math.cos(tilt)))
        fs=[tuple(range(8)),tuple(range(15,7,-1))]+[(i,(i+1)%8,8+(i+1)%8,i+8) for i in range(8)]
        self.mesh(vs,fs,mat)

    def strap(self,points,width,mat):
        vs=[]
        for p in points:vs.extend([(p[0]-width/2,p[1],p[2]),(p[0]+width/2,p[1],p[2])])
        self.mesh(vs,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(points)-1)],mat)

    def head(self,base,female,hat):
        # Relative to the chin. The facial portrait maps to fitted jaw/cheek
        # profiles with relief at the nose bridge, mouth and orbital sockets.
        rows=[(0,.036,.047),(.014,.058,.075),(.036,.070,.084),(.062,.078,.091),
              (.085,.084,.095),(.106,.087,.097),(.126,.085,.098),(.148,.085,.1),
              (.178,.086,.101),(.207,.080,.095),(.229,.061,.078),(.248,.015,.035)]
        vs=[];uv=[];fs=[];n=36
        for j,(z,rx,ry) in enumerate(rows):
            for i in range(n+1):
                a=TAU*i/n;x=rx*math.sin(a);front=math.cos(a)
                nose=.028*math.exp(-(x/.017)**2-((z-.080)/.028)**2)+.014*math.exp(-(x/.015)**2-((z-.111)/.043)**2)
                orbital=.010*math.exp(-((abs(x)-.034)/.023)**2-((z-.115)/.016)**2)
                mouth=.005*math.exp(-(x/.036)**4-((z-.044)/.011)**2)
                y=-ry*front-max(0,front)**4*(nose+mouth-orbital)
                vs.append((x,y,base+z))
                uv.append((.513+3.35*x,1-(.912-z*3.58)))
                if j and i:
                    k=j*(n+1)+i
                    fs.append((k-n-2,k-n-1,k,k-1))
        self.mesh(vs,fs,'face_guide' if female else 'face_worker',uv)
        for side in [-1,1]:
            self.oval((side*.082,.003,base+.094),(.014,.025,.033),'skin',10)
        self.oval((0,.019,base+.16),(.085,.096,.090),'hair',18)
        if female:
            for i in range(8):
                self.oval((-.053-.013*math.sin(i*2.6),.086+i*.004,base+.082-i*.030),
                          (.029-i*.0015,.024,.035),'hair',10)
        if hat=='straw':
            self.rings([(0,0,base+.157,.158,.173),(0,0,base+.164,.171,.180),
                        (0,.01,base+.238,.077,.077),(0,.013,base+.250,.019,.026)],'straw',32,.014)
            self.rings([(0,0,base+.192,.125,.126),(0,0,base+.197,.12,.122)],'hemp',30)
        elif hat:
            self.rings([(0,.003,base+.158,.088,.101),(.002,.002,base+.170,.094,.106),
                        (-.007,.014,base+.2,.103,.110),(-.011,.012,base+.233,.095,.102),
                        (-.017,.009,base+.251,.062,.084),(0,.012,base+.254,.024,.035)],'capblue',24,.055)
            vs=[(0,-.066,base+.169)]
            for j in range(17):
                a=math.pi*j/16
                vs.append((.097*math.cos(a),-.061-.080*math.sin(a),base+.166-.012*math.sin(a)))
            self.mesh(vs,[(0,j+1,j+2) for j in range(16)],'capbrim')
            self.tube([(-.087,-.011,base+.171),(0,-.101,base+.177),(.087,-.011,base+.171)],[.004]*3,'seam',6)

    def hand(self,wrist,tip):
        w=Vector(wrist);end=Vector(tip);centre=w.lerp(end,.57)
        self.tube([w,centre,end],[.026,.035,.024],'skin',10,.57)
        d=(end-w).normalized()
        for i in range(4):
            a=end+Vector(((i-1.5)*.011,0,0))
            b=a+d*(.034-.003*abs(i-1.6))+Vector((0,.007,-.008))
            self.tube([a,b,b+Vector((0,.007,-.01))],[.0068,.0059,.0042],'skin',6)
        self.tube([centre+Vector((.022,0,.005)),end+Vector((.037,-.007,-.001))],[.009,.006],'skin',7)

    def build(self,x,y,z,height=1.67,yaw=0,pose='walk',role='walker',guide=False):
        # The contemporary recorder anchor stays independent of historical
        # actors. Luding's historical people now use the supplied meshes too.
        if guide:
            return self._legacy_build(x,y,z,height,yaw,pose,role,guide)
        # Advance the appearance slot even for a deliberately removed person.
        # Other figures keep their original cloth, gender and supplied model.
        self.appearance_index+=1
        from field_scene_people import scene_actor_edit
        edit=scene_actor_edit(self.env.sid,x,y,z,pose,role)
        if edit:
            self.scene_people_edits.append({**edit,'original_position':[x,y,z],
                                           'appearance_index':self.appearance_index})
            if edit.get('remove'):return
            x,y,z=edit['position'];role=edit['role']
            yaw=edit.get('yaw',yaw)
        from field_supplied import try_build_person
        if try_build_person(self,x,y,z,height,yaw,pose,role,asset=edit.get('asset') if edit else None):return
        from field_personnel import build_person
        return build_person(self,x,y,z,height,yaw,pose,role)

    def _legacy_build(self,x,y,z,height=1.67,yaw=0,pose='walk',role='walker',guide=False):
        if guide:
            # One high-detail sculpt is shared across the 19 guide cameras.
            self.anchor=[float(x),float(z+1.14),float(-y),float(yaw)]
            return
        self.count+=1;self.is_guide=guide
        self.people.append((x,y,z,height))
        self.pivot=Vector((x,y,z));self.yaw=yaw
        self.scale=height/(1.621 if role=='boatman' else 1.625)
        female=guide or (self.count%5==2 and role!='boatman')
        coat='coatblue' if guide else ('coatumber' if role=='boatman' else ['coatblue','coatlight','coatslate'][self.count%3])
        seated=pose=='sit';scribe=guide or pose=='write'
        hip=.54 if seated else .86
        for side in [-1,1]:
            stride=(.13*side if pose in ('walk','climb') else .028*side)
            knee=(side*.099,-.32 if seated else -.048+stride*.45,.49 if seated else .48)
            ankle=(side*.107,-.33 if seated else stride,.111)
            self.tube([(side*.082,.014,hip),((side*.096),knee[1]*.4,hip*.62+knee[2]*.38),
                       knee,(side*.105,(knee[1]+ankle[1])*.5,.31),ankle],
                      [.106,.101,.070,.071,.048],'trousers',12)
            if role=='walker' or guide:
                for j in range(5):
                    zz=.147+.032*j;t=(zz-.111)/(.49-.111)
                    self.rings([(ankle[0],ankle[1]+(knee[1]-ankle[1])*t,zz,.056+.003*j,.051+.002*j),
                                (ankle[0],ankle[1]+(knee[1]-ankle[1])*t,zz+.013,.057+.003*j,.052+.002*j)],'wraps',10)
            fx,fy=ankle[:2]
            self.rings([(fx,fy-.043,.015,.054,.120),(fx,fy-.046,.031,.057,.124),
                        (fx,fy-.046,.044,.055,.123)],'sole',14)
            self.rings([(fx,fy-.043,.043,.054,.119),(fx,fy-.037,.060,.055,.113),
                        (fx,fy-.018,.083,.052,.090),(fx,fy,.115,.046,.061)],'shoe',14)
        self.rings([(0,.011,hip-.080,.167,.110),(0,.005,hip+.012,.170,.115),
                    (0,.010,hip+.11,.146,.102),(0,.008,hip+.25,.152,.114),
                    (0,0,hip+.390,.181,.118),(0,.009,hip+.445,.187,.095),
                    (0,.014,hip+.478,.128,.073),(0,.012,hip+.492,.070,.06)],coat,22,.037)
        self.rings([(0,.008,hip+.454,.080,.069),(0,.008,hip+.511,.067,.061)],'capblue' if guide else coat,18,.018)
        self.rings([(0,.012,hip+.455,.062,.056),(0,.008,hip+.556,.054,.052)],'skin',14)
        head_z=hip+.526
        self.head(head_z,female,'straw' if role=='boatman' else 'cap')
        for side in [-1,1]:
            sh=(side*.179,.004,hip+.421)
            if scribe:
                el=(side*.232,-.057,hip+.17)
                wr=(side*(.118 if side<0 else .102),-.225,hip+(.238 if side<0 else .185))
                tip=(side*.055,-.248,hip+(.211 if side<0 else .178))
            elif pose=='row':
                el=(side*.255,-.107,hip+.27)
                wr=(side*.21,-.26,hip+.28+side*.105)
                tip=(side*.18,-.31,wr[2])
            elif pose=='greet' and side>0:
                el=(side*.28,-.08,hip+.23)
                wr=(side*.35,-.16,hip+.47)
                tip=(side*.36,-.17,hip+.55)
            else:
                el=(side*.225,-.08+side*stride if pose=='walk' else -.055,hip+.17)
                wr=(side*.24,-.086-side*.075,hip-.040 if not seated else hip+.02)
                tip=(wr[0],wr[1]-.012,wr[2]-.069)
            self.oval((side*.163,.005,hip+.412),(.095,.091,.093),coat,12)
            self.tube([sh,Vector(sh).lerp(Vector(el),.32),el,Vector(el).lerp(Vector(wr),.55),wr],
                      [.086,.087,.065,.066,.051],coat,14)
            self.tube([Vector(el).lerp(Vector(wr),.84),wr],[.062,.056],'capblue' if guide else coat,12)
            self.hand(wr,tip)
            self.panel((side*.097,-.109,hip+.285),.077,.075,.008,coat)
            self.panel((side*.097,-.117,hip+.321),.085,.026,.010,'seam')
        for j in range(5):self.oval((.014,-.119,hip+.04+j*.079),(.007,.004,.007),'buttons',7)
        if guide or role=='walker':
            self.strap([(-.145,.055,hip+.42),(-.146,-.015,hip+.467),(-.092,-.111,hip+.377),
                        (.017,-.124,hip+.241),(.129,-.105,hip+.096),(.171,-.075,hip+.008)],.045,'bag')
            self.panel((.176,-.065,hip-.045),.214,.205,.10,'bag')
            self.panel((.176,-.124,hip-.003),.218,.116,.014,'bagflap')
            self.panel((.186,-.136,hip-.039),.022,.065,.008,'leather')
            self.oval((.186,-.146,hip-.032),(.008,.003,.008),'brass',8)
        if scribe:
            self.panel((0,-.233,hip+.228),.188,.134,.026,'pages',-.43)
            self.panel((0,-.250,hip+.230),.196,.141,.009,'book',-.43)
            self.panel((.052,-.259,hip+.230),.022,.144,.009,'sealred',-.43)
            self.tube([(-.067,-.253,hip+.248),(-.10,-.247,hip+.339)],[.004,.004],'pencil',6)
        if pose=='row':
            self.tube([(.44,-.31,hip+.53),(.18,-.31,hip+.39),(-.18,-.31,hip+.175),(-1.72,-.31,hip-.75)],[.018,.023,.025,.025],'elmtool',8)
            self.mesh([(-1.67,-.33,hip-.72),(-1.83,-.36,hip-.73),(-2.18,-.38,hip-1.00),
                       (-2.10,-.34,hip-1.12),(-1.80,-.30,hip-.90)],[(0,1,2,3,4)],'elmtool')
        if guide:self.anchor=[float(x),float(z+1.14),float(-y),float(yaw)]
        self.is_guide=False

    def flush(self,geometry):
        from field_supplied import flush_supplied
        flush_supplied(self)
        for (guide,mat),(vs,fs,uv) in self.parts.items():
            name=('Journal guide ' if guide else 'People ')+mat
            obj=geometry(name,vs,fs,mat,uv or None,mat not in ['book','bag','bagflap','pages','sealred','pencil'])
            if guide:obj['journalGuide']=True
            if mat.startswith('fig_'):
                from field_personnel import finish_figure
                finish_figure(obj,mat,self.identities)

