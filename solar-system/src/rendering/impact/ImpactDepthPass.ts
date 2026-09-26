
import { type Camera, DepthTexture, HalfFloatType, Mesh, type Object3D, PerspectiveCamera, type Scene, ShaderMaterial,
  UnsignedByteType, UnsignedIntType, Vector3, WebGLRenderTarget, type WebGLRenderer } from 'three';
import { impactDepthUniforms as u } from './ImpactDepthContext';

/** Opaque depth uses original materials, including terrain displacement and cutouts. */
export class ImpactDepthPass {
  private target: WebGLRenderTarget | null = null;
  private readonly center=new Vector3();
  private readonly scale=new Vector3();
  private readonly atmosphereOrders=new Map<Object3D,number>();
  public render(renderer:WebGLRenderer,scene:Scene,camera:Camera,width:number,height:number,hdr:boolean):void {
    const impact=scene.getObjectByName('impact-lab-target-local-layer');
    const active=impact?.visible===true && impact.parent!==null && camera instanceof PerspectiveCamera;
    if(!active){this.reset();return;}
    if(!this.target){
      this.target=new WebGLRenderTarget(1,1,{type:hdr?HalfFloatType:UnsignedByteType,depthBuffer:true});
      this.target.depthTexture=new DepthTexture(1,1,UnsignedIntType);
      this.target.texture.name='impact-opaque-color';
    }
    width=Math.max(1,Math.floor(width));height=Math.max(1,Math.floor(height));
    if(this.target.width!==width||this.target.height!==height)this.target.setSize(width,height);
    u.uImpactNear.value=camera.near;u.uImpactFar.value=camera.far;
    let lightFound=false;
    impact.parent?.traverse(object=>{
      if(lightFound || !(object instanceof Mesh) || !(object.material instanceof ShaderMaterial))return;
      const sun=object.material.uniforms.uSunDirectionWorld?.value;
      if(sun){u.uImpactSunWorld.value.copy(sun);u.uImpactSunView.value.copy(sun).transformDirection(camera.matrixWorldInverse);lightFound=true;}
    });
    u.uImpactSkyVisibility.value=1;
    if(impact.parent?.getObjectByName('phase-4-earth-atmosphere')){
      impact.parent.getWorldPosition(this.center);impact.parent.getWorldScale(this.scale);
      this.center.subVectors(camera.position, this.center);
      const altitude=this.center.length()/Math.max(1e-20,this.scale.x)-1;
      const sunAltitude=this.center.normalize().dot(u.uImpactSunWorld.value);
      const day=Math.min(1,Math.max(0,(sunAltitude+0.08)/0.16));
      const altitudeFade=Math.min(1,Math.max(0,(altitude-0.0047)/0.0073));
      u.uImpactSkyVisibility.value=1-day*(1-altitudeFade);
    }
    const hidden:Object3D[]=[];
    scene.traverseVisible(object=>{
      const material=(object as Mesh).material;
      if(!material)return;
      const materials=Array.isArray(material)?material:[material];
      if(materials.some(m=>m.transparent)){
        hidden.push(object);
        if(materials.some(m=>m instanceof ShaderMaterial && m.uniforms.uShellRadius)){
          if(!this.atmosphereOrders.has(object))this.atmosphereOrders.set(object,object.renderOrder);
          object.renderOrder=6;
        }
      }
    });
    const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear;
    u.uImpactDepthEnabled.value=0;u.uImpactDepth.value=null;u.uImpactColor.value=null;
    try{
      for(const o of hidden)o.visible=false;
      renderer.autoClear=true;renderer.setRenderTarget(this.target);renderer.clear();
      renderer.render(scene,camera);
    }finally{
      for(const o of hidden)o.visible=true;
      renderer.setRenderTarget(previous);renderer.autoClear=autoClear;
    }
    u.uImpactDepth.value=this.target.depthTexture;u.uImpactColor.value=this.target.texture;
    u.uImpactDepthEnabled.value=1;u.uImpactViewport.value.set(width,height);
  }
  public reset():void{
    u.uImpactSkyVisibility.value=1;
    u.uImpactDepthEnabled.value=0;u.uImpactDepth.value=null;u.uImpactColor.value=null;
    for(const [object,order]of this.atmosphereOrders)object.renderOrder=order;
    this.atmosphereOrders.clear();
  }
  public dispose():void{this.reset();this.target?.dispose();this.target=null;}
}
