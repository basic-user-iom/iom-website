import type { RefObject } from 'react'
import { useHeroScene, type HeroSceneLoadStatus } from '../three/useHeroScene'

type HeroSceneMountProps = {
  containerRef: RefObject<HTMLDivElement | null>
  onStatus?: (status: HeroSceneLoadStatus) => void
}

export default function HeroSceneMount({ containerRef, onStatus }: HeroSceneMountProps) {
  useHeroScene(containerRef, { onStatus })
  return null
}
