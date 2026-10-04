/** Compose a fresh WebGL frame and visible DOM annotations without a new renderer. */
export async function exportSceneImage(scene: HTMLCanvasElement, surface: HTMLCanvasElement, lines: readonly string[]): Promise<Blob> {
  const rect = surface.getBoundingClientRect();
  const ratio = Math.min(2, 2048 / Math.max(1, rect.width));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx || rect.width < 1 || rect.height < 1) throw new Error('The scene is not available for export.');
  const width = Math.round(rect.width);
  ctx.font = '13px sans-serif';
  const wrapped = lines.flatMap(line => wrapLine(ctx, line, Math.max(100, width - 32)));
  const footer = 34 + wrapped.length * 20;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round((rect.height + footer) * ratio);
  ctx.scale(ratio, ratio);
  ctx.fillStyle = '#020509'; ctx.fillRect(0, 0, width, rect.height);
  ctx.drawImage(scene, 0, 0, width, rect.height);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, width, rect.height); ctx.clip();
  const layer = surface.parentElement;
  for (const dot of layer?.querySelectorAll<HTMLElement>('.body-location-dot') ?? []) {
    const css = getComputedStyle(dot), r = dot.getBoundingClientRect();
    if (css.visibility === 'hidden' || css.display === 'none' || Number(css.opacity) === 0 || r.width === 0) continue;
    ctx.globalAlpha = Number(css.opacity); ctx.fillStyle = css.backgroundColor;
    ctx.beginPath(); ctx.arc(r.x - rect.x + r.width / 2, r.y - rect.y + r.height / 2, r.width / 2, 0, Math.PI * 2); ctx.fill();
  }
  for (const label of layer?.querySelectorAll<HTMLElement>('.body-screen-label, .natural-satellite-screen-label, .space-object-screen-label') ?? []) {
    const css = getComputedStyle(label);
    const textElement = label.querySelector<HTMLElement>('span') ?? label;
    const r = textElement.getBoundingClientRect();
    if (css.visibility === 'hidden' || css.display === 'none' || Number(css.opacity) === 0 || r.width === 0) continue;
    const textCss = getComputedStyle(textElement);
    ctx.font = `${textCss.fontWeight} ${textCss.fontSize} ${textCss.fontFamily}`;
    let text = textElement.textContent?.trim() ?? '';
    while (text.length > 1 && ctx.measureText(text).width > r.width) text = text.slice(0, -2) + '…';
    ctx.globalAlpha = Number(css.opacity); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = '#02080e'; ctx.lineJoin = 'round';
    const x = r.x - rect.x + r.width / 2, y = r.y - rect.y + r.height / 2;
    ctx.strokeText(text, x, y); ctx.fillStyle = css.color; ctx.fillText(text, x, y);
  }
  ctx.restore(); ctx.globalAlpha = 1; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#091521'; ctx.fillRect(0, rect.height, width, footer);
  ctx.fillStyle = '#e0edf4'; ctx.font = '13px sans-serif';
  wrapped.forEach((line, i) => ctx.fillText(line, 16, rect.height + 25 + i * 20));
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed. Please try again.')), 'image/png'));
}
function wrapLine(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []; let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
