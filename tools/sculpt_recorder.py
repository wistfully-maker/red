"""Reconstruct the journal guide with four registered silhouettes and surface nets.
Usage: python tools/sculpt_recorder.py <original 2x2 turnaround>
The resulting closed mesh is refined and exported by build_valley_scenes.py.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT=Path(__file__).resolve().parents[1]
H=1.64
W_PX,H_PX=352,704
PAD=16
PIX=(H_PX-2*PAD)/H

def calibrate(view):
    rgb=np.asarray(view.convert('RGB'),dtype='float32');r,g,b=rgb.transpose(2,0,1)
    mask=~((r>1.38*g+22)&(b>1.27*g+18))
    labels,n=ndimage.label(mask)
    counts=np.bincount(labels.ravel());counts[0]=0
    mask=labels==counts.argmax()
    yy,xx=np.where(mask);top,bottom=yy.min(),yy.max()
    head=mask[top+int((bottom-top)*.041):top+int((bottom-top)*.114)]
    axis=np.median(np.where(head)[1])
    scale=(H_PX-2*PAD)/(bottom-top)
    interior=ndimage.binary_erosion(mask,iterations=3)
    indices=ndimage.distance_transform_edt(~interior,return_distances=False,return_indices=True)
    clean=rgb[tuple(indices)].astype('uint8')
    transform=(1/scale,0,axis-W_PX*.5/scale,0,1/scale,top-PAD/scale)
    color=Image.fromarray(clean).transform((W_PX,H_PX),Image.Transform.AFFINE,transform,Image.Resampling.BICUBIC)
    silhouette=Image.fromarray(np.uint8(mask)*255).transform((W_PX,H_PX),Image.Transform.AFFINE,transform,Image.Resampling.NEAREST)
    return np.asarray(silhouette)>0,color

def shell(vol,axes):
    points=np.array([[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]])
    def sub(a,off):return a[tuple(slice(int(v),int(v)+a.shape[i]-1) for i,v in enumerate(off))]
    stack=np.stack([sub(vol,p) for p in points],axis=-1)
    cells=np.column_stack(np.where((stack.min(axis=-1)<0)&(stack.max(axis=-1)>=0)))
    values=stack[tuple(cells.T)];offset=np.zeros((len(cells),3));counts=np.zeros(len(cells))
    for a,p in enumerate(points):
        for b in range(a+1,8):
            q=points[b]
            if np.abs(q-p).sum()!=1:continue
            take=(values[:,a]>=0)!=(values[:,b]>=0)
            t=values[take,a]/(values[take,a]-values[take,b])
            offset[take]+=p+(q-p)*t[:,None];counts[take]+=1
    fractional=cells+offset/counts[:,None]
    positions=np.stack([axes[i][0]+fractional[:,i]*(axes[i][1]-axes[i][0]) for i in range(3)],axis=1)
    cell_ids=np.full(stack.shape[:3],-1,dtype=np.int32);cell_ids[tuple(cells.T)]=np.arange(len(cells))
    faces=[];delta=np.eye(3,dtype=int)
    for d in range(3):
        lo=sub(vol,[0,0,0]);hi=sub(vol,delta[d])
        edges=np.column_stack(np.where((lo>=0)!=(hi>=0)))
        a=delta[(d+1)%3];b=delta[(d+2)%3]
        edges=edges[np.all(edges-a-b>=0,axis=1)]
        corners=[edges,edges-a,edges-a-b,edges-b]
        quad=np.stack([cell_ids[tuple(c.T)] for c in corners],axis=1)
        assert np.min(quad)>=0
        reverse=lo[tuple(edges.T)]<0
        quad[reverse]=quad[reverse,::-1]
        faces.extend(quad)
    return positions.astype('float32'),np.asarray(faces,dtype='int32')

def main(path):
    src=Image.open(path);w,h=src.size
    masks=[];atlas=Image.new('RGB',(2*W_PX,2*H_PX))
    for i in range(4):
        x=(i%2)*w//2;y=(i//2)*h//2
        mask,image=calibrate(src.crop((x,y,x+w//2,y+h//2)))
        masks.append(mask);atlas.paste(image,((i%2)*W_PX,(i//2)*H_PX))
    atlas.save(ROOT/'assets/valley/recorder-atlas.webp',quality=95,method=5)
    axes=[np.arange(-.43,.431,.009),np.arange(-.46,.411,.009),np.arange(-.03,H+.032,.009)]
    profile=[]
    for i,mask in enumerate(masks):
        sdf=ndimage.distance_transform_edt(mask)-ndimage.distance_transform_edt(~mask)
        cols=(W_PX/2+axes[i%2]*PIX*(1 if i<2 else -1)).clip(0,W_PX-1).astype(int)
        rows=(H_PX-PAD-axes[2]*PIX).clip(0,H_PX-1).astype(int)
        profile.append(sdf[np.ix_(rows,cols)].T)
    front=.70*profile[0]+.30*profile[2];side=.60*profile[1]+.40*profile[3]
    # Round sections in depth while respecting the separate feet, elbows, cap
    # peak and satchel in the silhouettes. A rectangular extrusion loses these.
    wide=np.maximum(1,front.max(axis=0));deep=np.maximum(1,side.max(axis=0))
    X=(1-front/wide)[:,None,:];Y=(1-side/deep)[None,:,:]
    vol=(1-np.abs(X)**2.4-np.abs(Y)**2.4)*np.minimum(wide,deep)
    # Force the book and satchel forward only over their own silhouette.
    vol=ndimage.gaussian_filter(vol,.70)
    for axis in range(3):
        sl=[slice(None)]*3
        for v in [0,-1]:
            sl[axis]=v;vol[tuple(sl)]=-20
    pos,faces=shell(vol,axes)
    tri=pos[faces];norm=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])
    ref=np.where(np.abs(norm[:,1])>=np.abs(norm[:,0])*.89,np.where(norm[:,1]<0,0,2),np.where(norm[:,0]>0,1,3))
    uv=[]
    for i,q in zip(ref,tri):
        u=.5+q[:,i%2]*PIX/W_PX*(1 if i<2 else -1)
        v=(PAD+q[:,2]*PIX)/H_PX
        uv.append(np.stack([.5*(i%2+u),.5*(1-i//2+v)],axis=1))
    np.savez_compressed(ROOT/'tools/recorder-sculpt.npz',positions=pos,faces=faces,uv=np.array(uv,dtype='float32'))
    print('Surface nets:',len(pos),'vertices,',len(faces),'quads. Bounds:',pos.ptp(axis=0) if hasattr(pos,'ptp') else np.ptp(pos,axis=0))

if __name__=='__main__':main(sys.argv[1])

