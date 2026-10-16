import * as T from 'three';
import type {OrbitMode} from './OrbitMode';
import {WalkWorld} from './WalkWorld';
const editable=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"])');
export class WalkMode{
 active=false;readonly world=new WalkWorld();private keys=new Set<string>();private drag:{id:number;x:number;y:number}|undefined;private dirty=true;private available=false;private yaw=0;private pitch=0;private touchPad?:HTMLElement;private touchKeys=new Map<number,string>();
 constructor(private camera:T.PerspectiveCamera,private orbit:OrbitMode,private canvas:HTMLElement,private roots:()=>T.Object3D[],private panels:()=>T.Object3D[],private changed:()=>void){
  if(matchMedia('(pointer: coarse)').matches){
   const pad=this.touchPad=document.createElement('div');pad.id='walk-touch';pad.hidden=true;pad.setAttribute('aria-label','Walking directions');
   for(const [code,label,arrow] of [['KeyW','Walk forward','↑'],['KeyA','Walk left','←'],['KeyS','Walk backward','↓'],['KeyD','Walk right','→']]){const b=document.createElement('button');b.textContent=arrow;b.dataset.direction=code;b.setAttribute('aria-label',label);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);this.touchKeys.set(e.pointerId,code);this.keys.add(code);this.changed();});const release=(e:PointerEvent)=>{const key=this.touchKeys.get(e.pointerId);this.touchKeys.delete(e.pointerId);if(key&&![...this.touchKeys.values()].includes(key))this.keys.delete(key);};b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);pad.append(b);}canvas.parentElement!.append(pad);
  }
  window.addEventListener('keydown',e=>{if(!this.active)return;if(e.key==='Escape'){this.stop();return;}if(editable(e.target))return;if(['KeyW','KeyA','KeyS','KeyD'].includes(e.code)){e.preventDefault();this.keys.add(e.code);this.changed();}});
  window.addEventListener('keyup',e=>{this.keys.delete(e.code);});window.addEventListener('blur',()=>this.clearKeys());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clearKeys();});document.addEventListener('focusin',e=>{if(editable(e.target))this.clearKeys();});
  canvas.addEventListener('pointerdown',e=>{if(!this.active||e.button!==0)return;e.preventDefault();canvas.focus();this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!this.active||this.drag?.id!==e.pointerId)return;this.yaw-=(e.clientX-this.drag.x)*.003;this.pitch=T.MathUtils.clamp(this.pitch-(e.clientY-this.drag.y)*.003,-1.3,1.3);this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};this.look();this.changed();});
  const end=()=>{this.drag=undefined;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);
 }
 setAvailable(value:boolean){this.available=value;if(!value)this.stop();}
 invalidate(){this.dirty=true;}
 private prepare(){if(this.dirty){this.world.rebuild(this.roots(),this.panels());this.dirty=false;}}
 start(){if(!this.available)return false;this.prepare();const start=this.world.safeStart(this.camera.position);if(!start)return false;this.orbit.cancelTransition();this.clearKeys();const e=new T.Euler().setFromQuaternion(this.camera.quaternion,'YXZ');this.yaw=e.y;this.pitch=e.x;this.camera.position.copy(start);this.active=true;if(this.touchPad)this.touchPad.hidden=false;this.orbit.setEnabled(false);this.look();this.changed();return true;}
 stop(){const was=this.active;this.active=false;if(this.touchPad)this.touchPad.hidden=true;this.clearKeys();this.drag=undefined;if(was){this.orbit.setEnabled(true);this.changed();}}
 clearKeys(){this.keys.clear();this.touchKeys.clear();}
 get moving(){return this.active&&this.keys.size>0;}
 private look(){this.camera.quaternion.setFromEuler(new T.Euler(this.pitch,this.yaw,0,'YXZ'));this.orbit.controls.target.copy(this.camera.position).add(this.camera.getWorldDirection(new T.Vector3()).multiplyScalar(3));}
 update(dt:number){if(!this.active)return;this.orbit.setEnabled(false);this.prepare();const forward=new T.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw)),right=new T.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw)),direction=forward.multiplyScalar(Number(this.keys.has('KeyW'))-Number(this.keys.has('KeyS'))).addScaledVector(right,Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA')));if(direction.lengthSq()){direction.normalize().multiplyScalar(1.65*Math.min(Math.max(dt,0),.1));this.camera.position.copy(this.world.move(this.camera.position,direction));this.look();}}
 inspect(){return{active:this.active,available:this.available,moving:this.moving,keys:[...this.keys],position:this.camera.position.toArray(),...this.world.inspect()};}
}
