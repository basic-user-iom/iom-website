import * as T from 'three';

type Car={root:T.Group;wheels:T.Group[];lane:number;direction:number;z:number;speed:number;wraps:number;shadow:T.Mesh};
/** Two lanes on the original road. Curbside car and van remain parked.
 * Only the original car_B and one shared-geometry copy join the traffic. */
export class Traffic{
 readonly root=new T.Group();
 enabled=!matchMedia('(prefers-reduced-motion: reduce)').matches;
 exterior=true;
 private cars:Car[]=[];
 private road:T.Object3D|null=null;
 private roads:T.Object3D[]=[];
 private frustum=new T.Frustum();
 private projection=new T.Matrix4();
 private groundRay=new T.Raycaster();
 private roadHeights=new Map<number,number[]>();
 private minZ=-195;private maxZ=45;
 private baseY=0;
 get running(){return this.enabled&&this.exterior&&!document.hidden&&this.cars.length>0;}
 register(street:T.Group){
  this.road=street.getObjectByName('AE35_010_road')??null;
  if(!this.road)return;
  this.roads=street.userData.trafficRoads??[this.road];this.maxZ=street.userData.trafficMaxZ??45;
  street.updateWorldMatrix(true,true);
  const parts=street.children.filter(o=>/^AE35_010_car_B\d+$/.test(o.name));
  if(!parts.length)return;
  const bounds=new T.Box3();parts.forEach(p=>bounds.expandByObject(p));
  const center=bounds.getCenter(new T.Vector3());this.baseY=bounds.min.y;
  const body=new T.Group();body.name='TRAFFIC_Original_Car_B';body.position.set(center.x,0,center.z);street.add(body);body.updateWorldMatrix(true,true);
  parts.forEach(p=>body.attach(p));
  const wheels:T.Group[]=[];
  for(const ids of [[11,13,14],[16,17,19],[28,30,31],[34,35,36]]){
   const objects=ids.map(id=>body.getObjectByName(`AE35_010_car_B${id}`)).filter((o):o is T.Object3D=>!!o);
   const b=new T.Box3();objects.forEach(o=>b.expandByObject(o));
   const pivot=new T.Group();pivot.name=`TRAFFIC_Wheel_${ids[0]}`;pivot.position.copy(body.worldToLocal(b.getCenter(new T.Vector3())));body.add(pivot);pivot.updateWorldMatrix(true,true);objects.forEach(o=>pivot.attach(o));wheels.push(pivot);
  }
  // Cached city shadows stay static. A soft moving contact shadow grounds each car.
  body.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=false;});
  this.root.name='WEB_Traffic';street.add(this.root);this.root.attach(body);
  const copy=body.clone(true);copy.name='TRAFFIC_Opposing_Car_B';copy.rotation.y=Math.PI;this.root.add(copy);
  const shadowMap=this.makeShadow();
  for(const [index,carRoot] of [body,copy].entries()){
   const lane=index===0?center.x:-1.95,direction=index===0?-1:1;
   const samples:number[]=[];
   for(let z=this.minZ;z<=this.maxZ;z+=5){this.groundRay.set(new T.Vector3(lane,3,z),new T.Vector3(0,-1,0));samples.push(this.groundRay.intersectObjects(this.roads,true)[0]?.point.y??.055);}
   this.roadHeights.set(lane,samples);
   const shadow=new T.Mesh(new T.PlaneGeometry(2.7,5.7),new T.MeshBasicMaterial({map:shadowMap,transparent:true,opacity:.42,depthWrite:false,toneMapped:false}));shadow.name='TRAFFIC_Contact_Shadow';shadow.rotation.x=-Math.PI/2;shadow.renderOrder=1;this.root.add(shadow);
   const car:Car={root:carRoot,wheels:index===0?wheels:copy.children.filter(o=>o.name.startsWith('TRAFFIC_Wheel_')) as T.Group[],lane,direction,z:index===0?center.z:-85,speed:index===0?6.8:7.2,wraps:0,shadow};this.cars.push(car);this.place(car);
  }
 }
 private makeShadow(){
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.scale(64,128);const g=ctx.createRadialGradient(.5,.5,.15,.5,.5,.5);g.addColorStop(0,'#000');g.addColorStop(1,'#0000');ctx.fillStyle=g;ctx.fillRect(0,0,1,1);return new T.CanvasTexture(canvas);
 }
 private height(lane:number,z:number){const values=this.roadHeights.get(lane)!;const p=T.MathUtils.clamp((z-this.minZ)/5,0,values.length-1),i=Math.floor(p);return T.MathUtils.lerp(values[i],values[Math.min(i+1,values.length-1)],p-i);}
 private place(car:Car){const height=this.height(car.lane,car.z);car.root.position.set(car.lane,height-this.baseY+.005,car.z);car.shadow.position.set(car.lane,height+.012,car.z);}
 update(dt:number,camera:T.Camera){
  if(!this.running)return;
  camera.updateMatrixWorld();this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  for(const car of this.cars){
   const end=car.direction<0?this.minZ:this.maxZ,start=car.direction<0?this.maxZ:this.minZ;
   const remaining=Math.abs(end-car.z),endVisible=this.frustum.intersectsSphere(new T.Sphere(new T.Vector3(car.lane,.8,end),4));
   const startVisible=this.frustum.intersectsSphere(new T.Sphere(new T.Vector3(car.lane,.8,start),4));
   // If an overview sees either endpoint, gently stop; never jump across the image.
   const speed=(endVisible||startVisible)?Math.min(car.speed,Math.sqrt(2*1.8*Math.max(0,remaining-.05))):car.speed;
   const travel=Math.min(speed*dt,remaining);car.z+=car.direction*travel;
   for(const wheel of car.wheels)wheel.rotation.x-=travel/.373;
   if(remaining<.1&&!endVisible&&!startVisible){car.z=start;car.wraps++;}
   this.place(car);
  }
 }
 inspect(){return{enabled:this.enabled,running:this.running,exterior:this.exterior,hidden:document.hidden,road:'AE35_010_road',route:[this.minZ,this.maxZ],parked:['AE35_010_carpaint','AE35_010_van'],cars:this.cars.map(c=>({name:c.root.name,lane:c.lane,z:c.z,y:c.root.position.y,speedMps:c.speed,direction:c.direction,wraps:c.wraps,parts:c.root.children.length}))};}
}

