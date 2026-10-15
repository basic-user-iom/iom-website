import * as T from 'three';
/** Remove only unused overlapping source props at the scene origin.
 * Valid placed copies and the upper-floor furniture are preserved. */
export function excludeOriginProps(root:T.Object3D){
 const removed:{name:string;center:number[]}[]=[];root.updateWorldMatrix(true,true);
 const matches=(o:T.Mesh)=>{const mats=Array.isArray(o.material)?o.material:[o.material];return mats.some(m=>/interior_V|props_Shop_exposition|props_billboard_V2/.test(m.name));};
 const orphan=(b:T.Box3)=>{const c=b.getCenter(new T.Vector3());return Math.abs(c.x)<3&&Math.abs(c.z)<3&&b.max.y<5&&b.min.y>-.2;};
 const drop:T.Object3D[]=[];
 root.traverse(o=>{if(!(o instanceof T.Mesh)||!matches(o))return;
  if(o instanceof T.InstancedMesh){o.geometry.computeBoundingBox();const local=new T.Matrix4();let count=0;
   for(let i=0;i<o.count;i++){o.getMatrixAt(i,local);const b=o.geometry.boundingBox!.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(o.matrixWorld,local));if(orphan(b)){removed.push({name:`${o.name}:source-instance-${i}`,center:b.getCenter(new T.Vector3()).toArray()});continue;}o.setMatrixAt(count++,local);}
   o.count=count;o.instanceMatrix.needsUpdate=true;o.computeBoundingBox();o.computeBoundingSphere();if(!count)drop.push(o);
  }else{const b=new T.Box3().setFromObject(o);if(orphan(b)){removed.push({name:o.name,center:b.getCenter(new T.Vector3()).toArray()});drop.push(o);}}
 });drop.forEach(o=>o.removeFromParent());return removed;
}
/** Minimal storefront infill on the source's existing two glazing rectangles.
 * Bounds are from windows_bottom_glass001/002; adjoining stone piers, upper
 * facade and the separate doorway/shop to the left are untouched. */
export function repairContextStorefront(root:T.Object3D){
 const repair=new T.Group();repair.name='WEB_Context_Storefront_Repair';
 const metal=new T.MeshStandardMaterial({color:'#333839',metalness:.48,roughness:.34});
 const stone=new T.MeshStandardMaterial({color:'#c4b08f',roughness:.9});
 root.traverse(o=>{if(!(o instanceof T.Mesh))return;const materials=Array.isArray(o.material)?o.material:[o.material];for(const material of materials){if(material.name!=='AE35_010_walls_A_AE35_010_walls_A_Diffuse'||!(material instanceof T.MeshStandardMaterial)||!material.map||stone.map)continue;const source=material.map.image as HTMLImageElement,canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;canvas.getContext('2d')!.drawImage(source,0,source.height/2,source.width,source.height/2,0,0,512,256);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;stone.map=texture;stone.color.set('#ffffff');}});
 const z0=-6.145464,z1=2.927089,x=57.01;
 function bar(name:string,y:number,z:number,w:number,h:number,d:number,material:T.Material,px=x){const geometry=new T.BoxGeometry(w,h,d);if(material===stone){const p=geometry.attributes.position,uv=geometry.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getZ(i)+z)/6.4,(p.getY(i)+y)/3);}const m=new T.Mesh(geometry,material);m.name=name;m.position.set(px,y,z);m.castShadow=true;m.receiveShadow=true;repair.add(m);}
 const width=z1-z0,mid=(z0+z1)/2;
 bar('Storefront_stone_plinth',1.63,mid,.20,1.70,width+.72,stone);
 bar('Storefront_stone_spandrel',5.89,mid,.20,.82,width+.72,stone);
 for(const z of [z0-.18,z1+.18])bar('Storefront_side_reveal',5.04,z,.20,8.52,.36,stone);
 for(const [bottom,top] of [[2.517,5.455],[6.322,9.260]]){
  for(const y of [bottom,top])bar('Storefront_horizontal_frame',y,mid,.13,.09,width+.09,metal);
  for(let i=0;i<=4;i++)bar('Storefront_vertical_frame',(bottom+top)/2,z0+i*width/4,.13,top-bottom,.075,metal);
 }
 // The adjoining full-height shop opening keeps its ground-level entrance.
 const leftZ0=-18.56424,leftZ1=-9.25184,leftMid=(leftZ0+leftZ1)/2,leftWidth=leftZ1-leftZ0;
 bar('Shop_interfloor_spandrel',5.89,leftMid,.16,.82,leftWidth,stone,55.9);
 for(const [bottom,top] of [[.173,5.455],[6.322,9.260]]){
  for(const y of [bottom,top])bar('Shop_horizontal_frame',y,leftMid,.11,.07,leftWidth,metal,55.9);
  for(let i=0;i<=4;i++)bar('Shop_vertical_frame',(bottom+top)/2,leftZ0+i*leftWidth/4,.11,top-bottom,.065,metal,55.9);
 }
 root.add(repair);return repair;
}
