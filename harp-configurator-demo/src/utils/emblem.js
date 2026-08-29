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
  canvas.width = 768
  canvas.height = 560
  const ctx = canvas.getContext('2d', { alpha: true })
  const cx = canvas.width / 2
  const cy = canvas.height / 2

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const brass = ctx.createRadialGradient(cx - 100, cy - 110, 10, cx, cy, 330)
  brass.addColorStop(0, '#f4d896')
  brass.addColorStop(0.42, '#c99c4f')
  brass.addColorStop(0.78, '#9a6e31')
  brass.addColorStop(1, '#6e4822')
  ctx.fillStyle = brass
  ctx.strokeStyle = '#f6dea4'
  ctx.lineWidth = 12
  ctx.beginPath()
  ctx.ellipse(cx, cy, 325, 224, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.strokeStyle = 'rgba(87, 52, 20, 0.78)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.ellipse(cx, cy, 292, 191, 0, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = 'rgba(76, 43, 17, 0.9)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '700 36px Georgia, serif'
  ctx.letterSpacing = '8px'
  ctx.fillText('MARINI MADE HARPS', cx, cy - 132)

  ctx.strokeStyle = 'rgba(75, 42, 16, 0.88)'
  ctx.fillStyle = 'rgba(239, 205, 128, 0.7)'
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - 20, cy - 88)
  ctx.quadraticCurveTo(cx + 112, cy + 8, cx + 34, cy + 112)
  ctx.lineTo(cx - 46, cy + 112)
  ctx.quadraticCurveTo(cx - 118, cy + 4, cx - 20, cy - 88)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.strokeStyle = 'rgba(76, 43, 17, 0.8)'
  ctx.lineWidth = 4
  for (let index = -2; index <= 2; index += 1) {
    const offset = index * 12
    ctx.beginPath()
    ctx.moveTo(cx + offset, cy - 56)
    ctx.quadraticCurveTo(cx + offset * 2.2, cy + 20, cx + offset * 0.7, cy + 90)
    ctx.stroke()
  }

  ctx.font = '600 26px Georgia, serif'
  ctx.letterSpacing = '6px'
  ctx.fillText('USA', cx, cy + 157)
  return finishTexture(canvas)
}

export function createCarvingTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 1024
  const ctx = canvas.getContext('2d', { alpha: true })
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.translate(canvas.width / 2, 42)
  ctx.strokeStyle = 'rgba(92, 55, 24, 0.58)'
  ctx.fillStyle = 'rgba(151, 101, 48, 0.28)'
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const branch = (side) => {
    ctx.save()
    ctx.scale(side, 1)
    ctx.beginPath()
    ctx.moveTo(0, 870)
    ctx.bezierCurveTo(10, 660, 145, 565, 82, 384)
    ctx.bezierCurveTo(49, 288, 110, 188, 35, 64)
    ctx.stroke()

    const leaves = [205, 340, 485, 620, 745]
    leaves.forEach((y, index) => {
      const x = 52 + (index % 2) * 25
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(index % 2 ? -0.6 : 0.42)
      ctx.beginPath()
      ctx.ellipse(0, 0, 43, 18, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    })
    ctx.restore()
  }

  branch(1)
  branch(-1)
  ctx.beginPath()
  ctx.moveTo(0, 885)
  ctx.bezierCurveTo(-36, 790, 36, 702, 0, 610)
  ctx.stroke()
  return finishTexture(canvas)
}
