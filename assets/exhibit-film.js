import * as THREE from './vendor/three.module.min.js';

// Both renderers write scene-linear light into the same kind of film buffer.
// Shadows, air and highlight response are evaluated in linear light, then
// converted once for the display. Interface type stays outside this pipeline.
export class ExhibitFilm {
 constructor(renderer){
  this.renderer=renderer;
  const hdr=renderer.extensions.has('EXT_color_buffer_float');
  this.target=new THREE.WebGLRenderTarget(1,1,{type:hdr?THREE.HalfFloatType:THREE.UnsignedByteType,depthBuffer:true,stencilBuffer:false});
  this.target.texture.colorSpace=THREE.LinearSRGBColorSpace;
  this.target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  this.size=new THREE.Vector2();this.scene=new THREE.Scene();this.camera=new THREE.Camera();
  this.uniforms={frame:{value:this.target.texture},depthMap:{value:this.target.depthTexture},pixel:{value:new THREE.Vector2(1,1)},
   clip:{value:new THREE.Vector2()},unproject:{value:new THREE.Matrix4()},world:{value:new THREE.Matrix4()},
   span:{value:1},scale:{value:1},floorY:{value:0},clay:{value:0},strength:{value:1},sceneSky:{value:0}};
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  const mat=new THREE.ShaderMaterial({uniforms:this.uniforms,depthTest:false,depthWrite:false,toneMapped:false,
   vertexShader:'varying vec2 screenUv;void main(){screenUv=position.xy*.5+.5;gl_Position=vec4(position,1.);}',
   fragmentShader:`uniform sampler2D frame,depthMap;uniform vec2 pixel,clip;uniform mat4 unproject,world;
   uniform float span,scale,floorY,clay,strength,sceneSky;varying vec2 screenUv;
   float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
   float eyeDepth(float z){return clip.x*clip.y/(clip.y-z*(clip.y-clip.x));}
   float contact(vec2 v,float depth){float d=(depth-eyeDepth(texture2D(depthMap,clamp(screenUv+v,0.,1.)).x))/max(.001,depth);
     return smoothstep(.0008,.011,d)*(1.-smoothstep(.028,.095,d));}
   void main(){vec2 uv=screenUv;vec3 color=texture2D(frame,uv).rgb;
    float z=texture2D(depthMap,uv).x;
    vec4 ray=unproject*vec4(uv*2.-1.,z*2.-1.,1.);vec3 local=ray.xyz/ray.w;
    vec3 point=(world*vec4(local,1.)).xyz, eye=world[3].xyz, direction=normalize(point-eye);
    float towards=pow(max(dot(direction,normalize(vec3(-.67,.42,-.40))),0.),5.);
    if(z>.999998){float sky=smoothstep(-.05,.54,direction.y);
      color=mix(mix(vec3(.47,.51,.50)+towards*vec3(.31,.22,.10),vec3(.20,.31,.39),sky),color,sceneSky);
    }else{
      float depth=eyeDepth(z);
      float ao=contact(pixel*vec2(3.,1.),depth)+contact(pixel*vec2(-2.,3.),depth)+contact(pixel*vec2(-4.,-2.),depth)+contact(pixel*vec2(1.,-4.),depth)+
               .65*(contact(pixel*vec2(8.,3.),depth)+contact(pixel*vec2(-7.,-4.),depth));
      color*=1.-min(.25,ao*.083)*strength;
      float h0=(eye.y-floorY)/max(.001,span*scale),h1=(point.y-floorY)/max(.001,span*scale);
      float density=(exp(-max(0.,h0)*5.)+2.*exp(-max(0.,.5*(h0+h1))*5.)+exp(-max(0.,h1)*5.))*.25;
      float hazeDistance=max(0.,length(local)/max(.001,span)-.14);
      float air=min(.65,(1.-exp(-hazeDistance*density*.45))*strength);
      color=mix(color,vec3(luma(color)),air*.40);
      color=mix(color,vec3(.32,.41,.44)+towards*vec3(.24,.15,.055),air*(1.-.8*clay));
    }
    vec3 highlight=texture2D(frame,uv+pixel*vec2(3.5,2.4)).rgb+texture2D(frame,uv-pixel*vec2(3.5,2.4)).rgb;
    color+=.016*max(highlight*.5-.93,vec3(0.));
    color*=mix(vec3(1.035,1.012,.966),vec3(.965,1.0,1.038),(1.-smoothstep(.035,.28,luma(color)))*(1.-clay));
    color=max(vec3(0.),color*1.11);
    color=clamp((color*(2.25*color+.042))/(color*(2.15*color+.66)+.15),0.,1.);
    float edge=dot(uv-.5,uv-.5);color*=1.-.15*edge;
    gl_FragColor=vec4(color,1.);
    #include <colorspace_fragment>
   }`});
  const screen=new THREE.Mesh(geometry,mat);screen.frustumCulled=false;this.scene.add(screen);
 }
 draw(scene,camera,{span,floor=0,verticalScale=1,strength=1,clay=false}){
  const r=this.renderer,u=this.uniforms;
  r.getDrawingBufferSize(this.size);
  if(this.target.width!==this.size.x||this.target.height!==this.size.y){
   this.target.setSize(this.size.x,this.size.y);u.pixel.value.set(1/this.size.x,1/this.size.y);
  }
  u.clip.value.set(camera.near,camera.far);u.unproject.value.copy(camera.projectionMatrixInverse);
  u.world.value.copy(camera.matrixWorld);u.span.value=Math.max(.01,span);u.scale.value=verticalScale;u.floorY.value=floor;
  u.strength.value=strength;u.clay.value=clay?1:0;u.sceneSky.value=scene.background?.isTexture?1:0;
  r.setRenderTarget(this.target);r.render(scene,camera);
  r.setRenderTarget(null);r.render(this.scene,this.camera);
 }
}
