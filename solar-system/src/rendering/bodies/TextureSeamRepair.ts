/**
 * Repair only a declared invalid left gutter in a wrapping RGBA raster.
 * Interpolation joins the last valid longitude to the first valid longitude.
 * Dimensions, longitude registration, alpha and every other column stay intact.
 */
export function repairLongitudeGutter(
  image: Pick<ImageData, 'data' | 'width' | 'height'>,
  invalidColumns: number,
): void {
  const { data, width, height } = image;
  if (!Number.isInteger(invalidColumns) || invalidColumns < 1 ||
      invalidColumns > width - 2 || data.length !== width * height * 4) {
    throw new RangeError('Longitude repair requires an RGBA raster and a bounded left gutter.');
  }
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    const left = row + (width - 1) * 4;
    const right = row + invalidColumns * 4;
    for (let x = 0; x < invalidColumns; x += 1) {
      const mix = (x + 1) / (invalidColumns + 1);
      for (let channel = 0; channel < 3; channel += 1) {
        data[row + x * 4 + channel] = Math.round(
          data[left + channel]! * (1 - mix) + data[right + channel]! * mix,
        );
      }
    }
  }
}

/** Repair before GPU upload so mipmaps cannot retain the bright source gutter. */
export function createSeamRepairedImage(
  source: HTMLImageElement,
  invalidColumns: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.naturalWidth || source.width;
  canvas.height = source.naturalHeight || source.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) throw new Error('Texture seam repair requires a 2D canvas context.');
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  repairLongitudeGutter(image, invalidColumns);
  context.putImageData(image, 0, 0);
  return canvas;
}
