import type { VehicleBeamProxy } from '../persistence/schema'

/**
 * Author-locked beam seats (placement-local metres) for the grounded Lixiang demo.
 * Pasted from the Studio "Copy positions" clipboard — replaces auto body-frame seats
 * for new projects and Reset auto.
 */
export const DEFAULT_BEAM_PROXIES: VehicleBeamProxy[] = [
  {
    id: 'auto-drl-0',
    groupId: 'drl',
    position: { x: 1.706, y: 0.405, z: 1.992 },
    target: { x: 2.292, y: 0.065, z: 3.343 },
  },
  {
    id: 'auto-drl-1',
    groupId: 'drl',
    position: { x: 0.753, y: 0.497, z: 2.463 },
    target: { x: 1.115, y: 0.014, z: 3.85 },
  },
  {
    id: 'auto-highBeam-0',
    groupId: 'highBeam',
    position: { x: 1.411, y: 0.85, z: 1.637 },
    target: { x: 8.141, y: 0.515, z: 11.864 },
  },
  {
    id: 'auto-highBeam-1',
    groupId: 'highBeam',
    position: { x: 0.518, y: 0.892, z: 2.097 },
    target: { x: 5.001, y: 0.518, z: 13.487 },
  },
  {
    id: 'auto-lowBeam-0',
    groupId: 'lowBeam',
    position: { x: 1.546, y: 0.67, z: 1.37 },
    target: { x: 3.761, y: 0.081, z: 5.403 },
  },
  {
    id: 'auto-lowBeam-1',
    groupId: 'lowBeam',
    position: { x: 0.237, y: 0.67, z: 2.119 },
    target: { x: 1.904, y: 0.045, z: 6.402 },
  },
  {
    id: 'auto-reverse-0',
    groupId: 'reverse',
    position: { x: -1.013, y: 0.602, z: -1.896 },
    target: { x: -1.013, y: 0, z: -4.4 },
  },
]

const BEAM_LINE =
  /^(drl|lowBeam|highBeam|reverse)\s+id=(\S+)\s+pos=([-\d.]+),([-\d.]+),([-\d.]+)\s+aim=([-\d.]+),([-\d.]+),([-\d.]+)\s*$/

/** Parse the Studio "Copy positions" clipboard block into beam proxies. */
export function parseBeamPlacementsClipboard(text: string): VehicleBeamProxy[] {
  const out: VehicleBeamProxy[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = BEAM_LINE.exec(line)
    if (!m) continue
    out.push({
      id: m[2],
      groupId: m[1] as VehicleBeamProxy['groupId'],
      position: { x: Number(m[3]), y: Number(m[4]), z: Number(m[5]) },
      target: { x: Number(m[6]), y: Number(m[7]), z: Number(m[8]) },
    })
  }
  return out
}
