import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { repairLongitudeGutter } from '../../rendering/bodies/TextureSeamRepair';
import { BODY_TEXTURE_ASSETS } from '../../rendering/bodies/AssetCatalog';

describe('longitude gutter repair', () => {
  it('repairs the actual Mars source edge without shifting or changing other columns', async () => {
    const mars = BODY_TEXTURE_ASSETS.find((asset) => asset.bodyId === 'mars' && asset.channel === 'albedo')!;
    expect(mars.invalidLeftGutterPixels).toBe(1);
    const encoded = await readFile('public/assets/phase4/mars.jpg');
    const { data, info } = await sharp(encoded).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const repaired = new Uint8ClampedArray(data);
    repairLongitudeGutter({ data: repaired, width: info.width, height: info.height }, 1);
    let beforeJump = 0, afterJump = 0;
    for (let y = 0; y < info.height; y += 1) {
      const row = y * info.width * 4;
      expect(Buffer.from(repaired.buffer, row + 4, (info.width - 1) * 4).equals(
        data.subarray(row + 4, row + info.width * 4),
      )).toBe(true);
      expect(repaired[row + 3]).toBe(data[row + 3]);
      for (let c = 0; c < 3; c += 1) {
        const left = data[row + (info.width - 1) * 4 + c]!;
        const right = data[row + 4 + c]!;
        expect(repaired[row + c]).toBe(Math.round((left + right) / 2));
        beforeJump += Math.abs(data[row + c]! - right);
        afterJump += Math.abs(repaired[row + c]! - right);
      }
    }
    expect(beforeJump / (info.height * 3)).toBeGreaterThan(60);
    expect(afterJump).toBeLessThan(beforeJump * 0.05);
    expect(BODY_TEXTURE_ASSETS.filter((asset) => asset.invalidLeftGutterPixels !== undefined))
      .toEqual([mars]);
  });

  it('rejects invalid gutter dimensions instead of overwriting the map', () => {
    const image = { width: 4, height: 1, data: new Uint8ClampedArray(16) };
    for (const invalid of [-1, 0, 0.5, 3, 4]) {
      expect(() => repairLongitudeGutter(image, invalid)).toThrow(RangeError);
    }
  });
});
