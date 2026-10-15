import * as T from 'three';import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';import type {SSRPass} from 'three/addons/postprocessing/SSRPass.js';import type {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
/** Reuse the reflection normal/depth buffer for AO and derive the ground-floor
 * reflection mask from the already-rendered, occlusion-correct beauty depth. */
export function shareReflectionBuffers(ssr:SSRPass,ao:GTAOPass,scene:T.Scene,camera:T.PerspectiveCamera,excluded:()=>T.Mesh[]){
 const normalDepth=new T.DepthTexture(1,1,T.UnsignedIntType);ssr.normalRenderTarget.depthTexture=normalDepth;ssr.normalRenderTarget.depthBuffer=true;
 const ownAO=(ao as GTAOPass&{normalRenderTarget:T.WebGLRenderTarget}).normalRenderTarget;
 type InternalSSR=SSRPass&{_renderOverride:(r:T.WebGLRenderer,m:T.Material,target:T.WebGLRenderTarget,c:number,a:number)=>void;_renderMetalness:(r:T.WebGLRenderer,m:T.Material,target:T.WebGLRenderTarget,c:number,a:number)=>void};
 const internal=ssr as InternalSSR,originalNormal=internal._renderOverride.bind(ssr);
 internal._renderOverride=(r,m,target,c,a)=>{const hidden=excluded().filter(x=>x.visible);scene.traverse(o=>{if(o instanceof T.Mesh&&!Array.isArray(o.material)&&!o.material.colorWrite&&o.visible)hidden.push(o);});hidden.forEach(x=>x.visible=false);try{originalNormal(r,m,target,c,a);}finally{hidden.forEach(x=>x.visible=true);}};
 const mask=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{tDepth:{value:ssr.beautyRenderTarget.depthTexture},inverseProjection:{value:camera.projectionMatrixInverse},world:{value:camera.matrixWorld}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'varying vec2 vUv; uniform sampler2D tDepth; uniform mat4 inverseProjection; uniform mat4 world; void main(){float d=texture2D(tDepth,vUv).x;vec4 p=inverseProjection*vec4(vUv*2.-1.,d*2.-1.,1.);vec4 w=world*vec4(p.xyz/p.w,1.);float floorMask=1.-step(.0015,abs(w.y-.30034656));gl_FragColor=vec4(vec3(floorMask),1.);}'}),quad=new FullScreenQuad(mask);
 internal._renderMetalness=(r,_m,target)=>{r.setRenderTarget(target);quad.render(r);};
 return(enabled:boolean)=>{if(enabled)ao.setGBuffer(normalDepth,ssr.normalRenderTarget.texture);else{ao.setGBuffer(ownAO.depthTexture!,ownAO.texture);(ao as GTAOPass&{_renderGBuffer:boolean})._renderGBuffer=true;}};
}
