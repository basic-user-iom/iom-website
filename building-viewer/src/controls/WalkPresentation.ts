import { Vector3 } from 'three'
import type { CharacterAnimState } from './CharacterVisual'

/** Presentation follows measured motion; it never changes collision position. */
export class WalkPresentation {
  cameraFeetY = 0
  bodyFeetY = 0
  private cameraHeightVelocity = 0
  facingYaw = 0
  speed = 0
  animation: CharacterAnimState = 'idle'
  playbackRate = 1
  private airborneSeconds = 0
  private stairSeconds = 0
  private stairDirection = 0
  private travelled = 0
  private heightHistory: { distance: number; y: number }[] = []
  private readonly stairHeading = new Vector3()

  reset(feet: Vector3, yaw: number): void {
    this.cameraFeetY = feet.y
    this.bodyFeetY = feet.y
    this.cameraHeightVelocity = 0
    this.facingYaw = yaw
    this.speed = 0
    this.animation = 'idle'
    this.playbackRate = 1
    this.airborneSeconds = 0
    this.stairSeconds = 0
    this.stairDirection = 0
    this.travelled = 0
    this.heightHistory = [{ distance: 0, y: feet.y }]
  }

  update(
    dt: number,
    before: Vector3,
    feet: Vector3,
    onGround: boolean,
    verticalVelocity: number,
    stairsIntent: number,
    hasInput: boolean,
    running: boolean,
  ): void {
    if (dt <= 0) return
    const dx = feet.x - before.x
    const dz = feet.z - before.z
    const distance = Math.hypot(dx, dz)
    const dy = feet.y - before.y
    if (distance > 2 || Math.abs(dy) > 1) {
      this.reset(feet, this.facingYaw)
      return
    }
    const blend = 1 - Math.exp(-14 * dt)
    this.speed += (distance / dt - this.speed) * blend
    if (distance > 0.001 && hasInput) {
      const yaw = Math.atan2(-dx, -dz)
      const difference = Math.atan2(Math.sin(yaw - this.facingYaw), Math.cos(yaw - this.facingYaw))
      this.facingYaw += difference * (1 - Math.exp(-18 * dt))
    }
    this.airborneSeconds = onGround ? 0 : this.airborneSeconds + dt
    const jumping = verticalVelocity > 0.4 || this.airborneSeconds > 0.08
    if (jumping) {
      this.cameraFeetY = this.bodyFeetY = feet.y
      this.cameraHeightVelocity = 0
    } else {
      // Feet need a short response for contact; the view needs a smooth velocity
      // across a riser. Keeping separate values avoids pulling shoes under steps.
      this.bodyFeetY += (feet.y - this.bodyFeetY) * (1 - Math.exp(-16 * dt))
      this.bodyFeetY = Math.max(feet.y - 0.3, Math.min(feet.y + 0.3, this.bodyFeetY))
      const omega = 10
      const error = this.cameraFeetY - feet.y
      const decay = Math.exp(-omega * dt)
      const impulse = (this.cameraHeightVelocity + omega * error) * dt
      this.cameraFeetY = feet.y + (error + impulse) * decay
      this.cameraHeightVelocity = (this.cameraHeightVelocity - omega * impulse) * decay
    }

    this.stairSeconds = Math.max(0, this.stairSeconds - dt)
    // A slow tread takes longer than the old fixed 0.22 s latch. Keep the gait
    // through one tread, but discard the ascent hint immediately on reversal.
    if (distance > 0.001 && dx * this.stairHeading.x + dz * this.stairHeading.z < 0) {
      this.stairSeconds = 0
      this.heightHistory = [{ distance: this.travelled, y: before.y }]
      this.stairDirection = 0
    }
    this.travelled += distance
    if (distance > 0.001) this.heightHistory.push({ distance: this.travelled, y: feet.y })
    while (this.heightHistory.length > 2 && this.travelled - this.heightHistory[1]!.distance > 0.65) this.heightHistory.shift()
    const heightChange = feet.y - (this.heightHistory[0]?.y ?? before.y)
    const measuredDirection = Math.abs(heightChange) > 0.04 ? Math.sign(heightChange) : 0
    if (onGround && hasInput && distance > 0.001 && (measuredDirection !== 0 || Math.abs(dy) > 0.012)) {
      this.stairDirection = measuredDirection || this.stairDirection || Math.sign(dy)
      this.stairSeconds = Math.max(0.3, Math.min(1.1, 0.4 / Math.max(0.35, this.speed)))
      this.stairHeading.set(dx, 0, dz)
    } else if (onGround && hasInput && stairsIntent !== 0 && this.stairSeconds === 0 && (this.stairDirection === 0 || stairsIntent === this.stairDirection)) {
      this.stairDirection = measuredDirection || stairsIntent
      this.stairSeconds = Math.max(this.stairSeconds, 0.1)
      this.stairHeading.set(dx, 0, dz)
    }

    if (this.stairSeconds > 0 && measuredDirection !== 0) {
      this.stairDirection = measuredDirection
    }
    if (jumping) this.animation = 'jumping'
    else if (!hasInput || this.speed < 0.08) this.animation = 'idle'
    else if (this.stairSeconds > 0) this.animation = this.stairDirection > 0 ? 'stairsUp' : 'stairsDown'
    else this.animation = running ? 'running' : 'walking'

    const locomotion = this.animation !== 'idle' && this.animation !== 'jumping'
    const referenceSpeed = this.animation === 'running' ? 4.5 : 1.6
    this.playbackRate = locomotion ? Math.max(0.35, Math.min(2.2, this.speed / referenceSpeed)) : 1
    if (!hasInput || jumping) this.stairSeconds = 0
  }
}

/** Keep authored stair strides within their reviewed cadence at normal/run input. */
export function stairWalkingSpeed(requested: number, animation: CharacterAnimState): number {
  if (animation === 'stairsUp') return Math.min(requested, 0.7)
  if (animation === 'stairsDown') return Math.min(requested, 0.6)
  return requested
}
