import { Matrix4, type InstancedMesh } from 'three';
import { describe, expect, it } from 'vitest';
import { SpaceObjectVisualSystem } from '../../rendering/spaceobjects/SpaceObjectVisualSystem';
import { TrueRenderScale } from '../../rendering/TrueRenderScale';
import { PresentationRenderScale } from '../../rendering/PresentationRenderScale';
import { SPACECRAFT_DEFINITIONS } from '../../simulation/spacecraft';
import { EARTH_SATELLITE_DEFINITIONS } from '../../simulation/artificial';
import type { DebugRenderFrame } from '../../rendering/RenderContext';

const origin = { x: 0, y: 0, z: 0 };
function frame(jd: number): DebugRenderFrame {
  return { currentJdTdb: jd, originM: origin, originRevision: 0, trails: [], bodies: [{
    bodyId: 'earth', displayName: 'Earth', kind: 'planet', meanRadiusM: 6371008.4,
    positionM: { x: 149597870700, y: 0, z: 0 }, velocityMps: origin, visible: true,
  }] };
}
function visibleMarkers(system: SpaceObjectVisualSystem, name: string): number {
  const mesh = system.root.getObjectByName(name) as InstancedMesh;
  const matrix = new Matrix4();
  let count = 0;
  for (let index = 0; index < mesh.count; index++) {
    mesh.getMatrixAt(index, matrix);
    if (matrix.elements[0]! > 0) count++;
  }
  return count;
}

describe('space object locator visibility', () => {
  for (const scale of [new TrueRenderScale(), new PresentationRenderScale()]) {
    it(`shows only the chosen probe, retains navigation data and clears it on deselection (${scale.mode})`, () => {
      const system = new SpaceObjectVisualSystem();
      try {
        const mission = SPACECRAFT_DEFINITIONS.find(item => item.id === 'psyche')!;
        const snapshot = frame((mission.validStartJdTdb + mission.validEndJdTdb) / 2);
        system.updateFrame(snapshot, scale, origin);
        expect(visibleMarkers(system, 'spacecraft-probe-markers')).toBe(0);
        expect(system.getObjectWorldPosition(mission.id)).not.toBeNull();
        system.selectObject(mission.id);
        system.updateFrame(snapshot, scale, origin);
        expect(visibleMarkers(system, 'spacecraft-probe-markers')).toBe(1);
        expect(system.getDiagnostics().selectedTrajectoryPointCount).toBe(128);
        system.selectObject(null);
        system.updateFrame(snapshot, scale, origin);
        expect(visibleMarkers(system, 'spacecraft-probe-markers')).toBe(0);
        expect(system.getDiagnostics().selectedTrajectoryPointCount).toBe(0);
      } finally { system.dispose(); }
    });
  }
  it('does not scatter unrelated satellite locators around Earth', () => {
    const system = new SpaceObjectVisualSystem();
    try {
      const satellite = EARTH_SATELLITE_DEFINITIONS.find(item => item.id !== 'earth-satellite-25544')!;
      const snapshot = frame(satellite.elementEpochJdTdb);
      const scale = new TrueRenderScale();
      system.updateFrame(snapshot, scale, origin);
      expect(visibleMarkers(system, 'earth-satellite-markers')).toBe(0);
      system.selectObject(satellite.id);
      system.updateFrame(snapshot, scale, origin);
      expect(visibleMarkers(system, 'earth-satellite-markers')).toBe(1);
      expect(system.getDiagnostics().selectedTrajectoryPointCount).toBe(96);
    } finally { system.dispose(); }
  });
});
