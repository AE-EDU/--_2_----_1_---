import * as Tone from 'tone'

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
  }

  createGraph() {
    this.gate = new Tone.Gain(0)
    this.volume = new Tone.Volume(this.settings.volume)
    this.limiter = new Tone.Limiter(-1).toDestination()
    this.meter = new Tone.Meter({ normalRange: false, smoothing: 0.7 })
    this.gate.chain(this.volume, this.limiter)
    this.limiter.connect(this.meter)
    this.nodes.push(this.gate, this.volume, this.limiter, this.meter)

    const playbackId = this.playbackId

    this.voices.forEach((voice) => {
      const synth = new Tone.Synth({
        oscillator: { type: voice.waveform },
        envelope: { attack: 0.015, decay: 0.18, sustain: 0.3, release: 0.25 }
      })
      const filter = new Tone.Filter(voice.cutoff, 'lowpass')
      const delay = new Tone.FeedbackDelay({
        delayTime: '8n.',
        feedback: 0.24,
        wet: voice.echo
      })
      const channel = new Tone.Channel({
        volume: voice.volume,
        pan: voice.pan,
        mute: voice.muted
      })

      synth.chain(filter, delay, channel, this.gate)

      const sequence = new Tone.Sequence(
        (time, step) => {
          if (voice.notes[step] && !voice.muted) {
            synth.triggerAttackRelease(
              voice.notes[step],
              voice.duration,
              time,
              0.65
            )
          }

          Tone.getDraw().schedule(() => {
            if (this.playing && playbackId === this.playbackId)
              this.onStep(voice.id, step)
          }, time)
        },
        voice.notes.map((_, index) => index),
        '8n'
      ).start(0)

      this.channels.set(voice.id, { synth, filter, delay, channel })
      this.nodes.push(sequence, synth, filter, delay, channel)
    })
  }

  async start() {
    if (this.playing || this.starting) return
    this.starting = true
    const playbackId = ++this.playbackId

    try {
      await Tone.start()
      await this.stopping
      if (playbackId !== this.playbackId) return

      const transport = Tone.getTransport()
      transport.bpm.value = this.settings.tempo
      transport.position = 0
      this.createGraph()
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
    Tone.getDraw().cancel()
    this.voices.forEach((voice) => this.onStep(voice.id, -1))

    const nodes = this.nodes.splice(0)
    this.channels.clear()
    this.meter = null
    if (!nodes.length) return this.stopping

    this.gate.gain.rampTo(0, 0.03)
    this.stopping = new Promise((resolve) => {
      setTimeout(() => {
        nodes.forEach((node) => node.dispose())
        resolve()
      }, 80)
    })
    return this.stopping
  }

  setVoice(id, property, value) {
    const voice = this.voices.find((item) => item.id === id)
    voice[property] = value
    const nodes = this.channels.get(id)
    if (!nodes) return

    if (property === 'waveform') nodes.synth.oscillator.type = value
    if (property === 'volume') nodes.channel.volume.rampTo(value, 0.04)
    if (property === 'pan') nodes.channel.pan.rampTo(value, 0.04)
    if (property === 'cutoff') nodes.filter.frequency.rampTo(value, 0.04)
    if (property === 'echo') nodes.delay.wet.rampTo(value, 0.04)
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
    Tone.getTransport().stop()
    Tone.getDraw().cancel()
    this.nodes.splice(0).forEach((node) => node.dispose())
    this.channels.clear()
    this.meter = null
  }
}
