import type {Vector3} from 'three';
import type {TourEntrance} from './TourEntrance';
/** Threshold crossing arms the delay; the swept doorway always has priority. */
export class EntranceAutoClose{
 private previous?:{x:number;y:number;z:number};private remaining:number|null=null;private target=0;private from=0;private elapsed=0;private approaching=false;private crossed=0;private occupied=false;private proximityEnabled=true;private resumeAfterMovement?:{x:number;y:number;z:number};
 constructor(private door:TourEntrance){}
 suspendProximityUntilMovement(p:Vector3){this.resumeAfterMovement={x:p.x,y:p.y,z:p.z};this.proximityEnabled=false;}
 resumeProximity(){this.resumeAfterMovement=undefined;}
 reset(){this.resumeProximity();this.previous=undefined;this.remaining=null;this.target=this.from=this.door.amount;this.elapsed=0;this.approaching=false;}
 get running(){return this.remaining!==null&&this.remaining>0||this.door.amount!==this.target;}
 update(p:Vector3,dt:number,held=false,paused=false,proximityEnabled=true){const anchor=this.resumeAfterMovement;if(anchor&&proximityEnabled&&!held&&!paused&&Math.hypot(p.x-anchor.x,p.y-anchor.y,p.z-anchor.z)>.001)this.resumeProximity();proximityEnabled=proximityEnabled&&!this.resumeAfterMovement;this.proximityEnabled=proximityEnabled;const prev=this.previous;this.previous={x:p.x,y:p.y,z:p.z};if(held){this.target=this.from=this.door.amount;this.elapsed=0;return false;}if(paused)return false;
  const inOpening=p.z> -34.13&&p.z< -31.28&&p.y>.35&&p.y<3.5,near=inOpening&&Math.abs(p.x-25.267)<3.4;this.occupied=inOpening&&p.x>24.65&&p.x<26.75;
  let crossed=false;if(prev&&Math.hypot(p.x-prev.x,p.y-prev.y,p.z-prev.z)<1.5&&(prev.x-25.267)*(p.x-25.267)<0){const t=(25.267-prev.x)/(p.x-prev.x),z=prev.z+(p.z-prev.z)*t;crossed=z> -33.87&&z< -31.54&&inOpening;}
  const toward=prev&&Math.abs(p.x-25.267)<Math.abs(prev.x-25.267)-.0001;
  if(crossed){this.remaining=5;this.crossed++;}else if(this.remaining!==null)this.remaining=Math.max(0,this.remaining-dt);
  // A closed door is safe behind the threshold even inside its possible swing.
  // During a tour, only actual threshold occupancy may reopen a closed door;
  // an already moving/open leaf still protects its entire swept volume.
  const safetyOpen=this.occupied&&(proximityEnabled||this.door.amount>0||Math.abs(p.x-25.267)<.3);
  let target=this.target;if(safetyOpen||(proximityEnabled&&near&&toward)){target=1;this.approaching=true;}else if(this.remaining===0){target=0;this.remaining=null;this.approaching=false;}else if(this.remaining===null&&this.approaching&&!near){target=0;this.approaching=false;}
  if(target!==this.target){this.from=this.door.amount;this.target=target;this.elapsed=0;}
  if(this.door.amount===this.target)return false;this.elapsed=Math.min(1.7,this.elapsed+dt);const t=this.elapsed/1.7,ease=t*t*(3-2*t);this.door.set(this.from+(this.target-this.from)*ease);return true;
 }
 inspect(){return{waitingForMovement:!!this.resumeAfterMovement,proximityEnabled:this.proximityEnabled,remainingSeconds:this.remaining,crossings:this.crossed,target:this.target,occupied:this.occupied,running:this.running};}
}
