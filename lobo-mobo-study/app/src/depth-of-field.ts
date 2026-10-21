import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

/** Full-resolution depth keeps the ceramic sharp as the room falls softly out of focus. */
export class DepthOfField {
 supported:boolean;active=false;focus=[0,100];private target?:THREE.WebGLRenderTarget;private quad:FullScreenQuad;private size=new THREE.Vector2();
 private approach=0;private subjectDepth=0;private radiusCss=1.4;
 private box=new THREE.Box3();private corner=new THREE.Vector3();
 private material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{tColor:{value:null},tDepth:{value:null},resolution:{value:new THREE.Vector2(1,1)},nearFar:{value:new THREE.Vector2(.05,60)},focus:{value:new THREE.Vector2(0,100)},maxRadius:{value:1.4},approach:{value:0}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:`#include <common>
 #include <packing>
 varying vec2 vUv;uniform sampler2D tColor;uniform sampler2D tDepth;uniform vec2 resolution;uniform vec2 nearFar;uniform vec2 focus;uniform float maxRadius;uniform float approach;
 float distanceAt(vec2 uv){return -perspectiveDepthToViewZ(texture2D(tDepth,uv).x,nearFar.x,nearFar.y);}
 void main(){
  float d=distanceAt(vUv);
  float roomCoc=smoothstep(.25,2.4,max(focus.x-d,d-focus.y));
  float backgroundCoc=smoothstep(.1,1.3,d-focus.y);
  float coc=mix(roomCoc,backgroundCoc,approach);
  vec3 color=texture2D(tColor,vUv).rgb;float weight=1.;
  if(coc>.001){for(int i=0;i<12;i++){
   // Fixed disk samples avoid moving noise; depth rejection preserves silhouettes.
   float a=float(i)*2.39996323;float radius=sqrt((float(i)+.5)/12.);
   vec2 uv=vUv+vec2(cos(a),sin(a))*maxRadius*coc*radius/resolution;
   // Pair color and depth at the same texel. Bilinear color can otherwise pull
   // a sharp ceramic edge into a tap whose nearest depth belongs to the wall.
   uv=(floor(uv*resolution)+.5)/resolution;
   float tap=distanceAt(uv);
   float roomWeight=1.-smoothstep(.12,.65,abs(tap-d));
   float protectedDepth=tap;
   if(approach>.001){
    // Resolved MSAA border texels can contain both surfaces. Reject that one-pixel
    // fringe as well, without softening the original in-focus ceramic pixels.
    protectedDepth=min(protectedDepth,min(min(distanceAt(uv+vec2(1.,0.)/resolution),distanceAt(uv-vec2(1.,0.)/resolution)),min(distanceAt(uv+vec2(0.,1.)/resolution),distanceAt(uv-vec2(0.,1.)/resolution))));
   }
   // A blurred wall must never gather the sharp ceramic or a nearer foreground edge.
   float backgroundWeight=(1.-smoothstep(.045,.2,d-protectedDepth))*smoothstep(focus.y,focus.y+.06,protectedDepth);
   float w=mix(roomWeight,backgroundWeight,approach);
   color+=texture2D(tColor,uv).rgb*w;weight+=w;
  }}
  gl_FragColor=vec4(color/weight,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`});
 constructor(private renderer:THREE.WebGLRenderer){this.supported=renderer.extensions.has('EXT_color_buffer_float');this.quad=new FullScreenQuad(this.material);}
 render(scene:THREE.Scene,camera:THREE.PerspectiveCamera,lamps:THREE.Group[]){
  // Match the canvas's coverage sampling so the offscreen pass does not restore
  // subpixel cabinet-bevel shimmer. Keep the existing pixel ratio and one render target.
  this.renderer.getDrawingBufferSize(this.size);if(!this.target){this.target=new THREE.WebGLRenderTarget(this.size.x,this.size.y,{type:THREE.HalfFloatType,depthBuffer:true,samples:Math.min(4,this.renderer.capabilities.maxSamples)});this.target.depthTexture=new THREE.DepthTexture(this.size.x,this.size.y,THREE.UnsignedIntType);}
  if(this.target.width!==this.size.x||this.target.height!==this.size.y)this.target.setSize(this.size.x,this.size.y);
  camera.updateMatrixWorld();let near=Infinity,far=0,subjectNear=Infinity,subjectFar=0,subjectDepth=Infinity;
  for(const lamp of lamps){
   this.box.setFromObject(lamp.getObjectByName('MOBO_Ceramic')!);let lampNear=Infinity,lampFar=0;
   for(const x of [this.box.min.x,this.box.max.x])for(const y of [this.box.min.y,this.box.max.y])for(const z of [this.box.min.z,this.box.max.z]){
    const d=-this.corner.set(x,y,z).applyMatrix4(camera.matrixWorldInverse).z;lampNear=Math.min(lampNear,d);lampFar=Math.max(lampFar,d);
   }
   near=Math.min(near,lampNear);far=Math.max(far,lampFar);
   const depth=(lampNear+lampFar)*.5;if(depth>0&&depth<subjectDepth){subjectDepth=depth;subjectNear=lampNear;subjectFar=lampFar;}
  }
  // Distance follows the existing continuous dolly, including pauses and the return.
  // The wide room keeps both pendants in focus; near the featured pendant the other
  // lamp no longer expands the protected depth band across the visible backsplash.
  this.subjectDepth=subjectDepth;
  this.approach=1-THREE.MathUtils.smoothstep(subjectDepth,2.5,5.8);
  this.focus=[THREE.MathUtils.lerp(near-.4,subjectNear-.12,this.approach),THREE.MathUtils.lerp(far+.4,subjectFar+.12,this.approach)];
  const mobile=this.renderer.domElement.clientWidth<600;
  this.radiusCss=THREE.MathUtils.lerp(mobile?.85:1.4,mobile?2.1:3.2,this.approach);
  const u=this.material.uniforms;u.focus.value.set(...this.focus);u.nearFar.value.set(camera.near,camera.far);u.resolution.value.copy(this.size);u.maxRadius.value=this.radiusCss*this.renderer.getPixelRatio();u.approach.value=this.approach;
  this.renderer.setRenderTarget(this.target);this.renderer.render(scene,camera);this.renderer.setRenderTarget(null);u.tColor.value=this.target.texture;u.tDepth.value=this.target.depthTexture;this.quad.render(this.renderer);this.active=true;
 }
 disable(){this.active=false;}
 fail(){this.supported=false;this.active=false;this.renderer.setRenderTarget(null);}
 snapshot(){return{supported:this.supported,active:this.active,focusRange:this.focus,maxRadiusPixels:this.material.uniforms.maxRadius.value,maxRadiusCss:this.radiusCss,approach:this.approach,subjectDepth:this.subjectDepth,depthAware:true,samples:this.target?.samples??Math.min(4,this.renderer.capabilities.maxSamples),filterSamples:12};}
 dispose(){this.target?.dispose();this.material.dispose();this.quad.dispose();}
}
