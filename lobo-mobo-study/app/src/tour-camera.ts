import {Box3, MathUtils, PerspectiveCamera, Vector3} from 'three';

export type TourShot = 'room' | 'lamp' | 'table';
export type TourCameraFrame = {shot:TourShot; amount:number; lift?:number; delta:number; rebase?:boolean; immediate?:boolean};

// Exact critically damped spring update: retargeting preserves both position and
// velocity, including at chapter boundaries and at different refresh rates.
export function dampVector(value:Vector3, velocity:Vector3, goal:Vector3, seconds:number, frequency=3.2) {
  if(seconds<=0)return;
  const decay=Math.exp(-frequency*seconds);
  for(const axis of ['x','y','z'] as const){
    const offset=value[axis]-goal[axis], impulse=velocity[axis]+frequency*offset;
    value[axis]=goal[axis]+(offset+impulse*seconds)*decay;
    velocity[axis]=(velocity[axis]-frequency*impulse*seconds)*decay;
  }
}

// The slower base shot also carries acceleration across a retarget. This exact
// third-order critical response gives the dolly a soft start without frame-rate
// dependent integration or an acceleration kick at the next chapter.
export function dampShot(value:Vector3,velocity:Vector3,acceleration:Vector3,goal:Vector3,seconds:number,frequency=1.5){
  if(seconds<=0)return;
  const decay=Math.exp(-frequency*seconds),squared=frequency*frequency;
  for(const axis of ['x','y','z'] as const){
    const offset=value[axis]-goal[axis],linear=velocity[axis]+frequency*offset;
    const quadratic=(acceleration[axis]+2*frequency*velocity[axis]+squared*offset)*.5;
    const polynomial=offset+linear*seconds+quadratic*seconds*seconds,derivative=linear+2*quadratic*seconds;
    value[axis]=goal[axis]+polynomial*decay;
    velocity[axis]=(derivative-frequency*polynomial)*decay;
    acceleration[axis]=(2*quadratic-2*frequency*derivative+squared*polynomial)*decay;
  }
}

/** One perspective scene for the whole tour, from room to ceramic and table. */
export class RoomTourCamera {
  private position=new Vector3();
  private positionVelocity=new Vector3();
  private positionAcceleration=new Vector3();
  private targetVelocity=new Vector3();
  private targetAcceleration=new Vector3();
  private target=new Vector3();
  private driftPosition=new Vector3();
  private driftTarget=new Vector3();
  private driftPositionVelocity=new Vector3();
  private driftTargetVelocity=new Vector3();
  private driftPositionGoal=new Vector3();
  private driftTargetGoal=new Vector3();
  private right=new Vector3();
  private up=new Vector3(0,1,0);
  private zoomState=new Vector3(1,0,0);
  private zoomVelocity=new Vector3();
  private zoomGoal=new Vector3(1,0,0);
  private roomPosition:Vector3;
  private roomTarget:Vector3;
  private lampTarget:Vector3;
  private tableTarget:Vector3;
  private direction:Vector3;
  private goalPosition=new Vector3();
  private goalTarget=new Vector3();
  private ready=false;
  private shot:TourShot='room';
  private shellHeight:number;
  constructor(private camera:PerspectiveCamera,room:{position:number[];target:number[]},shell:Box3,tableTop:number){
    this.roomPosition=new Vector3().fromArray(room.position);
    this.roomTarget=new Vector3().fromArray(room.target);
    this.direction=this.roomPosition.clone().sub(this.roomTarget).normalize();
    this.right.crossVectors(this.up,this.direction).normalize();
    this.up.crossVectors(this.direction,this.right).normalize();
    this.lampTarget=shell.getCenter(new Vector3());
    this.shellHeight=shell.max.y-shell.min.y;
    this.tableTarget=this.lampTarget.clone();
    this.tableTarget.y=(shell.max.y+tableTop)*.5;
  }
  stop(){this.ready=false;}
  update(frame:TourCameraFrame){
    const {camera}=this;
    this.shot=frame.shot;
    this.goalTarget.copy(frame.shot==='lamp'?this.lampTarget:frame.shot==='table'?this.tableTarget:this.roomTarget);
    if(frame.shot==='room')this.goalPosition.copy(this.roomPosition);
    else {
      // Framing adapts to portrait screens as well as the room's shifted lens.
      const halfAngle=MathUtils.degToRad(camera.fov)*.5;
      const halfHeight=frame.shot==='lamp'?Math.max(.5,this.shellHeight*.95):Math.max(.95,this.lampTarget.y-this.tableTarget.y+.55);
      const distance=Math.max(frame.shot==='lamp'?2.2:3.5,halfHeight/Math.tan(halfAngle));
      this.goalPosition.copy(this.goalTarget).addScaledVector(this.direction,distance);
    }
    // Perpendicular drift components never reverse at the same time. Keep this
    // restrained motion separate from the slow dolly so the approved six-second
    // closing envelope retains its original response and does not acquire lag.
    const drift=frame.immediate?0:frame.amount,lift=frame.immediate?0:frame.lift??0;
    this.driftPositionGoal.copy(this.right).multiplyScalar(drift*.13).addScaledVector(this.up,lift*.035);
    this.driftTargetGoal.copy(this.right).multiplyScalar(drift*.035).addScaledVector(this.up,lift*.01);
    if(!this.ready||frame.rebase){
      // Preserve the live orientation when returning from a manual camera move.
      const distance=Math.max(.5,camera.position.distanceTo(this.ready?this.target:this.roomTarget));
      camera.getWorldDirection(this.target).multiplyScalar(distance).add(camera.position);
      this.position.copy(camera.position);
      this.positionVelocity.set(0,0,0);this.targetVelocity.set(0,0,0);
      this.positionAcceleration.set(0,0,0);this.targetAcceleration.set(0,0,0);
      this.driftPosition.set(0,0,0);this.driftTarget.set(0,0,0);
      this.driftPositionVelocity.set(0,0,0);this.driftTargetVelocity.set(0,0,0);
      this.zoomState.set(camera.zoom,0,0);this.zoomVelocity.set(0,0,0);this.ready=true;
    }
    if(frame.immediate){
      this.position.copy(this.goalPosition);this.target.copy(this.goalTarget);this.zoomState.copy(this.zoomGoal);
      this.positionVelocity.set(0,0,0);this.targetVelocity.set(0,0,0);this.zoomVelocity.set(0,0,0);
      this.positionAcceleration.set(0,0,0);this.targetAcceleration.set(0,0,0);
      this.driftPosition.set(0,0,0);this.driftTarget.set(0,0,0);
      this.driftPositionVelocity.set(0,0,0);this.driftTargetVelocity.set(0,0,0);
    }else{
      const seconds=MathUtils.clamp(frame.delta,0,.15);
      dampShot(this.position,this.positionVelocity,this.positionAcceleration,this.goalPosition,seconds);
      dampShot(this.target,this.targetVelocity,this.targetAcceleration,this.goalTarget,seconds);
      dampVector(this.driftPosition,this.driftPositionVelocity,this.driftPositionGoal,seconds);
      dampVector(this.driftTarget,this.driftTargetVelocity,this.driftTargetGoal,seconds);
      dampVector(this.zoomState,this.zoomVelocity,this.zoomGoal,seconds);
    }
    camera.zoom=this.zoomState.x;camera.updateProjectionMatrix();
    camera.position.copy(this.position).add(this.driftPosition);
    camera.lookAt(this.target.clone().add(this.driftTarget));camera.updateMatrixWorld();
  }
  snapshot(){return {active:this.ready,shot:this.shot,position:this.camera.position.toArray(),target:this.target.clone().add(this.driftTarget).toArray(),positionVelocity:this.positionVelocity.clone().add(this.driftPositionVelocity).toArray(),targetVelocity:this.targetVelocity.clone().add(this.driftTargetVelocity).toArray(),basePositionAcceleration:this.positionAcceleration.toArray(),baseTargetAcceleration:this.targetAcceleration.toArray(),zoom:this.camera.zoom};}
}
