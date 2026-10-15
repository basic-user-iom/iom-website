import type * as T from 'three';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {CopyShader} from 'three/addons/shaders/CopyShader.js';
/** Reuse the full-resolution MSAA beauty target while deferred effects pause. */
export class InteractionBeautyPass extends Pass{
 private copy=new ShaderPass(CopyShader);
 constructor(private scene:T.Scene,private camera:T.Camera,private target:T.WebGLRenderTarget){super();this.enabled=false;this.copy.material.depthTest=false;this.copy.material.depthWrite=false;}
 render(renderer:T.WebGLRenderer,writeBuffer:T.WebGLRenderTarget){renderer.setRenderTarget(this.target);renderer.clear();renderer.render(this.scene,this.camera);this.copy.renderToScreen=this.renderToScreen;this.copy.render(renderer,writeBuffer,this.target,0,false);}
 dispose(){this.copy.dispose();}
}
