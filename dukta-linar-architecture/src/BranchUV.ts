import * as T from 'three';
/** Map disconnected branch tubes along their own longest axis, in metres. */
export function restoreBranchUV(mesh:T.Mesh){
 const g=mesh.geometry,p=g.getAttribute('position'),n=p.count,parents=Array.from({length:n},(_,i)=>i),find=(i:number):number=>parents[i]===i?i:(parents[i]=find(parents[i])),join=(a:number,b:number)=>{parents[find(a)]=find(b);};
 const positions=new Map<string,number>();for(let i=0;i<n;i++){const k=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*1e5)).join(',');const old=positions.get(k);if(old!==undefined)join(i,old);else positions.set(k,i);}
 const ix=g.index;for(let i=0;i<(ix?.count??n);i+=3){const a=ix?ix.getX(i):i;join(a,ix?ix.getX(i+1):i+1);join(a,ix?ix.getX(i+2):i+2);}
 const groups=new Map<number,number[]>();for(let i=0;i<n;i++){const k=find(i),list=groups.get(k)??[];list.push(i);groups.set(k,list);}
 const scale=new T.Vector3();mesh.getWorldScale(scale);const pts=Array.from({length:n},(_,i)=>new T.Vector3().fromBufferAttribute(p,i).multiply(scale)),uv=new Float32Array(n*2);
 for(const ids of groups.values()){const center=new T.Vector3();for(const i of ids)center.add(pts[i]);center.divideScalar(ids.length);const cov=new T.Matrix3().set(0,0,0,0,0,0,0,0,0),e=cov.elements;for(const i of ids){const q=pts[i].clone().sub(center),a=q.toArray();for(let r=0;r<3;r++)for(let c=0;c<3;c++)e[c*3+r]+=a[r]*a[c];}const axis=new T.Vector3(.37,1,.19).normalize();for(let j=0;j<16;j++)axis.applyMatrix3(cov).normalize();const ref=Math.abs(axis.y)<.9?new T.Vector3(0,1,0):new T.Vector3(1,0,0),x=new T.Vector3().crossVectors(axis,ref).normalize(),y=new T.Vector3().crossVectors(axis,x).normalize();for(const i of ids){const q=pts[i].clone().sub(center);uv[i*2]=Math.atan2(q.dot(y),q.dot(x))/(Math.PI*2)+.5;uv[i*2+1]=q.dot(axis)/.7;}}
 g.setAttribute('uv',new T.BufferAttribute(uv,2));g.deleteAttribute('tangent');
 if(g.index){const expanded=g.toNonIndexed();g.copy(expanded);expanded.dispose();}
 const out=g.getAttribute('uv');for(let i=0;i<out.count;i+=3){const us=[out.getX(i),out.getX(i+1),out.getX(i+2)];if(Math.max(...us)-Math.min(...us)>.5)for(let j=0;j<3;j++)if(us[j]<.5)out.setX(i+j,us[j]+1);}
 g.userData.branchUV='local branch axis, 0.7m repeat, unwrapped seam';
}
