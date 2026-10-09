import { PerspectiveCamera, Vector3 } from 'three';
import { NaturalSatelliteVisualSystem } from '../../rendering/satellites/NaturalSatelliteVisualSystem';
import { TrueRenderScale } from '../../rendering/TrueRenderScale';
import { PresentationRenderScale } from '../../rendering/PresentationRenderScale';
import type { RenderScaleModel } from '../../rendering/RenderScaleModel';

const width = 390, height = 580;
const zero = { x: 0, y: 0, z: 0 };
let system: NaturalSatelliteVisualSystem;
let container: HTMLDivElement;
let camera: PerspectiveCamera;

function frame(scale: RenderScaleModel = new TrueRenderScale(), parentId = 'neptune'): void {
  system.updateFrame({ currentJdTdb: 2461322.123456, originM: zero, originRevision: 0, trails: [], bodies: [
    { bodyId: parentId, displayName: parentId, kind: 'planet', meanRadiusM: 24_622_000,
      positionM: zero, velocityMps: zero, visible: true },
  ] }, scale, zero, parentId);
}
function dot(id = 'triton'): HTMLElement {
  return container.querySelector<HTMLElement>(`[data-satellite-id="${id}"].body-location-dot`)!;
}
function aim(position: Vector3, from: Vector3): void {
  camera.position.copy(from);
  camera.lookAt(position);
  camera.updateMatrixWorld(true);
  system.updateLabels(camera, width, height);
}
function viewMoon(id = 'triton', radiiAway = 1000): void {
  const position = system.getSatelliteWorldPosition(id)!;
  const side = new Vector3().crossVectors(position, new Vector3(0, 1, 0)).normalize();
  aim(position, position.clone().addScaledVector(side, system.getSatelliteRenderRadius(id)! * radiiAway));
}

beforeEach(() => {
  system = new NaturalSatelliteVisualSystem();
  container = document.createElement('div');
  system.setLabelContainer(container);
  camera = new PerspectiveCamera(50, width / height, 1e-10, 10000);
});
afterEach(() => system.dispose());

for (const scale of [new TrueRenderScale(), new PresentationRenderScale()]) {
  it(`marks a small Triton at its actual centre in ${scale.mode} scale, independently of names`, () => {
    frame(scale);
    const beforePosition = system.getSatelliteWorldPosition('triton');
    const beforeRadius = system.getSatelliteRenderRadius('triton');
    viewMoon();
    expect(Number(dot().style.opacity)).toBe(1);
    expect(dot().style.getPropertyValue('--body-dot-color')).toMatch(/^#[0-9a-f]{6}$/);
    const coordinates = dot().style.transform.match(/translate\(([-.0-9]+)px, ([-.0-9]+)px\)/)!;
    expect(Number(coordinates[1])).toBeCloseTo(width / 2, 5);
    expect(Number(coordinates[2])).toBeCloseTo(height / 2, 5);
    system.setLabelsVisible(false);
    system.updateLabels(camera, width, height, false, [{ left: 0, right: width, top: 0, bottom: height }]);
    expect(Number(dot().style.opacity)).toBe(1);
    expect(system.getSatelliteWorldPosition('triton')).toEqual(beforePosition);
    expect(system.getSatelliteRenderRadius('triton')).toBe(beforeRadius);
    viewMoon('triton', 20);
    expect(Number(dot().style.opacity)).toBe(0);
  });
}

it('hides an occulted moon but keeps the same moon visible in front of its planet', () => {
  frame();
  system.selectSatellite('triton');
  const position = system.getSatelliteWorldPosition('triton')!;
  aim(position, position.clone().multiplyScalar(-20));
  expect(Number(dot().style.opacity)).toBe(0);
  aim(position, position.clone().multiplyScalar(20));
  expect(Number(dot().style.opacity)).toBe(1);
  camera.lookAt(camera.position.clone().multiplyScalar(2));
  camera.updateMatrixWorld(true);
  system.updateLabels(camera, width, height);
  expect(Number(dot().style.opacity)).toBe(0);
});

it('keeps overview planet dots clear of unresolved moon clusters, except the selected moon', () => {
  frame();
  viewMoon('triton', 100000);
  expect(Number(dot().style.opacity)).toBe(0);
  system.selectSatellite('triton');
  system.updateLabels(camera, width, height);
  expect(Number(dot().style.opacity)).toBe(1);
});

it('respects layer and scenario visibility without leaving stale dots', () => {
  frame();
  viewMoon();
  expect(Number(dot().style.opacity)).toBe(1);
  system.updateLabels(camera, width, height, true);
  expect(Number(dot().style.opacity)).toBe(0);
  system.setScenarioOverlaysSuppressed(true);
  system.updateLabels(camera, width, height);
  expect(Number(dot().style.opacity)).toBe(0);
  system.setScenarioOverlaysSuppressed(false);
  system.setMajorVisible(false);
  system.updateLabels(camera, width, height);
  expect(Number(dot().style.opacity)).toBe(0);
  system.setMajorVisible(true);
  system.setVisible(false);
  system.updateLabels(camera, width, height);
  expect(Number(dot().style.opacity)).toBe(0);
});

it('reuses one marker for selected minor moons and removes it when deselected', () => {
  for (const id of ['saturn-minor-001', 'saturn-minor-002']) {
    system.selectSatellite(id);
    frame(new TrueRenderScale(), 'saturn');
    viewMoon(id);
    expect(Number(dot(id).style.opacity)).toBe(1);
    expect(container.querySelectorAll('[data-testid="selected-minor-moon-location-dot"]')).toHaveLength(1);
  }
  system.selectSatellite(null);
  system.updateLabels(camera, width, height);
  expect(Number(dot('saturn-minor-002').style.opacity)).toBe(0);
});

it('does not duplicate dots on container replacement and removes them on disposal', () => {
  const initialCount = container.querySelectorAll('.body-location-dot').length;
  expect(initialCount).toBeGreaterThan(10);
  system.setLabelContainer(container);
  expect(container.querySelectorAll('.body-location-dot')).toHaveLength(initialCount);
  const replacement = document.createElement('div');
  system.setLabelContainer(replacement);
  expect(container.children).toHaveLength(0);
  expect(replacement.querySelectorAll('.body-location-dot')).toHaveLength(initialCount);
  system.setLabelContainer(null);
  expect(replacement.children).toHaveLength(0);
  system.setLabelContainer(container);
  system.dispose();
  expect(container.children).toHaveLength(0);
});
