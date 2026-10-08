import { TeleportEffect } from './TeleportEffect'
﻿import {
  CanvasTexture, CircleGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry,
  RingGeometry, SRGBColorSpace, Vector3, type Object3D,
} from 'three'
import type { CollisionWorld } from '../collision/CollisionWorld'
import { isValidSpawnPoint, type CharacterController } from '../collision/CharacterController'
import type { WalkMode } from './WalkMode'
import {
  ICM_STAIR_TELEPORTS, StairTeleportGate, stairPortals,
  type StairPortal,
} from './stairTeleportRoutes'

/** Walk-only floor markers. Never inserted into the model or collision graph. */
export class StairTeleports {
  readonly root = new Group()
  private readonly portals = stairPortals(ICM_STAIR_TELEPORTS)
  private readonly layerIds = [...new Set(this.portals.flatMap(p => [p.layerId, p.destinationLayerId]))]
  private readonly gate = new StairTeleportGate()
  private readonly markers = new Map<string, Group>()
  private readonly textures: CanvasTexture[] = []
  private readyPortals: StairPortal[] = []
  private wasWalking = false
  private availability = ''
  readonly effect: TeleportEffect

  constructor(
    private readonly world: CollisionWorld,
    private readonly controller: CharacterController,
    private readonly walk: WalkMode,
    private readonly layerVisible: (id: string) => boolean,
    character: Object3D, host: HTMLElement,
  ) {
    this.effect = new TeleportEffect(character, host)
    this.root.add(this.effect.root)
    this.root.name = 'StairTeleportMarkers'
    this.root.visible = false
    const upTexture = this.makeLabel('UP')
    const downTexture = this.makeLabel('DOWN')
    for (const portal of this.portals) {
      const marker = new Group()
      marker.name = 'Teleport:' + portal.id
      const color = portal.up ? 0x56d9ed : 0xe8abeb
      const ring = new Mesh(new RingGeometry(portal.radius - .07, portal.radius + .05, 64),
        new MeshBasicMaterial({ color, transparent: true, opacity: .95, depthWrite: false, toneMapped: false }))
      const fill = new Mesh(new CircleGeometry(portal.radius - .07, 64),
        new MeshBasicMaterial({ color: 0x122630, transparent: true, opacity: .62, depthWrite: false, toneMapped: false }))
      const label = new Mesh(new PlaneGeometry(portal.radius * 1.6, portal.radius * 1.6),
        new MeshBasicMaterial({ map: portal.up ? upTexture : downTexture, transparent: true, depthWrite: false, toneMapped: false }))
      for (const mesh of [fill, ring, label]) {
        mesh.rotation.x = -Math.PI / 2
        mesh.position.y = mesh === label ? .028 : .018
        marker.add(mesh)
      }
      // Text reads from the approach to the stairs, at either end.
      marker.rotation.y = portal.approachYaw
      this.markers.set(portal.id, marker)
      this.root.add(marker)
    }
  }

  private makeLabel(text: string): CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const context = canvas.getContext('2d')!
    context.fillStyle = '#ffffff'
    context.beginPath()
    context.moveTo(128, 28); context.lineTo(186, 95); context.lineTo(148, 95)
    context.lineTo(148, 138); context.lineTo(108, 138); context.lineTo(108, 95)
    context.lineTo(70, 95); context.closePath(); context.fill()
    context.textAlign = 'center'
    context.font = 'bold 49px Arial'
    context.fillText(text, 128, 205)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    this.textures.push(texture)
    return texture
  }

  /** Check a full flat landing and standing capsule, using only the visible owner. */
  private resolveLanding(expected: Vector3, layerId: string, radius: number): Vector3 | null {
    if (!this.layerVisible(layerId)) return null
    this.world.setFocus(expected)
    const hit = this.world.raycastBestGround(expected.clone().setY(expected.y + .12), .24, .95, layerId)
    if (!hit || Math.abs(hit.point.y - expected.y) > .08) return null
    // CollisionWorld reuses ray result vectors, so copy before further queries.
    const feet = hit.point.clone()
    const normal = hit.normal.clone()
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4
      const probe = feet.clone().add(new Vector3(Math.cos(angle) * (radius + .1), .12, Math.sin(angle) * (radius + .1)))
      const edge = this.world.raycastBestGround(probe, .24, .95, layerId)
      if (!edge || Math.abs(edge.point.y - feet.y) > .06) return null
    }
    if (!isValidSpawnPoint(this.world, feet, normal, this.controller.params).ok) return null
    const head = this.world.raycast(feet.clone().add(new Vector3(0, .12, 0)), new Vector3(0, 1, 0), this.controller.params.playerHeight)
    if (head && head.distance < this.controller.params.playerHeight - .1) return null
    return feet
  }

  private refresh(): void {
    const previousLayer = this.world.getQueryLayer()
    this.world.setQueryLayer(null)
    try {
      this.readyPortals = this.portals.filter(portal => {
        const point = this.resolveLanding(portal.point, portal.layerId, portal.radius)
        const destination = this.resolveLanding(portal.destination, portal.destinationLayerId, portal.destinationRadius)
        if (!point || !destination) return false
        portal.point.copy(point)
        portal.destination.copy(destination)
        this.markers.get(portal.id)!.position.copy(point)
        return true
      })
    } finally {
      this.world.setQueryLayer(previousLayer)
      this.world.setFocus(this.controller.position)
    }
  }

  update(walking: boolean, dt = 1 / 60): void {
    this.root.visible = walking
    if (!walking) {
      this.wasWalking = false
      this.effect.cancel()
      this.walk.setTeleportTransition(false)
      return
    }
    const availability = this.world.getRevision() + ':' + this.layerIds.map(id => id + '=' + this.layerVisible(id)).join(',')
    if (!this.wasWalking || availability !== this.availability) {
      this.effect.cancel()
      this.walk.setTeleportTransition(false)
      this.availability = availability
      this.refresh()
      // Dropping the character onto a circle does not unexpectedly teleport.
      this.gate.blockAt(this.controller.position, this.readyPortals)
      this.wasWalking = true
    }
    const available = this.readyPortals.filter(p => this.layerVisible(p.layerId) && this.layerVisible(p.destinationLayerId))
    const ids = new Set(available.map(p => p.id))
    for (const portal of this.portals) {
      const marker = this.markers.get(portal.id)!
      marker.visible = ids.has(portal.id) && Math.abs(this.controller.position.y - portal.point.y) < 1.5 &&
        this.controller.position.distanceToSquared(portal.point) < 35 * 35
    }
    if (this.effect.active) {
      this.effect.update(dt)
      if (!this.effect.active) this.walk.setTeleportTransition(false)
      return
    }
    const entered = this.gate.update(this.controller.position, this.controller.onGround, available)
    if (!entered) return
    this.walk.setTeleportTransition(true)
    this.effect.begin(() => {
      const previousLayer = this.world.getQueryLayer()
      this.world.setQueryLayer(null)
      const destination = this.resolveLanding(entered.destination, entered.destinationLayerId, entered.destinationRadius)
      if (!destination || !this.layerVisible(entered.layerId)) {
        this.world.setQueryLayer(previousLayer)
        this.world.setFocus(this.controller.position)
        return false
      }
      this.world.setQueryLayer(entered.destinationLayerId)
      this.world.setFocus(destination)
      this.walk.teleportTo(destination, entered.arrivalYaw)
      this.gate.blockAt(this.controller.position, available)
      return true
    })
  }

  dispose(): void {
    this.effect.dispose()
    this.walk.setTeleportTransition(false)
    this.root.removeFromParent()
    this.root.traverse(object => {
      if (object instanceof Mesh) {
        object.geometry.dispose()
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose())
        else object.material.dispose()
      }
    })
    this.textures.forEach(texture => texture.dispose())
    this.root.clear()
  }
}
