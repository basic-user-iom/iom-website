import { getEarthSurfaceSampler } from '../../simulation/scenarios/impact/EarthSurface';
import { craterDisplacementM } from './ImpactSurfaceDeformation';
import { impactDepthUniforms, IMPACT_DEPTH_GLSL } from './ImpactDepthContext';
import {
  BufferGeometry, Float32BufferAttribute,
  Group,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

import type { ImpactRenderState } from './ImpactRenderTypes';
import { clampImpactUnit, mapImpactEnuToBodyLocal, type ImpactSurfaceBasis } from './ImpactSurfaceMath';

export class SurfaceShockwaveRenderer {
  public readonly root = new Group();
  public groundVisible = false;
  public atmosphericVisible = false;
  public groundAngularRadiusRad = 0;
  public atmosphericAngularRadiusRad = 0;
  public surfaceConforming = false;
  public surfaceAttachmentErrorM = 0;
  public activeObjectCount = 0;

  private readonly geometry = new SphereGeometry(1, 64, 32);
  private readonly groundMaterial = createWaveMaterial(0xc58a56, false);
  private readonly atmosphericMaterial = createWaveMaterial(0x9cc8d8, true);
  private readonly groundGeometry = new BufferGeometry();
  private readonly ground = new Mesh(this.groundGeometry, this.groundMaterial);
  private readonly atmospheric = new Mesh(this.geometry, this.atmosphericMaterial);
  private disposed = false;
  private readonly surfaceScratch = new Vector3();
  private readonly normalScratch = new Vector3();

  public constructor() {
    const indices:number[]=[];
    for(let y=0;y<4;y++)for(let x=0;x<128;x++){const a=y*129+x,b=a+129;indices.push(a,b,a+1,a+1,b,b+1);}
    this.groundGeometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(5*129*3),3));
    this.groundGeometry.setAttribute('normal',new Float32BufferAttribute(new Float32Array(5*129*3),3));
    this.groundGeometry.setIndex(indices);
    this.groundMaterial.uniforms.uLocalGround!.value=1;
    this.root.name = 'impact-curved-shockwave-renderer';
    this.ground.name = 'impact-curved-ground-shockwave';
    this.atmospheric.name = 'impact-curved-atmospheric-shockwave';
    this.ground.frustumCulled = false;
    this.atmospheric.frustumCulled = false;
    this.ground.renderOrder = 8;
    this.atmospheric.renderOrder = 9;
    this.root.add(this.ground, this.atmospheric);
    this.reset();
  }

  public update(
    state: Readonly<ImpactRenderState>,
    basis: Readonly<ImpactSurfaceBasis>,
    active: boolean,
    presentationMultiplier = 1,
  ): void {
    this.groundAngularRadiusRad = Math.min(
      Math.PI * 0.94,
      Math.max(0, state.groundShockwaveAngularRadiusRad * presentationMultiplier),
    );
    this.atmosphericAngularRadiusRad = Math.min(
      Math.PI * 0.94,
      Math.max(0, state.atmosphericShockwaveAngularRadiusRad * presentationMultiplier),
    );
    this.groundVisible = active
      && state.eventElapsedSeconds !== null
      && state.supportsGroundShockwave
      && state.outcomeKind === 'solid-surface-impact'
      && this.groundAngularRadiusRad > 0
      && state.groundShockwaveOpacity > 0;
    this.atmosphericVisible = active
      && state.eventElapsedSeconds !== null
      && state.supportsAtmosphericShockwave
      && state.stage !== 'impact-flash'
      && state.stage !== 'airburst'
      && this.atmosphericAngularRadiusRad > 0
      && state.atmosphericShockwaveOpacity > 0
      && state.eventElapsedSeconds < 12;
    updateWaveMaterial(
      this.groundMaterial,
      state,
      basis,
      this.groundAngularRadiusRad,
      state.groundShockwaveOpacity * (presentationMultiplier > 1.001 ? 0.15 : 1),
      3 / state.targetRadiusM,
    );
    updateWaveMaterial(
      this.atmosphericMaterial,
      state,
      basis,
      this.atmosphericAngularRadiusRad,
      state.atmosphericShockwaveOpacity * Math.exp(-Math.max(0, (state.eventElapsedSeconds ?? 0) - 1) / 2.5) * 0.22,
      Math.max(12_000 / state.targetRadiusM, 0.002),
    );
    const airborne = state.outcomeKind === 'airburst';
    const localBlast = state.targetClass !== 'gas-giant' && state.targetClass !== 'ice-giant';
    this.atmosphericMaterial.uniforms.uBurstMode!.value = localBlast ? 1 : 0;
    this.atmospheric.position.set(0, 0, 0);
    this.atmospheric.scale.setScalar(1);
    if (localBlast) {
      const p = airborne && state.impactorLocalEnuM !== null
        ? state.impactorLocalEnuM : { eastM: 0, northM: 0, upM: (state.earthSurface?.surfaceAltitudeM ?? 0) + 3 };
      mapImpactEnuToBodyLocal(this.atmospheric.position, p.eastM, p.northM, p.upM,
        state, basis, this.surfaceScratch, this.normalScratch);
      this.atmospheric.scale.setScalar(Math.max(1e-9, this.atmosphericAngularRadiusRad));
    }
    if(this.groundVisible){
      const sample=state.earthSurface?getEarthSurfaceSampler():null,positions=this.groundGeometry.getAttribute('position');
      const width=Math.max(0.0000005,this.groundAngularRadiusRad*0.01)*2.1;
      for(let y=0;y<=4;y++)for(let x=0;x<=128;x++){
        const a=Math.max(0,this.groundAngularRadiusRad+(y/4*2-1)*width),theta=x/128*Math.PI*2;
        this.normalScratch.copy(basis.normal).multiplyScalar(Math.cos(a))
          .addScaledVector(basis.east,Math.cos(theta)*Math.sin(a)).addScaledVector(basis.north,Math.sin(theta)*Math.sin(a)).normalize();
        const p=this.normalScratch;
        const h=(sample?.(Math.asin(p.y)*180/Math.PI,Math.atan2(-p.z,p.x)*180/Math.PI).surfaceAltitudeM??0)
          +craterDisplacementM(a*state.targetRadiusM,state.craterRadiusM*presentationMultiplier,
            state.craterDepthM*presentationMultiplier,state.craterFormationProgress);
        const equatorial=state.targetEquatorialRadiusM/state.targetRadiusM,polar=state.targetPolarRadiusM/state.targetRadiusM;
        const surfaceRadius=1/Math.sqrt((p.x*p.x+p.z*p.z)/(equatorial*equatorial)+p.y*p.y/(polar*polar));
        this.surfaceScratch.copy(p).multiplyScalar(surfaceRadius+(h+2)/state.targetRadiusM);
        positions.setXYZ(y*129+x,this.surfaceScratch.x,this.surfaceScratch.y,this.surfaceScratch.z);
      }
      positions.needsUpdate=true;
    }
    this.ground.visible = this.groundVisible;
    this.atmospheric.visible = this.atmosphericVisible;
    this.root.visible = this.groundVisible || this.atmosphericVisible;
    this.surfaceConforming = this.groundVisible || (this.atmosphericVisible && !localBlast);
    this.surfaceAttachmentErrorM = 0;
    this.activeObjectCount = Number(this.groundVisible) + Number(this.atmosphericVisible);
  }

  public reset(): void {
    if (this.disposed) return;
    this.root.visible = false;
    this.ground.visible = false;
    this.atmospheric.visible = false;
    this.groundVisible = false;
    this.atmosphericVisible = false;
    this.groundAngularRadiusRad = 0;
    this.atmosphericAngularRadiusRad = 0;
    this.surfaceConforming = false;
    this.surfaceAttachmentErrorM = 0;
    this.activeObjectCount = 0;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.geometry.dispose();
    this.groundGeometry.dispose();
    this.groundMaterial.dispose();
    this.atmosphericMaterial.dispose();
    this.root.clear();
  }
}

function createWaveMaterial(color: number, atmospheric: boolean): ShaderMaterial {
  return new ShaderMaterial({
    depthTest: true,
    depthWrite: false,
    fragmentShader: `
      ${IMPACT_DEPTH_GLSL}
      uniform float uBurstMode;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      uniform vec3 uImpactDirection;
      uniform vec3 uColor;
      uniform float uAngularRadius;
      uniform float uOpacity;
      uniform float uAtmospheric;
      varying vec3 vBodyDirection;
      void main() {
        vec3 d=normalize(vBodyDirection),n=normalize(uImpactDirection);
        float angularDistance=atan(length(cross(d,n)),dot(d,n));
        float ringWidth = max(0.0000005, uAngularRadius * mix(0.01, 0.03, uAtmospheric));
        float ring = 1.0 - smoothstep(
          ringWidth,
          ringWidth * 1.8,
          abs(angularDistance - uAngularRadius)
        );
        float wake = uAtmospheric * (1.0 - smoothstep(
          ringWidth * 4.0,
          ringWidth * 12.0,
          abs(angularDistance - uAngularRadius)
        )) * 0.18;
        if (uBurstMode > 0.5) {
          ring = pow(1.0 - abs(dot(normalize(vViewNormal), normalize(-vViewPosition))), 32.0);
          wake = 0.0;
        }
        float alpha = (ring + wake) * uOpacity;
        if (alpha < 0.004) discard;
        if(uBurstMode>0.5 && uImpactDepthEnabled>0.5){
          vec2 uv=gl_FragCoord.xy/uImpactViewport;
          vec2 shift=normalize(vViewNormal.xy+vec2(0.0001))*ring*1.4/uImpactViewport;
          vec3 background=texture2D(uImpactColor,uv+shift).rgb;
          gl_FragColor=vec4(background, min(alpha*3.0,0.18));
        } else gl_FragColor = vec4(uColor * (0.68 + ring * 0.24), min(alpha, uAtmospheric>0.5?0.045:0.25));
      }
    `,
    toneMapped: false,
    transparent: true,
    uniforms: {
      ...impactDepthUniforms,
      uLocalGround: { value: 0 },
      uBurstMode: { value: 0 },
      uAngularRadius: { value: 0 },
      uAtmospheric: { value: atmospheric ? 1 : 0 },
      uAxisScale: { value: new Vector3(1, 1, 1) },
      uColor: { value: new Vector3(
        ((color >> 16) & 0xff) / 255,
        ((color >> 8) & 0xff) / 255,
        (color & 0xff) / 255,
      ) },
      uImpactDirection: { value: new Vector3(1, 0, 0) },
      uOpacity: { value: 0 },
      uSurfaceOffset: { value: 0 },
    },
    vertexShader: `
      uniform float uLocalGround;
      uniform float uBurstMode;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      uniform vec3 uAxisScale;
      uniform float uSurfaceOffset;
      varying vec3 vBodyDirection;
      void main() {
        vBodyDirection = normalize(position);
        vec3 bodyPosition = position * uAxisScale * (1.0 + uSurfaceOffset);
        if (uBurstMode > 0.5 || uLocalGround > 0.5) bodyPosition = position;
        vec4 viewPosition = modelViewMatrix * vec4(bodyPosition, 1.0);
        vViewPosition = viewPosition.xyz;
        vViewNormal = normalMatrix * normal;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
  });
}

function updateWaveMaterial(
  material: ShaderMaterial,
  state: Readonly<ImpactRenderState>,
  basis: Readonly<ImpactSurfaceBasis>,
  angularRadius: number,
  opacity: number,
  surfaceOffset: number,
): void {
  (material.uniforms.uAxisScale!.value as Vector3).set(
    state.targetEquatorialRadiusM / state.targetRadiusM,
    state.targetPolarRadiusM / state.targetRadiusM,
    state.targetEquatorialRadiusM / state.targetRadiusM,
  );
  (material.uniforms.uImpactDirection!.value as Vector3).copy(basis.normal);
  material.uniforms.uAngularRadius!.value = angularRadius;
  material.uniforms.uOpacity!.value = clampImpactUnit(opacity);
  material.uniforms.uSurfaceOffset!.value = surfaceOffset;
}
