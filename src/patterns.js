export const settings = { tempo: 92, volume: -8 }

export const voices = [
  {
    id: 'bass',
    name: 'Опора',
    description: 'Низкая ритмическая линия',
    waveform: 'triangle',
    volume: -12,
    pan: -0.25,
    cutoff: 1200,
    echo: 0.12,
    muted: false,
    duration: '16n',
    notes: ['D2', null, 'D2', 'A2', 'F2', null, 'C3', 'A2']
  },
  {
    id: 'melody',
    name: 'Контур',
    description: 'Верхняя мелодическая линия',
    waveform: 'sine',
    volume: -15,
    pan: 0.25,
    cutoff: 3200,
    echo: 0.24,
    muted: false,
    duration: '8n',
    notes: ['D4', 'A4', null, 'F4', 'E4', null, 'A3', 'C4']
  }
]
