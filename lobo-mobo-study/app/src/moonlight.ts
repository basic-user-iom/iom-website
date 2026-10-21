import * as THREE from 'three';

/** Cool exterior key clipped to the modelled window; sky bounce is balanced in the viewer. */
export class Moonlight {
  readonly light=new THREE.DirectionalLight('#c8d7ee',0);
  private aperture=new THREE.Group();
  private progress=0;
  constructor(scene:THREE.Scene){
    this.light.name='Room_Moonlight';this.light.position.set(-6,5,-3);this.light.target.position.set(0,1,0);
    this.light.castShadow=true;this.light.shadow.mapSize.set(1024,1024);
    Object.assign(this.light.shadow.camera,{left:-4.5,right:4.5,top:4.5,bottom:-4.5,near:.1,far:20});
    this.light.shadow.bias=-.000025;this.light.shadow.normalBias=.012;this.light.shadow.radius=2;
    // Invisible shadow-only aperture occludes this source alone.
    this.aperture.name='Moonlight window aperture';
    const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide,colorWrite:false,depthWrite:false});
    const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
    for(const [y,z,h,w] of [[-4.4425,0,9.115,24],[7.5925,0,8.815,24],[1.65,-6.7875,3.07,10.425],[1.65,8.9875,3.07,6.025]]){
      const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);m.rotation.y=Math.PI/2;m.position.set(-1.99,y,z);m.castShadow=true;m.customDepthMaterial=depth;
      m.onBeforeShadow=(_r,_o,_c,shadowCamera)=>{depth.colorWrite=depth.depthWrite=shadowCamera===this.light.shadow.camera;};this.aperture.add(m);
    }
    scene.add(this.light,this.light.target,this.aperture);
  }
  setProgress(progress:number){
    this.progress=THREE.MathUtils.clamp(progress,0,1);
    const t=THREE.MathUtils.clamp((this.progress-.35)/.65,0,1),factor=t*t*(3-2*t);
    this.light.intensity=1.8*factor;
  }
  snapshot(){return{intensity:this.light.intensity,progress:this.progress,color:this.light.color.getHexString(),position:this.light.position.toArray(),target:this.light.target.position.toArray(),castShadow:this.light.castShadow,mapSize:this.light.shadow.mapSize.toArray(),aperture:{planeX:-1.99,minY:.115,maxY:3.185,minZ:-1.575,maxZ:5.975},apertureOccludesMoonOnly:true};}
}

