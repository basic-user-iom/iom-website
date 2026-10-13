import {PerspectiveCamera,Vector3,MathUtils} from 'three';

export type InspectionAction='forward'|'back'|'left'|'right'|'in'|'out'|'reset'|'up'|'down';
type Point={x:number;y:number;pan:boolean};
// Temporary unrestricted free-flight inspection. No collision or position bounds.
export class RoomInspection {
  enabled=false;
  private pointers=new Map<number,Point>();
  private yaw=0;
  private pitch=0;
  private initialPosition:Vector3;
  private initialQuaternion;
  private initialYaw=0;
  private initialPitch=0;
  constructor(private camera:PerspectiveCamera,private canvas:HTMLCanvasElement,private invalidate:()=>void){
    this.initialPosition=camera.position.clone();this.initialQuaternion=camera.quaternion.clone();
    const direction=camera.getWorldDirection(new Vector3());
    this.initialYaw=this.yaw=Math.atan2(direction.x,-direction.z);this.initialPitch=this.pitch=Math.asin(direction.y);
    canvas.addEventListener('pointerdown',this.down);canvas.addEventListener('pointermove',this.move);
    canvas.addEventListener('pointerup',this.up);canvas.addEventListener('pointercancel',this.up);
    canvas.addEventListener('lostpointercapture',this.up);canvas.addEventListener('wheel',this.wheel,{passive:false});
    canvas.addEventListener('keydown',this.key);canvas.addEventListener('contextmenu',this.menu);
  }
  setEnabled(value:boolean){this.enabled=value;if(!value)this.release();this.canvas.style.touchAction=value?'none':'pan-y';this.canvas.style.cursor=value?'grab':'default';}
  syncPose(){const d=this.camera.getWorldDirection(new Vector3());this.yaw=Math.atan2(d.x,-d.z);this.pitch=Math.asin(d.y);this.release();}
  reset(){this.release();this.camera.position.copy(this.initialPosition);this.camera.quaternion.copy(this.initialQuaternion);this.camera.zoom=1;this.yaw=this.initialYaw;this.pitch=this.initialPitch;this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();this.invalidate();}
  action(action:InspectionAction,fast=false){if(!this.enabled)return;if(action==='reset'){this.reset();return;}if(action==='in'||action==='out'){this.zoom(action==='in'?1.12:1/1.12);return;}const step=fast?.88:.22;if(action==='up'||action==='down'){this.camera.position.y+=action==='up'?step:-step;this.orient();return;}this.walk(action==='forward'?step:action==='back'?-step:0,action==='right'?step:action==='left'?-step:0);}
  snapshot(){return {enabled:this.enabled,mode:'free-fly',position:this.camera.position.toArray(),quaternion:this.camera.quaternion.toArray(),zoom:this.camera.zoom,yaw:this.yaw,pitch:this.pitch,bounds:null,obstacles:[],pointers:this.pointers.size};}
  private walk(forward:number,right:number){
    const direction=new Vector3(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch));
    this.camera.position.addScaledVector(direction,forward).addScaledVector(new Vector3(Math.cos(this.yaw),0,Math.sin(this.yaw)),right);this.orient();
  }
  private orient(){const d=new Vector3(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch));this.camera.lookAt(this.camera.position.clone().add(d));this.camera.updateMatrixWorld();this.invalidate();}
  private look(dx:number,dy:number){this.yaw+=dx*.0035;this.pitch=MathUtils.clamp(this.pitch-dy*.0035,-1.55,1.55);this.orient();}
  private zoom(scale:number){this.camera.zoom=MathUtils.clamp(this.camera.zoom*scale,.7,1.8);this.camera.updateProjectionMatrix();this.invalidate();}
  private down=(e:PointerEvent)=>{if(!this.enabled)return;e.preventDefault();this.canvas.focus({preventScroll:true});this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,pan:e.button!==0||e.shiftKey});this.canvas.setPointerCapture(e.pointerId);};
  private move=(e:PointerEvent)=>{
    if(!this.enabled||!this.pointers.has(e.pointerId))return;e.preventDefault();
    const before=[...this.pointers.values()],old=this.pointers.get(e.pointerId)!;
    this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,pan:old.pan});const after=[...this.pointers.values()];
    if(after.length===1){const dx=e.clientX-old.x,dy=e.clientY-old.y;if(old.pan||e.shiftKey)this.walk(-dy*.008,-dx*.008);else this.look(dx,dy);}
    else if(after.length===2){const distance=(p:Point[])=>Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);const a=distance(before),b=distance(after);if(a>5&&b>5)this.zoom(b/a);this.walk(-(after[0].y+after[1].y-before[0].y-before[1].y)*.004,-(after[0].x+after[1].x-before[0].x-before[1].x)*.004);}
  };
  private up=(e:PointerEvent)=>{this.pointers.delete(e.pointerId);};
  private wheel=(e:WheelEvent)=>{if(!this.enabled)return;e.preventDefault();const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?this.canvas.clientHeight:1);this.zoom(Math.exp(-MathUtils.clamp(pixels,-500,500)*.001));};
  private key=(e:KeyboardEvent)=>{if(!this.enabled||e.target!==this.canvas||e.ctrlKey||e.metaKey||e.altKey)return;const actions:Record<string,InspectionAction>={w:'forward',W:'forward',ArrowUp:'forward',s:'back',S:'back',ArrowDown:'back',a:'left',A:'left',ArrowLeft:'left',d:'right',D:'right',ArrowRight:'right','+':'in','=':'in','-':'out',Home:'reset',q:'down',Q:'down',e:'up',E:'up'};if(e.key==='Escape'){e.preventDefault();this.canvas.dispatchEvent(new CustomEvent('room-inspection-exit',{bubbles:true}));}else if(actions[e.key]){e.preventDefault();this.action(actions[e.key],e.shiftKey);}};
  private menu=(e:Event)=>{if(this.enabled)e.preventDefault();};
  private release(){for(const id of this.pointers.keys())if(this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);this.pointers.clear();}
  dispose(){this.setEnabled(false);this.canvas.removeEventListener('pointerdown',this.down);this.canvas.removeEventListener('pointermove',this.move);this.canvas.removeEventListener('pointerup',this.up);this.canvas.removeEventListener('pointercancel',this.up);this.canvas.removeEventListener('lostpointercapture',this.up);this.canvas.removeEventListener('wheel',this.wheel);this.canvas.removeEventListener('keydown',this.key);this.canvas.removeEventListener('contextmenu',this.menu);}
}
