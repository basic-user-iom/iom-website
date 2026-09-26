
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, ShaderMaterial, Vector3, Vector4 } from 'three';
import { getEarthSurfaceSampler, getEarthSurfaceRevision } from '../../simulation/scenarios/impact/EarthSurface';
import type { ImpactRenderState } from './ImpactRenderTypes';
import type { ImpactSurfaceBasis } from './ImpactSurfaceMath';
import { CRATER_DISPLACEMENT_GLSL, oceanEvolution } from './ImpactSurfaceDeformation';

/** A dense centre and logarithmic outer rings preserve metre-scale excavation
 * without tessellating the whole planet. The base globe is cut out underneath. */
export class ImpactTerrainRenderer {
  public readonly root = new Group();
  private readonly geometry = new BufferGeometry();
  private mesh: Mesh<BufferGeometry, ShaderMaterial> | null = null;
  private source: ShaderMaterial | null = null;
  private key = '';
  public constructor() { this.root.name = 'impact-measured-earth-terrain'; }
  public update(state: Readonly<ImpactRenderState>, basis: Readonly<ImpactSurfaceBasis>, multiplier = 1): void {
    const sample = getEarthSurfaceSampler();
    const enabled = state.targetBodyId === 'earth' && state.earthSurface !== undefined && sample !== null;
    if (!enabled || sample === null) { this.reset(); return; }
    const source = this.root.parent?.parent?.getObjectByName('phase-4-earth-surface');
    if (!(source instanceof Mesh) || !(source.material instanceof ShaderMaterial)) return;
    if (this.source !== source.material || this.mesh === null) {
      if (this.source?.uniforms.uImpactCut) (this.source.uniforms.uImpactCut.value as Vector4).w = 2;
      this.mesh?.material.dispose(); this.mesh?.removeFromParent();
      this.source = source.material;
      const material = source.material.clone();
      // Share changing lighting/textures; cutout and deformation are local.
      material.uniforms = { ...source.material.uniforms,
        uImpactCut: { value: new Vector4(0,0,0,2) },
        uCraterRadius: { value: 0 }, uCraterDepth: { value: 0 }, uCraterFormation: { value: 0 },
        uTerrainCenter:{value:new Vector3()},uTerrainEast:{value:new Vector3()},uTerrainNorth:{value:new Vector3()},
        uTerrainScorchRadius:{value:0},uTerrainScorchOpacity:{value:0},uTerrainRadius: { value: state.targetRadiusM } };
      material.vertexShader = 'uniform vec3 uTerrainCenter; varying float vTerrainDistance; attribute float aDistanceM; uniform float uCraterRadius; uniform float uCraterDepth; uniform float uCraterFormation; uniform float uTerrainRadius; varying vec3 vTerrainView;\n'
        + CRATER_DISPLACEMENT_GLSL + material.vertexShader;
      material.vertexShader = material.vertexShader.replace('vec4 worldPosition = modelMatrix * vec4(position, 1.0);',
        'float displacement = uCraterRadius > 0.0 ? craterDisplacement(aDistanceM/uCraterRadius,uCraterDepth,uCraterFormation) : 0.0;\n'
        + 'vec3 displaced = position + normalize(position)*displacement/uTerrainRadius;\n'
        + 'vTerrainView = (modelViewMatrix*vec4(displaced,1.0)).xyz;\n'
        + 'vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);');
      material.vertexShader = material.vertexShader.replace('vSurfaceViewPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;',
        'vSurfaceViewPosition = vTerrainView;');
      material.vertexShader=material.vertexShader.replace('vWorldNormal = normalize(mat3(modelMatrix) * normal);',smoothTerrainNormal());
      material.fragmentShader=terrainFragmentPrelude()+material.fragmentShader;
      material.fragmentShader=material.fragmentShader.replace('vec3 albedo = uHasMap > 0.5 ? mapColor : fallbackAlbedo();','vec3 albedo = uHasMap > 0.5 ? mapColor : fallbackAlbedo();'+terrainCraterAlbedo());
      this.mesh = new Mesh(this.geometry, material);
      this.mesh.name = 'impact-earth-relief-mesh';
      this.mesh.frustumCulled = false;
      this.root.add(this.mesh); this.key = '';
    }
    this.root.visible = true;
    const extentM = 450000;
    const u = this.mesh.material.uniforms;
    u.uCraterRadius!.value = (state.outcomeKind === 'ocean-surface-impact' ? state.seafloorCraterRadiusM ?? 0 : state.craterRadiusM) * multiplier;
    u.uCraterDepth!.value = (state.outcomeKind === 'ocean-surface-impact' ? state.seafloorCraterDepthM ?? 0 : state.craterDepthM) * multiplier;
    u.uCraterFormation!.value = state.outcomeKind === 'solid-surface-impact' ? state.craterFormationProgress
      : state.outcomeKind === 'ocean-surface-impact' ? Math.min(1,Math.max(0,((state.eventElapsedSeconds ?? 0)-0.2)/2)) : 0;
    u.uTerrainRadius!.value = state.targetRadiusM;
    (u.uTerrainCenter!.value as Vector3).copy(basis.normal);(u.uTerrainEast!.value as Vector3).copy(basis.east);(u.uTerrainNorth!.value as Vector3).copy(basis.north);
    u.uTerrainScorchRadius!.value=state.scorchRadiusM*multiplier;u.uTerrainScorchOpacity!.value=state.surfaceScorchOpacity;
    const cut = this.source!.uniforms.uImpactCut?.value as Vector4 | undefined;
    // Slight overlap at the perimeter hides roundoff cracks.
    cut?.set(basis.normal.x,basis.normal.y,basis.normal.z,Math.cos((extentM-100)/state.targetRadiusM));
    const waterExtent = state.outcomeKind === 'ocean-surface-impact' && (state.eventElapsedSeconds ?? 0) > 0 ? oceanEvolution(state).extentM * multiplier : 0;
    const key = [basis.normal.x,basis.normal.y,basis.normal.z,waterExtent,getEarthSurfaceRevision()].join(',');
    if (key === this.key) return;
    this.key = key;
    const rings = 192, segments = 192, positions = [], uv = [], indices = [], distances = [];
    const direction = new Vector3();
    let minimumM=Infinity, maximumM=-Infinity;
    for(let y=0;y<=rings;y++) {
      const radius = 20 * (Math.exp(Math.log1p(extentM/20)*y/rings)-1);
      const angle=radius/state.targetRadiusM;
      for(let x=0;x<=segments;x++) {
        const azimuth=x/segments*2*Math.PI;
        direction.copy(basis.normal).multiplyScalar(Math.cos(angle))
          .addScaledVector(basis.east,Math.cos(azimuth)*Math.sin(angle))
          .addScaledVector(basis.north,Math.sin(azimuth)*Math.sin(angle)).normalize();
        const lat=Math.asin(direction.y),lon=Math.atan2(-direction.z,direction.x);
        const surface=sample(lat*180/Math.PI,lon*180/Math.PI);
        let elevation=surface.surfaceAltitudeM;
        if(surface.kind==='ocean' && waterExtent>0 && radius<waterExtent*0.96){
          const edge=Math.min(1,Math.max(0,(radius/waterExtent-0.8)/0.16));
          elevation=surface.elevationM*(1-edge*edge*(3-2*edge));
        }
        minimumM=Math.min(minimumM,elevation);maximumM=Math.max(maximumM,elevation);
        const fade=1-Math.max(0,(radius/extentM-0.95)/0.05);
        direction.multiplyScalar(1+(elevation*fade+0.3)/state.targetRadiusM);
        positions.push(direction.x,direction.y,direction.z);
        distances.push(radius);uv.push((lon+Math.PI)/(2*Math.PI),lat/Math.PI+0.5);
        if(y<rings&&x<segments){const a=y*(segments+1)+x,b=a+segments+1;indices.push(a,b,a+1,a+1,b,b+1);}
      }
    }
    for(let y=0;y<=rings;y++) for(let x=1;x<=segments;x++){
      const i=(y*(segments+1)+x)*2;
      while(uv[i]!-uv[i-2]!>0.5)uv[i]!-=1;
      while(uv[i]!-uv[i-2]!< -0.5)uv[i]!+=1;
    }
    this.geometry.dispose();
    this.geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
    this.geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));
    this.geometry.setAttribute('aDistanceM',new Float32BufferAttribute(distances,1));
    this.geometry.setIndex(indices);this.geometry.computeVertexNormals();
    this.root.userData={source:'NOAA ETOPO1 + available local terrain tiles',minimumM,maximumM,verticalScale:1,excavated:true};
  }
  public reset(): void { this.root.visible=false;this.key='';const c=this.source?.uniforms.uImpactCut?.value as Vector4|undefined;if(c)c.w=2; }
  public dispose(): void { this.reset();this.geometry.dispose();this.mesh?.material.dispose();this.root.clear();this.root.removeFromParent(); }
}

function terrainFragmentPrelude():string{return "varying float vTerrainDistance;\nuniform float uCraterRadius,uCraterFormation,uTerrainScorchRadius,uTerrainScorchOpacity;\nuniform vec3 uTerrainEast,uTerrainNorth;\n";}
function terrainCraterAlbedo():string{return "\n    float craterR=vTerrainDistance/max(1.0,uCraterRadius);\n    float bowlMask=(1.0-smoothstep(0.78,1.08,craterR))*uCraterFormation;\n    float azimuth=atan(dot(vObjectPosition,uTerrainNorth),dot(vObjectPosition,uTerrainEast));\n    float rays=pow(max(0.0,sin(azimuth*11.0)),8.0);\n    float blanket=(1.0-smoothstep(uCraterRadius,max(uCraterRadius+1.0,uTerrainScorchRadius),vTerrainDistance));\n    float soil=max(bowlMask*0.92,blanket*(0.32+rays*0.42)*uTerrainScorchOpacity);\n    albedo=mix(albedo,vec3(0.13,0.085,0.05),clamp(soil,0.0,0.94));\n";}
function smoothTerrainNormal():string{return "\n    vTerrainDistance=aDistanceM;\n    float delta=max(1.0,uCraterRadius*0.002);\n    float slope=uCraterRadius>0.0 ?\n      (craterDisplacement((aDistanceM+delta)/uCraterRadius,uCraterDepth,uCraterFormation)\n      -craterDisplacement(max(0.0,aDistanceM-delta)/uCraterRadius,uCraterDepth,uCraterFormation))/(2.0*delta) : 0.0;\n    vec3 radial=normalize(position);\n    vec3 tangent=radial*dot(radial,uTerrainCenter)-uTerrainCenter;\n    vec3 terrainNormal=normal;\n    if(dot(tangent,tangent)>1e-16)terrainNormal=normalize(normal-normalize(tangent)*slope);\n    vWorldNormal=normalize(mat3(modelMatrix)*terrainNormal);\n";}
