import * as T from 'three';
import {cadBridgeProfileHeightMm,type LinarCadCutGeometry} from './linar-reference/linarGeometry';

/** Same three-arc section and clipped-profile convention as the source
 * configurator's LinarPanel.createBridgeAssemblyGeometry. All sides are closed.
 * Only arc tessellation changes with viewing distance; thickness never does. */
export function routedBridge(cad:LinarCadCutGeometry,steps:number,start=0,end=1){
 const positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[];
 const vertex=(x:number,y:number,z:number,u:number,v:number)=>{const i=positions.length/3;positions.push(x,y,z);uvs.push(u,v);return i;};
 const quad=(a:number[],b:number[],c:number[],d:number[])=>{const ids=[a,b,c,d].map(v=>vertex(...v as [number,number,number,number,number]));indices.push(ids[0],ids[1],ids[2],ids[0],ids[2],ids[3]);};
 const left:number[]=[],right:number[]=[],heights:number[]=[];
 for(let i=0;i<=steps;i++){const t=i/steps,u=start+(end-start)*t,z=-.5+cadBridgeProfileHeightMm(cad,u)/cad.bridgeHeightMm;heights.push(z);left.push(vertex(-.5,t-.5,z,0,u));right.push(vertex(.5,t-.5,z,1,u));}
 for(let i=0;i<steps;i++){
  indices.push(left[i],right[i],right[i+1],left[i],right[i+1],left[i+1]);
  const y0=i/steps-.5,y1=(i+1)/steps-.5,z0=heights[i],z1=heights[i+1];
  quad([-.5,y0,-.5,0,0],[-.5,y0,z0,1,0],[-.5,y1,z1,1,1],[-.5,y1,-.5,0,1]);
  quad([.5,y0,-.5,0,0],[.5,y1,-.5,0,1],[.5,y1,z1,1,1],[.5,y0,z0,1,0]);
 }
 quad([-.5,-.5,-.5,0,0],[-.5,.5,-.5,0,1],[.5,.5,-.5,1,1],[.5,-.5,-.5,1,0]);
 if(heights[0]>-.499999)quad([-.5,-.5,-.5,0,0],[.5,-.5,-.5,1,0],[.5,-.5,heights[0],1,1],[-.5,-.5,heights[0],0,1]);
 if(heights[steps]>-.499999)quad([-.5,.5,-.5,0,0],[-.5,.5,heights[steps],0,1],[.5,.5,heights[steps],1,1],[.5,.5,-.5,1,0]);
 // Omit zero-area tip triangles; retain the continuous rear/arc/side shell.
 const clean:number[]=[];for(let i=0;i<indices.length;i+=3){const pts=indices.slice(i,i+3).map(j=>new T.Vector3().fromArray(positions,j*3));if(pts[1].sub(pts[0]).cross(pts[2].sub(pts[0])).lengthSq()>1e-16)clean.push(...indices.slice(i,i+3));}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(clean);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData={steps,profileStart:start,profileEnd:end,closedVolume:true};return g;
}

/** Contact-point placement from the reference renderer, including its 0.08 mm
 * join tolerance. It prevents cracks when neighboring lamellae rotate in C/S bends. */
export function bridgeContact(a:{x:number;z:number;rotY:number},b:{x:number;z:number;rotY:number},thickness:number,bridgeHeight:number,slatWidth=.004,rightWidth=slatWidth){
 const center=-thickness/2+bridgeHeight/2;
 const left=new T.Vector2(a.x+Math.cos(a.rotY)*slatWidth/2+Math.sin(a.rotY)*center,a.z-Math.sin(a.rotY)*slatWidth/2+Math.cos(a.rotY)*center);
 const right=new T.Vector2(b.x-Math.cos(b.rotY)*rightWidth/2+Math.sin(b.rotY)*center,b.z+Math.sin(b.rotY)*rightWidth/2+Math.cos(b.rotY)*center);
 return {x:(left.x+right.x)/2,z:(left.y+right.y)/2,rotation:-Math.atan2(right.y-left.y,right.x-left.x),width:left.distanceTo(right)+.00008,left:left.toArray(),right:right.toArray()};
}

export function tintSolid(g:T.BufferGeometry,cut:T.Color,end:T.Color,reverse:T.Color){
 const a=g.getAttribute('normal'),colours=new Float32Array(a.count*3);for(let i=0;i<a.count;i++){const c=Math.abs(a.getY(i))>.7?end:Math.abs(a.getX(i))>.7?cut:a.getZ(i)<-.7?reverse:new T.Color(1,1,1);c.toArray(colours,i*3);}g.setAttribute('color',new T.BufferAttribute(colours,3));return g;
}
