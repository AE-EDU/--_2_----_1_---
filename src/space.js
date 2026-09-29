// SpaceScene — создаёт непрерывный полёт по орбите из звёзд и золотой пыли.
export class SpaceScene {
  constructor(canvas, button) {
    this.canvas = canvas
    this.context = canvas.getContext('2d')
    this.button = button
    this.motionPreference = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    )
    this.enabled = !this.motionPreference.matches
    this.energy = 0
    this.time = 0
    this.travel = 0
    this.frameInterval = 1000 / 30
    this.lastFrame = 0
    this.lastDraw = 0
    this.stars = Array.from({ length: 140 }, () => ({
      x: (Math.random() - 0.5) * 1.6,
      y: (Math.random() - 0.5) * 1.2,
      offset: Math.random(),
      size: Math.random() * 1.1 + 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.35 + 0.15
    }))
    this.dust = Array.from({ length: 55 }, () => ({
      offset: Math.random(),
      lane: Math.random(),
      size: Math.random() * 1.2 + 0.3
    }))
    this.resize = this.resize.bind(this)
    this.tick = this.tick.bind(this)
    this.toggle = () => {
      this.enabled = !this.enabled
      this.sync()
    }
    this.preferenceChanged = () => {
      this.enabled = !this.motionPreference.matches
      this.sync()
    }
    this.visibilityChanged = () => this.sync()
    button.addEventListener('click', this.toggle)
    window.addEventListener('resize', this.resize)
    document.addEventListener('visibilitychange', this.visibilityChanged)
    this.motionPreference.addEventListener('change', this.preferenceChanged)
    this.resize()
    this.sync()
  }

  resize() {
    this.width = window.innerWidth
    this.height = window.innerHeight
    const ratio = Math.min(
      window.devicePixelRatio || 1,
      1.25,
      Math.sqrt(1500000 / (this.width * this.height))
    )
    this.canvas.width = Math.round(this.width * ratio)
    this.canvas.height = Math.round(this.height * ratio)
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0)
    this.draw()
  }

  sync() {
    cancelAnimationFrame(this.frame)
    const running = this.enabled && !document.hidden
    document.body.dataset.motion = running ? 'on' : 'off'
    this.button.setAttribute('aria-pressed', String(this.enabled))
    this.button.querySelector('.motion-label').textContent = this.enabled
      ? 'Остановить фон'
      : 'Оживить фон'
    this.button.querySelector('.motion-icon').textContent = this.enabled
      ? 'Ⅱ'
      : '▷'
    this.lastFrame = 0
    this.lastDraw = 0
    if (running) this.frame = requestAnimationFrame(this.tick)
  }

  tick(now) {
    this.frame = requestAnimationFrame(this.tick)
    if (this.lastDraw && now - this.lastDraw < this.frameInterval) return
    const elapsed = this.lastFrame ? Math.min(now - this.lastFrame, 100) / 1000 : 0
    this.time += elapsed
    this.travel = (this.travel + elapsed * 0.012) % 1
    this.lastFrame = now
    this.lastDraw = now - ((now - this.lastDraw) % this.frameInterval)
    this.draw()
  }

  draw() {
    const ctx = this.context
    const { width, height, time } = this
    const focusX = width * 0.58
    const focusY = height * 0.42
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#ffe8c0'
    this.stars.forEach((star) => {
      const progress = (star.offset - this.travel + 1) % 1
      const depth = 0.22 + progress * 0.78
      const bend = 0.055 * (1 - depth) ** 2
      const x = focusX + ((star.x + bend) * width) / depth
      const y = focusY + (star.y * height) / depth
      if (x < -8 || x > width + 8 || y < -8 || y > height + 8) return
      const fade = Math.min(1, progress * 8, (1 - progress) * 8)
      const alpha = fade * (0.4 + Math.sin(time * star.speed + star.phase) * 0.15)
      const size = star.size * Math.min(2, 0.7 / depth)
      ctx.globalAlpha = alpha
      ctx.fillRect(x, y, size, size)
      if (star.size > 1.25) {
        ctx.globalAlpha = alpha * 0.3
        ctx.fillRect(x - 3.5, y - 0.35, 7, 0.7)
        ctx.fillRect(x - 0.35, y - 3.5, 0.7, 7)
      }
    })
    ctx.fillStyle = '#f4bd6d'
    this.dust.forEach((particle) => {
      const progress = (particle.offset - this.travel + 1) % 1
      const depth = 0.16 + progress * 0.84
      const curve = -0.24 * (1 - depth) ** 2
      const x = focusX + (((particle.lane - 0.5) * 0.28 + curve) * width) / depth
      const y = focusY + ((0.1 + particle.lane * 0.035) * height) / depth
      if (x < -4 || x > width + 4 || y > height + 4) return
      const size = particle.size * Math.min(2.5, 0.65 / depth)
      ctx.globalAlpha = Math.sin(progress * Math.PI) * (0.3 + this.energy * 0.2)
      ctx.fillRect(x, y, size * 1.6, size)
    })
    ctx.globalAlpha = 1
    const comet = time % 18
    if (comet > 12 && comet < 13.5) {
      const progress = (comet - 12) / 1.5
      const x = width * (0.76 - progress * 0.28)
      const y = height * (0.06 + progress * 0.15)
      const gradient = ctx.createLinearGradient(x, y, x + 90, y - 38)
      gradient.addColorStop(
        0,
        `rgba(255, 220, 160, ${Math.sin(progress * Math.PI) * 0.8})`
      )
      gradient.addColorStop(1, 'rgba(255, 220, 160, 0)')
      ctx.strokeStyle = gradient
      ctx.lineWidth = 1.3
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + 90, y - 38)
      ctx.stroke()
    }
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    this.button.removeEventListener('click', this.toggle)
    window.removeEventListener('resize', this.resize)
    document.removeEventListener('visibilitychange', this.visibilityChanged)
    this.motionPreference.removeEventListener('change', this.preferenceChanged)
  }
}
