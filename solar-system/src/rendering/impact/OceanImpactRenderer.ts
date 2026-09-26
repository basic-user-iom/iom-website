import { EARTH_OCEAN_REFLECTION_GLSL } from '../bodies/EarthOceanReflection';

import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, Points, ShaderMaterial, Vector3 } from 'three';
import { getEarthSurfaceSampler, getEarthSurfaceRevision } from '../../simulation/scenarios/impact/EarthSurface';
import { IMPACT_NOISE_GLSL } from './ImpactNoise';
import { impactDepthUniforms, IMPACT_DEPTH_GLSL } from './ImpactDepthContext';
import { oceanEvolution, oceanJetHeightM, oceanCavityProgress } from './ImpactSurfaceDeformation';
import type { ImpactRenderState } from './ImpactRenderTypes';
import type { ImpactSurfaceBasis } from './ImpactSurfaceMath';

const SEGMENTS=144, RINGS=112;
const WATER_VERTEX = `
  attribute float aWet;
  attribute float aRadiusM;
  uniform float uRadius, uScale, uTime, uCavity, uDepth, uCollapse, uWavelength;
  uniform float uSpeed, uGroupSpeed, uGravity, uKind, uJetHeight;
  uniform vec3 uNormal,uEast,uNorth;
  varying vec3 vViewPosition;
  varying vec3 vLocalNormal;
  varying float vWet,vFoam;
  varying vec2 vUv;
  float waveHeight(float r) {
    float k=6.2831853/uWavelength;
    float age=max(0.0,uTime-uCollapse*0.5);
    float front=uCavity+uGroupSpeed*age;
    float envelope=exp(-pow((r-front)/(uWavelength*0.8),2.0));
    float spread=sqrt(uCavity/max(uCavity,r));
    float emergence=1.0-exp(-age/max(1.0,uCollapse*0.3));
    float amplitude=min(uDepth*0.12,uCavity*0.07)*spread*emergence*exp(-age/75.0);
    // Phase is defined in metres, independent of the extent of the mesh.
    return amplitude*envelope*(sin(k*(r-uCavity)-k*uSpeed*age)
      +0.28*sin(k*1.65*(r-uCavity)-sqrt(uGravity*k*1.65)*age));
  }
  void main() {
    vUv=uv;vWet=aWet;
    float angle=uv.x*6.2831853;
    float r=aRadiusM, h=0.0;
    float growth=pow(max(0.0,sin(3.14159265*clamp(uTime/(uCollapse*1.8),0.0,1.0))),1.25);
    if(uKind<0.5){
      float radius=uCavity*(0.22+0.78*min(1.0,uTime/max(0.1,uCollapse*0.5)));
      float bowl=pow(max(1.0-pow(r/max(radius,1.0),2.0),0.0),2.0);
      h=-uDepth*bowl*growth+waveHeight(r);
      vFoam=clamp(abs(waveHeight(r))/max(1.0,uCavity*0.055),0.0,1.0)*0.65;
      vFoam+=exp(-pow((r-radius)/(uCavity*0.07),2.0))*growth*0.55;
    } else if(uKind<1.5){
      float launch=sqrt(2.0*uGravity*uCavity*0.42);
      float top=max(0.0,launch*uTime-0.5*uGravity*uTime*uTime);
      r=uCavity*(0.3+0.7*uv.y)*(1.0+uTime/max(1.0,uCollapse)*0.32);
      h=top*pow(uv.y,0.65)*(0.85+0.1*sin(angle*11.0)+0.05*sin(angle*23.0));
      vFoam=0.4+uv.y*0.6;
    } else {
      r=uCavity*(0.035+0.07*pow(1.0-uv.y,2.0));
      h=uJetHeight*uv.y*(0.96+0.04*sin(angle*9.0));
      vFoam=0.3+uv.y*0.7;
    }
    float a=r*uScale/uRadius;
    vec3 direction=normalize(uNormal*cos(a)+(uEast*cos(angle)+uNorth*sin(angle))*sin(a));
    vec3 local=direction*(1.0+(h*uScale+0.6)/uRadius);
    vLocalNormal=direction;
    vec4 view=modelViewMatrix*vec4(local,1.0);
    vViewPosition=view.xyz;
    gl_Position=projectionMatrix*view;
  }
`;
function geometry(): BufferGeometry {
  const g=new BufferGeometry(),uv=[],indices=[],positions=[],wet=[],radius=[];
  for(let y=0;y<=RINGS;y++)for(let x=0;x<=SEGMENTS;x++){
    uv.push(x/SEGMENTS,y/RINGS);positions.push(0,0,0);wet.push(1);radius.push(0);
    if(y<RINGS&&x<SEGMENTS){const a=y*(SEGMENTS+1)+x,b=a+SEGMENTS+1;indices.push(a,b,a+1,a+1,b,b+1);}
  }
  g.setAttribute('position',new Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new Float32BufferAttribute(uv,2));
  g.setAttribute('aWet',new Float32BufferAttribute(wet,1));
  g.setAttribute('aRadiusM',new Float32BufferAttribute(radius,1));g.setIndex(indices);return g;
}
function material(kind:number): ShaderMaterial {
  return new ShaderMaterial({transparent:kind!==0,depthTest:true,depthWrite:kind===0,side:DoubleSide,
    uniforms:{...impactDepthUniforms,uKind:{value:kind},uOpacity:{value:0},uTime:{value:0},uRadius:{value:1},
      uEarthMap:{value:null},uHasEarthMap:{value:0},uExtent:{value:1},uScale:{value:1},uCavity:{value:1},uDepth:{value:1},uCollapse:{value:1},uWavelength:{value:1},
      uSpeed:{value:1},uGroupSpeed:{value:1},uGravity:{value:9.81},uJetHeight:{value:0},
      uNormal:{value:new Vector3()},uEast:{value:new Vector3()},uNorth:{value:new Vector3()}},
    vertexShader:WATER_VERTEX,
    fragmentShader:IMPACT_NOISE_GLSL+IMPACT_DEPTH_GLSL+EARTH_OCEAN_REFLECTION_GLSL+`
      uniform float uKind,uOpacity,uTime,uHasEarthMap,uExtent;
      uniform sampler2D uEarthMap;
      varying vec3 vViewPosition,vLocalNormal;
      varying float vWet,vFoam;
      varying vec2 vUv;
      void main(){
        if(vWet<0.5)discard;
        vec3 n=normalize(cross(dFdx(vViewPosition*1e8),dFdy(vViewPosition*1e8)));
        if(!gl_FrontFacing)n=-n;
        vec3 eye=normalize(-vViewPosition);
        float fresnel=0.02+0.98*pow(1.0-clamp(dot(n,eye),0.0,1.0),5.0);
        float sun=max(0.0,dot(n,uImpactSunView));
        float spec=pow(max(0.0,dot(n,normalize(eye+uImpactSunView))),100.0);
        float noise=impactFbm(vec3(vUv.x*46.0,vUv.y*31.0,uTime*0.15));
        float foam=clamp(vFoam*(0.55+noise*0.8),0.0,1.0);
        vec3 water=mix(vec3(0.012,0.055,0.065),vec3(0.07,0.19,0.24),fresnel);
        vec3 color=mix(water,vec3(0.65,0.78,0.79),foam)*(0.18+sun*0.82);
        color+=vec3(1.0,0.91,0.72)*spec*0.7;
        if(uKind<0.5 && uHasEarthMap>0.5){
          vec3 d=normalize(vLocalNormal);
          vec2 mapUv=vec2((atan(-d.z,d.x)+3.14159265)/6.2831853,asin(d.y)/3.14159265+0.5);
          vec3 base=texture2D(uEarthMap,mapUv).rgb*(0.028+0.97*sun);
          base+=earthOceanSkyReflection(n,eye,dot(n,uImpactSunView),1.0,1.0);
          // Match the global ocean at the boundary; the near field retains
          // displaced normals, directional highlights and foam.
          color=mix(color,base,smoothstep(0.87,1.0,vUv.y));
        }
        float alpha=uKind<0.5?1.0:uOpacity*(0.45+foam*0.55);
        if(uKind>0.5){
          alpha*=smoothstep(0.0,0.07,vUv.y)*(1.0-smoothstep(0.80+noise*0.16,1.0,vUv.y));
          if(uImpactDepthEnabled>0.5)alpha*=clamp((impactSceneDepth()+vViewPosition.z)/max(1e-15,length(dFdx(vViewPosition))*3.0),0.0,1.0);
        }
        if(alpha<0.005)discard;
        gl_FragColor=vec4(color,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `});
}
/** GPU surface displacement. Topology and coastline samples change only on setup. */
export class OceanImpactRenderer {
  public readonly root=new Group();
  private readonly splash=new Mesh(geometry(),material(1));
  private readonly jet=new Mesh(geometry(),material(2));
  private readonly waves=new Mesh(geometry(),material(0));
  private readonly spray=createSpray();
  private key='';
  private stride=1;
  public constructor(){
    this.root.name='impact-ocean-effects';this.splash.name='impact-water-column-and-crown';
    this.jet.name='impact-ocean-central-water-jet';this.waves.name='impact-ocean-wave-train';
    for(const m of [this.splash,this.jet,this.waves])m.frustumCulled=false;
    this.splash.renderOrder=this.jet.renderOrder=8;
    this.root.add(this.splash,this.jet,this.waves,this.spray);this.reset();
  }
  public setBudget(count:number):void{
    const stride=count<=40?4:count<=80?2:1;
    this.spray.geometry.setDrawRange(0,stride===4?128:stride===2?256:512);
    if(stride===this.stride)return;
    this.stride=stride;
    const indices:number[]=[];
    for(let y=0;y<RINGS;y+=stride)for(let x=0;x<SEGMENTS;x+=stride){
      const a=y*(SEGMENTS+1)+x,b=a+stride*(SEGMENTS+1);
      indices.push(a,b,a+stride,a+stride,b,b+stride);
    }
    for(const mesh of [this.waves,this.splash,this.jet]){
      mesh.geometry.dispose();mesh.geometry.setIndex(indices);
    }
  }
  public update(state:Readonly<ImpactRenderState>,basis:Readonly<ImpactSurfaceBasis>,active:boolean,multiplier:number):void {
    const t=state.eventElapsedSeconds;
    if(!active||state.outcomeKind!=='ocean-surface-impact'||t===null||t<=0){this.reset();return;}
    const model=oceanEvolution(state),g=state.surfaceGravityMps2;
    const launch=Math.sqrt(2*g*model.cavityRadiusM*0.42),splashLifetime=2*launch/g;
    const splashOpacity=Math.sin(Math.PI*Math.min(1,t/splashLifetime))*0.8;
    const jetHeight=oceanJetHeightM(t,model,g);
    this.splash.visible=splashOpacity>0.01;this.jet.visible=jetHeight>1;
    this.waves.visible=true;this.root.visible=true;
    this.spray.visible=t<model.collapseSeconds*2.5;
    const key=[state.runSignature,basis.normal.x,basis.normal.y,basis.normal.z,multiplier,getEarthSurfaceRevision()].join(',');
    if(key!==this.key){
      this.key=key;
      const sample=getEarthSurfaceSampler(),p=new Vector3();
      for(const mesh of [this.waves,this.splash,this.jet]){
        const wet=mesh.geometry.getAttribute('aWet'),radii=mesh.geometry.getAttribute('aRadiusM');
        for(let y=0;y<=RINGS;y++)for(let x=0;x<=SEGMENTS;x++){
          const u=y/RINGS,angle=x/SEGMENTS*2*Math.PI;
          const r=mesh===this.waves?20*Math.expm1(Math.log1p(model.extentM/20)*u)
            :mesh===this.splash?model.cavityRadiusM*(0.3+u*0.7)*2: model.cavityRadiusM*0.105;
          const a=r*multiplier/state.targetRadiusM;
          p.copy(basis.normal).multiplyScalar(Math.cos(a)).addScaledVector(basis.east,Math.cos(angle)*Math.sin(a))
            .addScaledVector(basis.north,Math.sin(angle)*Math.sin(a));
          const s=sample?.(Math.asin(p.y)*180/Math.PI,Math.atan2(-p.z,p.x)*180/Math.PI);
          const i=y*(SEGMENTS+1)+x;wet.setX(i,s?.kind==='land'?0:1);radii.setX(i,r);
        }
        wet.needsUpdate=radii.needsUpdate=true;
      }
    }
    for(const mesh of [this.waves,this.splash,this.jet]){
      const u=mesh.material.uniforms;
      const source=this.root.parent?.parent?.getObjectByName('phase-4-earth-surface');
      if(source instanceof Mesh && source.material instanceof ShaderMaterial){u.uEarthMap!.value=source.material.uniforms.uMap?.value;u.uHasEarthMap!.value=1;}
      u.uExtent!.value=model.extentM;
      const values={uOpacity:mesh===this.splash?splashOpacity:0.85,uTime:t,uRadius:state.targetRadiusM,uScale:multiplier,
        uCavity:model.cavityRadiusM,uDepth:model.cavityDepthM,uCollapse:model.collapseSeconds,uWavelength:model.wavelengthM,
        uSpeed:model.phaseSpeedMps,uGroupSpeed:model.groupSpeedMps,uGravity:g,uJetHeight:jetHeight};
      for(const [name,value]of Object.entries(values))u[name]!.value=value;
      (u.uNormal!.value as Vector3).copy(basis.normal);(u.uEast!.value as Vector3).copy(basis.east);(u.uNorth!.value as Vector3).copy(basis.north);
    }
    const spray=this.spray.material.uniforms;
    spray.uTime!.value=t;spray.uRadius!.value=state.targetRadiusM;spray.uScale!.value=multiplier;
    spray.uCavity!.value=model.cavityRadiusM;spray.uGravity!.value=g;
    (spray.uNormal!.value as Vector3).copy(basis.normal);
    (spray.uEast!.value as Vector3).copy(basis.east);(spray.uNorth!.value as Vector3).copy(basis.north);
    this.root.userData={...model,depthM:state.earthSurface?.waterDepthM,elapsedSeconds:t,
      cavityDepthNowM:model.cavityDepthM*oceanCavityProgress(t,model.collapseSeconds),jetHeightM:jetHeight,
      phase:t<model.collapseSeconds?'excavation':t<model.collapseSeconds*1.8?'collapse':jetHeight>0?'rebound-jet':'wave-packet',
      simulation:'energy-bounded cavity and dispersive wave packet; no inundation solver'};
  }
  public reset():void {this.root.visible=this.spray.visible=this.splash.visible=this.jet.visible=this.waves.visible=false;this.key='';this.root.userData={};}
  public dispose():void {for(const m of [this.splash,this.jet,this.waves,this.spray]){m.geometry.dispose();m.material.dispose();}this.root.clear();this.root.removeFromParent();}
}

function createSpray():Points<BufferGeometry,ShaderMaterial>{
  const geometry=new BufferGeometry(),seeds=[];
  for(let i=0;i<512;i++)seeds.push((i*0.61803398875)%1,(i*0.41421356237)%1,(i*0.73205080757)%1);
  geometry.setAttribute('position',new Float32BufferAttribute(seeds,3));
  const material=new ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{...impactDepthUniforms,uTime:{value:0},uRadius:{value:1},uScale:{value:1},uCavity:{value:1},
      uGravity:{value:9.81},uNormal:{value:new Vector3()},uEast:{value:new Vector3()},uNorth:{value:new Vector3()}},
    vertexShader: `
      uniform float uTime,uRadius,uScale,uCavity,uGravity;
      uniform vec3 uNormal,uEast,uNorth;
      uniform vec2 uImpactViewport;
      varying float vAlpha,vDepth,vSize;
      void main(){
        float angle=position.x*6.2831853;
        float speed=sqrt(2.0*uGravity*uCavity)*(0.35+position.y*0.6);
        float age=max(0.0,uTime-position.z*1.2);
        float height=speed*age-0.5*uGravity*age*age;
        float r=uCavity*0.7+speed*age*(0.3+position.z*0.5);
        float a=r*uScale/uRadius;
        vec3 p=normalize(uNormal*cos(a)+(uEast*cos(angle)+uNorth*sin(angle))*sin(a));
        p*=1.0+max(0.0,height)*uScale/uRadius;
        vec4 view=modelViewMatrix*vec4(p,1.0);
        float size=(2.0+position.y*4.0)*uScale/uRadius*length(modelViewMatrix[0].xyz);
        vAlpha=step(0.1,height)*min(1.0,age/0.3)*(1.0-smoothstep(0.6,1.0,age/(2.0*speed/uGravity)));
        vDepth=-view.z;vSize=size;
        gl_PointSize=clamp(size*projectionMatrix[1][1]*uImpactViewport.y/max(1e-18,-view.z),1.0,6.0);
        gl_Position=projectionMatrix*view;
      }
    `,
    fragmentShader:IMPACT_DEPTH_GLSL+`
      varying float vAlpha,vDepth,vSize;
      void main(){
        float r=length(gl_PointCoord-0.5)*2.0;
        float alpha=vAlpha*(1.0-smoothstep(0.3,1.0,r))*0.45;
        if(uImpactDepthEnabled>0.5)alpha*=clamp((impactSceneDepth()-vDepth)/max(1e-18,vSize*4.0),0.0,1.0);
        if(alpha<0.005)discard;
        gl_FragColor=vec4(0.7,0.83,0.88,alpha);
      }
    `});
  const points=new Points(geometry,material);points.name='impact-water-spray';points.frustumCulled=false;points.renderOrder=8;return points;
}
