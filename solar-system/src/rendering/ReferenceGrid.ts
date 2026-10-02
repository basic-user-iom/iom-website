import { GridHelper, LineBasicMaterial } from 'three';
import { PrecisionLine } from './PrecisionPath';

/** Keep AU-wide guide lines stable when the camera is metres from a target. */
export function createReferenceGrid(): PrecisionLine {
  const template = new GridHelper(80, 40, 0x214563, 0x102338);
  const position = template.geometry.getAttribute('position');
  const color = template.geometry.getAttribute('color');
  const grid = new PrecisionLine(position.count, new LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.18, depthWrite: false,
  }), 'segments');
  grid.name = 'observatory-reference-grid';
  for (let i = 0; i < position.count; i++) {
    grid.path.positions.set([position.getX(i), position.getY(i), position.getZ(i)], i * 3);
    grid.path.colors.set([color.getX(i), color.getY(i), color.getZ(i)], i * 3);
  }
  template.geometry.dispose();
  template.material.dispose();
  return grid;
}
