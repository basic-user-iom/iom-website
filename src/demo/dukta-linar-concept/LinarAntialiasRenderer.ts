import {
  Color,
  HalfFloatType,
  Matrix4,
  NoBlending,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'

type Options = { software: boolean; compact: boolean }
export type LinarRenderDiagnostics = {
  mode: 'motion' | 'refining' | 'settled' | 'fallback'
  msaaSamples: number
  accumulatedSamples: number
  targetSamples: number
  width: number
  height: number
  sceneRenders: number
  sceneDrawCalls: number
}

/**
 * MSAA while moving; bounded subpixel accumulation only after the scene stops.
 * Each refinement frame renders the geometry once. No history from a previous
 * pose survives interaction, so thin lamellas and the light orb cannot ghost.
 */
export function createLinarAntialiasRenderer(renderer: WebGLRenderer, options: Options) {
  const diagnostics: LinarRenderDiagnostics = {
    mode: 'motion', msaaSamples: 0, accumulatedSamples: 0,
    targetSamples: options.software || options.compact ? 8 : 16,
    width: 0, height: 0, sceneRenders: 0, sceneDrawCalls: 0,
  }
  // Averaging in an 8-bit HDR buffer would clip the bright rear-light study.
  // Retain direct tone-mapped rendering if floating-point targets are absent.
  if (!renderer.extensions.has('EXT_color_buffer_float')) {
    diagnostics.mode = 'fallback'
    return {
      diagnostics,
      needsRefinement: (_now: number) => false,
      render(scene: Scene, camera: PerspectiveCamera, _moving: boolean, _now: number) {
        renderer.render(scene, camera)
      },
      dispose() {},
    }
  }

  const gl = renderer.getContext() as WebGL2RenderingContext
  const supportedSamples = Array.from(
    gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES) as Int32Array ?? [],
  )
  const desiredSamples = options.software ? 0 : options.compact ? 2 : 4
  const samples = Math.max(0, ...supportedSamples.filter(n => n <= desiredSamples))
  diagnostics.msaaSamples = samples

  // Software WebGL uses one depth sample, preserving the opaque felt fix.
  // Hardware MSAA belongs on this scene target, not on the final canvas quad.
  const frame = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType, samples, depthBuffer: true, stencilBuffer: false,
  })
  frame.texture.name = 'LINAR scene samples'
  const history = [0, 1].map(index => {
    const target = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType, depthBuffer: false, stencilBuffer: false,
    })
    target.texture.name = `LINAR settled samples ${index}`
    return target
  })
  const blend = new ShaderMaterial({
    name: 'LINAR linear sample average',
    uniforms: {
      currentSample: { value: frame.texture },
      previousSamples: { value: history[0].texture },
      sampleWeight: { value: 1 },
    },
    vertexShader: `varying vec2 sampleUv;
      void main() { sampleUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `varying vec2 sampleUv;
      uniform sampler2D currentSample;
      uniform sampler2D previousSamples;
      uniform float sampleWeight;
      void main() {
        vec4 current = texture2D(currentSample, sampleUv);
        if (sampleWeight >= 1.0) { gl_FragColor = current; }
        else { gl_FragColor = mix(texture2D(previousSamples, sampleUv), current, sampleWeight); }
      }`,
    depthTest: false, depthWrite: false, blending: NoBlending, toneMapped: false,
  })
  const quad = new FullScreenQuad(blend)
  const display = new ShaderMaterial({
    name: 'LINAR display composite',
    uniforms: {
      image: { value: frame.texture },
      backdrop: { value: new Color() },
      compositeBackdrop: { value: false },
    },
    vertexShader: blend.vertexShader,
    fragmentShader: `varying vec2 sampleUv;
      uniform sampler2D image;
      uniform vec3 backdrop;
      uniform bool compositeBackdrop;
      void main() {
        vec4 sampleColor = texture2D(image, sampleUv);
        // The transparent HDR buffer stores coverage-premultiplied samples.
        // Unpremultiply before tone mapping so narrow openings keep their tone.
        vec3 radiance = compositeBackdrop
          ? sampleColor.rgb / max(sampleColor.a, 0.00001) : sampleColor.rgb;
        gl_FragColor = vec4(radiance, sampleColor.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        if (compositeBackdrop) {
          vec3 paper = linearToOutputTexel(vec4(backdrop, 1.0)).rgb;
          gl_FragColor = vec4(mix(paper, gl_FragColor.rgb, sampleColor.a), 1.0);
        }
      }`,
    depthTest: false, depthWrite: false, blending: NoBlending, toneMapped: true,
  })
  const output = new FullScreenQuad(display)
  const clearColor = new Color()
  const size = new Vector2()
  const projection = new Matrix4()
  const inverseProjection = new Matrix4()
  let readIndex = 0
  let lastMotionAt = 0
  let contextLost = false
  let disposed = false

  const reset = () => {
    diagnostics.accumulatedSamples = 0
    diagnostics.mode = 'motion'
  }
  const onContextLost = () => { contextLost = true; reset() }
  const onContextRestored = () => { contextLost = false; reset() }
  renderer.domElement.addEventListener('webglcontextlost', onContextLost)
  renderer.domElement.addEventListener('webglcontextrestored', onContextRestored)

  // A stratified sequence spans one output pixel without changing camera pose.
  const halton = (index: number, base: number) => {
    let value = 0, fraction = 1
    while (index > 0) {
      fraction /= base
      value += fraction * (index % base)
      index = Math.floor(index / base)
    }
    return value - 0.5
  }

  return {
    diagnostics,
    needsRefinement(now: number) {
      return !disposed && !contextLost &&
        diagnostics.accumulatedSamples < diagnostics.targetSamples && now - lastMotionAt >= 120
    },
    render(scene: Scene, camera: PerspectiveCamera, moving: boolean, now: number) {
      if (disposed || contextLost) return
      renderer.getDrawingBufferSize(size)
      if (size.x !== diagnostics.width || size.y !== diagnostics.height) {
        frame.setSize(size.x, size.y)
        for (const target of history) target.setSize(size.x, size.y)
        diagnostics.width = size.x
        diagnostics.height = size.y
        reset()
        moving = true
      }
      if (moving) { lastMotionAt = now; reset() }
      const settled = !moving && now - lastMotionAt >= 120
      const refine = settled && diagnostics.accumulatedSamples < diagnostics.targetSamples
      const previousTarget = renderer.getRenderTarget()
      const previousAutoClear = renderer.autoClear
      const previousBackground = scene.background
      const previousAlpha = renderer.getClearAlpha()
      renderer.getClearColor(clearColor)
      const compositeBackdrop = previousBackground instanceof Color
      display.uniforms.compositeBackdrop.value = compositeBackdrop
      if (compositeBackdrop) display.uniforms.backdrop.value.copy(previousBackground)
      projection.copy(camera.projectionMatrix)
      inverseProjection.copy(camera.projectionMatrixInverse)
      try {
        renderer.autoClear = true
        if (!settled || refine) {
          if (refine) {
            const index = diagnostics.accumulatedSamples + 1
            camera.projectionMatrix.elements[8] += 2 * halton(index, 2) / size.x
            camera.projectionMatrix.elements[9] += 2 * halton(index, 3) / size.y
            camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
          }
          if (compositeBackdrop) {
            scene.background = null
            renderer.setClearColor(0x000000, 0)
          }
          renderer.setRenderTarget(frame)
          renderer.render(scene, camera)
          scene.background = previousBackground
          renderer.setClearColor(clearColor, previousAlpha)
          diagnostics.sceneRenders += 1
          diagnostics.sceneDrawCalls = renderer.info.render.calls
        }
        if (refine) {
          const writeIndex = 1 - readIndex
          blend.uniforms.previousSamples.value = history[readIndex].texture
          blend.uniforms.sampleWeight.value = 1 / (diagnostics.accumulatedSamples + 1)
          renderer.setRenderTarget(history[writeIndex])
          quad.render(renderer)
          readIndex = writeIndex
          diagnostics.accumulatedSamples += 1
          diagnostics.mode = diagnostics.accumulatedSamples === diagnostics.targetSamples ? 'settled' : 'refining'
        }
        // Tone mapping / sRGB conversion happen exactly once, after averaging.
        display.uniforms.image.value = (settled ? history[readIndex] : frame).texture
        renderer.setRenderTarget(null)
        output.render(renderer)
      } finally {
        camera.projectionMatrix.copy(projection)
        camera.projectionMatrixInverse.copy(inverseProjection)
        renderer.autoClear = previousAutoClear
        scene.background = previousBackground
        renderer.setClearColor(clearColor, previousAlpha)
        renderer.setRenderTarget(previousTarget)
      }
    },
    dispose() {
      disposed = true
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored)
      frame.dispose()
      for (const target of history) target.dispose()
      blend.dispose()
      quad.dispose()
      display.dispose()
      output.dispose()
    },
  }
}
