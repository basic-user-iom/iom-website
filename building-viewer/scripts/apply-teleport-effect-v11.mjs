import fs from 'node:fs';
const path='src/controls/WalkMode.ts';let s=fs.readFileSync(path,'utf8');s=s.replace('  enabled = false','  enabled = false\n  private teleportTransition = false');s=s.replace("      if (!this.enabled || this.teleportHeldKeys.has(e.code)) return", "      if (!this.enabled || this.teleportHeldKeys.has(e.code)) return\n      if (this.teleportTransition) {\n        if (e.code === 'Escape') this.exitPointerLock()\n        else this.teleportHeldKeys.add(e.code)\n        return\n      }");s=s.replace('if (!this.enabled || !this.pointerLocked) return','if (!this.enabled || !this.pointerLocked || this.teleportTransition) return');s=s.replace('    this.enabled = false\n    this.keys.clear()', '    this.enabled = false\n    this.teleportTransition = false\n    this.keys.clear()');s=s.replace('  /** Move feet, pose and camera together;',`  setTeleportTransition(active: boolean): void {
    this.teleportTransition = active
    if (!active) return
    for (const key of this.keys) this.teleportHeldKeys.add(key)
    this.keys.clear()
    this.controller.velocity.set(0, 0, 0)
    this.visual.resetForTeleport()
  }

  /** Move feet, pose and camera together;`);s=s.replace('    this.update(0)\n  }','    const transitioning = this.teleportTransition\n    this.teleportTransition = false\n    this.update(0)\n    this.teleportTransition = transitioning\n  }');s=s.replace('    if (!this.enabled) return\n    if (isUiControl','    if (!this.enabled || this.teleportTransition) return\n    if (isUiControl');fs.writeFileSync(path,s);
