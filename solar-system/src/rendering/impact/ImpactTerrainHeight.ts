
import { Ray, Vector3 } from 'three';
import type { EarthSurfaceSampler } from '../../simulation/scenarios/impact/EarthSurface';

/** Radial height of the same logarithmic triangles used by ImpactTerrainRenderer.
 * Ground cameras must stand on the rendered triangles, not on a second surface. */
export function localTerrainTriangleHeightM(
  direction:Vector3,normal:Vector3,east:Vector3,north:Vector3,radiusM:number,sample:EarthSurfaceSampler,
):number {
  const extent=450000,rings=192,segments=192;
  const cosine=Math.min(1,Math.max(-1,direction.dot(normal)));
  const r=Math.acos(cosine)*radiusM;
  const elevation=sample(Math.asin(direction.z)*180/Math.PI,Math.atan2(direction.y,direction.x)*180/Math.PI).surfaceAltitudeM;
  if(r>=extent)return elevation;
  const y=Math.min(rings-1,Math.floor(Math.log1p(r/20)/Math.log1p(extent/20)*rings));
  const azimuth=(Math.atan2(direction.dot(north),direction.dot(east))+Math.PI*2)%(Math.PI*2);
  const x=Math.floor(azimuth/(Math.PI*2)*segments);
  const vertex=(ring:number,segment:number)=>{
    const distance=20*Math.expm1(Math.log1p(extent/20)*ring/rings),a=distance/radiusM,theta=segment/segments*Math.PI*2;
    const p=normal.clone().multiplyScalar(Math.cos(a)).addScaledVector(east,Math.sin(a)*Math.cos(theta))
      .addScaledVector(north,Math.sin(a)*Math.sin(theta)).normalize();
    const h=sample(Math.asin(p.z)*180/Math.PI,Math.atan2(p.y,p.x)*180/Math.PI).surfaceAltitudeM;
    return p.multiplyScalar(1+(h*(1-Math.max(0,(distance/extent-0.95)/0.05))+0.3)/radiusM);
  };
  const a=vertex(y,x),b=vertex(y+1,x),c=vertex(y,x+1),d=vertex(y+1,x+1);
  const ray=new Ray(new Vector3(),direction),point=new Vector3();
  const hit=ray.intersectTriangle(a,b,c,false,point)??ray.intersectTriangle(c,b,d,false,point);
  return hit?(hit.length()-1)*radiusM:elevation;
}
