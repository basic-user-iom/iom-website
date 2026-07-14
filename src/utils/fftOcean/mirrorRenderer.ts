import * as THREE from 'three'

function isPowerOfTwo(value: number) {
  return (value & (value - 1)) === 0 && value !== 0
}

export class FftOceanMirrorRenderer extends THREE.Object3D {
  readonly texture: THREE.WebGLRenderTarget
  readonly textureMatrix = new THREE.Matrix4()
  readonly mirrorCamera: THREE.PerspectiveCamera

  private readonly renderer: THREE.WebGLRenderer
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly clipBias: number
  private readonly mirrorPlane = new THREE.Plane()
  private readonly normal = new THREE.Vector3(0, 0, 1)
  private readonly cameraWorldPosition = new THREE.Vector3()
  private readonly rotationMatrix = new THREE.Matrix4()
  private readonly lookAtPosition = new THREE.Vector3(0, 0, -1)
  private readonly clipPlane = new THREE.Vector4()
  private readonly mirrorUp = new THREE.Vector3()
  mesh: THREE.Object3D = this
  matrixNeedsUpdate = true

  constructor(
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    options?: { textureWidth?: number; textureHeight?: number; clipBias?: number },
  ) {
    super()
    this.name = `mirror_${this.id}`
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.clipBias = options?.clipBias ?? 0

    const width = options?.textureWidth ?? 512
    const height = options?.textureHeight ?? 512

    this.mirrorCamera = camera.clone()
    this.mirrorCamera.matrixAutoUpdate = true
    this.mirrorCamera.layers.disable(1)

    this.texture = new THREE.WebGLRenderTarget(width, height)
    if (!isPowerOfTwo(width) || !isPowerOfTwo(height)) {
      this.texture.texture.generateMipmaps = false
    }

    this.updateTextureMatrix()
    this.render()
  }

  updateTextureMatrix() {
    if (this.parent) this.mesh = this.parent

    this.updateMatrixWorld(true)
    this.camera.updateMatrixWorld(true)

    this.cameraWorldPosition.setFromMatrixPosition(this.camera.matrixWorld)

    this.rotationMatrix.extractRotation(this.matrixWorld)

    this.normal.set(0, 1, 0).applyEuler(this.mesh.rotation)
    const cameraLookAt = new THREE.Vector3(0, 0, 1).applyEuler(this.camera.rotation)
    if (this.normal.dot(cameraLookAt) < 0) {
      const meshNormal = new THREE.Vector3(0, 0, 1).applyEuler(this.mesh.rotation)
      this.normal.reflect(meshNormal)
    }

    const view = this.mesh.position.clone().sub(this.cameraWorldPosition)
    view.reflect(this.normal).negate()
    view.add(this.mesh.position)

    this.rotationMatrix.extractRotation(this.camera.matrixWorld)

    this.lookAtPosition.set(0, 0, -1)
    this.lookAtPosition.applyMatrix4(this.rotationMatrix)
    this.lookAtPosition.add(this.cameraWorldPosition)

    const target = this.mesh.position.clone().sub(this.lookAtPosition)
    target.reflect(this.normal).negate()
    target.add(this.mesh.position)

    this.mirrorUp.set(0, -1, 0)
    this.mirrorUp.applyMatrix4(this.rotationMatrix)
    this.mirrorUp.reflect(this.normal).negate()

    this.mirrorCamera.position.copy(view)
    this.mirrorCamera.up.copy(this.mirrorUp)
    this.mirrorCamera.lookAt(target)
    this.mirrorCamera.aspect = this.camera.aspect
    this.mirrorCamera.updateProjectionMatrix()
    this.mirrorCamera.updateMatrixWorld(true)
    this.mirrorCamera.matrixWorldInverse.copy(this.mirrorCamera.matrixWorld).invert()

    this.textureMatrix.set(0.5, 0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 1.0)
    this.textureMatrix.multiply(this.mirrorCamera.projectionMatrix)
    this.textureMatrix.multiply(this.mirrorCamera.matrixWorldInverse)

    this.mirrorPlane.setFromNormalAndCoplanarPoint(this.normal, this.mesh.position)
    this.mirrorPlane.applyMatrix4(this.mirrorCamera.matrixWorldInverse)

    this.clipPlane.set(
      this.mirrorPlane.normal.x,
      this.mirrorPlane.normal.y,
      this.mirrorPlane.normal.z,
      this.mirrorPlane.constant,
    )

    const q = new THREE.Vector4()
    const projectionMatrix = this.mirrorCamera.projectionMatrix

    q.x = (Math.sign(this.clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0]
    q.y = (Math.sign(this.clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5]
    q.z = -1.0
    q.w = (1.0 + projectionMatrix.elements[10]) / projectionMatrix.elements[14]

    const c = this.clipPlane.clone().multiplyScalar(2.0 / this.clipPlane.dot(q))
    projectionMatrix.elements[2] = c.x
    projectionMatrix.elements[6] = c.y
    projectionMatrix.elements[10] = c.z + 1.0 - this.clipBias
    projectionMatrix.elements[14] = c.w
  }

  render() {
    if (this.matrixNeedsUpdate) this.updateTextureMatrix()
    this.matrixNeedsUpdate = true

    const prevTarget = this.renderer.getRenderTarget()
    this.renderer.setRenderTarget(this.texture)
    this.renderer.clear()
    this.renderer.render(this.scene, this.mirrorCamera)
    this.renderer.setRenderTarget(prevTarget)
  }

  dispose() {
    this.texture.dispose()
  }
}
