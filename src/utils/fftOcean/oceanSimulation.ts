import * as THREE from 'three'
import { FftOceanMirrorRenderer } from './mirrorRenderer'
import {
  createOceanRenderMaterial,
  createSimMaterial,
  createSubtransformMaterial,
  OCEAN_INITIAL_SPECTRUM_FRAGMENT,
  OCEAN_NORMALS_FRAGMENT,
  OCEAN_PHASE_FRAGMENT,
  OCEAN_SPECTRUM_FRAGMENT,
} from './shaders'

export type FftOceanOptions = {
  initialSize?: number
  initialWind?: [number, number]
  initialChoppiness?: number
  oceanColor?: THREE.Vector3
  skyColor?: THREE.Vector3
  exposure?: number
  sunDirection?: THREE.Vector3
  geometryResolution?: number
  geometrySize?: number
  resolution?: number
  mirrorTextureSize?: number
}

export class FftOceanSimulation {
  changed = true
  initial = true
  deltaTime = 0.016

  windX: number
  windY: number
  size: number
  choppiness: number
  exposure: number
  /** World-space Z scroll applied to ocean UV sampling (decouples wave parallax from chase cam). */
  oceanScrollZ = 0
  /** Amplifies travel distance into visible UV scroll (independent of camera Z). */
  oceanScrollGain = 7

  readonly oceanMesh: THREE.Mesh
  readonly materialOcean: THREE.ShaderMaterial
  readonly materialSpectrum: THREE.ShaderMaterial

  private readonly renderer: THREE.WebGLRenderer
  private readonly camera: THREE.PerspectiveCamera
  private readonly scene: THREE.Scene
  private readonly mirror: FftOceanMirrorRenderer
  private readonly cameraWorldPosition = new THREE.Vector3()
  private readonly oceanCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private readonly simScene = new THREE.Scene()
  private readonly screenQuad: THREE.Mesh
  private readonly resolution: number
  private pingPhase = true

  private readonly initialSpectrumFramebuffer: THREE.WebGLRenderTarget
  private readonly spectrumFramebuffer: THREE.WebGLRenderTarget
  private readonly pingPhaseFramebuffer: THREE.WebGLRenderTarget
  private readonly pongPhaseFramebuffer: THREE.WebGLRenderTarget
  private readonly pingTransformFramebuffer: THREE.WebGLRenderTarget
  private readonly pongTransformFramebuffer: THREE.WebGLRenderTarget
  private readonly displacementMapFramebuffer: THREE.WebGLRenderTarget
  private readonly normalMapFramebuffer: THREE.WebGLRenderTarget

  private readonly materialOceanHorizontal: THREE.ShaderMaterial
  private readonly materialOceanVertical: THREE.ShaderMaterial
  private readonly materialInitialSpectrum: THREE.ShaderMaterial
  private readonly materialPhase: THREE.ShaderMaterial
  private readonly materialNormal: THREE.ShaderMaterial
  private pingPhaseTexture: THREE.DataTexture

  constructor(
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    options: FftOceanOptions = {},
  ) {
    this.renderer = renderer
    this.camera = camera
    this.scene = scene

    const resolution = options.resolution ?? 128
    this.resolution = resolution

    this.windX = options.initialWind?.[0] ?? 10
    this.windY = options.initialWind?.[1] ?? 10
    this.size = options.initialSize ?? 120
    this.choppiness = options.initialChoppiness ?? 2.8
    this.exposure = options.exposure ?? 0.14

    const floatParams = {
      format: THREE.RGBAFormat,
      stencilBuffer: false,
      depthBuffer: false,
      type: THREE.FloatType,
      colorSpace: THREE.NoColorSpace,
    }

    const createNearestClampTarget = () =>
      new THREE.WebGLRenderTarget(resolution, resolution, {
        ...floatParams,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
      })

    const createNearestRepeatTarget = () =>
      new THREE.WebGLRenderTarget(resolution, resolution, {
        ...floatParams,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.RepeatWrapping,
      })

    const createLinearRepeatTarget = () =>
      new THREE.WebGLRenderTarget(resolution, resolution, {
        ...floatParams,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.RepeatWrapping,
      })

    this.initialSpectrumFramebuffer = createNearestRepeatTarget()
    this.spectrumFramebuffer = createNearestClampTarget()
    this.pingPhaseFramebuffer = createNearestClampTarget()
    this.pongPhaseFramebuffer = createNearestClampTarget()
    this.pingTransformFramebuffer = createNearestClampTarget()
    this.pongTransformFramebuffer = createNearestClampTarget()
    this.displacementMapFramebuffer = createLinearRepeatTarget()
    this.normalMapFramebuffer = createLinearRepeatTarget()

    this.materialOceanHorizontal = createSubtransformMaterial(true)
    this.materialOceanHorizontal.uniforms.u_transformSize.value = resolution

    this.materialOceanVertical = createSubtransformMaterial(false)
    this.materialOceanVertical.uniforms.u_transformSize.value = resolution

    this.materialInitialSpectrum = createSimMaterial(OCEAN_INITIAL_SPECTRUM_FRAGMENT, {
      u_wind: { value: new THREE.Vector2(this.windX, this.windY) },
      u_resolution: { value: resolution },
      u_size: { value: this.size },
    })

    this.materialPhase = createSimMaterial(OCEAN_PHASE_FRAGMENT, {
      u_phases: { value: null },
      u_deltaTime: { value: 0 },
      u_resolution: { value: resolution },
      u_size: { value: this.size },
    })

    this.materialSpectrum = createSimMaterial(OCEAN_SPECTRUM_FRAGMENT, {
      u_initialSpectrum: { value: null },
      u_resolution: { value: resolution },
      u_choppiness: { value: this.choppiness },
      u_phases: { value: null },
      u_size: { value: this.size },
    })

    this.materialNormal = createSimMaterial(OCEAN_NORMALS_FRAGMENT, {
      u_displacementMap: { value: null },
      u_resolution: { value: resolution },
      u_size: { value: this.size },
    })

    const gl = renderer.getContext()
    const supportsVertexTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) > 0
    this.materialOcean = createOceanRenderMaterial(supportsVertexTextures)
    // Match fft-ocean demo: displacement scale uses FFT resolution, not world mesh size.
    this.materialOcean.uniforms.u_geometrySize.value = resolution
    this.materialOcean.uniforms.u_oceanColor.value =
      options.oceanColor ?? new THREE.Vector3(0.08, 0.14, 0.2)
    this.materialOcean.uniforms.u_skyColor.value =
      options.skyColor ?? new THREE.Vector3(3, 4, 5)
    this.materialOcean.uniforms.u_sunDirection.value =
      options.sunDirection ?? new THREE.Vector3(-0.28, 0.52, -0.38)
    this.materialOcean.uniforms.u_exposure.value = this.exposure

    this.screenQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    this.simScene.add(this.screenQuad)

    this.pingPhaseTexture = this.generateSeedPhaseTexture()

    const geometry = new THREE.PlaneGeometry(
      1,
      1,
      options.geometryResolution ?? resolution,
      options.geometryResolution ?? resolution,
    )
    this.oceanMesh = new THREE.Mesh(geometry, this.materialOcean)
    this.oceanMesh.frustumCulled = false

    this.mirror = new FftOceanMirrorRenderer(renderer, camera, scene, {
      textureWidth: options.mirrorTextureSize ?? 256,
      textureHeight: options.mirrorTextureSize ?? 256,
    })
    this.mirror.position.y = -10

    this.materialOcean.uniforms.u_displacementMap.value = this.displacementMapFramebuffer.texture
    this.materialOcean.uniforms.u_reflection.value = this.mirror.texture.texture
    this.materialOcean.uniforms.u_mirrorMatrix.value = this.mirror.textureMatrix
    this.materialOcean.uniforms.u_normalMap.value = this.normalMapFramebuffer.texture

    this.mirror.mesh = this.oceanMesh
    // Scene-root mesh: Three.js r181 only traverses the scene graph (not camera children
    // unless the camera is in the scene). Screen-plane vertices are projected in the shader.
    scene.add(this.oceanMesh)
  }

  private generateSeedPhaseTexture() {
    const phaseArray = new Float32Array(this.resolution * this.resolution * 4)
    for (let i = 0; i < this.resolution; i += 1) {
      for (let j = 0; j < this.resolution; j += 1) {
        const idx = i * this.resolution * 4 + j * 4
        phaseArray[idx] = Math.random() * 2.0 * Math.PI
        phaseArray[idx + 1] = 0
        phaseArray[idx + 2] = 0
        phaseArray[idx + 3] = 0
      }
    }

    const texture = new THREE.DataTexture(
      phaseArray,
      this.resolution,
      this.resolution,
      THREE.RGBAFormat,
      THREE.FloatType,
    )
    texture.minFilter = THREE.NearestFilter
    texture.magFilter = THREE.NearestFilter
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.needsUpdate = true
    return texture
  }

  private renderPass(material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null, clear = false) {
    this.screenQuad.material = material
    this.simScene.overrideMaterial = material
    const prevTarget = this.renderer.getRenderTarget()
    this.renderer.setRenderTarget(target)
    if (clear) this.renderer.clear()
    this.renderer.render(this.simScene, this.oceanCamera)
    this.simScene.overrideMaterial = null
    this.renderer.setRenderTarget(prevTarget)
  }

  private renderInitialSpectrum() {
    this.materialInitialSpectrum.uniforms.u_wind.value.set(this.windX, this.windY)
    this.materialInitialSpectrum.uniforms.u_size.value = this.size
    this.renderPass(this.materialInitialSpectrum, this.initialSpectrumFramebuffer, true)
  }

  private renderWavePhase() {
    if (this.initial) {
      this.materialPhase.uniforms.u_phases.value = this.pingPhaseTexture
      this.initial = false
    } else {
      this.materialPhase.uniforms.u_phases.value = this.pingPhase
        ? this.pingPhaseFramebuffer.texture
        : this.pongPhaseFramebuffer.texture
    }
    this.materialPhase.uniforms.u_deltaTime.value = this.deltaTime
    this.materialPhase.uniforms.u_size.value = this.size
    this.renderPass(
      this.materialPhase,
      this.pingPhase ? this.pongPhaseFramebuffer : this.pingPhaseFramebuffer,
    )
    this.pingPhase = !this.pingPhase
  }

  private renderSpectrum() {
    this.materialSpectrum.uniforms.u_initialSpectrum.value = this.initialSpectrumFramebuffer.texture
    this.materialSpectrum.uniforms.u_phases.value = this.pingPhase
      ? this.pingPhaseFramebuffer.texture
      : this.pongPhaseFramebuffer.texture
    this.materialSpectrum.uniforms.u_choppiness.value = this.choppiness
    this.materialSpectrum.uniforms.u_size.value = this.size
    this.renderPass(this.materialSpectrum, this.spectrumFramebuffer)
  }

  private renderSpectrumFft() {
    const iterations = Math.log2(this.resolution) * 2
    let subtransformProgram = this.materialOceanHorizontal

    for (let i = 0; i < iterations; i += 1) {
      let inputBuffer: THREE.WebGLRenderTarget
      let frameBuffer: THREE.WebGLRenderTarget

      if (i === 0) {
        inputBuffer = this.spectrumFramebuffer
        frameBuffer = this.pingTransformFramebuffer
      } else if (i === iterations - 1) {
        inputBuffer =
          iterations % 2 === 0 ? this.pingTransformFramebuffer : this.pongTransformFramebuffer
        frameBuffer = this.displacementMapFramebuffer
      } else if (i % 2 === 1) {
        inputBuffer = this.pingTransformFramebuffer
        frameBuffer = this.pongTransformFramebuffer
      } else {
        inputBuffer = this.pongTransformFramebuffer
        frameBuffer = this.pingTransformFramebuffer
      }

      if (i === iterations / 2) {
        subtransformProgram = this.materialOceanVertical
      }

      subtransformProgram.uniforms.u_input.value = inputBuffer.texture
      subtransformProgram.uniforms.u_subtransformSize.value = Math.pow(2, (i % (iterations / 2)) + 1)
      this.renderPass(subtransformProgram, frameBuffer)
    }
  }

  private renderNormalMap() {
    if (this.changed) this.materialNormal.uniforms.u_size.value = this.size
    this.materialNormal.uniforms.u_displacementMap.value = this.displacementMapFramebuffer.texture
    this.renderPass(this.materialNormal, this.normalMapFramebuffer, true)
  }

  renderSimulation() {
    if (this.changed) this.renderInitialSpectrum()

    this.renderWavePhase()
    this.renderSpectrum()
    this.renderSpectrumFft()
    this.renderNormalMap()

    this.renderer.setRenderTarget(null)
    this.renderer.resetState()

    const oceanWasVisible = this.oceanMesh.visible
    this.oceanMesh.visible = false
    this.mirror.render()
    this.oceanMesh.visible = oceanWasVisible
  }

  update() {
    this.camera.getWorldPosition(this.cameraWorldPosition)
    // Mirror plane tracks camera X only — Z parallax comes from u_oceanScroll, not mesh follow.
    this.oceanMesh.position.set(this.cameraWorldPosition.x, 0, 0)

    if (this.changed) {
      this.materialOcean.uniforms.u_size.value = this.size
      this.materialOcean.uniforms.u_exposure.value = this.exposure
      this.changed = false
    }
    this.materialOcean.uniforms.u_normalMap.value = this.normalMapFramebuffer.texture
    this.materialOcean.uniforms.u_displacementMap.value = this.displacementMapFramebuffer.texture
    this.materialOcean.uniforms.u_mirrorMatrix.value = this.mirror.textureMatrix
    this.materialOcean.uniforms.u_reflection.value = this.mirror.texture.texture
    this.materialOcean.uniforms.u_oceanScroll.value.set(0, this.oceanScrollZ * this.oceanScrollGain)
    this.materialOcean.depthTest = true
  }

  setSunDirection(direction: THREE.Vector3) {
    this.materialOcean.uniforms.u_sunDirection.value.copy(direction)
    this.changed = true
  }

  dispose() {
    this.scene.remove(this.oceanMesh)
    this.oceanMesh.geometry.dispose()
    this.materialOcean.dispose()
    this.materialOceanHorizontal.dispose()
    this.materialOceanVertical.dispose()
    this.materialInitialSpectrum.dispose()
    this.materialPhase.dispose()
    this.materialSpectrum.dispose()
    this.materialNormal.dispose()
    this.screenQuad.geometry.dispose()
    this.pingPhaseTexture.dispose()

    this.initialSpectrumFramebuffer.dispose()
    this.spectrumFramebuffer.dispose()
    this.pingPhaseFramebuffer.dispose()
    this.pongPhaseFramebuffer.dispose()
    this.pingTransformFramebuffer.dispose()
    this.pongTransformFramebuffer.dispose()
    this.displacementMapFramebuffer.dispose()
    this.normalMapFramebuffer.dispose()
    this.mirror.dispose()
  }
}
