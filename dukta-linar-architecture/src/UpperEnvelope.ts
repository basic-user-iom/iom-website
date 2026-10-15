import * as T from 'three';

type Volume={name:string;center:[number,number,number];size:[number,number,number]};
/** Minimal opaque interiors for the three stone context wings.
 * The preserved Blender master and both GLBs lack continuous upper floors
 * (99/108 vertical probes miss). Bounds follow walls_C..F and existing glass;
 * slab heights occupy the opaque gaps between the original window rows.
 * The central spine separates front/back rooms without covering glazing.
 * No detailed rooms, exterior alterations or glass overrides are introduced. */
export function addUpperEnvelope(context:T.Object3D){
 const root=new T.Group();root.name='WEB_Upper_Interior_Envelope';
 const wings=[
  {name:'centre',front:55.72,back:71.85,z0:-20.13,z1:-7.68,levels:[10.65,13.85,17.10,20.35,23.60,27.20,30.92]},
  {name:'left',front:56.83,back:72.96,z0:-32.54,z1:-20.10,levels:[10.65,13.85,17.10,20.35,23.60,27.20]},
  {name:'right',front:56.83,back:72.96,z0:-7.83,z1:4.61,levels:[10.65,13.85,17.10,20.35,23.60,27.20]},
 ];
 const slabs:Volume[]=[],walls:Volume[]=[];
 for(const wing of wings){
  const x=(wing.front+wing.back)/2,z=(wing.z0+wing.z1)/2,bottom=wing.levels[0],top=wing.levels[wing.levels.length-1];
  for(const y of wing.levels)slabs.push({name:`${wing.name}_slab_${y}`,center:[x,y,z],size:[wing.back-wing.front,.18,wing.z1-wing.z0]});
  walls.push({name:`${wing.name}_central_partition`,center:[x,(bottom+top)/2,z],size:[.18,top-bottom,wing.z1-wing.z0]});
 }
 function batch(name:string,volumes:Volume[],color:string){
  const mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({name,color,roughness:.9}),volumes.length),pose=new T.Object3D();mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;
  volumes.forEach((v,i)=>{pose.position.set(...v.center);pose.scale.set(...v.size);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);});mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
 }
 batch('Upper_envelope_slabs',slabs,'#b7b1a6');batch('Upper_envelope_partitions',walls,'#c7c1b7');
 root.userData.volumes=[...slabs,...walls];context.add(root);return root;
}

export function inspectUpperEnvelope(scene:T.Object3D){
 const root=scene.getObjectByName('WEB_Upper_Interior_Envelope');if(!root)return{present:false};
 const volumes=root.userData.volumes as Volume[],boxes=volumes.map(v=>new T.Box3().setFromCenterAndSize(new T.Vector3(...v.center),new T.Vector3(...v.size)));
 const hit=(origin:T.Vector3,direction:T.Vector3,maxDistance:number)=>{const ray=new T.Ray(origin,direction);return boxes.some(b=>{const p=ray.intersectBox(b,new T.Vector3());return !!p&&p.distanceTo(origin)<=maxDistance;});};
 let verticalHits=0,verticalTotal=0,opticalHits=0,opticalTotal=0;
 for(const x of [58,63,68])for(const z of [-10,-14,-18])for(const y of [12,15.5,18.5,22,25,29])for(const dy of [-1,1]){verticalTotal++;if(hit(new T.Vector3(x,y,z),new T.Vector3(0,dy,0),5))verticalHits++;}
 for(const z of [-25,-14,-2])for(const y of [12,15.5,18.5,22,25]){opticalTotal++;if(hit(new T.Vector3(54,y,z),new T.Vector3(1,0,0),20))opticalHits++;}
 return{present:true,slabs:19,partitions:3,verticalHits,verticalTotal,opticalHits,opticalTotal,volumes};
}
