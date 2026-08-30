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
  canvas.width = 640
  canvas.height = 760
  const ctx = canvas.getContext('2d', { alpha: true })
  const cx = canvas.width / 2

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const brass = ctx.createLinearGradient(145, 80, 495, 690)
  brass.addColorStop(0, 'rgba(250, 222, 155, 0.95)')
  brass.addColorStop(0.42, 'rgba(202, 158, 79, 0.9)')
  brass.addColorStop(1, 'rgba(112, 72, 31, 0.88)')

  const shieldPath = () => {
    ctx.beginPath()
    ctx.moveTo(cx, 66)
    ctx.bezierCurveTo(452, 66, 508, 146, 492, 294)
    ctx.bezierCurveTo(474, 478, 390, 615, cx, 690)
    ctx.bezierCurveTo(250, 615, 166, 478, 148, 294)
    ctx.bezierCurveTo(132, 146, 188, 66, cx, 66)
    ctx.closePath()
  }

  shieldPath()
  ctx.fillStyle = 'rgba(156, 104, 43, 0.18)'
  ctx.fill()
  ctx.strokeStyle = brass
  ctx.lineWidth = 16
  ctx.lineJoin = 'round'
  ctx.stroke()

  shieldPath()
  ctx.strokeStyle = 'rgba(86, 52, 21, 0.66)'
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.lineCap = 'round'
  ctx.strokeStyle = brass
  ctx.lineWidth = 12
  ctx.beginPath()
  ctx.moveTo(232, 454)
  ctx.bezierCurveTo(224, 286, 244, 174, 300, 142)
  ctx.bezierCurveTo(404, 190, 430, 312, 392, 454)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(230, 455)
  ctx.quadraticCurveTo(314, 492, 402, 454)
  ctx.stroke()

  ctx.lineWidth = 4
  for (let index = 0; index < 6; index += 1) {
    const x = 258 + index * 23
    ctx.beginPath()
    ctx.moveTo(x, 202 + index * 13)
    ctx.lineTo(x + 12, 449)
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(85, 50, 19, 0.86)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '600 82px Georgia, serif'
  ctx.fillText('M', cx, 342)

  ctx.strokeStyle = brass
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(240, 552)
  ctx.lineTo(400, 552)
  ctx.stroke()

  ctx.save()
  ctx.translate(cx, 596)
  ctx.rotate(Math.PI / 4)
  ctx.fillStyle = 'rgba(112, 72, 31, 0.72)'
  ctx.fillRect(-10, -10, 20, 20)
  ctx.restore()
  return finishTexture(canvas)
}

export function createCarvingTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 1200
  const ctx = canvas.getContext('2d', { alpha: true })
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.translate(canvas.width / 2, 0)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const leaf = (x, y, angle, scale = 1) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.scale(scale, scale)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.bezierCurveTo(22, -17, 58, -17, 78, 0)
    ctx.bezierCurveTo(56, 19, 23, 17, 0, 0)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  const drawMotif = (strokeStyle, fillStyle, lineWidth, offsetX = 0) => {
    ctx.save()
    ctx.translate(offsetX, 0)
    ctx.strokeStyle = strokeStyle
    ctx.fillStyle = fillStyle
    ctx.lineWidth = lineWidth

    ctx.beginPath()
    ctx.moveTo(0, 1110)
    ctx.bezierCurveTo(-14, 944, 17, 796, 0, 650)
    ctx.bezierCurveTo(-16, 494, 15, 334, 0, 126)
    ctx.stroke()

    const tiers = [270, 455, 650, 845]
    tiers.forEach((y, index) => {
      const reach = [112, 142, 126, 94][index]
      const lift = [76, 88, 82, 68][index]
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(0, y + 70)
        ctx.bezierCurveTo(side * 26, y + 28, side * (reach * 0.58), y + 8, side * reach, y - lift)
        ctx.stroke()
        leaf(side * (reach * 0.56), y - lift * 0.34, side < 0 ? -2.7 : -0.44, 0.72)
        leaf(side * reach, y - lift, side < 0 ? 2.8 : 0.34, 0.88)
      }
    })

    ctx.beginPath()
    ctx.moveTo(0, 108)
    ctx.lineTo(34, 154)
    ctx.lineTo(0, 198)
    ctx.lineTo(-34, 154)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, 1085)
    ctx.lineTo(28, 1120)
    ctx.lineTo(0, 1154)
    ctx.lineTo(-28, 1120)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  drawMotif('rgba(238, 203, 133, 0.32)', 'rgba(222, 178, 99, 0.14)', 7, -2)
  drawMotif('rgba(82, 49, 22, 0.64)', 'rgba(128, 79, 33, 0.23)', 3.5)
  return finishTexture(canvas)
}
