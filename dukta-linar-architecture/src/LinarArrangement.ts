import {curveElement,type BendState} from './linar-reference/bendMath';
type Pose={x:number;z:number;rotY:number};
const transform=(p:Pose,root:Pose)=>({x:root.x+Math.cos(root.rotY)*p.x+Math.sin(root.rotY)*p.z,z:root.z-Math.sin(root.rotY)*p.x+Math.cos(root.rotY)*p.z,rotY:root.rotY+p.rotY});
/** Port of LinarScene.panelPlacementsForState: tangent-connected modules,
 * centered in plan and aligned to their complete end-to-end chord. */
export function arrangeModules(count:number,width:number,state:BendState){
 const left={x:0,z:0,rotY:0},right={x:0,z:0,rotY:0};curveElement(-width/2,state,width,left);curveElement(width/2,state,width,right);
 const placements:Pose[]=[{x:0,z:0,rotY:0}];for(let i=1;i<count;i++){const prev=placements[i-1],edge=transform(right,prev),rotY=prev.rotY+right.rotY-left.rotY,offset=transform(left,{x:0,z:0,rotY});placements.push({x:edge.x-offset.x,z:edge.z-offset.z,rotY});}
 const points:Pose[]=[];for(const placement of placements)for(let i=0;i<=64;i++){const p={x:0,z:0,rotY:0};curveElement((i/64-.5)*width,state,width,p);points.push(transform(p,placement));}
 const cx=(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2,cz=(Math.min(...points.map(p=>p.z))+Math.max(...points.map(p=>p.z)))/2;for(const p of placements){p.x-=cx;p.z-=cz;}
 const start=transform(left,placements[0]),end=transform(right,placements[count-1]),angle=Math.atan2(end.z-start.z,end.x-start.x);for(const p of placements){const x=p.x,z=p.z;p.x=Math.cos(angle)*x+Math.sin(angle)*z;p.z=-Math.sin(angle)*x+Math.cos(angle)*z;p.rotY+=angle;}
 return placements;
}
export function installationPoint(x:number,count:number,width:number,state:BendState,placements:Pose[]){const index=Math.min(count-1,Math.max(0,Math.floor((x+count*width/2)/width))),p={x:0,z:0,rotY:0};curveElement(x+count*width/2-index*width-width/2,state,width,p);return transform(p,placements[index]);}
