import {Vector3} from 'three';
import type {Application} from './LinarWalls';
import type {OrbitMode} from './controls/OrbitMode';
import {TourMotion,type TourClearance} from './TourPath';

export type LinarTarget=Application|'desk';
type Preset={position:[number,number,number];target:[number,number,number];fov:number};
// Shared low reception view matched to the user's Wall & ceiling reference.
export const wallCeilingEntry:Preset={position:[36.6474,1.1659,-30.0037],target:[30.5388,3.6347,-36.9],fov:59.2681};
// View 2 remains the independently supplied detail view for each application.
export const linarCameraPresets:Partial<Record<LinarTarget,Preset[]>>={
 wall:[wallCeilingEntry,{position:[25.9953,1.9914,-33.4100],target:[28.8246,1.8864,-36.9],fov:58.92}],
 desk:[{position:[31.1223,1.0499,-31.9424],target:[31.102,1.0516,-34.324],fov:54.998},{position:[35.35,1.75,-32],target:[31.45,.8,-34.65],fov:49}],
 ceiling:[wallCeilingEntry,{position:[28.176,4.3779,-32.5752],target:[30.5607,5.6,-34.6239],fov:47.2946}],
 freestanding:[{position:[36.106,1.5387,-36.0959],target:[40.2,1.6528,-32.8737],fov:50.8636},{position:[43.7601,1.2459,-31.0438],target:[40.2,1.7544,-33.111],fov:51.6628}],
};
export class LinarCamera {
 unlocked=false;
 private application:LinarTarget='wall';
 private active=false;
 private owned:Preset|undefined;
 private selected:Partial<Record<LinarTarget,number>>={};
 private tour?:TourMotion;private tourPaused=false;private clearance?:()=>TourClearance;
 constructor(private orbit:OrbitMode,private render:()=>void,private duration:()=>number=()=>.65,private beforeFocus:()=>void=()=>{}){}
 hasPreset(id:LinarTarget){return !!linarCameraPresets[id];}
 views(id:LinarTarget){return linarCameraPresets[id]?.length??0;}
 selectedView(id:LinarTarget){return this.selected[id]??0;}
 private preset(id:LinarTarget){return linarCameraPresets[id]?.[this.selectedView(id)];}
 choose(id:LinarTarget,index:number,touring=false){const preset=linarCameraPresets[id]?.[index];if(!preset)return;this.context(id,true);this.selected[id]=index;if(touring&&this.clearance){const world=this.clearance(),from=this.orbit.inspect();this.tour=new TourMotion(this.orbit,from,preset,world.route(new Vector3(...from.position),new Vector3(...preset.position)),world,this.render);this.tourPaused=false;}else this.focus(id);}
 setTourClearance(clearance:()=>TourClearance){this.clearance=clearance;}
 tourMoving(){return !!this.tour||this.orbit.isAnimating();}
 updateTour(dt:number){if(this.tour&&!this.tourPaused&&this.tour.update(dt))this.tour=undefined;}
 pauseTour(){this.tourPaused=true;if(!this.tour)this.orbit.cancelTransition();}
 resumeTour(){this.tourPaused=false;}
 endTour(){this.tour=undefined;this.tourPaused=false;}
 get locked(){return this.active&&!this.unlocked&&this.hasPreset(this.application);}
 context(id:LinarTarget,open:boolean){if(id!==this.application||!open)this.cancelOwned();this.application=id;this.active=open;this.sync();}
 enter(id:LinarTarget,open=true){this.context(id,open);if(id==='wall'||id==='ceiling'){this.selected[id]=0;if(open&&!this.unlocked)this.focus(id);}}
 edit(id:LinarTarget){this.context(id,true);if(!this.unlocked)this.focus(id);}
 setUnlocked(value:boolean){this.unlocked=value;if(value)this.cancelOwned();this.sync();if(this.locked)this.focus(this.application);}
 focus(id:LinarTarget){const p=this.preset(id);if(!p)return false;this.beforeFocus();this.owned=p;this.orbit.goTo(p.position,p.target,{fov:p.fov,duration:this.duration()});this.render();return true;}
 resetView(){if(!this.locked)return false;return this.focus(this.application);}
 suspend(){this.cancelOwned();this.active=false;this.sync();}
 private sync(){this.orbit.setEnabled(!this.locked);this.render();}
 private cancelOwned(){const p=this.owned;if(p&&this.orbit.isHeadingTo(new Vector3(...p.position),new Vector3(...p.target),p.fov))this.orbit.cancelTransition();this.owned=undefined;}
 capture(){return{unlocked:this.unlocked,application:this.application,active:this.active,selected:{...this.selected},orbit:this.orbit.inspect()};}
 restore(state:ReturnType<LinarCamera['capture']>,move=true){this.cancelOwned();this.orbit.cancelTransition();this.unlocked=state.unlocked;this.application=state.application;this.active=state.active;this.selected={...state.selected};if(move)this.orbit.restoreState({position:new Vector3(...state.orbit.position),target:new Vector3(...state.orbit.target),fov:state.orbit.fov});this.sync();}
 inspect(){return{unlocked:this.unlocked,locked:this.locked,application:this.application,active:this.active,selectedView:this.selectedView(this.application),preset:this.preset(this.application)??null,orbit:this.orbit.inspect()};}
}
