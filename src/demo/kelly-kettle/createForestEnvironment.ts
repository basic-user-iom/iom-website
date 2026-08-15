import {
  CanvasTexture,
  CircleGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
  type WebGLRenderer,
} from 'three'

const FOREST_URL = '/demos/kelly-kettle/forest-background.png'

function liftForestMap(source: Texture) {
  const image = source.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx || !image) return source
  ctx.filter = 'brightness(1.7) saturate(0.72) contrast(0.86)'
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  const lifted = new CanvasTexture(canvas)
  lifted.colorSpace = SRGBColorSpace
  lifted.needsUpdate = true
  return lifted
}

export function loadForestEnvironment(renderer: WebGLRenderer, onReady: (texture: Texture) => void) {
  let cancelled = false
  const loader = new TextureLoader()
  loader.load(
    FOREST_URL,
    (map) => {
      if (cancelled) {
        map.dispose()
        return
      }
      const lifted = liftForestMap(map)
      map.dispose()
      const pmrem = new PMREMGenerator(renderer)
      const envScene = new Scene()
      envScene.background = new Color(0xc9d0bc)

      const skyGeo = new SphereGeometry(8, 48, 28)
      skyGeo.scale(-1, 1, 1)
      const skyMat = new MeshBasicMaterial({ map: lifted, color: 0xe8eadc })
      const sky = new Mesh(skyGeo, skyMat)
      sky.rotation.y = 0.42
      envScene.add(sky)

      const groundGeo = new CircleGeometry(7.2, 32)
      const groundMat = new MeshBasicMaterial({ color: 0xb7a888 })
      const ground = new Mesh(groundGeo, groundMat)
      ground.rotation.x = -Math.PI / 2
      ground.position.y = -1.4
      envScene.add(ground)

      const sunGeo = new SphereGeometry(0.85, 16, 12)
      const sunMat = new MeshBasicMaterial({ color: 0xfff3d2 })
      const sun = new Mesh(sunGeo, sunMat)
      sun.position.set(3.4, 4.6, 2.2)
      envScene.add(sun)

      const fillGeo = new SphereGeometry(1.4, 12, 8)
      const fillMat = new MeshBasicMaterial({ color: 0xc5d0b0 })
      const fill = new Mesh(fillGeo, fillMat)
      fill.position.set(-4.2, 1.8, -2.6)
      envScene.add(fill)

      const envTex = pmrem.fromScene(envScene, 0.28).texture
      skyGeo.dispose()
      groundGeo.dispose()
      sunGeo.dispose()
      fillGeo.dispose()
      skyMat.dispose()
      groundMat.dispose()
      sunMat.dispose()
      fillMat.dispose()
      if (lifted !== map) lifted.dispose()
      pmrem.dispose()
      if (cancelled) {
        envTex.dispose()
        return
      }
      onReady(envTex)
    },
    undefined,
    () => undefined,
  )

  return () => {
    cancelled = true
  }
}
