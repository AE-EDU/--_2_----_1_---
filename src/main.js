import './style.css'
import { settings, voices } from './patterns.js'
import { SynthEngine } from './audio.js'

const formatDb = (value) => `${value < 0 ? '−' : ''}${Math.abs(value)} дБ`
const controls = [
  {
    key: 'volume',
    label: 'Громкость',
    min: -36,
    max: 0,
    step: 1,
    ends: ['Тише', 'Громче'],
    format: formatDb
  },
  {
    key: 'pan',
    label: 'Панорама',
    min: -1,
    max: 1,
    step: 0.05,
    ends: ['Лево', 'Право'],
    format: (value) =>
      value === 0
        ? 'Центр'
        : `${Math.round(Math.abs(value) * 100)}% ${value < 0 ? 'Л' : 'П'}`
  },
  {
    key: 'cutoff',
    label: 'Фильтр',
    min: 100,
    max: 8000,
    step: 100,
    ends: ['Темнее', 'Ярче'],
    format: (value) => `${(value / 1000).toLocaleString('ru-RU')} кГц`
  },
  {
    key: 'echo',
    label: 'Эхо',
    min: 0,
    max: 0.6,
    step: 0.01,
    ends: ['Сухой звук', 'Больше эха'],
    format: (value) => `${Math.round(value * 100)}%`
  }
]

const playButton = document.querySelector('#play')
const stopButton = document.querySelector('#stop')
const status = document.querySelector('#status')
const errorMessage = document.querySelector('#error')
const cards = new Map()
const engine = new SynthEngine(voices, settings, (id, step) => {
  cards
    .get(id)
    .querySelectorAll('.step')
    .forEach((element, index) => {
      element.classList.toggle('is-active', index === step)
    })
})

// createVoicePanel — связывает регуляторы одного голоса с его настройками.
function createVoicePanel(voice, index) {
  const card = document.createElement('section')
  card.className = 'voice'
  card.dataset.voice = voice.id
  card.setAttribute('aria-labelledby', `${voice.id}-title`)
  card.innerHTML = `
    <header class="voice-header">
      <div><span class="voice-number">0${index + 1} / ГОЛОС</span><h2 id="${voice.id}-title">${voice.name}</h2><p>${voice.description}</p></div>
      <button class="mute-button" type="button" aria-pressed="false" aria-label="Выключить голос ${voice.name}"><span class="voice-dot"></span><span class="mute-label">Включён</span></button>
    </header>
    <div class="pattern" aria-label="Партия голоса ${voice.name}">
      ${voice.notes.map((note, i) => `<span class="step ${note ? '' : 'is-rest'}"><span class="step-index">${i + 1}</span><span>${note || '—'}</span></span>`).join('')}
    </div>
    <div class="waveform-control"><label for="${voice.id}-waveform">Форма волны</label><select id="${voice.id}-waveform"><option value="sine">Синус</option><option value="triangle">Треугольник</option><option value="sawtooth">Пила</option></select></div>
    <div class="voice-controls">
      ${controls
        .map(
          (control) => `
        <div class="control">
          <label for="${voice.id}-${control.key}">${control.label}<output for="${voice.id}-${control.key}">${control.format(voice[control.key])}</output></label>
          <input id="${voice.id}-${control.key}" data-property="${control.key}" type="range" min="${control.min}" max="${control.max}" step="${control.step}" value="${voice[control.key]}" />
          <div class="range-labels"><span>${control.ends[0]}</span><span>${control.ends[1]}</span></div>
        </div>`
        )
        .join('')}
    </div>`

  const waveform = card.querySelector('select')
  waveform.value = voice.waveform
  waveform.addEventListener('change', () =>
    engine.setVoice(voice.id, 'waveform', waveform.value)
  )

  card.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => {
      const control = controls.find(
        (item) => item.key === input.dataset.property
      )
      const value = Number(input.value)
      engine.setVoice(voice.id, control.key, value)
      input.closest('.control').querySelector('output').value =
        control.format(value)
      updateRange(input)
    })
  })

  const muteButton = card.querySelector('.mute-button')
  muteButton.addEventListener('click', () => {
    engine.setVoice(voice.id, 'muted', !voice.muted)
    muteButton.setAttribute('aria-pressed', String(voice.muted))
    muteButton.setAttribute(
      'aria-label',
      `${voice.muted ? 'Включить' : 'Выключить'} голос ${voice.name}`
    )
    card.querySelector('.mute-label').textContent = voice.muted
      ? 'Выключен'
      : 'Включён'
    card.classList.toggle('is-muted', voice.muted)
  })

  cards.set(voice.id, card)
  return card
}

function updateRange(input) {
  const fill =
    (Number(input.value) - Number(input.min)) /
    (Number(input.max) - Number(input.min))
  input.style.setProperty('--fill', `${fill * 100}%`)
}

function setPlaybackState(state) {
  const labels = {
    stopped: 'Остановлен',
    starting: 'Включаем звук…',
    playing: 'Играет',
    stopping: 'Останавливаем…'
  }
  status.textContent = labels[state]
  document.body.dataset.playback = state
  playButton.disabled = state !== 'stopped'
  stopButton.disabled = state !== 'playing'
}

voices.forEach((voice, index) =>
  document.querySelector('#voices').append(createVoicePanel(voice, index))
)

playButton.addEventListener('click', async () => {
  errorMessage.hidden = true
  setPlaybackState('starting')
  try {
    await engine.start()
    if (engine.playing) setPlaybackState('playing')
  } catch {
    setPlaybackState('stopped')
    errorMessage.textContent =
      'Не удалось включить звук. Попробуйте ещё раз или откройте страницу в другом браузере.'
    errorMessage.hidden = false
  }
})

stopButton.addEventListener('click', async () => {
  setPlaybackState('stopping')
  await engine.stop()
  setPlaybackState('stopped')
})

const tempo = document.querySelector('#tempo')
tempo.addEventListener('input', () => {
  engine.setTempo(Number(tempo.value))
  document.querySelector('#tempo-value').value = `${tempo.value} BPM`
  updateRange(tempo)
})

const master = document.querySelector('#master')
master.addEventListener('input', () => {
  engine.setVolume(Number(master.value))
  document.querySelector('#master-value').value = formatDb(Number(master.value))
  updateRange(master)
})

document.querySelectorAll('input[type="range"]').forEach(updateRange)

const meter = document.querySelector('#level')
const levelValue = document.querySelector('#level-value')
const meterTimer = setInterval(() => {
  const level = engine.getLevel()
  meter.value = Math.max(-60, Math.min(0, level))
  levelValue.value = level > -60 ? formatDb(Math.round(level)) : '−∞ дБ'
}, 100)

window.addEventListener('pagehide', () => engine.dispose())

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearInterval(meterTimer)
    engine.dispose()
  })
}
