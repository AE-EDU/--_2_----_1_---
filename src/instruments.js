import * as Tone from 'tone'

// createSaxophone — воспроизводит семплы саксофона с разной артикуляцией.
export function createSaxophone() {
  let timer
  let resolveLoad
  let rejectLoad
  const loaded = new Promise((resolve, reject) => {
    resolveLoad = resolve
    rejectLoad = reject
  })
  const sampler = new Tone.Sampler({
    urls: {
      C4: 'C4.mp3',
      F4: 'F4.mp3',
      A4: 'A4.mp3',
      C5: 'C5.mp3',
      D5: 'D5.mp3'
    },
    baseUrl: `${import.meta.env.BASE_URL}samples/saxophone/`,
    attack: 0.025,
    release: 0.22,
    onload: resolveLoad,
    onerror: rejectLoad
  })
  const ready = Promise.race([
    loaded,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Sample loading timed out')),
        20000
      )
    })
  ]).finally(() => clearTimeout(timer))

  return {
    nodes: [sampler],
    ready,
    connect: (destination) => sampler.connect(destination),
    play: (event, time) =>
      sampler.triggerAttackRelease(
        event.note,
        event.duration,
        time,
        event.velocity
      ),
    setMode(mode) {
      const envelopes = {
        soft: [0.025, 0.22],
        airy: [0.045, 0.32],
        short: [0.002, 0.065]
      }
      const [attack, release] = envelopes[mode]
      sampler.attack = attack
      sampler.release = release
    }
  }
}

// createDrums — синтезирует бочку, малый барабан, райд и закрытый хай-хэт.
export function createDrums() {
  const output = new Tone.Gain(1)
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.025,
    octaves: 2.5,
    volume: -4,
    envelope: { attack: 0.002, decay: 0.22, sustain: 0, release: 0.08 }
  }).connect(output)
  const snareFilter = new Tone.Filter(900, 'highpass').connect(output)
  const snare = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    volume: -6,
    envelope: { attack: 0.018, decay: 0.16, sustain: 0, release: 0.06 }
  }).connect(snareFilter)
  const ride = new Tone.MetalSynth({
    harmonicity: 5.1,
    modulationIndex: 24,
    resonance: 3800,
    octaves: 1.2,
    volume: -17,
    envelope: { attack: 0.002, decay: 0.55, release: 0.12 }
  }).connect(output)
  const hatFilter = new Tone.Filter(6500, 'highpass').connect(output)
  const hat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    volume: -13,
    envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.02 }
  }).connect(hatFilter)

  return {
    nodes: [kick, snare, ride, hat, snareFilter, hatFilter, output],
    ready: Promise.resolve(),
    connect: (destination) => output.connect(destination),
    play(event, time) {
      if (event.kick) kick.triggerAttackRelease('C2', '16n', time, event.kick)
      if (event.snare) snare.triggerAttackRelease('32n', time, event.snare)
      if (event.ride) ride.triggerAttackRelease('D#3', '16n', time, event.ride)
      if (event.hat) hat.triggerAttackRelease('64n', time, event.hat)
    },
    setMode(mode) {
      const brushes = mode === 'brushes'
      snare.noise.type = brushes ? 'pink' : 'white'
      snare.envelope.attack = brushes ? 0.018 : 0.002
      snare.envelope.decay = brushes ? 0.16 : 0.1
      snare.volume.rampTo(brushes ? -6 : -9, 0.04)
    }
  }
}
