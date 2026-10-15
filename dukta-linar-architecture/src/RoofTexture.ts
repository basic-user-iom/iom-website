import * as T from 'three';
import {nonRepeatingRoofMaterial} from './RoofSampling';

/** The source roof's V coordinates collapse to one row. Repair only its eight
 * horizontal triangles; preserve the facade's UVs and shared PBR textures. */
export function repairRoofTexture(mesh:T.Mesh){
 if(!/^AE35_010_building_A_walls(?:_\d+)?$/.test(mesh.name)||!(mesh.material instanceof T.MeshStandardMaterial)||mesh.material.name!=='AE35_010_Building_A_black_AE35_010_building_A_black_color')return;
 const source=mesh.geometry,p=source.getAttribute('position'),index=source.index,selected:number[]=[];
 for(let i=0;i<(index?.count??p.count);i+=3){const pts=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));if(pts.every(v=>Math.abs(v.y-24.59057)<.002)&&pts[1].clone().sub(pts[0]).cross(pts[2].clone().sub(pts[0])).normalize().y>.999)selected.push(i);}
 if(!selected.length)return;
 const g=index?source.toNonIndexed():source.clone(),position=g.getAttribute('position'),oldUV=g.getAttribute('uv'),values=new Float32Array(oldUV.count*2);
 // The GLB stores normalized Uint16 UVs. Repeats above 1 need floating-point
 // storage, otherwise setXY wraps the integer value and collapses the scale.
 for(let i=0;i<oldUV.count;i++){values[i*2]=oldUV.getX(i);values[i*2+1]=oldUV.getY(i);}
 const uv=new T.BufferAttribute(values,2),tileMetres=2;g.setAttribute('uv',uv);let oldUVArea=0,newUVArea=0;
 const area=(i:number)=>Math.abs((uv.getX(i+1)-uv.getX(i))*(uv.getY(i+2)-uv.getY(i))-(uv.getY(i+1)-uv.getY(i))*(uv.getX(i+2)-uv.getX(i)))/2;
 for(const i of selected){oldUVArea+=area(i);for(let j=0;j<3;j++){const v=new T.Vector3().fromBufferAttribute(position,i+j).applyMatrix4(mesh.matrixWorld);uv.setXY(i+j,(v.x-22.82148875)/tileMetres,(-v.z-26.76740217)/tileMetres);}newUVArea+=area(i);}
 const original=mesh.material,roof=nonRepeatingRoofMaterial(original),roofTriangles=new Set(selected);g.clearGroups();let start=0,last=-1;
 for(let i=0;i<position.count;i+=3){const slot=roofTriangles.has(i)?1:0;if(slot!==last){if(last>=0)g.addGroup(start,i-start,last);start=i;last=slot;}}if(last>=0)g.addGroup(start,position.count-start,last);
 g.deleteAttribute('tangent');mesh.geometry=g;mesh.material=[original,roof];
 return {mesh:mesh.name,triangles:selected.length,tileMetres:[tileMetres,tileMetres],height:24.59057,oldUVArea,newUVArea,originalMap:original.map?.name,originalRoughnessMap:original.roughnessMap?.name,normalMap:original.normalMap?.name??null,wrapS:original.map?.wrapS,wrapT:original.map?.wrapT,facadeMaterialUnchanged:true,sourceTexturesUnchanged:true,positionsAndNormalsUnchanged:true,sampling:roof.userData.roofSampling};
}
