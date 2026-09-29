import * as Tone from 'tone'
import { createSaxophone, createDrums } from './instruments.js'

// SynthEngine — создаёт голоса и эффекты, управляет общим воспроизведением.
export class SynthEngine {
  constructor(voices, settings, onStep) {
    this.voices = voices
    this.settings = settings
    this.onStep = onStep
    this.channels = new Map()
    this.nodes = []
    this.playing = false
    this.starting = false
    this.playbackId = 0
    this.stopping = Promise.resolve()
    this.visible = !document.hidden
    this.context = null
  }

  async createGraph() {
    this.gate = new Tone.Gain(0)
    this.volume = new Tone.Volume(this.settings.volume)
    this.limiter = new Tone.Limiter(-1).toDestination()
    this.meter = new Tone.Meter({ normalRange: false, smoothing: 0.7 })
    this.gate.chain(this.volume, this.limiter)
    this.limiter.connect(this.meter)
    this.nodes.push(this.gate, this.volume, this.limiter, this.meter)

    const playbackId = this.playbackId
    const pending = []

    this.voices.forEach((voice) => {
      const instrument =
        voice.id === 'saxophone' ? createSaxophone() : createDrums()
      this.nodes.push(...instrument.nodes)
      pending.push(instrument.ready)
      instrument.setMode(voice.mode)
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
        pan: voice.pan,
        mute: voice.muted
      })

      instrument.connect(filter)
      filter.chain(reverb, delay, channel, this.gate)
      this.nodes.push(filter, reverb, delay, channel)

      const sequence = new Tone.Sequence(
        (time, step) => {
          const event = voice.pattern[step]
          if (event && !voice.muted) instrument.play(event, time)

          if (!this.visible) return
          Tone.getDraw().schedule(() => {
            if (this.playing && playbackId === this.playbackId)
              this.onStep(voice.id, step)
          }, time)
        },
        voice.pattern.map((_, index) => index),
        '8n'
      ).start(0)

      this.channels.set(voice.id, { instrument, filter, reverb, delay, channel })
      this.nodes.push(sequence)
    })
    await Promise.all(pending)
  }

  async start() {
    if (this.playing || this.starting) return
    this.starting = true
    const playbackId = ++this.playbackId

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
      await this.createGraph()
      if (playbackId !== this.playbackId) return
      this.playing = true
      this.gate.gain.rampTo(1, 0.02)
      transport.start('+0.05')
    } catch (error) {
      this.dispose()
      throw error
    } finally {
      this.starting = false
    }
  }

  stop() {
    this.playbackId += 1
    this.playing = false
    Tone.getTransport().stop()
    Tone.getDraw().cancel(0)
    this.voices.forEach((voice) => this.onStep(voice.id, -1))

    const nodes = this.nodes.splice(0)
    const gate = this.gate
    this.channels.clear()
    this.meter = null
    this.gate = null
    this.volume = null
    this.limiter = null
    if (!nodes.length) return this.stopping

    gate.gain.rampTo(0, 0.03)
    this.stopping = new Promise((resolve) => {
      setTimeout(() => {
        nodes.forEach((node) => node.dispose())
        resolve()
      }, (this.context.lookAhead + 0.05) * 1000)
    }).then(() => this.context.rawContext.suspend())
    return this.stopping
  }

  setVisible(visible) {
    this.visible = visible
    if (!visible && this.context) Tone.getDraw().cancel(0)
  }

  setVoice(id, property, value) {
    const voice = this.voices.find((item) => item.id === id)
    voice[property] = value
    const nodes = this.channels.get(id)
    if (!nodes) return

    if (property === 'mode') nodes.instrument.setMode(value)
    if (property === 'volume') nodes.channel.volume.rampTo(value, 0.04)
    if (property === 'pan') nodes.channel.pan.rampTo(value, 0.04)
    if (property === 'cutoff') nodes.filter.frequency.rampTo(value, 0.04)
    if (property === 'echo') nodes.delay.wet.rampTo(value, 0.04)
    if (property === 'reverb') nodes.reverb.wet.rampTo(value, 0.04)
    if (property === 'muted') nodes.channel.mute = value
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
    this.playing = false
    if (this.context) {
      Tone.getTransport().stop()
      Tone.getDraw().cancel(0)
    }
    this.nodes.splice(0).forEach((node) => node.dispose())
    this.channels.clear()
    this.meter = null
    this.gate = null
    this.volume = null
    this.limiter = null
    if (this.context) {
      this.stopping = this.stopping.then(() => this.context.rawContext.suspend())
    }
  }
}
