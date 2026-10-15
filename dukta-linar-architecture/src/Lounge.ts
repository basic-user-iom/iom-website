import * as T from 'three';
import type {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
/** The source models stay in staging; this arrangement only uses reduced web copies. */
export async function loadLounge(loader:GLTFLoader){
 const [chair,table]=await Promise.all(['chair','tables'].map(name=>loader.loadAsync(`${import.meta.env.BASE_URL}models/lounge-${name}.glb`)));
 const root=new T.Group();root.name='WEB_Waiting_Area';
 for(const [i,x] of [42.2,44.3].entries()){const item=chair.scene.clone(true);item.name=`WEB_Lounge_Chair_${i+1}`;item.position.set(x,.30035,-33.8);item.rotation.y=i?-.25:.25;root.add(item);}
 table.scene.name='WEB_Lounge_Table';table.scene.position.set(43.25,.30035,-32.5);root.add(table.scene);
 root.updateWorldMatrix(true,true);root.userData.items=root.children.map(o=>{const b=new T.Box3().setFromObject(o);return{name:o.name,min:b.min.toArray(),max:b.max.toArray()};});
 return root;
}
