import { MeshStandardMaterial, type Mesh, ShaderLib, Vector3, type WebGLRenderer } from 'three';
import { attachMoonSunlight, updateMoonSunlight } from '../../rendering/satellites/MoonSunlight';
import { NaturalSatelliteVisualSystem } from '../../rendering/satellites/NaturalSatelliteVisualSystem';
import { getNaturalSatelliteDefinition } from '../../simulation/satellites/NaturalSatelliteCatalog';
import { sampleNaturalSatellite } from '../../simulation/satellites/NaturalSatelliteProvider';
import { TrueRenderScale } from '../../rendering/TrueRenderScale';
import { PresentationRenderScale } from '../../rendering/PresentationRenderScale';

it('keeps the physical Sun direction when distance changes, including the scene Y-up mapping', () => {
  const light = attachMoonSunlight(new MeshStandardMaterial());
  updateMoonSunlight(light, {x: 3e11, y: 4e11, z: 12e11}, false);
  expect(light.directionWorld.value.toArray()).toEqual([3/13, 12/13, -4/13]);
  const direction = light.directionWorld.value.clone();
  updateMoonSunlight(light, {x: 3e9, y: 4e9, z: 12e9}, false);
  expect(light.directionWorld.value.distanceTo(direction)).toBeLessThan(1e-15);
  expect(light.visibility.value).toBe(1);
});
it('removes direct sunlight in an eclipse and restores it afterwards, without NaNs for a missing Sun', () => {
  const light = attachMoonSunlight(new MeshStandardMaterial());
  updateMoonSunlight(light, {x: 1, y: 0, z: 0}, true);
  expect(light.visibility.value).toBe(0);
  updateMoonSunlight(light, {x: 1, y: 0, z: 0}, false);
  expect(light.visibility.value).toBe(1);
  updateMoonSunlight(light, {x: 0, y: 0, z: 0}, false);
  expect(light.visibility.value).toBe(0);
  expect(light.directionWorld.value.length()).toBe(1);
});
for (const scale of [new TrueRenderScale(), new PresentationRenderScale()]) {
  it(`uses the moon's physical position and parent eclipse, independent of render origin in ${scale.mode}`, () => {
    const system = new NaturalSatelliteVisualSystem();
    try {
      const jd = 2461323.3, zero = { x:0, y:0, z:0 };
      const definition = getNaturalSatelliteDefinition('triton')!;
      const p = sampleNaturalSatellite(definition,jd).positionM;
      const mesh = system.root.getObjectByName('natural-satellite-triton') as Mesh;
      const material = mesh.material as MeshStandardMaterial;
      const shader = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader, uniforms: {} } as Parameters<typeof material.onBeforeCompile>[0];
      material.onBeforeCompile(shader, {} as WebGLRenderer);
      const uniforms = shader.uniforms as Record<string, { value: number | Vector3 }>;
      const update = (side:number, origin=zero) => system.updateFrame({currentJdTdb:jd,originM:origin,originRevision:0,trails:[],bodies:[
        {bodyId:'neptune',displayName:'Neptune',kind:'planet',meanRadiusM:24622000,positionM:zero,velocityMps:zero,visible:true},
        {bodyId:'sun',displayName:'Sun',kind:'star',meanRadiusM:695700000,positionM:{x:p.x*side*10000,y:p.y*side*10000,z:p.z*side*10000},velocityMps:zero,visible:true},
      ]}, scale, origin, 'neptune');
      update(1);
      expect(uniforms.uMoonSunVisibility!.value).toBe(1);
      const direction = (uniforms.uMoonSunDirection!.value as Vector3).clone();
      const expected = new Vector3(p.x,p.z,-p.y).normalize();
      expect(direction.distanceTo(expected)).toBeLessThan(1e-14);
      update(1,{x:1e12,y:-2e12,z:3e12});
      expect((uniforms.uMoonSunDirection!.value as Vector3).distanceTo(direction)).toBeLessThan(1e-14);
      update(-1);
      expect(uniforms.uMoonSunVisibility!.value).toBe(0);
      update(1);
      expect(uniforms.uMoonSunVisibility!.value).toBe(1);
    } finally { system.dispose(); }
  });
}
