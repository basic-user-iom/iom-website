import { test, expect } from '@playwright/test';
import type { WebGLRenderer } from 'three';
import type { PrecisionLine } from '../src/rendering/PrecisionPath';

test('Voyager trajectory stays attached during wheel damping and uses the current frame GPU buffer', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1500, height: 950 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    const events = new EventTarget();
    const samples: { pixels: number; bufferError: number; segments: number; viewSpaceShader: boolean }[] = [];
    Object.assign(window, { __THREE_DEVTOOLS__: events, __orbitSamples: samples });
    events.addEventListener('observe', event => {
      const renderer = (event as CustomEvent<WebGLRenderer>).detail;
      if (!('isWebGLRenderer' in renderer)) return;
      const render = renderer.render;
      renderer.render = function (scene, camera) {
        const line = scene.getObjectByName('spacecraft-selected-trajectory') as PrecisionLine | undefined;
        if (line?.path && line.visible) line.onAfterRender = () => {
          const gl = renderer.getContext() as WebGL2RenderingContext;
          const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
          const vertexShader = gl.getAttachedShaders(program)!.find(shader => gl.getShaderParameter(shader, gl.SHADER_TYPE) === gl.VERTEX_SHADER)!;
          const viewSpaceShader = gl.getShaderSource(vertexShader)!.includes('vec4 mvPosition = vec4(position, 1.0)');
          const location = gl.getAttribLocation(program, 'position');
          const buffer = gl.getVertexAttrib(location, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING) as WebGLBuffer;
          const saved = gl.getParameter(gl.COPY_READ_BUFFER_BINDING) as WebGLBuffer | null;
          gl.bindBuffer(gl.COPY_READ_BUFFER, buffer);
          const count = line.geometry.drawRange.count;
          const gpu = new Float32Array(count * 3);
          gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, gpu);
          gl.bindBuffer(gl.COPY_READ_BUFFER, saved);
          const center = line.path.anchor.clone().project(camera);
          let pixels = Infinity;
          let bufferError = 0;
          for (let i = 0; i < gpu.length; i += 1) bufferError = Math.max(bufferError, Math.abs(gpu[i]! - line.path.segments[i]!));
          for (let i = 0; i < gpu.length; i += 3) {
            const point = line.path.anchor.clone().set(gpu[i]!, gpu[i + 1]!, gpu[i + 2]!).applyMatrix4(camera.projectionMatrix);
            pixels = Math.min(pixels, Math.hypot((point.x - center.x) * renderer.domElement.clientWidth / 2, (point.y - center.y) * renderer.domElement.clientHeight / 2));
          }
          if (samples.length < 1000) samples.push({ pixels, bufferError, segments: count / 2, viewSpaceShader });
        };
        return render.call(this, scene, camera);
      };
    });
  });
  await page.goto(process.env.SOLAR_SYSTEM_VERIFY_URL ?? './');
  const canvas = page.getByTestId('solar-system-canvas');
  await expect(canvas).toHaveAttribute('data-asset-state', 'ready', { timeout: 60_000 });
  for (const id of ['voyager-1', 'voyager-2']) {
    await page.locator('#body-search').fill(id.replace('-', ' '));
    await page.getByTestId('navigator-catalog-spacecraft-' + id).click();
    await expect(canvas).toHaveAttribute('data-voyager-model-state', 'ready', { timeout: 30_000 });
    await expect(canvas).toHaveAttribute('data-space-object-detailed-inspection', id);
    await page.evaluate(() => (window as unknown as { __orbitSamples: unknown[] }).__orbitSamples.splice(0));
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
    for (const delta of [-700, -600, -500, 1000, 800, -400]) {
      await page.mouse.wheel(0, delta);
      await page.waitForTimeout(180);
    }
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.68, box.y + box.height * 0.56, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    await canvas.screenshot({ path: info.outputPath(id + '-trajectory.png') });
    const samples = await page.evaluate(() => (window as unknown as { __orbitSamples: { pixels: number; bufferError: number; segments: number; viewSpaceShader: boolean }[] }).__orbitSamples);
    expect(samples.length).toBeGreaterThan(10);
    expect(Math.max(...samples.map(s => s.bufferError))).toBe(0);
    expect(Math.max(...samples.map(s => s.pixels))).toBeLessThan(1);
    // Distant curved portions can enter the frustum too; the number of segments is not fixed.
    expect(samples.every(s => s.segments >= 1 && s.viewSpaceShader)).toBe(true);
    console.log(JSON.stringify({ id, frames: samples.length, maxPixelError: Math.max(...samples.map(s => s.pixels)), maxGpuBufferError: Math.max(...samples.map(s => s.bufferError)) }));
    await info.attach(id + '-trajectory-metrics', { body: JSON.stringify(samples), contentType: 'application/json' });
  }
  expect(errors).toEqual([]);
});
