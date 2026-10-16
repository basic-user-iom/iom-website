import {mobileProfile} from './DeviceProfile';
import * as THREE from 'three';
import {InteractionBeautyPass} from './InteractionBeautyPass';
import {shareReflectionBuffers} from './SharedReflectionBuffers';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {SSRPass} from 'three/addons/postprocessing/SSRPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
export class VisualEffects{
 readonly composer:EffectComposer;readonly ao:GTAOPass;readonly ssr:SSRPass;
 private width=512;private height=512;private high=false;
 private interactionBeauty:InteractionBeautyPass;private shareBuffers?: (enabled:boolean)=>void;private beauty:RenderPass;private fxaa:ShaderPass;private excluded:THREE.Mesh[]=[];private floors:THREE.Mesh[]=[];private interior=false;interacting=false;private savedInteraction?:{ao:boolean;ssr:boolean;beauty:boolean};
 constructor(private renderer:THREE.WebGLRenderer,private scene:THREE.Scene,camera:THREE.PerspectiveCamera){
  this.composer=new EffectComposer(renderer);this.beauty=new RenderPass(scene,camera);this.composer.addPass(this.beauty);
  this.ssr=new SSRPass({renderer,scene,camera,width:512,height:512,selects:[],groundReflector:null});this.ssr.opacity=.2;this.ssr.maxDistance=12;this.ssr.thickness=.12;this.ssr.blur=true;this.ssr.distanceAttenuation=true;this.ssr.fresnel=true;this.ssr.enabled=false;this.interactionBeauty=new InteractionBeautyPass(scene,camera,this.ssr.beautyRenderTarget);this.composer.addPass(this.interactionBeauty);this.composer.addPass(this.ssr);
  // SSR defaults to 16-bit depth: nearby ceiling skins then fight at lobby distances.
  if(this.ssr.beautyRenderTarget.depthTexture)this.ssr.beautyRenderTarget.depthTexture.type=THREE.UnsignedIntType;
  // Real 4 mm LINAR cuts need subpixel edge coverage. Multisample only the
  // existing interior beauty target. Auxiliary buffers use display resolution.
  this.ssr.beautyRenderTarget.samples=Math.min(mobileProfile?2:4,renderer.capabilities.maxSamples);
  this.ao=new GTAOPass(scene,camera,512,512);this.ao.blendIntensity=.7;this.ao.updateGtaoMaterial({radius:.6,thickness:.25,distanceExponent:2,scale:1,samples:8});this.composer.addPass(this.ao);
  const renderAO=this.ao.render.bind(this.ao);this.ao.render=(...args)=>{const hidden=this.excluded.filter(m=>m.visible);hidden.forEach(m=>m.visible=false);try{renderAO(...args);}finally{hidden.forEach(m=>m.visible=true);}};
  if(!new URLSearchParams(location.search).has('effects-review'))this.shareBuffers=shareReflectionBuffers(this.ssr,this.ao,scene,camera,()=>this.excluded);
  this.composer.addPass(new OutputPass());this.fxaa=new ShaderPass(FXAAShader);this.composer.addPass(this.fxaa);
 }
 register(root:THREE.Object3D){
  root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.some(m=>m.transparent||m.alphaTest>0||(m instanceof THREE.MeshPhysicalMaterial&&m.transmission>0)))this.excluded.push(o);if(/building_A_carpets/i.test(o.name))this.floors.push(o);});this.ssr.selects=[...this.floors];this.setInterior(this.interior);
 }
 setPlanCamera(camera:THREE.Camera|null){this.setInteracting(false);this.beauty.camera=camera??this.ssr.camera;this.ao.enabled=!camera;this.ssr.enabled=!camera&&this.interior&&this.floors.length>0&&(!mobileProfile||this.high);this.interactionBeauty.enabled=!camera&&mobileProfile&&this.interior&&!this.ssr.enabled;this.beauty.enabled=!this.ssr.enabled&&!this.interactionBeauty.enabled;}
 get interiorActive(){return this.interior;}
 setInterior(interior:boolean){const changed=this.interior!==interior;this.interior=interior;const ssr=interior&&this.floors.length>0&&(!mobileProfile||this.high);if(this.savedInteraction){this.savedInteraction.ssr=ssr;this.savedInteraction.beauty=!ssr;}this.ssr.enabled=!this.interacting&&ssr;if(!this.interacting)this.interactionBeauty.enabled=mobileProfile&&interior&&!ssr;this.beauty.enabled=!this.interacting&&!ssr&&!this.interactionBeauty.enabled;this.ao.updateGtaoMaterial({radius:interior?.6:1.2});if(changed)this.resize(this.width,this.height,this.high);}
 resize(width:number,height:number,high:boolean){
  const qualityChanged=this.high!==high;this.width=width;this.height=height;this.high=high;if(qualityChanged&&mobileProfile)this.setInterior(this.interior);
  const dpr=this.renderer.getPixelRatio(),native=Math.min(devicePixelRatio,high?2:1),sampleRatio=this.interior&&!mobileProfile?Math.max(2,dpr):dpr;
  this.composer.setPixelRatio(sampleRatio);this.composer.setSize(width,height);
  // Supersample physical cut edges, without multiplying the cost of smooth AO,
  // floor reflections or their shared normal buffer by the same pixel count.
  this.ao.setSize(Math.round(width*native*(high?.8:.55)),Math.round(height*native*(high?.8:.55)));
  this.ssr.resolutionScale=(high?.75:.5)*native/sampleRatio;
  this.ssr.normalRenderTarget.setSize(Math.round(width*native),Math.round(height*native));
  this.ssr.metalnessRenderTarget.setSize(Math.round(width*native),Math.round(height*native));
  this.fxaa.material.uniforms.resolution.value.set(1/(width*sampleRatio),1/(height*sampleRatio));
 }
 setInteracting(value:boolean){if(value===this.interacting)return;this.interacting=value;if(value){this.savedInteraction={ao:this.ao.enabled,ssr:this.ssr.enabled,beauty:this.beauty.enabled};this.ao.enabled=false;this.ssr.enabled=false;this.beauty.enabled=false;this.interactionBeauty.enabled=true;}else if(this.savedInteraction){this.interactionBeauty.enabled=false;this.ao.enabled=this.savedInteraction.ao;this.ssr.enabled=this.savedInteraction.ssr;this.beauty.enabled=this.savedInteraction.beauty;this.savedInteraction=undefined;if(mobileProfile&&this.interior&&!this.ssr.enabled){this.interactionBeauty.enabled=true;this.beauty.enabled=false;}}}
 inspect(){return{interacting:this.interacting,ao:this.ao.enabled,ssr:this.ssr.enabled,beauty:this.beauty.enabled,interactionBeauty:this.interactionBeauty.enabled,interior:this.interior,beautySamples:this.ssr.beautyRenderTarget.samples,beautySize:[this.ssr.beautyRenderTarget.width,this.ssr.beautyRenderTarget.height],normalSize:[this.ssr.normalRenderTarget.width,this.ssr.normalRenderTarget.height],reflectionSize:[this.ssr.ssrRenderTarget.width,this.ssr.ssrRenderTarget.height],canvasMSAA:this.renderer.getContext().getContextAttributes()?.antialias};}
 render(){this.shareBuffers?.(this.ssr.enabled);this.composer.render();}
}
