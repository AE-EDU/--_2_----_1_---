export const settings = { tempo: 88, volume: -6, swing: 0.08 }

export const chords = [
  'Dm9',
  'Bbmaj7',
  'Fmaj7',
  'Cadd9',
  'Dm9',
  'Bbmaj7',
  'Cadd9',
  'Dm9'
]

const saxophone = [
  [
    null,
    ['A4', '8n', 0.56],
    ['D5', '4n', 0.76],
    null,
    ['C5', '8n', 0.64],
    ['A4', '4n', 0.68],
    null,
    null
  ],
  [
    ['F4', '4n.', 0.66],
    null,
    null,
    ['G4', '8n', 0.5],
    ['A4', '4n', 0.68],
    null,
    ['F4', '8n', 0.48],
    null
  ],
  [
    null,
    ['A4', '8n', 0.54],
    ['C5', '4n', 0.72],
    null,
    ['A4', '8n', 0.6],
    ['G4', '4n', 0.62],
    null,
    null
  ],
  [
    ['E4', '4n', 0.62],
    null,
    ['G4', '8n', 0.52],
    ['A4', '8n', 0.64],
    ['G4', '4n.', 0.65],
    null,
    null,
    ['E4', '8n', 0.48]
  ],
  [
    null,
    ['A4', '8n', 0.58],
    ['D5', '4n', 0.8],
    null,
    ['C5', '8n', 0.68],
    ['A4', '8n', 0.64],
    ['G4', '8n', 0.55],
    ['A4', '8n', 0.62]
  ],
  [
    ['F4', '4n.', 0.68],
    null,
    null,
    ['D4', '8n', 0.49],
    ['F4', '4n', 0.62],
    null,
    ['A4', '8n', 0.56],
    null
  ],
  [
    ['G4', '4n', 0.67],
    null,
    ['A4', '8n', 0.6],
    ['G4', '8n', 0.56],
    ['E4', '4n', 0.6],
    null,
    ['D4', '8n', 0.5],
    ['E4', '8n', 0.53]
  ],
  [['D4', '2n.', 0.66], null, null, null, null, null, null, null]
]
  .flat()
  .map(
    (note) => note && { note: note[0], duration: note[1], velocity: note[2] }
  )

const drums = Array.from({ length: chords.length }, (_, bar) => [
  { kick: 0.68, hat: bar % 4 === 0 ? 0 : 0.24, ride: bar % 4 === 0 ? 0.22 : 0 },
  { hat: 0.13 },
  { snare: 0.62, hat: 0.23 },
  { hat: 0.14, kick: bar % 2 === 1 ? 0.27 : 0 },
  { kick: 0.49, hat: 0.25 },
  { hat: 0.13, kick: bar % 2 === 0 ? 0.3 : 0 },
  { snare: 0.68, hat: 0.24 },
  { hat: 0.16, snare: bar % 4 === 3 ? 0.22 : 0 }
]).flat()

export const voices = [
  {
    id: 'saxophone',
    name: 'Саксофон',
    description: 'Певучая тема · мягкая фразировка',
    mode: 'soft',
    modes: [
      ['soft', 'Мягко'],
      ['airy', 'Воздушно'],
      ['short', 'Коротко']
    ],
    volume: -2,
    pan: -0.2,
    cutoff: 5200,
    echo: 0.16,
    reverb: 0.13,
    muted: false,
    pattern: saxophone
  },
  {
    id: 'drums',
    name: 'Барабаны',
    description: 'Мягкий бит · акценты на 2 и 4',
    mode: 'sticks',
    modes: [
      ['brushes', 'Щётки'],
      ['sticks', 'Палочки']
    ],
    volume: -4,
    pan: 0.2,
    cutoff: 6800,
    echo: 0.02,
    reverb: 0.06,
    muted: false,
    pattern: drums
  }
]

export function getStepLabel(voice, step) {
  const event = voice.pattern[step]
  if (!event) return '—'
  if (voice.id === 'saxophone') return event.note
  return Object.entries({ kick: 'Б', snare: 'М', hat: 'Х', ride: 'Р' })
    .filter(([instrument]) => event[instrument])
    .map(([, label]) => label)
    .join('·')
}
