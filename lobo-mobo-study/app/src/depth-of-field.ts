import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

/** Restrained depth-aware blur: in-focus lamp pixels are never filtered. */
export class DepthOfField {
 supported:boolean;active=false;focus=[0,100];private target?:THREE.WebGLRenderTarget;private quad:FullScreenQuad;private size=new THREE.Vector2();
 private material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{tColor:{value:null},tDepth:{value:null},resolution:{value:new THREE.Vector2(1,1)},nearFar:{value:new THREE.Vector2(.05,60)},focus:{value:new THREE.Vector2(0,100)},maxRadius:{value:1.4}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:`#include <common>
 #include <packing>
 varying vec2 vUv;uniform sampler2D tColor;uniform sampler2D tDepth;uniform vec2 resolution;uniform vec2 nearFar;uniform vec2 focus;uniform float maxRadius;
 float distanceAt(vec2 uv){return -perspectiveDepthToViewZ(texture2D(tDepth,uv).x,nearFar.x,nearFar.y);}
 void main(){float d=distanceAt(vUv);float coc=smoothstep(.25,2.4,max(focus.x-d,d-focus.y));vec3 color=texture2D(tColor,vUv).rgb;float weight=1.;
 if(coc>.001){for(int i=0;i<8;i++){float a=float(i)*.785398163;vec2 uv=vUv+vec2(cos(a),sin(a))*maxRadius*coc/resolution;float tap=distanceAt(uv);float w=1.-smoothstep(.12,.65,abs(tap-d));color+=texture2D(tColor,uv).rgb*w;weight+=w;}}
 gl_FragColor=vec4(color/weight,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 constructor(private renderer:THREE.WebGLRenderer){this.supported=renderer.extensions.has('EXT_color_buffer_float');this.quad=new FullScreenQuad(this.material);}
 render(scene:THREE.Scene,camera:THREE.PerspectiveCamera,lamps:THREE.Group[]){
  this.renderer.getDrawingBufferSize(this.size);if(!this.target){this.target=new THREE.WebGLRenderTarget(this.size.x,this.size.y,{type:THREE.HalfFloatType,depthBuffer:true,samples:2});this.target.depthTexture=new THREE.DepthTexture(this.size.x,this.size.y,THREE.UnsignedIntType);}
  if(this.target.width!==this.size.x||this.target.height!==this.size.y)this.target.setSize(this.size.x,this.size.y);
  camera.updateMatrixWorld();let near=Infinity,far=0;for(const lamp of lamps){const box=new THREE.Box3().setFromObject(lamp.getObjectByName('MOBO_Ceramic')!);for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const d=-new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse).z;near=Math.min(near,d);far=Math.max(far,d);}}
  this.focus=[near-.4,far+.4];const u=this.material.uniforms;u.focus.value.set(...this.focus);u.nearFar.value.set(camera.near,camera.far);u.resolution.value.copy(this.size);u.maxRadius.value=(this.renderer.domElement.clientWidth<600?.85:1.4)*this.renderer.getPixelRatio();
  this.renderer.setRenderTarget(this.target);this.renderer.render(scene,camera);this.renderer.setRenderTarget(null);u.tColor.value=this.target.texture;u.tDepth.value=this.target.depthTexture;this.quad.render(this.renderer);this.active=true;
 }
 disable(){this.active=false;}
 fail(){this.supported=false;this.active=false;this.renderer.setRenderTarget(null);}
 snapshot(){return{supported:this.supported,active:this.active,focusRange:this.focus,maxRadiusPixels:this.material.uniforms.maxRadius.value,depthAware:true};}
 dispose(){this.target?.dispose();this.material.dispose();this.quad.dispose();}
}
