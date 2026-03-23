import { ref, onMounted, onUnmounted } from 'vue'

type IconType = 'dot' | 'cross' | 'heart' | 'pill' | 'pulse' | 'dna' | 'syringe' | 'flask'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  alpha: number
  pulseSpeed: number
  pulseOffset: number
  icon: IconType
  rotation: number
  rotationSpeed: number
}

function drawCross(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number, color: string, rotation: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.strokeStyle = `${color} ${alpha})`
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, -size)
  ctx.lineTo(0, size)
  ctx.moveTo(-size, 0)
  ctx.lineTo(size, 0)
  ctx.stroke()
  ctx.restore()
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number, color: string, rotation: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.strokeStyle = `${color} ${alpha})`
  ctx.lineWidth = 1.2
  ctx.beginPath()
  const s = size * 0.8
  ctx.moveTo(0, s * 0.4)
  ctx.bezierCurveTo(-s, -s * 0.3, -s * 0.5, -s, 0, -s * 0.4)
  ctx.bezierCurveTo(s * 0.5, -s, s, -s * 0.3, 0, s * 0.4)
  ctx.stroke()
  ctx.restore()
}

function drawPill(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number, color: string, rotation: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.strokeStyle = `${color} ${alpha})`
  ctx.lineWidth = 1.2
  ctx.lineCap = 'round'
  const h = size * 1.2
  const r = size * 0.4
  ctx.beginPath()
  ctx.moveTo(-r, -h / 2)
  ctx.arc(0, -h / 2, r, Math.PI, 0)
  ctx.lineTo(r, h / 2)
  ctx.arc(0, h / 2, r, 0, Math.PI)
  ctx.closePath()
  ctx.stroke()
  // divider line
  ctx.beginPath()
  ctx.moveTo(-r, 0)
  ctx.lineTo(r, 0)
  ctx.stroke()
  ctx.restore()
}

function drawPulse(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = `${color} ${alpha})`
  ctx.lineWidth = 1.3
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const s = size
  ctx.beginPath()
  ctx.moveTo(-s * 1.5, 0)
  ctx.lineTo(-s * 0.8, 0)
  ctx.lineTo(-s * 0.5, -s * 0.8)
  ctx.lineTo(-s * 0.1, s * 0.6)
  ctx.lineTo(s * 0.3, -s)
  ctx.lineTo(s * 0.6, s * 0.3)
  ctx.lineTo(s * 0.8, 0)
  ctx.lineTo(s * 1.5, 0)
  ctx.stroke()
  ctx.restore()
}

function drawDna(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number, color: string, rotation: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.strokeStyle = `${color} ${alpha})`
  ctx.lineWidth = 1.2
  ctx.lineCap = 'round'
  const s = size
  // two helix strands
  ctx.beginPath()
  for (let i = -3; i <= 3; i++) {
    const py = (i / 3) * s * 1.2
    const px = Math.sin((i / 3) * Math.PI) * s * 0.5
    if (i === -3) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.beginPath()
  for (let i = -3; i <= 3; i++) {
    const py = (i / 3) * s * 1.2
    const px = -Math.sin((i / 3) * Math.PI) * s * 0.5
    if (i === -3) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  // rungs
  for (let i = -2; i <= 2; i++) {
    const py = (i / 3) * s * 1.2
    const px1 = Math.sin((i / 3) * Math.PI) * s * 0.5
    const px2 = -Math.sin((i / 3) * Math.PI) * s * 0.5
    ctx.beginPath()
    ctx.moveTo(px1, py)
    ctx.lineTo(px2, py)
    ctx.stroke()
  }
  ctx.restore()
}

function drawSyringe(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number, color: string, rotation: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.strokeStyle = `${color} ${alpha})`
  ctx.lineWidth = 1.2
  ctx.lineCap = 'round'
  const s = size
  // barrel
  ctx.beginPath()
  ctx.rect(-s * 0.25, -s * 0.8, s * 0.5, s * 1.2)
  ctx.stroke()
  // plunger
  ctx.beginPath()
  ctx.moveTo(-s * 0.15, -s * 0.8)
  ctx.lineTo(-s * 0.15, -s * 1.2)
  ctx.lineTo(s * 0.15, -s * 1.2)
  ctx.lineTo(s * 0.15, -s * 0.8)
  ctx.stroke()
  // plunger handle
  ctx.beginPath()
  ctx.moveTo(-s * 0.3, -s * 1.2)
  ctx.lineTo(s * 0.3, -s * 1.2)
  ctx.stroke()
  // needle
  ctx.beginPath()
  ctx.moveTo(0, s * 0.4)
  ctx.lineTo(0, s * 1.2)
  ctx.stroke()
  // tick marks
  for (let t = -0.4; t <= 0.2; t += 0.3) {
    ctx.beginPath()
    ctx.moveTo(-s * 0.25, s * t)
    ctx.lineTo(-s * 0.1, s * t)
    ctx.stroke()
  }
  ctx.restore()
}

function drawFlask(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number, color: string, rotation: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.strokeStyle = `${color} ${alpha})`
  ctx.lineWidth = 1.2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const s = size
  // neck
  ctx.beginPath()
  ctx.moveTo(-s * 0.15, -s * 1.1)
  ctx.lineTo(-s * 0.15, -s * 0.3)
  // body left
  ctx.lineTo(-s * 0.6, s * 0.6)
  ctx.quadraticCurveTo(-s * 0.6, s * 1.0, -s * 0.2, s * 1.0)
  // bottom
  ctx.lineTo(s * 0.2, s * 1.0)
  ctx.quadraticCurveTo(s * 0.6, s * 1.0, s * 0.6, s * 0.6)
  // body right + neck
  ctx.lineTo(s * 0.15, -s * 0.3)
  ctx.lineTo(s * 0.15, -s * 1.1)
  ctx.stroke()
  // rim
  ctx.beginPath()
  ctx.moveTo(-s * 0.25, -s * 1.1)
  ctx.lineTo(s * 0.25, -s * 1.1)
  ctx.stroke()
  // liquid line
  ctx.beginPath()
  ctx.moveTo(-s * 0.4, s * 0.3)
  ctx.lineTo(s * 0.4, s * 0.3)
  ctx.stroke()
  ctx.restore()
}

function drawDoctor(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = `${color} ${alpha})`
  ctx.lineWidth = 1.2
  ctx.lineCap = 'round'
  const s = size
  // outer circle
  ctx.beginPath()
  ctx.arc(0, 0, s, 0, Math.PI * 2)
  ctx.stroke()
  // head
  ctx.beginPath()
  ctx.arc(0, -s * 0.25, s * 0.28, 0, Math.PI * 2)
  ctx.stroke()
  // shoulders/body (arc from bottom)
  ctx.beginPath()
  ctx.arc(0, s * 0.9, s * 0.55, Math.PI * 1.2, Math.PI * 1.8)
  ctx.stroke()
  // head mirror (forehead circle)
  ctx.beginPath()
  ctx.arc(s * 0.18, -s * 0.48, s * 0.1, 0, Math.PI * 2)
  ctx.stroke()
  // mirror band
  ctx.beginPath()
  ctx.moveTo(s * 0.08, -s * 0.5)
  ctx.quadraticCurveTo(-s * 0.15, -s * 0.6, -s * 0.25, -s * 0.45)
  ctx.stroke()
  // stethoscope
  ctx.beginPath()
  ctx.moveTo(-s * 0.15, s * 0.1)
  ctx.quadraticCurveTo(-s * 0.3, s * 0.3, -s * 0.2, s * 0.45)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(-s * 0.2, s * 0.5, s * 0.06, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

export function useNeuralNetwork() {
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  let animationId: number | undefined
  let resizeHandler: (() => void) | undefined

  function init() {
    const canvas = canvasRef.value
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx!.scale(dpr, dpr)
    }

    resize()
    resizeHandler = resize
    window.addEventListener('resize', resize)

    const particleColors = [
      'rgba(0, 41, 84,',
      'rgba(0, 178, 178,',
      'rgba(59, 130, 246,',
      'rgba(16, 185, 129,',
    ]

    const iconTypes: IconType[] = ['heart', 'pill', 'pulse', 'dna', 'syringe', 'flask']

    const particles: Particle[] = []
    const count = Math.min(50, Math.floor((window.innerWidth * window.innerHeight) / 20000))
    const connectionDistance = 180

    for (let i = 0; i < count; i++) {
      // ~25% of particles become medical icons
      const isIcon = i < count * 0.25
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * (isIcon ? 0.25 : 0.4),
        vy: (Math.random() - 0.5) * (isIcon ? 0.25 : 0.4),
        radius: isIcon ? 8 + Math.random() * 5 : 1.5 + Math.random() * 2,
        color: particleColors[Math.floor(Math.random() * particleColors.length)]!,
        alpha: isIcon ? 0.4 + Math.random() * 0.25 : 0.3 + Math.random() * 0.4,
        pulseSpeed: 0.01 + Math.random() * 0.02,
        pulseOffset: Math.random() * Math.PI * 2,
        icon: isIcon ? iconTypes[Math.floor(Math.random() * iconTypes.length)]! : 'dot',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.003,
      })
    }

    let time = 0

    function animate() {
      if (!ctx || !canvas) return
      const cw = canvas.width / dpr
      const ch = canvas.height / dpr

      ctx.clearRect(0, 0, cw, ch)
      time += 1

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > cw) p.vx *= -1
        if (p.y < 0 || p.y > ch) p.vy *= -1

        const pulse = Math.sin(time * p.pulseSpeed + p.pulseOffset) * 0.15
        const currentAlpha = p.alpha + pulse

        if (p.icon === 'dot') {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
          ctx.fillStyle = `${p.color} ${currentAlpha})`
          ctx.fill()

          // glow
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2)
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3)
          gradient.addColorStop(0, `${p.color} ${currentAlpha * 0.3})`)
          gradient.addColorStop(1, `${p.color} 0)`)
          ctx.fillStyle = gradient
          ctx.fill()
        } else {
          p.rotation += p.rotationSpeed
          const size = p.radius

          switch (p.icon) {
            case 'cross':
              drawCross(ctx, p.x, p.y, size, currentAlpha, p.color, p.rotation)
              break
            case 'heart':
              drawHeart(ctx, p.x, p.y, size, currentAlpha, p.color, p.rotation)
              break
            case 'pill':
              drawPill(ctx, p.x, p.y, size, currentAlpha, p.color, p.rotation)
              break
            case 'pulse':
              drawPulse(ctx, p.x, p.y, size, currentAlpha, p.color)
              break
            case 'dna':
              drawDna(ctx, p.x, p.y, size, currentAlpha, p.color, p.rotation)
              break
            case 'syringe':
              drawSyringe(ctx, p.x, p.y, size, currentAlpha, p.color, p.rotation)
              break
            case 'flask':
              drawFlask(ctx, p.x, p.y, size, currentAlpha, p.color, p.rotation)
              break
          }
        }
      }

      // connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]!
          const b = particles[j]!
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < connectionDistance) {
            const opacity = (1 - dist / connectionDistance) * 0.35
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(0, 178, 178, ${opacity})`
            ctx.lineWidth = 0.8
            ctx.stroke()
          }
        }
      }

      // traveling pulse
      if (time % 120 === 0 && particles.length > 1) {
        const i = Math.floor(Math.random() * particles.length)
        const a = particles[i]!
        let nearest = particles[i === 0 ? 1 : 0]!
        let minDist = Infinity
        for (const b of particles) {
          if (b === a) continue
          const d = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
          if (d < minDist && d < connectionDistance) { minDist = d; nearest = b }
        }
        if (minDist < connectionDistance) {
          const gradient = ctx.createLinearGradient(a.x, a.y, nearest.x, nearest.y)
          gradient.addColorStop(0, 'rgba(0, 178, 178, 0.4)')
          gradient.addColorStop(0.5, 'rgba(0, 178, 178, 0)')
          gradient.addColorStop(1, 'rgba(0, 178, 178, 0.4)')
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(nearest.x, nearest.y)
          ctx.strokeStyle = gradient
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }

      animationId = requestAnimationFrame(animate)
    }

    animate()
  }

  onMounted(() => init())

  onUnmounted(() => {
    if (resizeHandler) window.removeEventListener('resize', resizeHandler)
    if (animationId) cancelAnimationFrame(animationId)
  })

  return { canvasRef }
}
