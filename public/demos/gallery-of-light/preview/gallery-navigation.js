import {Box3,Matrix4,Vector3} from 'three';

// A small, conservative walking grid built from the loaded geometry. Floors are
// projected from their triangles; walls, glazing, furniture and partitions are
// clipped to a visitor's body height before their footprints are expanded.
// Sculpture AABBs are intentionally conservative, including their plinths.
const HEIGHT=1.70,LOW=.15,HIGH=2.05,CELL=.16,CLEARANCE=.24;
const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const smoother=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const lerp=(a,b,t)=>a+(b-a)*t;
function segmentDistance(x,z,a,b){const dx=b[0]-a[0],dz=b[2]-a[2],t=clamp(((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz||1));return Math.hypot(x-a[0]-dx*t,z-a[2]-dz*t);}
function inside(x,z,p){let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if(((a[2]>z)!==(b[2]>z))&&x<(b[0]-a[0])*(z-a[2])/(b[2]-a[2])+a[0])yes=!yes;}return yes;}
function clip(poly,y,above){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ina=above?a[1]>=y:a[1]<=y,inb=above?b[1]>=y:b[1]<=y;if(ina)out.push(a);if(ina!==inb){const t=(y-a[1])/(b[1]-a[1]);out.push([lerp(a[0],b[0],t),y,lerp(a[2],b[2],t)]);}}return out;}
class Heap{
 constructor(){this.items=[];}
 push(id,score){const a=this.items,node={id,score};let i=a.length;a.push(node);while(i){const p=(i-1)>>1;if(a[p].score<=score)break;a[i]=a[p];i=p;}a[i]=node;}
 pop(){const a=this.items,result=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1].score<a[j].score)j++;if(a[j].score>=last.score)break;a[i]=a[j];i=j;}a[i]=last;}return result;}
}
export function createGalleryNavigation({galleryModel,sculptureModel}){
 const started=performance.now(),floorPolys=[],obstacles=[],bounds=new Box3(),v=new Vector3(),instance=new Matrix4(),matrix=new Matrix4();
 galleryModel.updateMatrixWorld(true);sculptureModel.updateMatrixWorld(true);
 let inputTriangles=0,obstacleTriangles=0,instances=0;
 galleryModel.traverse(mesh=>{
  if(!mesh.isMesh)return;const geom=mesh.geometry,position=geom.attributes.position,index=geom.index;
  let floor=false;for(let p=mesh;p;p=p.parent)if(p.name==='gallery_floors')floor=true;
  const localBox=new Box3().setFromBufferAttribute(position),count=mesh.isInstancedMesh?mesh.count:1;
  for(let n=0;n<count;n++){
   if(mesh.isInstancedMesh){mesh.getMatrixAt(n,instance);matrix.multiplyMatrices(mesh.matrixWorld,instance);}else matrix.copy(mesh.matrixWorld);
   const box=localBox.clone().applyMatrix4(matrix);if(!floor&&(box.max.y<LOW||box.min.y>HIGH))continue;instances++;
   for(let i=0;i<(index?.count??position.count);i+=3){
    const points=[];for(let j=0;j<3;j++){v.fromBufferAttribute(position,index?index.getX(i+j):i+j).applyMatrix4(matrix);points.push(v.toArray());}inputTriangles++;
    if(floor){
     const a=points[0],b=points[1],c=points[2],area=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
     if(Math.abs(area)>1e-6&&Math.max(...points.map(p=>p[1]))<.15){floorPolys.push(points);for(const p of points)bounds.expandByPoint(v.fromArray(p));}
    }else{
     const poly=clip(clip(points,LOW,true),HIGH,false);if(poly.length>=2){obstacles.push(poly);obstacleTriangles++;}
    }
   }
  }
 });
 sculptureModel.traverse(root=>{
  if(!/^AI66_002_Sculpture_[A-F]\d*$/.test(root.name)&&root.name!=='runtime_Doryphoros'&&!root.userData.galleryExhibitRoot)return;
  const box=new Box3().setFromObject(root);if(box.max.y<LOW||box.min.y>HIGH)return;
  obstacles.push([[box.min.x,LOW,box.min.z],[box.max.x,LOW,box.min.z],[box.max.x,LOW,box.max.z],[box.min.x,LOW,box.max.z]]);
 });
 if(bounds.isEmpty())throw new Error('No measured gallery floor is available for the walking tour.');
 const origin=[bounds.min.x,0,bounds.min.z],width=Math.ceil((bounds.max.x-bounds.min.x)/CELL)+1,depth=Math.ceil((bounds.max.z-bounds.min.z)/CELL)+1,size=width*depth,walkable=new Uint8Array(size);
 const point=id=>[origin[0]+(id%width+.5)*CELL,HEIGHT,origin[2]+(Math.floor(id/width)+.5)*CELL];
 const cell=p=>{const x=Math.floor((p[0]-origin[0])/CELL),z=Math.floor((p[2]-origin[2])/CELL);return x<0||z<0||x>=width||z>=depth?-1:z*width+x;};
 function raster(poly,padding,value){
  const xs=poly.map(p=>p[0]),zs=poly.map(p=>p[2]);
  const x0=Math.max(0,Math.floor((Math.min(...xs)-padding-origin[0])/CELL)),x1=Math.min(width-1,Math.floor((Math.max(...xs)+padding-origin[0])/CELL));
  const z0=Math.max(0,Math.floor((Math.min(...zs)-padding-origin[2])/CELL)),z1=Math.min(depth-1,Math.floor((Math.max(...zs)+padding-origin[2])/CELL));
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
   const id=z*width+x;if(!value&&!walkable[id])continue;const px=origin[0]+(x+.5)*CELL,pz=origin[2]+(z+.5)*CELL;
   if(inside(px,pz,poly)||padding>0&&poly.some((a,i)=>segmentDistance(px,pz,a,poly[(i+1)%poly.length])<=padding))walkable[id]=value;
  }
 }
 floorPolys.forEach(poly=>raster(poly,0,1));obstacles.forEach(poly=>raster(poly,CLEARANCE+CELL*Math.SQRT1_2,0));
 // Erode floor boundaries as well, so a route cannot leave the actual slab.
 const floorMask=new Uint8Array(size);floorPolys.forEach(poly=>{const xs=poly.map(p=>p[0]),zs=poly.map(p=>p[2]);for(let z=Math.max(0,Math.floor((Math.min(...zs)-origin[2])/CELL));z<=Math.min(depth-1,Math.ceil((Math.max(...zs)-origin[2])/CELL));z++)for(let x=Math.max(0,Math.floor((Math.min(...xs)-origin[0])/CELL));x<=Math.min(width-1,Math.ceil((Math.max(...xs)-origin[0])/CELL));x++){const p=point(z*width+x);if(inside(p[0],p[2],poly))floorMask[z*width+x]=1;}});
 for(let id=0;id<size;id++)if(walkable[id]){const x=id%width,z=Math.floor(id/width);for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){if(dx*dx+dz*dz>4)continue;const xx=x+dx,zz=z+dz;if(xx<0||zz<0||xx>=width||zz>=depth||!floorMask[zz*width+xx])walkable[id]=0;}}
 obstacles.length=0;floorPolys.length=0;
 // Prefer room to turn, rather than the mathematically shortest line grazing
 // every partition. The original blocked cells remain the hard safety limit.
 const margin=new Float32Array(size);for(let i=0;i<size;i++)margin[i]=walkable[i]?1000:0;
 for(let z=0;z<depth;z++)for(let x=0;x<width;x++){const i=z*width+x;if(!walkable[i])continue;let d=margin[i];if(x)d=Math.min(d,margin[i-1]+CELL);if(z)d=Math.min(d,margin[i-width]+CELL);if(x&&z)d=Math.min(d,margin[i-width-1]+CELL*Math.SQRT2);if(x+1<width&&z)d=Math.min(d,margin[i-width+1]+CELL*Math.SQRT2);margin[i]=d;}
 for(let z=depth-1;z>=0;z--)for(let x=width-1;x>=0;x--){const i=z*width+x;if(!walkable[i])continue;let d=margin[i];if(x+1<width)d=Math.min(d,margin[i+1]+CELL);if(z+1<depth)d=Math.min(d,margin[i+width]+CELL);if(x+1<width&&z+1<depth)d=Math.min(d,margin[i+width+1]+CELL*Math.SQRT2);if(x&&z+1<depth)d=Math.min(d,margin[i+width-1]+CELL*Math.SQRT2);margin[i]=d;}
 const weight=id=>1+1.6*Math.exp(-margin[id]/.55);
 const state={ready:true,method:'Triangle-derived body-height footprint grid, conservative clearance, A* and collision-checked line-of-sight smoothing',cellSize:CELL,clearance:CLEARANCE,eyeHeight:HEIGHT,bodyHeight:[LOW,HIGH],bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},grid:[width,depth],walkableCells:walkable.reduce((a,b)=>a+b,0),inputTriangles,obstacleTriangles,instances,buildMs:performance.now()-started,plans:0,failures:0,lastRoute:null};
 function clear(a,b){
  // Supercover traversal visits every touched cell, including short corner
  // crossings that fixed-distance samples can miss at a partition edge.
  const first=cell(a),last=cell(b);if(first<0||last<0)return false;
  let x=first%width,z=Math.floor(first/width);const endX=last%width,endZ=Math.floor(last/width),dx=b[0]-a[0],dz=b[2]-a[2],sx=Math.sign(dx),sz=Math.sign(dz),tx=dx?CELL/Math.abs(dx):Infinity,tz=dz?CELL/Math.abs(dz):Infinity;
  let mx=dx?(origin[0]+(x+(sx>0?1:0))*CELL-a[0])/dx:Infinity,mz=dz?(origin[2]+(z+(sz>0?1:0))*CELL-a[2])/dz:Infinity;
  const free=(xx,zz)=>xx>=0&&zz>=0&&xx<width&&zz<depth&&!!walkable[zz*width+xx];
  for(let n=0;n<width+depth+4;n++){if(!free(x,z))return false;if(x===endX&&z===endZ)return true;
   if(Math.abs(mx-mz)<1e-10){if(!free(x+sx,z)||!free(x,z+sz))return false;x+=sx;z+=sz;mx+=tx;mz+=tz;}
   else if(mx<mz){x+=sx;mx+=tx;}else{z+=sz;mz+=tz;}
  }return false;
 }
 function nearest(p,max=.8){const id=cell(p);if(id>=0&&walkable[id])return{id,point:[p[0],HEIGHT,p[2]],adjustment:0};let best=null;for(let z=-Math.ceil(max/CELL);z<=Math.ceil(max/CELL);z++)for(let x=-Math.ceil(max/CELL);x<=Math.ceil(max/CELL);x++){const candidate=[p[0]+x*CELL,HEIGHT,p[2]+z*CELL],n=cell(candidate);if(n<0||!walkable[n])continue;const q=point(n),d=distance(q,p);if(d<=max&&(!best||d<best.adjustment))best={id:n,point:q,adjustment:d};}return best;}
 function visitorPose(pose){const valid=nearest(pose.position);return valid?{position:valid.point,target:[...pose.target],fov:pose.fov,aspect:pose.aspect,adjustment:valid.adjustment}:null;}
 function plan(from,to){
  state.plans++;const end=visitorPose(to),start=nearest(from.position,.05);
  if(!start||!end||from.position[1]<.8||from.position[1]>2.4){state.failures++;return null;}
  const goal=cell(end.position),startID=start.id,heap=new Heap(),cost=new Float32Array(size),parents=new Int32Array(size),closed=new Uint8Array(size);cost.fill(Infinity);parents.fill(-1);cost[startID]=0;heap.push(startID,distance(start.point,end.position));
  let found=false;
  while(heap.items.length){const {id}=heap.pop();if(closed[id])continue;closed[id]=1;if(id===goal){found=true;break;}const x=id%width,z=Math.floor(id/width);
   for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    if(!dx&&!dz)continue;const xx=x+dx,zz=z+dz;if(xx<0||zz<0||xx>=width||zz>=depth)continue;const next=zz*width+xx;if(!walkable[next]||closed[next]||dx&&dz&&(!walkable[z*width+xx]||!walkable[zz*width+x]))continue;
    const value=cost[id]+CELL*(dx&&dz?Math.SQRT2:1)*(weight(id)+weight(next))*.5;if(value>=cost[next])continue;cost[next]=value;parents[next]=id;heap.push(next,value+distance(point(next),end.position));
   }
  }
  if(!found){state.failures++;return null;}
  const raw=[],scores=[];for(let id=goal;id!==-1;id=parents[id]){raw.push(point(id));scores.push(cost[id]);}raw.reverse();scores.reverse();if(raw.length===1){raw.push(end.position);scores.push(distance(start.point,end.position)*weight(goal));}raw[0]=start.point;raw[raw.length-1]=end.position;
  const lineCost=(a,b)=>{const length=distance(a,b),n=Math.max(1,Math.ceil(length/(CELL*.75)));let total=0;for(let i=0;i<n;i++){const t=(i+.5)/n;total+=weight(cell([lerp(a[0],b[0],t),HEIGHT,lerp(a[2],b[2],t)]));}return total*length/n;};
  const turns=[raw[0]];for(let i=0;i<raw.length-1;){let j=raw.length-1;while(j>i+1&&(!clear(raw[i],raw[j])||lineCost(raw[i],raw[j])>(scores[j]-scores[i])*1.06))j--;turns.push(raw[j]);i=j;}
  const bezier=(values,t)=>{const q=values.slice();for(let n=q.length-1;n>0;n--)for(let i=0;i<n;i++)q[i]=lerp(q[i],q[i+1],t);return q[0];};
  const derivative=values=>values.slice(1).map((v,i)=>(v-values[i])*(values.length-1));
  const segments=[],rounded=[turns[0]],hardStops=[];let length=0,cursor=turns[0],roundedCorners=0;
  function addLine(to){const span=distance(cursor,to);if(span>1e-7){segments.push({type:'line',from:cursor,to,start:length,length:span});length+=span;rounded.push(to);}cursor=to;}
  function curveData(points){const xs=points.map(p=>p[0]),zs=points.map(p=>p[2]),dx=derivative(xs),dz=derivative(zs),ddx=derivative(dx),ddz=derivative(dz);return{xs,zs,dx,dz,ddx,ddz,at:t=>[bezier(xs,t),HEIGHT,bezier(zs,t)]};}
  for(let i=1;i<turns.length-1;i++){
   const a=turns[i-1],b=turns[i],c=turns[i+1];let chosen=null;
   // Collinear first/last three controls give zero curvature at each join.
   // Try a generous turn, then reduce it only if actual collision cells require.
   for(let radius=Math.min(1.4,distance(a,b)*.42,distance(b,c)*.42);radius>=.025;radius*=.72){
    const u=radius/(distance(a,b)||1),w=radius/(distance(b,c)||1),before=[lerp(b[0],a[0],u),HEIGHT,lerp(b[2],a[2],u)],after=[lerp(b[0],c[0],w),HEIGHT,lerp(b[2],c[2],w)];
    const toward=(p,t)=>[lerp(p[0],b[0],t),HEIGHT,lerp(p[2],b[2],t)];
    const curve=curveData([before,toward(before,.4),toward(before,.8),toward(after,.8),toward(after,.4),after]);
    const points=Array.from({length:65},(_,j)=>curve.at(j/64));
    if(clear(cursor,before)&&points.every((p,j)=>j===0||clear(points[j-1],p))&&clear(after,c)){chosen={...curve,points,before,after};break;}
   }
   if(chosen){
    addLine(chosen.before);const arc=[0];for(let j=1;j<chosen.points.length;j++)arc.push(arc[j-1]+distance(chosen.points[j-1],chosen.points[j]));
    const span=arc[arc.length-1];segments.push({...chosen,type:'curve',start:length,length:span,arc});length+=span;rounded.push(...chosen.points.slice(1));cursor=chosen.after;roundedCorners++;
   }else{addLine(b);hardStops.push(length);}
  }
  addLine(turns[turns.length-1]);
  function geometryAt(d){
   d=Math.max(0,Math.min(length,d));let i=0;while(i<segments.length-1&&segments[i].start+segments[i].length<d)i++;const segment=segments[i];
   if(!segment)return{position:[...end.position],curvature:0};const local=d-segment.start;
   if(segment.type==='line'){const t=clamp(local/segment.length);return{position:[lerp(segment.from[0],segment.to[0],t),HEIGHT,lerp(segment.from[2],segment.to[2],t)],curvature:0};}
   let j=1;while(j<segment.arc.length-1&&segment.arc[j]<local)j++;const t=((j-1)+(local-segment.arc[j-1])/(segment.arc[j]-segment.arc[j-1]||1))/(segment.arc.length-1);
   const dx=bezier(segment.dx,t),dz=bezier(segment.dz,t),ddx=bezier(segment.ddx,t),ddz=bezier(segment.ddz,t);
   return{position:segment.at(t),curvature:Math.abs(dx*ddz-dz*ddx)/Math.max(1e-9,Math.pow(dx*dx+dz*dz,1.5))};
  }
  const at=d=>geometryAt(d).position;
  // Distance-domain acceleration planning keeps a steady cruise on straights
  // and reduces speed before bends. It never cuts a geometric corner.
  const CRUISE=2.8,ACCELERATION=1.8,LATERAL_ACCELERATION=1.8;
  const n=Math.max(2,Math.ceil(length/.06)),distances=Array.from({length:n+1},(_,i)=>length*i/n);
  for(const stop of hardStops)if(stop>1e-6&&stop<length-1e-6)distances.push(stop);
  distances.sort((a,b)=>a-b);for(let i=distances.length-1;i>0;i--)if(distances[i]-distances[i-1]<1e-7)distances.splice(i,1);
  const speeds=distances.map(d=>Math.min(CRUISE,Math.sqrt(LATERAL_ACCELERATION/Math.max(.0001,geometryAt(d).curvature))));
  speeds[0]=0;speeds[speeds.length-1]=0;for(const stop of hardStops){const i=distances.findIndex(d=>Math.abs(d-stop)<1e-6);if(i>=0)speeds[i]=0;}
  for(let i=1;i<speeds.length;i++)speeds[i]=Math.min(speeds[i],Math.sqrt(speeds[i-1]**2+2*ACCELERATION*(distances[i]-distances[i-1])));
  for(let i=speeds.length-2;i>=0;i--)speeds[i]=Math.min(speeds[i],Math.sqrt(speeds[i+1]**2+2*ACCELERATION*(distances[i+1]-distances[i])));
  const times=[0];for(let i=1;i<distances.length;i++)times.push(times[i-1]+2*(distances[i]-distances[i-1])/Math.max(.01,speeds[i]+speeds[i-1]));
  const translationDuration=times[times.length-1];
  function distanceAt(t){if(t<=0)return 0;if(t>=translationDuration)return length;let i=1;while(times[i]<t)i++;const dt=times[i]-times[i-1],elapsed=t-times[i-1],acceleration=(speeds[i]-speeds[i-1])/dt;return distances[i-1]+speeds[i-1]*elapsed+.5*acceleration*elapsed*elapsed;}
  const direction=pose=>new Vector3().fromArray(pose.target).sub(new Vector3().fromArray(pose.position)).normalize();
  const startDirection=direction(from),endDirection=direction(end),startYaw=Math.atan2(startDirection.x,startDirection.z),unwrap=(yaw,previous)=>previous+Math.atan2(Math.sin(yaw-previous),Math.cos(yaw-previous));
  const headings=[];let previousYaw=startYaw;
  for(const fraction of [.1,.3,.5,.7,.9]){const d=length*fraction,a=at(Math.max(0,d-.35)),b=at(Math.min(length,d+1.15)),yaw=length<1e-6?lerp(startYaw,unwrap(Math.atan2(endDirection.x,endDirection.z),startYaw),fraction):Math.atan2(b[0]-a[0],b[2]-a[2]);previousYaw=unwrap(yaw,previousYaw);headings.push(previousYaw);}
  // Unwrap once while planning, never independently per rendered frame. The
  // endpoint is anchored to the starting yaw to avoid an unnecessary full spin.
  // A single smooth gaze curve anticipates bends and has zero first/second
  // derivatives at both sculpture views, instead of chasing a moving target.
  const startPitch=Math.asin(startDirection.y),endPitch=Math.asin(endDirection.y),middlePitch=length<1e-6?[.1,.3,.5,.7,.9].map(t=>lerp(startPitch,endPitch,t)):[0,0,0,0,0],pitchControls=[startPitch,startPitch,startPitch,...middlePitch,endPitch,endPitch,endPitch];
  const pitchD=derivative(pitchControls),pitchDD=derivative(pitchD);
  const MAX_ANGULAR_SPEED=95*Math.PI/180,MAX_ANGULAR_ACCELERATION=145*Math.PI/180;
  // Choose the unwrap branch for the entire route, including both endpoints.
  // Comparing the equivalent branches avoids a full spin or a long detour when
  // the starting and finishing views straddle the +/-180 degree boundary.
  let chosenGaze=null;const endYawRaw=Math.atan2(endDirection.x,endDirection.z);
  for(let shift=-1;shift<=1;shift++)for(let k=-2;k<=2;k++){
   const endYaw=endYawRaw+k*Math.PI*2;if(Math.abs(endYaw-startYaw)>Math.PI*1.5)continue;
   const controls=[startYaw,startYaw,startYaw,...headings.map(yaw=>yaw+shift*Math.PI*2),endYaw,endYaw,endYaw],dy=derivative(controls),ddy=derivative(dy);let speed=0,acceleration=0;
   for(let i=0;i<=256;i++){const t=i/256;speed=Math.max(speed,Math.hypot(bezier(dy,t),bezier(pitchD,t)));acceleration=Math.max(acceleration,Math.hypot(bezier(ddy,t),bezier(pitchDD,t)));}
   const minimum=Math.max(speed/MAX_ANGULAR_SPEED,Math.sqrt(acceleration/MAX_ANGULAR_ACCELERATION)),score=minimum+.15*Math.abs(endYaw-startYaw);
   if(!chosenGaze||score<chosenGaze.score)chosenGaze={controls,minimum,score};
  }
  const yawControls=chosenGaze.controls,angularMinimum=chosenGaze.minimum,duration=Math.max(1.6,translationDuration,angularMinimum),aspect=from.aspect??end.aspect;
  const motion={method:'Clearance-weighted paths, zero-curvature rounded joins, acceleration-limited arc-length cruise, continuous unwrapped gaze polynomial',cruiseSpeed:CRUISE,linearAcceleration:ACCELERATION,lateralAcceleration:LATERAL_ACCELERATION,maxAngularSpeed:95,maxAngularAcceleration:145,translationDuration,angularMinimum,roundedCorners,hardStops:hardStops.length};
  const route={from:structuredClone(from),to:{...end,aspect},points:rounded,length,duration,clearance:CLEARANCE,motion,sample(progress){
   const t=clamp(progress);if(t===0)return{position:[...from.position],target:[...from.target],fov:from.fov,aspect};if(t===1)return{position:[...end.position],target:[...end.target],fov:end.fov,aspect};
   const d=distanceAt(t*translationDuration),position=at(d);position[1]=lerp(from.position[1],HEIGHT,smoother(t*duration/Math.min(1,duration)));
   const yaw=bezier(yawControls,t),pitch=bezier(pitchControls,t),gazeDistance=lerp(new Vector3().fromArray(from.target).distanceTo(new Vector3().fromArray(from.position)),new Vector3().fromArray(end.target).distanceTo(new Vector3().fromArray(end.position)),smoother(t));
   const target=[position[0]+Math.sin(yaw)*Math.cos(pitch)*gazeDistance,position[1]+Math.sin(pitch)*gazeDistance,position[2]+Math.cos(yaw)*Math.cos(pitch)*gazeDistance];
   return{position,target,fov:lerp(from.fov,end.fov,smoother(t)),aspect};
  }};
  state.lastRoute={length,duration,motion,points:rounded.map(p=>[...p]),destinationAdjustment:end.adjustment,valid:rounded.every((p,i)=>i===0||clear(rounded[i-1],p))};return route;
 }
 return{state,plan,visitorPose,contains:position=>{const id=cell(position);return id>=0&&!!walkable[id];},segmentClear:clear,dispose(){state.ready=false;}};
}
