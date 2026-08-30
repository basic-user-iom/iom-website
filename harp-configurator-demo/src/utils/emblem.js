import { CanvasTexture, SRGBColorSpace } from 'three'

function finishTexture(canvas) {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.premultiplyAlpha = false
  texture.needsUpdate = true
  return texture
}

export function createEmblemTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 420
  const ctx = canvas.getContext('2d', { alpha: true })
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const plaquePath = (inset = 30) => {
    const clip = 58
    ctx.beginPath()
    ctx.moveTo(inset + clip, inset)
    ctx.lineTo(canvas.width - inset - clip, inset)
    ctx.lineTo(canvas.width - inset, inset + clip)
    ctx.lineTo(canvas.width - inset, canvas.height - inset - clip)
    ctx.lineTo(canvas.width - inset - clip, canvas.height - inset)
    ctx.lineTo(inset + clip, canvas.height - inset)
    ctx.lineTo(inset, canvas.height - inset - clip)
    ctx.lineTo(inset, inset + clip)
    ctx.closePath()
  }

  const brass = ctx.createLinearGradient(40, 20, 1160, 400)
  brass.addColorStop(0, 'rgba(116, 77, 31, 0.98)')
  brass.addColorStop(0.2, 'rgba(224, 189, 111, 0.99)')
  brass.addColorStop(0.52, 'rgba(164, 119, 55, 0.99)')
  brass.addColorStop(0.78, 'rgba(235, 207, 137, 0.99)')
  brass.addColorStop(1, 'rgba(104, 68, 28, 0.98)')

  plaquePath()
  ctx.fillStyle = brass
  ctx.fill()
  ctx.strokeStyle = 'rgba(70, 43, 17, 0.94)'
  ctx.lineWidth = 12
  ctx.lineJoin = 'bevel'
  ctx.stroke()

  plaquePath(48)
  ctx.strokeStyle = 'rgba(255, 229, 167, 0.46)'
  ctx.lineWidth = 4
  ctx.stroke()

  ctx.save()
  plaquePath()
  ctx.clip()
  for (let index = 0; index < 34; index += 1) {
    const y = 55 + index * 9.5
    const alpha = 0.025 + (index % 5) * 0.008
    ctx.strokeStyle = `rgba(66, 39, 15, ${alpha})`
    ctx.lineWidth = index % 4 === 0 ? 2 : 1
    ctx.beginPath()
    ctx.moveTo(72, y)
    ctx.lineTo(1128, y + Math.sin(index * 1.7) * 3)
    ctx.stroke()
  }
  ctx.restore()

  for (const x of [108, 1092]) {
    const screw = ctx.createRadialGradient(x - 5, 190, 2, x, 210, 28)
    screw.addColorStop(0, '#d7bd83')
    screw.addColorStop(0.38, '#6e512d')
    screw.addColorStop(1, '#24180f')
    ctx.fillStyle = screw
    ctx.beginPath()
    ctx.arc(x, 210, 25, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(21, 14, 9, 0.9)'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(x - 12, 210)
    ctx.lineTo(x + 12, 210)
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(49, 30, 14, 0.95)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '600 72px Georgia, serif'
  ctx.fillText('MARINI MADE HARPS', 600, 170)
  ctx.font = '500 43px Georgia, serif'
  ctx.fillText('LANCASTER CO. PA', 600, 260)
  return finishTexture(canvas)
}
