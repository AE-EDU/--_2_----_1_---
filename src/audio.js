import * as Tone from 'tone'
import { createSaxophone, createDrums } from './instruments.js'

// SynthEngine — синхронизирует партии, обработку и завершение исполнения.
export class SynthEngine {
  constructor(voices, settings, { onStep, onStateChange, onVoiceChange }) {
    this.voices = voices
    this.settings = settings
    this.onStep = onStep
    this.onStateChange = onStateChange
    this.onVoiceChange = onVoiceChange
    this.initialSettings = { ...settings }
    this.initialVoices = voices.map((voice) => ({ ...voice }))
    this.channels = new Map()
    this.nodes = []
    this.state = 'stopped'
    this.playbackId = 0
    this.stopping = Promise.resolve()
    this.visible = !document.hidden
    this.context = null
    this.tailTimer = null
  }

  get playing() {
    return ['playing', 'ending', 'tail'].includes(this.state)
  }

  setState(state) {
    this.state = state
    this.onStateChange(state)
  }

  async createGraph() {
    this.gate = new Tone.Gain(0)
    this.volume = new Tone.Volume(this.settings.volume)
    // Калибровка уровня тихих семплов с запасом на суммирование голосов.
    this.outputGain = new Tone.Gain(Tone.dbToGain(6))
    // Жёсткое колено и быстрая атака удерживают пики при суммировании в один канал.
    this.limiter = new Tone.Compressor({
      threshold: -6,
      ratio: 20,
      knee: 0,
      attack: 0.001,
      release: 0.1
    }).toDestination()
    this.meter = new Tone.Meter({ normalRange: false, smoothing: 0.7 })
    this.gate.chain(this.volume, this.outputGain, this.limiter)
    this.limiter.connect(this.meter)
    this.nodes.push(
      this.gate,
      this.volume,
      this.outputGain,
      this.limiter,
      this.meter
    )

    const playbackId = this.playbackId
    const pending = []

    this.voices.forEach((voice) => {
      const instrument =
        voice.id === 'saxophone' ? createSaxophone() : createDrums()
      this.nodes.push(...instrument.nodes)
      pending.push(instrument.ready)
      instrument.setMode(voice.mode)
      // Гасим вход голоса, оставляя уже возникшие эхо и реверберацию.
      const input = new Tone.Gain(voice.muted ? 0 : 1)
      const highpass = new Tone.Filter(
        voice.id === 'saxophone' ? 120 : 32,
        'highpass'
      )
      const filter = new Tone.Filter(voice.cutoff, 'lowpass')
      const reverb = new Tone.Freeverb({
        roomSize: 0.55,
        dampening: 4500,
        wet: voice.reverb
      })
      const delay = new Tone.FeedbackDelay({
        delayTime: '8n.',
        feedback: 0.2,
        wet: voice.echo
      })
      const channel = new Tone.Channel({
        volume: voice.volume,
        pan: voice.pan
      })

      instrument.connect(input)
      input.chain(highpass, filter)
      filter.chain(reverb, delay, channel, this.gate)
      this.nodes.push(input, highpass, filter, reverb, delay, channel)
      this.channels.set(voice.id, {
        instrument,
        input,
        highpass,
        filter,
        reverb,
        delay,
        channel
      })
    })

    const sequence = new Tone.Sequence(
      (time, step) => {
        if (!this.playing || this.state === 'tail') return
        if (step === 0 && this.state === 'ending' && this.hasPlayed) {
          this.beginTail(time)
          return
        }
        this.hasPlayed = true
        if (step === 0) this.cycle += 1
        const cycle = this.cycle

        const frames = this.voices.map((voice) => {
          const variantChanged =
            step % 8 === 0 && voice.pendingVariant !== null
          const mutedChanged = step % 8 === 0 && voice.pendingMuted !== null
          if (variantChanged) this.applyVariant(voice, voice.pendingVariant)
          if (mutedChanged) this.applyMuted(voice, voice.pendingMuted, time)
          const event = voice.pattern[step]
          if (event && !voice.muted) {
            this.channels.get(voice.id).instrument.play(event, time)
          }
          return {
            id: voice.id,
            pattern: voice.pattern,
            changed: variantChanged || mutedChanged
          }
        })

        if (!this.visible) return
        Tone.getDraw().schedule(() => {
          if (!this.playing || playbackId !== this.playbackId) return
          frames.forEach(({ id, pattern, changed }) => {
            this.onStep(id, step, pattern, cycle)
            if (changed) this.onVoiceChange(id)
          })
        }, time)
      },
      this.voices[0].pattern.map((_, index) => index),
      '8n'
    ).start(0)
    this.nodes.push(sequence)
    await Promise.all(pending)
  }

  async start() {
    if (this.state !== 'stopped') return
    const playbackId = ++this.playbackId
    this.setState('starting')

    try {
      await this.stopping
      if (playbackId !== this.playbackId) return
      this.context = Tone.getContext()
      await this.context.resume()
      if (playbackId !== this.playbackId) return

      const transport = Tone.getTransport()
      transport.bpm.value = this.settings.tempo
      transport.position = 0
      transport.swing = this.settings.swing
      transport.swingSubdivision = '8n'
      this.hasPlayed = false
      this.cycle = 0
      await this.createGraph()
      if (playbackId !== this.playbackId) return
      this.setState('playing')
      this.gate.gain.rampTo(1, 0.02)
      transport.start('+0.05')
    } catch (error) {
      if (playbackId !== this.playbackId) return
      await this.stop()
      throw error
    }
  }

  finish() {
    if (this.state === 'playing') this.setState('ending')
    else if (this.state === 'ending') this.setState('playing')
  }

  beginTail(time) {
    Tone.getTransport().stop(time)
    this.setState('tail')
    this.voices.forEach((voice) => {
      voice.pendingVariant = null
      voice.pendingMuted = null
      this.onVoiceChange(voice.id)
      this.onStep(voice.id, -1)
    })
    this.gate.gain.setValueAtTime(1, time + 1)
    this.gate.gain.linearRampToValueAtTime(0, time + 4)
    this.tailTimer = setTimeout(
      () => this.stop(),
      Math.max(0, time + 4 - this.context.immediate()) * 1000
    )
  }

  stop() {
    if (this.state === 'stopping') return this.stopping
    const playbackId = ++this.playbackId
    clearTimeout(this.tailTimer)
    this.tailTimer = null
    Tone.getTransport().stop()
    Tone.getDraw().cancel(0)
    this.voices.forEach((voice) => {
      voice.pendingVariant = null
      voice.pendingMuted = null
      this.onVoiceChange(voice.id)
      this.onStep(voice.id, -1)
    })

    const nodes = this.nodes.splice(0)
    const gate = this.gate
    const context = this.context
    this.channels.clear()
    this.meter = null
    this.gate = null
    this.volume = null
    this.outputGain = null
    this.limiter = null
    if (!nodes.length) {
      this.setState('stopped')
      return this.stopping
    }

    this.setState('stopping')
    gate.gain.rampTo(0, 0.03)
    this.stopping = new Promise((resolve) => {
      setTimeout(
        () => {
          nodes.forEach((node) => node.dispose())
          resolve()
        },
        (context.lookAhead + 0.05) * 1000
      )
    }).then(async () => {
      await context.rawContext.suspend()
      if (playbackId === this.playbackId) this.setState('stopped')
    })
    return this.stopping
  }

  applyVariant(voice, id) {
    const variant = voice.variants.find((item) => item.id === id)
    voice.variant = variant.id
    voice.pattern = variant.pattern
    voice.pendingVariant = null
  }

  applyMuted(voice, muted, time) {
    voice.muted = muted
    voice.pendingMuted = null
    this.channels
      .get(voice.id)
      ?.input.gain.rampTo(muted ? 0 : 1, 0.035, time)
  }

  setVariant(id, value) {
    const voice = this.voices.find((item) => item.id === id)
    if (!voice?.variants.some((item) => item.id === value)) return
    if (this.state === 'tail' || this.state === 'stopping') return
    if (this.playing) {
      voice.pendingVariant = value === voice.variant ? null : value
    } else {
      this.applyVariant(voice, value)
      this.onStep(id, -1)
    }
    this.onVoiceChange(id)
  }

  reset() {
    if (this.state !== 'stopped') return
    Object.assign(this.settings, this.initialSettings)
    this.voices.forEach((voice, index) => {
      Object.assign(voice, this.initialVoices[index])
      this.onVoiceChange(voice.id)
      this.onStep(voice.id, -1)
    })
  }

  setVisible(visible) {
    this.visible = visible
    if (!visible && this.context) Tone.getDraw().cancel(0)
    if (visible) this.voices.forEach((voice) => this.onVoiceChange(voice.id))
  }

  setVoice(id, property, value) {
    const voice = this.voices.find((item) => item.id === id)
    if (!voice) return
    if (property === 'muted') {
      if (['starting', 'tail', 'stopping'].includes(this.state)) return
      if (this.playing) {
        voice.pendingMuted = value === voice.muted ? null : value
      } else {
        this.applyMuted(voice, value)
      }
      this.onVoiceChange(id)
      return
    }
    voice[property] = value
    const nodes = this.channels.get(id)
    if (!nodes) return

    if (property === 'mode') nodes.instrument.setMode(value)
    if (property === 'volume') nodes.channel.volume.rampTo(value, 0.04)
    if (property === 'pan') nodes.channel.pan.rampTo(value, 0.04)
    if (property === 'cutoff') nodes.filter.frequency.rampTo(value, 0.04)
    if (property === 'echo') nodes.delay.wet.rampTo(value, 0.04)
    if (property === 'reverb') nodes.reverb.wet.rampTo(value, 0.04)
  }

  setTempo(value) {
    this.settings.tempo = value
    if (this.playing) Tone.getTransport().bpm.rampTo(value, 0.1)
  }

  setVolume(value) {
    this.settings.volume = value
    if (this.playing) this.volume.volume.rampTo(value, 0.04)
  }

  getLevel() {
    return this.meter ? this.meter.getValue() : -Infinity
  }

  dispose() {
    this.playbackId += 1
    clearTimeout(this.tailTimer)
    this.tailTimer = null
    this.voices.forEach((voice) => {
      voice.pendingVariant = null
      voice.pendingMuted = null
    })
    if (this.context) {
      Tone.getTransport().stop()
      Tone.getDraw().cancel(0)
    }
    this.nodes.splice(0).forEach((node) => node.dispose())
    this.channels.clear()
    this.meter = null
    this.gate = null
    this.volume = null
    this.outputGain = null
    this.limiter = null
    if (this.context) {
      const context = this.context
      this.stopping = this.stopping.then(() => context.rawContext.suspend())
    }
    this.setState('stopped')
  }
}
