import { Group, Mesh, Vector3, PerspectiveCamera, Scene, ShaderMaterial, SphereGeometry, type WebGLRenderer } from 'three';
import { ImpactDepthPass } from '../../rendering/impact/ImpactDepthPass';
import { impactDepthUniforms as u } from '../../rendering/impact/ImpactDepthContext';

describe('Impact Lab depth composition',()=>{
  it('renders opaque geometry once, unbinds feedback textures and restores the scene',()=>{
    const scene=new Scene(),impact=new Group(),camera=new PerspectiveCamera();
    impact.name='impact-lab-target-local-layer';scene.add(impact);
    const atmo=new Mesh(new SphereGeometry(),new ShaderMaterial({transparent:true,uniforms:{uShellRadius:{value:1.01}}}));
    atmo.renderOrder=10;scene.add(atmo);
    let target:unknown=null;
    const render=vi.fn(()=>{
      expect(atmo.visible).toBe(false);
      expect(u.uImpactDepth.value).toBeNull();
      expect(u.uImpactColor.value).toBeNull();
    });
    const renderer={getRenderTarget:()=>target,setRenderTarget:(next:unknown)=>{target=next;},clear:vi.fn(),render,autoClear:false} as unknown as WebGLRenderer;
    const pass=new ImpactDepthPass();
    pass.render(renderer,scene,camera,640,360,false);
    expect(render).toHaveBeenCalledTimes(1);
    expect(target).toBeNull();expect(atmo.visible).toBe(true);expect(atmo.renderOrder).toBe(6);
    expect(u.uImpactDepthEnabled.value).toBe(1);
    expect(u.uImpactViewport.value.toArray()).toEqual([640,360]);
    pass.reset();expect(atmo.renderOrder).toBe(10);expect(u.uImpactDepthEnabled.value).toBe(0);
    pass.dispose();atmo.geometry.dispose();atmo.material.dispose();
  });
  it('restores visibility and render target when an opaque render fails',()=>{
    const scene=new Scene(),impact=new Group(),camera=new PerspectiveCamera();
    impact.name='impact-lab-target-local-layer';scene.add(impact);
    const plume=new Mesh(new SphereGeometry(),new ShaderMaterial({transparent:true}));scene.add(plume);
    const original={name:'original'};let target:unknown=original;
    const renderer={getRenderTarget:()=>target,setRenderTarget:(next:unknown)=>{target=next;},clear:vi.fn(),
      render:()=>{throw new Error('context failure');},autoClear:false} as unknown as WebGLRenderer;
    const pass=new ImpactDepthPass();
    expect(()=>pass.render(renderer,scene,camera,100,100,false)).toThrow('context failure');
    expect(plume.visible).toBe(true);expect(target).toBe(original);expect(renderer.autoClear).toBe(false);
    expect(u.uImpactDepthEnabled.value).toBe(0);
    pass.dispose();plume.geometry.dispose();plume.material.dispose();
  });
});

it('suppresses stars in daytime air, keeps the night sky, and restores orbital visibility', () => {
  const scene = new Scene(), planet = new Group(), impact = new Group(), camera = new PerspectiveCamera();
  planet.position.set(10, 20, 30); planet.scale.setScalar(0.001);
  scene.add(planet); planet.add(impact); impact.name = 'impact-lab-target-local-layer';
  const atmosphere = new Mesh(new SphereGeometry(), new ShaderMaterial({transparent:true,
    uniforms:{uShellRadius:{value:1.01},uSunDirectionWorld:{value:new Vector3(1,0,0)}}}));
  atmosphere.name = 'phase-4-earth-atmosphere'; planet.add(atmosphere);
  scene.updateMatrixWorld(true);
  let target:unknown = null;
  const renderer = {getRenderTarget:()=>target,setRenderTarget:(next:unknown)=>{target=next;},
    clear:vi.fn(),render:vi.fn(),autoClear:true} as unknown as WebGLRenderer;
  const pass = new ImpactDepthPass();
  camera.position.set(10.001001, 20, 30); camera.updateMatrixWorld();
  pass.render(renderer,scene,camera,100,100,false);
  expect(u.uImpactSkyVisibility.value).toBe(0);
  camera.position.set(9.998999, 20, 30); camera.updateMatrixWorld();
  pass.render(renderer,scene,camera,100,100,false);
  expect(u.uImpactSkyVisibility.value).toBe(1);
  camera.position.set(10.002,20,30); camera.updateMatrixWorld();
  pass.render(renderer,scene,camera,100,100,false);
  expect(u.uImpactSkyVisibility.value).toBe(1);
  pass.reset(); expect(u.uImpactSkyVisibility.value).toBe(1);
  pass.dispose(); atmosphere.geometry.dispose(); atmosphere.material.dispose();
});
