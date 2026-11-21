"""Prepare macro albedo for occupied sites; remove baked roofs from the ground.
Original artwork remains in assets/valley. Only remapped ground plates are emitted.
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

root=Path(__file__).resolve().parents[1]/'assets'
out=root/'cinema/ground'
out.mkdir(parents=True,exist_ok=True)
for name in ['zunyi','liping','hadapu','baxi','huining','jiangtai','chishui','dawei']:
    image=Image.open(root/'valley'/(name+'.webp')).convert('RGB')
    rgb=np.asarray(image,dtype=np.float32)/255
    h,w=rgb.shape[:2];y,x=np.mgrid[0:h,0:w];u=x/w;v=y/h
    r,g,b=rgb.transpose(2,0,1)
    greenery=np.clip((g-b-.032)*11,0,1)*np.clip((g-r+.026)*18,0,1)
    preserve=gaussian_filter(greenery,3.3)
    if name in ['chishui','dawei']:
        band=v if name=='chishui' else u
        preserve=np.maximum(preserve,np.clip((.125-np.abs(band-.5))*65,0,1))
    else:
        open_court=np.maximum(abs(u-.5)/.177,abs(v-.5)/.170)
        preserve=np.maximum(preserve,np.clip((1-open_court)*8,0,1))
    if name=='jiangtai':
        preserve=np.maximum(preserve,np.clip(abs(u-.5)*2+.18,0,1))
    low=gaussian_filter(rgb,(22,22,0))
    grit=np.asarray(Image.open(root/'valley/flagstone.webp').convert('L'),dtype=np.float32)/255
    detail=grit[y%grit.shape[0],x%grit.shape[1]]-grit.mean()
    soil=low*.52+np.array([.48,.416,.314],dtype=np.float32)*.48+detail[:,:,None]*.37
    result=preserve[:,:,None]*rgb+(1-preserve[:,:,None])*soil
    Image.fromarray(np.uint8(np.clip(result*255,0,255))).save(out/(name+'.webp'),quality=91,method=4)

