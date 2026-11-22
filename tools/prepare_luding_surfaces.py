"""Prepare the shared Luding surface library. Originals are CC0 scans from Poly Haven."""
from pathlib import Path
import math
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'.workbuddy/luding-scans'
OUT=ROOT/'assets/luding/surfaces'
PLATES=ROOT/'assets/valley'
OUT.mkdir(parents=True,exist_ok=True)

def scan_maps():
    for source,dest in [('wood_planks','wood'),('rock_face_03','rock')]:
        for kind,role in [('Diffuse','color'),('nor_gl','normal'),('Rough','rough')]:
            im=Image.open(SRC/(source+'-'+kind+'.jpg')).convert('RGB')
            im.thumbnail((1536,1536) if role=='color' else (1024,1024),Image.Resampling.LANCZOS)
            if role=='color':
                rgb=np.asarray(im,dtype=np.float32)
                grey=rgb@np.array([.213,.715,.072],np.float32)
                if dest=='rock':rgb=grey[...,None]*np.array([.95,1.01,1.025])+(.18*(rgb-grey[...,None]))
                else:rgb=(.40*rgb+.60*grey[...,None])*1.12+13
                im=Image.fromarray(np.clip(rgb,0,255).astype('uint8'))
            im.save(OUT/(dest+'-'+role+'.jpg'),quality=88,subsampling=0)
            if role=='color' and dest=='wood':
                # A single board supplies long grain without painting plank seams onto posts.
                piece=im.crop((0,int(im.height*.032),im.width,int(im.height*.117)))
                grain=np.asarray(piece.convert('L'),dtype=np.float32)
                grain=np.clip((grain-grain.mean())*.64+92,25,165)
                rgb=grain[...,None]*np.array([1.10,.85,.69])
                Image.fromarray(rgb.astype('uint8')).save(OUT/'beam-grain.jpg',quality=91)
            if role=='color' and dest=='rock':
                grey=np.array(im.convert('L'),dtype=np.float32)
                grey=np.clip((grey-grey.mean())*.26+77,38,121)
                Image.fromarray((grey[...,None]*np.array([.95,1.,1.01])).astype('uint8')).save(OUT/'slate.jpg',quality=86)
    sky=cv2.imdecode(np.fromfile(SRC/'sky.hdr',dtype=np.uint8),cv2.IMREAD_UNCHANGED)
    if sky is None:raise ValueError('Missing Poly Haven sky HDR')
    # Preserve directional cloud detail in a compact sRGB environment used by both viewers.
    sky=np.maximum(0,sky*.65)
    sky=np.power(sky/(.68+sky),1/2.2)
    Image.fromarray((sky[:,:,::-1]*255+.5).astype('uint8')).save(OUT/'sky.jpg',quality=91)

def surface_atlas():
    n=2560
    # Asinh mapping gives the bridgeheads more texels than the distant valley.
    axis=105*np.sinh(np.linspace(-1,1,n,dtype=np.float32)*math.asinh(2450/105))
    near=np.asarray(Image.open(PLATES/'dadu.webp').convert('RGB'))
    far=np.asarray(Image.open(PLATES/'dadu-wide.webp').convert('RGB'))
    gravel=np.asarray(Image.open(PLATES/'bank-shingle.webp').convert('RGB'))
    output=np.empty((n,n,3),np.uint8)
    def sample(image,u,v,wrap=False):
        return cv2.remap(image,(u*(image.shape[1]-1)).astype(np.float32),(v*(image.shape[0]-1)).astype(np.float32),
                         cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101 if wrap else cv2.BORDER_REPLICATE).astype(np.float32)
    for row in range(0,n,96):
        x,z=np.meshgrid(axis,axis[row:row+96]);r=np.hypot(x,z)
        t=np.clip((r-92)/140,0,1);t=(t*t*(3-2*t))[...,None]
        a=sample(near,.48+x/455,.5+z/455)
        b=sample(far,.496+x/2250,.5+z/2250,True)
        macro=a*(1-t)+b*t
        g=sample(gravel,x/8.,z/8.,True).mean(2,keepdims=True)/110
        macro*=1+(np.clip(g,.45,1.65)-1)*(.23*(1-t)+.035)
        grey=macro.mean(axis=2,keepdims=True)
        macro=(macro*.79+grey*.21)*.81+np.array([21.,25.,23.])
        air=(np.clip((r-130)/1200,0,1)*.31)[...,None]
        macro=macro*(1-air)+np.array([118,139,148])*air
        output[row:row+len(x)]=np.clip(macro,0,255)
    Image.fromarray(output).save(OUT/'gorge-ground.jpg',quality=88)
    ripple=np.asarray(Image.open(PLATES/'river-ripples.webp').convert('L'),dtype=np.float32)/255
    ripple=cv2.GaussianBlur(ripple,(0,0),1.1)
    dy,dx=np.gradient(ripple)
    normal=np.stack((-dx*6,dy*6,np.ones_like(dx)),axis=2)
    normal/=np.linalg.norm(normal,axis=2,keepdims=True)
    Image.fromarray(((normal*.5+.5)*255).astype('uint8')).save(OUT/'river-normal.jpg',quality=94,subsampling=0)
    # Keep water colour on the channel even where its banks curve.
    water=np.asarray(Image.open(PLATES/'river-ripples.webp').convert('RGB'))
    v,u=np.mgrid[0:1536,0:1536].astype('float32')/1535
    stream=sample(near,.405+.13*u,v)
    bend=.07*np.sin(v*13)+.035*np.cos(u*9)
    riffle=sample(water,u*15.3+bend,v*24.4+.076*np.sin(u*8),True)
    fleck=riffle.mean(axis=2,keepdims=True)
    stream=.40*stream+.28*riffle+.32*np.array([51,84,81])+np.maximum(fleck-107,0)*.78
    Image.fromarray(np.clip(stream,0,255).astype('uint8')).save(OUT/'river-color.jpg',quality=91)

def plaque():
    im=Image.new('RGB',(900,288),'#312c25');d=ImageDraw.Draw(im)
    d.rounded_rectangle((16,17,883,270),radius=12,outline='#9a7545',width=6)
    d.rectangle((28,30,872,258),outline='#76613c',width=3)
    f=ImageFont.truetype('C:/Windows/Fonts/simkai.ttf',188)
    for x,c in zip([205,450,695],'泸定桥'):
        d.text((x,140),c,font=f,fill='#b99d65',anchor='mm',stroke_width=1)
    im.save(OUT/'bridge-plaque.jpg',quality=92)

if __name__=='__main__':
    scan_maps();surface_atlas();plaque()
