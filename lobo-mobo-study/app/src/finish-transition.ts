import { Color, Vector2, type MeshPhysicalMaterial } from 'three';
import { applyFinish, type ExportedFinish, type FinishId } from './materials';
import { CordTextile, cordAppearance, type CordAppearance } from './cord-textile';

type GlazeAppearance={color:Color;metalness:number;roughness:number;clearcoat:number;clearcoatRoughness:number;normalScale:Vector2};

/** One opaque material stays on the mesh; only its existing PBR values blend. */
export class FinishTransition {
  private source?:GlazeAppearance;
  private target?:ExportedFinish;
  private targetColor=new Color();
  private sourceCord?:CordAppearance;
  private targetCord?:CordAppearance;
  private elapsed=.5;
  readonly duration=.5;
  constructor(private material:MeshPhysicalMaterial,private cord:CordTextile){}
  get active(){return this.elapsed<this.duration;}
  setFinish(finish:ExportedFinish){
    if(this.target?.id===finish.id)return;
    const initial=!this.target;
    this.target=finish;
    if(initial){applyFinish(this.material,finish);this.cord.apply(finish.id);return;}
    // A new click starts at the values already on screen, never the old endpoint.
    const m=this.material;
    this.source={color:m.color.clone(),metalness:m.metalness,roughness:m.roughness,clearcoat:m.clearcoat,clearcoatRoughness:m.clearcoatRoughness,normalScale:m.normalScale.clone()};
    const p=finish.actualExportedMaterial.pbrMetallicRoughness.baseColorFactor;
    this.targetColor.setRGB(p[0],p[1],p[2]);
    this.sourceCord=this.cord.captureAppearance();this.targetCord=cordAppearance(finish.id);
    this.elapsed=0;
  }
  advance(seconds:number){
    if(!this.active||!this.source||!this.target||seconds<=0)return;
    this.elapsed=Math.min(this.duration,this.elapsed+seconds);
    const t=this.elapsed/this.duration,q=t*t*(3-2*t),m=this.material,a=this.source;
    const b=this.target.actualExportedMaterial,p=b.pbrMetallicRoughness,c=b.extensions.KHR_materials_clearcoat;
    const mix=(start:number,end:number)=>start+(end-start)*q;
    m.color.lerpColors(a.color,this.targetColor,q);
    m.metalness=mix(a.metalness,p.metallicFactor);m.roughness=mix(a.roughness,p.roughnessFactor);
    m.clearcoat=mix(a.clearcoat,c.clearcoatFactor);m.clearcoatRoughness=mix(a.clearcoatRoughness,c.clearcoatRoughnessFactor);
    m.normalScale.set(mix(a.normalScale.x,b.normalTexture.scale),mix(a.normalScale.y,-b.normalTexture.scale));
    this.cord.blendAppearance(this.sourceCord!,this.targetCord!,q);
    if(!this.active){applyFinish(m,this.target);this.cord.apply(this.target.id);}
  }
  snapshot(){return{target:this.target?.id as FinishId|undefined,active:this.active,progress:this.elapsed/this.duration,duration:this.duration};}
}
