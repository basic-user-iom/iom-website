import * as T from 'three';
import type {Font} from 'three/addons/loaders/FontLoader.js';
import {calculateCadCutGeometryMm} from './linar-reference/linarGeometry';
import {LINAR_MATERIAL_LOOKS,LINAR_VENEER_LOOKS,findMdfColour} from './linar-reference/materialData';
import type {LinarSettings} from './LinarWalls';
import {linarWood} from './LinarWood';
const inside=(x:number,y:number,poly:T.Vector2[])=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)hit=!hit;}return hit;};
function clearance(x:number,y:number,poly:T.Vector2[]){let d=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b.x-a.x,dy=b.y-a.y,t=T.MathUtils.clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);d=Math.min(d,Math.hypot(x-a.x-t*dx,y-a.y-t*dy));}return d;}
/** Through-slotted birch letters. A narrow intact perimeter keeps each glyph
 * connected; slots retain the panel's 4/4 mm phase and 60 mm incision rhythm. */
export type LetteringSettings=Pick<LinarSettings,'thicknessMm'|'incision'|'finish'|'veneer'|'mdfVariant'|'colour'>;
export function linarLettering(font:Font,width:number,height:number,settings:Partial<LetteringSettings>={}){
 const s={thicknessMm:9,incision:60,finish:'birch',veneer:'none',mdfVariant:'natural',colour:'grey',...settings} as LetteringSettings;
 s.thicknessMm=T.MathUtils.clamp(s.thicknessMm,4,15);s.incision=T.MathUtils.clamp(s.incision,40,400);
 const raw=font.generateShapes('L I N A R',1).map(s=>s.extractPoints(8)),box=new T.Box2();raw.forEach(s=>s.shape.forEach(p=>box.expandByPoint(p)));const scale=new T.Vector2(width/(box.max.x-box.min.x),height/(box.max.y-box.min.y));
 const transform=(p:T.Vector2)=>new T.Vector2((p.x-box.min.x)*scale.x-width/2,(p.y-box.min.y)*scale.y),shapes:T.Shape[]=[],slotCentres:number[][]=[];let slots=0;
 const thickness=s.thicknessMm/1000,incision=s.incision/1000,bridgeSpanMm=calculateCadCutGeometryMm(s.thicknessMm).bridgeSpanMm,pitch=incision+bridgeSpanMm/1000,rim=.0015;
 for(const item of raw){const outer=item.shape.map(transform),holes=item.holes.map(h=>h.map(transform)),bounds=new T.Box2().setFromPoints(outer),shape=new T.Shape(outer);shape.holes=holes.map(h=>new T.Path(T.ShapeUtils.isClockWise(h)?h.slice().reverse():h));
  const valid=(x:number,y:number)=>inside(x,y,outer)&&!holes.some(h=>inside(x,y,h))&&clearance(x,y,outer)>rim&&holes.every(h=>clearance(x,y,h)>rim);
  for(let col=Math.floor((bounds.min.x+width/2)/.008);col*.008-width/2<bounds.max.x;col++){const x0=col*.008-width/2+.002,x1=x0+.004;
   for(let row=-1;row*pitch<height;row++){const start=row*pitch+(col%2)*pitch/2,end=start+incision;let run:number|null=null;
    const finish=(y:number)=>{if(run!==null&&y-run>=.008){shape.holes.push(new T.Path([new T.Vector2(x0,run),new T.Vector2(x1,run),new T.Vector2(x1,y),new T.Vector2(x0,y)]));slotCentres.push([(x0+x1)/2,(run+y)/2]);slots++;}run=null;};
    for(let y=Math.max(0,start);y<=Math.min(height,end)+.00001;y+=.001){const fits=valid(x0,y)&&valid(x1,y)&&valid((x0+x1)/2,y);if(fits){if(run===null)run=y;}else if(run!==null)finish(y-.001);if(y+.001>Math.min(height,end))finish(y);}
   }
  }shapes.push(shape);
 }
 const geometry=new T.ExtrudeGeometry(shapes,{depth:thickness,steps:1,bevelEnabled:false,curveSegments:1}),materialId=s.finish==='birch'?'plywood':s.finish==='spruce'?'three-layer-spruce':'mdf',look=s.veneer==='none'?LINAR_MATERIAL_LOOKS[materialId]:LINAR_VENEER_LOOKS[s.veneer],plainMdf=s.finish==='mdf'&&s.veneer==='none',colour=plainMdf?(s.mdfVariant==='valchromat'?findMdfColour(s.colour).swatch:'#b99c72'):look.face;
 const face=new T.MeshStandardMaterial({name:'LINAR_Lettering_Face',color:colour,roughness:look.roughness,metalness:0,side:T.FrontSide}),edge=new T.MeshStandardMaterial({name:'LINAR_Lettering_Routed_Edges',color:plainMdf?colour:look.cut,roughness:look.cutRoughness,metalness:0,side:T.FrontSide});if(!plainMdf){linarWood(face);linarWood(edge);}
 geometry.userData={slots,slotCentres,thicknessMm:s.thicknessMm,cutMm:4,slatMm:4,incisionMm:s.incision,bridgeSpanMm,pitchMm:pitch*1000,perimeterRimMm:1.5,throughSlots:true};return {geometry,material:[face,edge],slots};
}
