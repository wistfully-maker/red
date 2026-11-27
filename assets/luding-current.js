import * as THREE from './vendor/three.module.min.js';

// The reflected banks are static. Only camera motion needs another reflection pass.
// Ripples, the broken surface highlights and the wakes change every frame.
export class LudingCurrent {
  constructor(mesh, clock, stones) {
    this.mesh=mesh;
    this.target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true});
    this.target.texture.colorSpace=THREE.LinearSRGBColorSpace;
    this.camera=new THREE.PerspectiveCamera();
    this.lastMatrix=new THREE.Matrix4();this.lastFov=0;this.lastUpdate=-Infinity;
    this.projection=new THREE.Matrix4();
    this.bias=new THREE.Matrix4().set(.5,0,0,.5, 0,.5,0,.5, 0,0,.5,.5, 0,0,0,1);
    const obstacles=[];
    for(let i=0;i<24;i+=4)obstacles.push(new THREE.Vector4(...stones.slice(i,i+4)));
    const material=mesh.material;
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{riverSeconds:clock,riverMirror:{value:this.target.texture},
        mirrorProjection:{value:this.projection},boulders:{value:obstacles}});
      shader.vertexShader='uniform float riverSeconds; uniform mat4 mirrorProjection; varying vec2 riverXZ; varying vec4 reflectedUv;\n'+shader.vertexShader
        .replace('#include <begin_vertex>',`#include <begin_vertex>
          riverXZ=position.xz;
          float surge=sin(position.z*.38+position.x*.17-riverSeconds*1.13 + .8*sin(position.x*.19));
          transformed.y+=surge*.08+.032*sin(position.z*.81-position.x*.26-riverSeconds*1.65);
          reflectedUv=mirrorProjection*modelMatrix*vec4(transformed,1.);
        `);
      shader.fragmentShader=`uniform float riverSeconds;uniform sampler2D riverMirror;
        uniform vec4 boulders[6];varying vec2 riverXZ;varying vec4 reflectedUv;
        float waterHash(vec2 p){p=fract(p*vec2(.1031,.11369));p+=dot(p,p.yx+19.19);return fract(p.x*p.y);}
        float waterNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(waterHash(i),waterHash(i+vec2(1,0)),f.x),mix(waterHash(i+vec2(0,1)),waterHash(i+1.),f.x),f.y);}
      `+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          float t=riverSeconds;
          // Cross-channel variation stretches foam into downstream filaments.
          // Keep the bank coordinates fixed while transporting surface detail.
          vec2 advect=riverXZ-vec2(.10,2.35)*t;
          float bend=waterNoise(riverXZ*.079)*2.8;
          vec2 phase=vec2(advect.x*.39+bend,advect.y*.17);
          float noiseA=waterNoise(phase);
          float crest=.60*noiseA+.40*waterNoise(phase*2.7+noiseA*1.8);
          float flecks=waterNoise(advect*vec2(2.1,1.13)+crest*3.8);
          float wake=0.;
          for(int j=0;j<6;j++){
            vec4 b=boulders[j];vec2 p=riverXZ-b.xy;
            float rim=length(p/max(b.zw,vec2(.1)));
            float collar=1.-smoothstep(.13,.45,abs(rim-1.0));
            float downstream=max(0.,p.y);
            float fork=abs(abs(p.x)-(.70*b.z+.18*downstream+sin(p.y*1.2-t*1.8)*.21));
            float trail=(1.-smoothstep(.03,.67,fork))*smoothstep(-.15,1.,p.y)*exp(-downstream/(b.w*3.8));
            wake=max(wake,collar*.77+trail*.88);
          }
          // Keep most of the channel dark. Fine broken crests run across the
          // current, with stronger persistent white water directly behind rocks.
          float ribbon=1.-abs(sin(advect.y*3.4+bend+noiseA*5.));
          float detail=1.-smoothstep(.25,1.20,fwidth(advect.y));
          float whitecap=smoothstep(.68,.90,crest)*smoothstep(.72,.95,ribbon)*flecks*detail;
          vec2 streamUV=vec2(riverXZ.x*.72+.48*sin(riverXZ.y*.11),advect.y*.15);
          float filaments=waterNoise(streamUV+noiseA*.68);
          float broken=smoothstep(.36,.76,waterNoise(advect*vec2(.28,.45)));
          float drift=smoothstep(.64,.84,filaments)*broken;
          float foam=clamp(wake*smoothstep(.28,.78,flecks)+whitecap*.34+drift*.45,0.,.82);
          float bedLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          vec3 channelColor=mix(vec3(.023,.059,.053),vec3(.089,.16,.13),smoothstep(.018,.24,bedLuma));
          diffuseColor.rgb=mix(channelColor,diffuseColor.rgb,.18)*(.84+.30*crest);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.50,.59,.55),foam);
        `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          vec2 a=texture2D(normalMap,riverXZ*vec2(.115,.16)-vec2(.010,.105)*t+vec2(bend*.061,0.)).rg*2.-1.;
          vec2 b=texture2D(normalMap,mat2(.86,-.51,.51,.86)*riverXZ*.26+vec2(.031,-.074)*t).rg*2.-1.;
          vec2 tilt=.64*a+.37*b+.044*vec2(sin(phase.y*3.+crest*4.),cos(phase.x*2.1+phase.y));
          normal=normalize(normal+mat3(viewMatrix)*vec3(tilt.x,0.,tilt.y));
        `).replace('#include <opaque_fragment>',`
          vec2 st=reflectedUv.xy/reflectedUv.w+tilt*vec2(.026,.040);
          float inside=smoothstep(0.,.035,min(min(st.x,1.-st.x),min(st.y,1.-st.y)));
          float grazing=pow(1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.),3.);
          vec3 reflection=texture2D(riverMirror,clamp(st,.002,.998)).rgb;
          outgoingLight=mix(outgoingLight,reflection*.83,(.055+.64*grazing)*inside*(1.-foam)*step(.001,reflectedUv.w));
          outgoingLight+=vec3(.21,.25,.23)*foam;
          #include <opaque_fragment>
        `);
    };
    material.customProgramCacheKey=()=>'luding-moving-channel-3';
  }
  update(renderer,scene,eye,width,height) {
    const w=Math.min(width<720?384:768,Math.round(width*.5)),h=Math.max(1,Math.round(w*height/width));
    const resized=this.target.width!==w||this.target.height!==h, now=performance.now();
    if(!resized&&this.lastFov===eye.fov&&(this.lastMatrix.equals(eye.matrixWorld)||now-this.lastUpdate<100))return;
    this.target.setSize(w,h);this.lastMatrix.copy(eye.matrixWorld);this.lastFov=eye.fov;this.lastUpdate=now;
    const camera=this.camera,y=.24,normal=new THREE.Vector3(0,1,0);
    camera.copy(eye,false);
    camera.position.y=2*y-eye.position.y;
    const direction=eye.getWorldDirection(new THREE.Vector3()).reflect(normal);
    camera.up.copy(eye.up).applyQuaternion(eye.quaternion).reflect(normal);
    camera.lookAt(direction.add(camera.position));camera.updateMatrixWorld();
    this.projection.copy(this.bias).multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse);
    // Clip the reflected camera at the water plane so the riverbed cannot obscure the bank.
    const plane=new THREE.Plane(normal,-y+.05).applyMatrix4(camera.matrixWorldInverse);
    const clip=new THREE.Vector4(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
    const m=camera.projectionMatrix.elements;
    const q=new THREE.Vector4((Math.sign(clip.x)+m[8])/m[0],(Math.sign(clip.y)+m[9])/m[5],-1,(1+m[10])/m[14]);
    clip.multiplyScalar(2/clip.dot(q));m[2]=clip.x;m[6]=clip.y;m[10]=clip.z+1;m[14]=clip.w;
    const previous=renderer.getRenderTarget(), shadow=renderer.shadowMap.needsUpdate;
    this.mesh.visible=false;renderer.shadowMap.needsUpdate=false;
    try{renderer.setRenderTarget(this.target);renderer.render(scene,camera);}
    finally{this.mesh.visible=true;renderer.setRenderTarget(previous);renderer.shadowMap.needsUpdate=shadow;}
  }
  dispose(){this.target.dispose();}
}
