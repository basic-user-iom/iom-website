
import type { EarthSurfaceSample, EarthSurfaceSampler } from './EarthSurface';

export interface TerrainTile { z:number;x:number;y:number;heights:Readonly<Float32Array> }
const cache=new Map<string,TerrainTile>();
const LIMIT=54;
export interface LocalTerrainResult { readonly sample:EarthSurfaceSampler; readonly tileCount:number }
export function terrariumHeight(r:number,g:number,b:number):number{return r*256+g+b/256-32768;}
function mercator(latitude:number,longitude:number,z:number):[number,number]{
  const n=2**z,lat=Math.max(-85.0511,Math.min(85.0511,latitude))*Math.PI/180;
  return [(((longitude+180)/360)%1+1)%1*n,(1-Math.asinh(Math.tan(lat))/Math.PI)/2*n];
}
async function tile(z:number,x:number,y:number,signal:AbortSignal):Promise<TerrainTile>{
  const n=2**z;x=(x%n+n)%n;y=Math.max(0,Math.min(n-1,y));
  const key=z+'/'+x+'/'+y,existing=cache.get(key);if(existing)return existing;
  const response=await fetch('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/'+key+'.png',{signal});
  if(!response.ok)throw new Error('Local terrain unavailable');
  const bitmap=await createImageBitmap(await response.blob());
  try{
    if(bitmap.width!==256||bitmap.height!==256)throw new Error('Invalid terrain tile dimensions');
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw new Error('Terrain decoder unavailable');
    ctx.drawImage(bitmap,0,0);const rgba=ctx.getImageData(0,0,256,256).data,heights=new Float32Array(256*256);
    for(let i=0;i<heights.length;i++)heights[i]=terrariumHeight(rgba[i*4]!,rgba[i*4+1]!,rgba[i*4+2]!);
    const result={z,x,y,heights};cache.set(key,result);
    while(cache.size>LIMIT)cache.delete(cache.keys().next().value!);
    return result;
  }finally{bitmap.close();}
}
/** 18 public Mapzen tiles at two LODs. Actual source resolution varies by region.
 * The returned immutable tile set is installed only before a run, never mid-run. */
export async function loadLocalEarthTerrain(latitude:number,longitude:number,base:EarthSurfaceSampler,signal:AbortSignal):Promise<LocalTerrainResult>{
  if(Math.abs(latitude)>84)return {sample:base,tileCount:0};
  const requests:Promise<TerrainTile>[]=[];
  for(const z of [9,12]){
    const [x,y]=mercator(latitude,longitude,z);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)requests.push(tile(z,Math.floor(x)+dx,Math.floor(y)+dy,signal));
  }
  const results=await Promise.allSettled(requests);
  const tiles=new Map<string,TerrainTile>();
  for(const result of results)if(result.status==='fulfilled'){const t=result.value;tiles.set(t.z+'/'+t.x+'/'+t.y,t);}
  return {sample:createLocalTerrainSampler(latitude,longitude,base,tiles),tileCount:tiles.size};
}
export function createLocalTerrainSampler(latitude:number,longitude:number,base:EarthSurfaceSampler,tiles:ReadonlyMap<string,TerrainTile>):EarthSurfaceSampler {
  return (lat,lon):Readonly<EarthSurfaceSample>=>{
    let regional=base(lat,lon);
    if(Math.abs(lat)>84)return regional;
    for(const z of [9,12]){
      const [tx,ty]=mercator(lat,lon,z),ix=Math.floor(tx),iy=Math.floor(ty);
      const t=tiles.get(z+'/'+ix+'/'+iy);if(!t)continue;
      const px=(tx-ix)*256,py=(ty-iy)*256,x0=Math.min(255,Math.floor(px)),y0=Math.min(255,Math.floor(py));
      const fx=px-x0,fy=py-y0;
      const read=(x:number,y:number)=>t.heights[Math.min(255,y)*256+Math.min(255,x)]!;
      const height=(read(x0,y0)*(1-fx)+read(x0+1,y0)*fx)*(1-fy)+(read(x0,y0+1)*(1-fx)+read(x0+1,y0+1)*fx)*fy;
      // High-zoom land DEMs often encode the sea as zero; preserve measured bathymetry.
      if(!Number.isFinite(height)||height < -11000||height > 9000||(regional.kind==='ocean' && height<=0))continue;
      // Fade the outer tile-set boundary into the regional grid.
      const [cx,cy]=mercator(latitude,longitude,z);
      const dx=Math.abs(tx-(Math.floor(cx)+0.5));
      const border=Math.max(Math.min(dx,2**z-dx),Math.abs(ty-(Math.floor(cy)+0.5)));
      const weight=Math.max(0,Math.min(1,(1.5-border)*5));
      if(weight===0)continue;
      const elevationM=regional.elevationM+(height-regional.elevationM)*weight;
      const ocean=elevationM<0&&regional.kind==='ocean';
      regional = {kind:ocean?'ocean':'land',elevationM,surfaceAltitudeM:ocean?0:Math.max(0,elevationM),
        waterDepthM:ocean?-elevationM:0,coastal:regional.coastal,
        source:'local',resolutionM:40075016.686*Math.cos(lat*Math.PI/180)/(256*2**z)};
    }
    return regional;
  };

}
