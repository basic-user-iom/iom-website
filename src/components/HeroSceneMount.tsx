import type { RefObject } from 'react'
import { useHeroScene } from '../three/useHeroScene'

type HeroSceneMountProps = {
  containerRef: RefObject<HTMLDivElement | null>
}

export default function HeroSceneMount({ containerRef }: HeroSceneMountProps) {
  useHeroScene(containerRef)
  return null
}
