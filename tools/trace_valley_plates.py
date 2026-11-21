"""Trace peripheral slate roofs and riverbanks on the project-owned aerial art."""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]/'assets/valley'
RIVERS={'dadu','dawei','gan','xiangjiang','anshun','chishui','jiaoping'}
URBAN={'liping','zunyi','hadapu','baxi','huining'}

# Each entry follows a roof ridge on the original aerial plate. Coordinates
# are percentages from its top left. The last value is the eave-to-eave width.
# Courtyards intentionally have no traces. Baxi roofs use the same footprints
# but the builder gives these earthen dwellings flat decks and parapets.
RIDGES = {
    'zunyi': [
        (13.5,23,15.3,30,6.1), (1,31,9.7,30,5.9), (2,41.1,12.4,39.2,4.5),
        (13.5,50.7,13.9,61.8,4.7), (1.5,57.2,10.9,57.2,4.6),
        (4.8,75.4,4.3,85.8,6.3), (18.3,77.2,18.1,85.4,5.8),
        (18.0,90.3,29.4,92.5,5.9), (45.8,80.3,45.6,87,3.4),
        (62.4,78.4,71.8,80.1,5.6), (81.4,74.3,96,82.4,5.1),
        (83.6,84.9,82.6,96.5,5.6), (87.1,27.1,97.0,26.7,3.4),
        (74.8,46.9,84.6,47.1,5.4), (88.8,50.2,98.2,50.4,4.7),
    ],
    'liping': [
        (23.4,15.5,25.4,25.0,5.2),(25.3,29.8,24.1,39.4,5.5),
        (24.4,41.4,23.5,47.6,5.4),(24.6,51.1,24.3,58.8,5.4),
        (30.1,8.9,37.4,8.0,5.4),(34.0,28.1,43.0,27.6,5.0),
        (52.2,26.3,57.4,26.0,7.5),(59.5,28.1,68.1,27.9,5.6),
        (74.0,30.6,73.7,40.4,6.6),(73.7,44.1,73.3,52.6,6.6),
        (76.5,54.6,76.3,62.3,5.5),(77.1,64.3,77.4,69.4,5.7),
        (51.6,74.6,59.4,74.3,5.1),(61.2,72.4,69.2,72.9,4.7),
        (39.3,75.5,46.5,75.7,4.8),(22.7,74.2,33.4,73.2,4.8),
    ],
    'baxi': [
        (10.4,43.9,18.7,43.4,3.7),(12.2,30.2,17.8,29.7,2.6),
        (12.8,34.0,19.8,35.2,3.0),(18.0,73.0,24.1,72.4,2.7),
        (84.9,38.6,90.8,38.4,2.8),(83.1,44.2,90.2,44.4,3.0),
        (78.8,56.1,84.7,56.6,2.7),(81.8,60.9,88.7,61.7,3.4),
        (90.9,21.4,96.8,22.3,2.6),(70.2,84.3,76.5,85.6,3.0),
    ],
    'hadapu': [
        (10.7,37.1,19.2,37.2,3.6),(17.3,41.2,17.5,46.2,3.5),
        (25.0,44.2,30.8,44.6,3.2),(32.5,47.7,32.6,54.5,2.7),
        (19.7,56.6,27.0,56.7,2.9),(18.1,65.8,25.9,65.5,3),
        (37.2,68.7,45.8,68.2,3.3),(54.6,72.5,54.0,77.7,3.1),
        (53.5,80.8,54.0,86.7,4.3),(61.6,75.5,66.1,75.2,2.9),
        (69.4,62.0,79.1,61.8,3.5),(65.7,54.9,65.7,61.9,3.2),
        (65.9,43.4,66.0,49.6,3.4),(69.2,41.6,73.8,41.9,2.8),
        (60.5,25.6,64.4,25.8,2.7),(52.4,15.0,56.6,14.3,2.8),
    ],
    'huining': [
        (21.6,13.3,27.8,13.4,2.8),(17.6,18.4,17.4,25,3.8),
        (21.8,24.7,28.8,24.5,3),(17.0,31.5,23.4,31.3,3.0),
        (20.6,53.0,24.6,53.2,3.4),(21.3,64.3,31.6,64.4,4.8),
        (32.8,68.1,32.4,73.4,3.9),(53.0,4.4,53.2,10.1,3.5),
        (60.8,12.3,67.8,12.4,3.4),(53,25.0,59.5,24.4,3.2),
        (60.5,24.1,66.5,23.8,3.5),(82.1,12.3,86.2,12.0,3.1),
        (88.6,12.5,88.6,18.4,3.0),(67.5,66.1,67.5,74.1,4.6),
        (76.6,39,76.8,45.2,4.3),(88.8,48.4,95.6,47.8,3.5),
    ],
}

def roofprints(station):
    roofs=[]
    for x1,y1,x2,y2,width in RIDGES[station]:
        ridge=np.array([x2-x1,y2-y1])
        perpendicular=np.array([-ridge[1],ridge[0]])*(width/(2*np.linalg.norm(ridge)))
        a=np.array([x1,y1]); b=np.array([x2,y2])
        roof=[a-perpendicular,b-perpendicular,b+perpendicular,a+perpendicular]
        roofs.append([[round(x/100,5),round(1-y/100,5)] for x,y in roof])
    return roofs

def banks(rgb,vertical):
    # Work in UV orientation, with along-channel coordinate along the first axis.
    uv=np.flipud(cv2.resize(rgb,(256,256),interpolation=cv2.INTER_AREA))
    if not vertical:uv=uv.transpose(1,0,2)
    lab=cv2.cvtColor(uv.copy(),cv2.COLOR_RGB2LAB).astype('float32')
    fractions=np.linspace(.02,.98,17); lo=[];hi=[]
    previous=128
    for fraction in fractions:
        p=int(255*fraction)
        strip=np.median(lab[max(0,p-3):p+4],axis=0)
        central=strip[max(50,previous-9):min(206,previous+10)]
        target=np.median(central,axis=0)
        delta=strip-target
        distance=np.sqrt((delta[:,0]*.40)**2+delta[:,1]**2+delta[:,2]**2)
        score=cv2.GaussianBlur(distance[None,:],(9,1),1.8)[0]
        valid=(score<12).astype('uint8')
        valid=cv2.morphologyEx(valid[None,:],cv2.MORPH_CLOSE,np.ones((1,8),np.uint8))[0]
        edges=np.flatnonzero(np.diff(np.r_[0,valid,0]))
        candidates=[(a,b) for a,b in edges.reshape(-1,2) if a<previous+6 and b>previous-6 and 13<b-a<159]
        a,b=min(candidates,key=lambda pair:abs((pair[0]+pair[1])*.5-previous)) if candidates else (previous-22,previous+22)
        previous=int(np.clip((a+b)*.5,78,176))
        lo.append(a/256);hi.append(b/256)
    return {'fractions':fractions.round(4).tolist(),'banks':[np.round(lo,4).tolist(),np.round(hi,4).tolist()]}

if __name__=='__main__':
    features={}
    for station in sorted(RIVERS|URBAN):
        im=np.array(Image.open(ROOT/(station+'.webp')).convert('RGB'))
        data=banks(im,station in ['dadu','dawei']) if station in RIVERS else {}
        if station in URBAN:data['roofs']=roofprints(station)
        features[station]=data
        print(station,len(data.get('roofs',[])),'peripheral roofs')
    (ROOT/'features.json').write_text(json.dumps(features,separators=(',',':')),encoding='utf8')

