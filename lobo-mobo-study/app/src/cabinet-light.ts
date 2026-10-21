import * as THREE from 'three';

/** Local, downward kitchen task light. Independent of the pendant dimmer. */
export class CabinetLight {

  private strip:THREE.RectAreaLight;
  private diffuser?:THREE.MeshStandardMaterial;
  private enabled=true;
  private brightness=.45;
  constructor(scene:THREE.Scene,room:THREE.Object3D) {
    room.traverse(o=>{if(o instanceof THREE.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial&&m.name==='LED under-cabinet diffuser')this.diffuser=m;}});
    // A continuous downward area emitter avoids separate spotlight pools.
    // Its narrow physical area and low output keep the effect local to the niche.
    this.strip=new THREE.RectAreaLight('#ffcd85',0,3.26,.026);
    this.strip.name='Cabinet_LED_Linear_Reflection';this.strip.position.set(2.112,2.207,-1.54);
    this.strip.lookAt(new THREE.Vector3(2.112,1.207,-1.79));scene.add(this.strip);
    this.set(true,.45);
  }
  set(enabled:boolean,brightness:number,renderedPower?:number){
    this.enabled=enabled;this.brightness=THREE.MathUtils.clamp(brightness,0,1);
    const power=renderedPower??(enabled?this.brightness:0);
    this.strip.intensity=60*power;
    if(this.diffuser){this.diffuser.emissive.set('#ffcd85');this.diffuser.emissiveIntensity=1.4*power;}
  }
  snapshot(){return{enabled:this.enabled,brightness:this.brightness,stripIntensity:this.strip.intensity,diffuserIntensity:this.diffuser?.emissiveIntensity,color:'#ffcd85',downward:true};}
}


