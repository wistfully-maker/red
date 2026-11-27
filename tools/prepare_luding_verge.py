"""Rectify a supplied oblique path photo and extract a leaf spray from the tree atlas."""
from pathlib import Path
import sys
import cv2
import numpy as np
from PIL import Image

out=Path(__file__).resolve().parents[1]/'assets/luding/surfaces'
n=1024
photo=np.asarray(Image.open(sys.argv[1]).convert('RGB'))
src=np.float32([[.41,.18],[.72,.18],[.94,.735],[.13,.735]])*np.float32([photo.shape[1],photo.shape[0]])
dst=np.float32([[0,0],[n-1,0],[n-1,n-1],[0,n-1]])
rgb=cv2.warpPerspective(photo,cv2.getPerspectiveTransform(src,dst),(n,n))
v,u=np.mgrid[-1:1:complex(n),-1:1:complex(n)]
edge=1-np.maximum(abs(u),abs(v))
mask=np.clip((edge+.034*np.sin(v*22)*np.cos(u*15)-.028)/.17,0,1)
mask[np.min(rgb,axis=2)>229]=0
rgba=np.dstack((np.clip(rgb*.88,0,255).astype('uint8'),(mask*255).astype('uint8')))
Image.fromarray(rgba).save(out/'fork-verge.webp',quality=89)
im=Image.open(out/'riparian.png').convert('RGBA')
leaf=np.array(im.crop((32,244,413,520)).resize((400,300),Image.Resampling.LANCZOS))
v,u=np.mgrid[-1:1:300j,-1:1:400j]
leaf[:,:,3]=(leaf[:,:,3]*np.clip((1-u*u-v*v)*4,0,1)).astype('uint8')
Image.fromarray(leaf).save(out/'leaf-spray.webp',quality=90)
