// Local CC0 HDRI, provenance and checksums: research/hdri-monochrome-studio-02.json.
export const studioEnvironment = {
  id: 'monochrome_studio_02',
  url: import.meta.env.BASE_URL + 'assets/environment/monochrome_studio_02_2k.hdr',
  intensity: .65,
  // Turn the large softboxes away from the front lacquer.
  rotationY: Math.PI * 1.5,
} as const;
