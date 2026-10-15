import * as T from 'three';
export const DIFFUSER_GAP=.005,DIFFUSER_INSET=.15,DIFFUSER_THICKNESS=.002;
export function canopyDiffuser(width:number,height:number,woodThickness:number,point:(x:number)=>{x:number;z:number;rotY:number}){
 const geometry=new T.BoxGeometry(width-2*DIFFUSER_INSET,height-2*DIFFUSER_INSET,DIFFUSER_THICKNESS,Math.ceil(width/.008),1,1),positions=geometry.getAttribute('position');
 const center=-woodThickness/2-DIFFUSER_GAP-DIFFUSER_THICKNESS/2;
 for(let i=0;i<positions.count;i++){const p=point(positions.getX(i)),offset=center+positions.getZ(i);positions.setXYZ(i,p.x+Math.sin(p.rotY)*offset,height/2+positions.getY(i),p.z+Math.cos(p.rotY)*offset);}
 geometry.computeVertexNormals();
 const material=new T.MeshStandardMaterial({name:'LINAR_Milky_LED_Diffuser',color:'#fff7e9',roughness:1,metalness:0,emissive:'#fff0d8',emissiveIntensity:3,side:T.FrontSide});
 const housing=new T.MeshStandardMaterial({name:'LINAR_LED_Opaque_Back_And_Edges',color:'#30332e',roughness:1,metalness:0});
 // Local +Z faces the LINAR. The reverse and the four thin edges never emit.
 const mesh=new T.Mesh(geometry,[housing,housing,housing,housing,material,housing]);mesh.name='LINAR_Curved_LED_Diffuser';mesh.castShadow=false;mesh.receiveShadow=false;
 mesh.userData={gapMm:DIFFUSER_GAP*1000,insetMm:DIFFUSER_INSET*1000,thicknessMm:DIFFUSER_THICKNESS*1000,closedSurface:true,continuousEmission:true,emittingFace:'Toward LINAR only; opaque reverse and edges',conceptOnly:true};return mesh;
}
