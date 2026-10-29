import './style.css'
import { settings, voices, chords, getStepLabel } from './patterns.js'
import { SynthEngine } from './audio.js'
import { SpaceScene } from './space.js'

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
  },
  {
    key: 'reverb',
    label: 'Пространство',
    min: 0,
    max: 1,
    step: 0.01,
    ends: ['Сухой звук', 'Больше объёма'],
    format: (value) => `${Math.round(value * 100)}%`,
    wide: true
  }
]

const playButton = document.querySelector('#play')
const stopButton = document.querySelector('#stop')
const finishButton = document.querySelector('#finish')
const resetButton = document.querySelector('#reset')
const status = document.querySelector('#status')
const errorMessage = document.querySelector('#error')
const cards = new Map()
const chordStrip = document.querySelector('#chords')
const barCount = String(chords.length).padStart(2, '0')
document.querySelector('#bar-position').textContent = `01 / ${barCount}`
document.querySelector('.score-label').textContent =
  `КРУГ 01 / ${chords.length} ТАКТОВ`
chordStrip.innerHTML = chords
  .map((chord) => `<span class="chord">${chord}</span>`)
  .join('')
const space = new SpaceScene(
  document.querySelector('#starlight'),
  document.querySelector('#motion')
)
const engine = new SynthEngine(voices, settings, {
  onStep: updateStep,
  onStateChange: setPlaybackState,
  onVoiceChange: updateVoice
})

function updateStep(id, step, pattern, cycle = 1) {
  const card = cards.get(id)
  if (step < 0 && engine.state === 'tail') {
    card
      .querySelectorAll('.is-active')
      .forEach((element) => element.classList.remove('is-active'))
    return
  }
  const voice = voices.find((item) => item.id === id)
  const bar = step < 0 ? 0 : Math.floor(step / 8)
  card.querySelectorAll('.step').forEach((element, index) => {
    const label = getStepLabel(voice, bar * 8 + index, pattern)
    element.querySelector('.step-note').textContent = label
    element.classList.toggle('is-rest', label === '—')
    element.classList.toggle('is-active', step >= 0 && index === step % 8)
  })
  if (id === 'saxophone') {
    if (step >= 0 && engine.state === 'ending') {
      const remaining = chords.length - bar
      const word = remaining === 1 ? 'такт' : remaining < 5 ? 'такта' : 'тактов'
      status.textContent = `Доигрываем фразу · ${remaining} ${word} до финала`
    }
    document.querySelector('.score-label').textContent =
      `КРУГ ${String(cycle).padStart(2, '0')} / ${chords.length} ТАКТОВ`
    chordStrip.querySelectorAll('.chord').forEach((element, index) => {
      element.classList.toggle('is-current', step >= 0 && index === bar)
    })
    document.querySelector('#bar-position').textContent =
      `${String(bar + 1).padStart(2, '0')} / ${barCount}`
  }
}

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
    <div class="variant-control" role="group" aria-label="Партия: ${voice.name}">
      ${voice.variants.map((variant) => `<button type="button" class="variant-button" data-variant="${variant.id}" aria-pressed="${variant.id === voice.variant}">${variant.name}</button>`).join('')}
    </div>
    <p class="variant-status" role="status"></p>
    <div class="pattern" aria-label="Партия голоса ${voice.name}">
      ${voice.pattern
        .slice(0, 8)
        .map(
          (event, i) =>
            `<span class="step ${event ? '' : 'is-rest'}"><span class="step-index">${i % 2 === 0 ? i / 2 + 1 : '·'}</span><span class="step-note">${getStepLabel(voice, i)}</span></span>`
        )
        .join('')}
    </div>
    <p class="pattern-caption">${voice.id === 'saxophone' ? 'Мелодическая фраза · 8 тактов' : 'Б — бочка · М — малый · Р — райд · Х — хэт'}</p>
    <div class="mode-control"><label for="${voice.id}-mode">${voice.id === 'saxophone' ? 'Характер' : 'Игра'}</label><select id="${voice.id}-mode">${voice.modes.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></div>
    <div class="voice-controls">
      ${controls
        .map(
          (control) => `
        <div class="control${control.wide ? ' control-wide' : ''}">
          <label for="${voice.id}-${control.key}">${control.label}<output for="${voice.id}-${control.key}">${control.format(voice[control.key])}</output></label>
          <input id="${voice.id}-${control.key}" data-property="${control.key}" type="range" min="${control.min}" max="${control.max}" step="${control.step}" value="${voice[control.key]}" />
          <div class="range-labels"><span>${control.ends[0]}</span><span>${control.ends[1]}</span></div>
        </div>`
        )
        .join('')}
    </div>`

  const mode = card.querySelector('select')
  mode.value = voice.mode
  mode.addEventListener('change', () =>
    engine.setVoice(voice.id, 'mode', mode.value)
  )

  card.querySelectorAll('[data-variant]').forEach((button) => {
    button.addEventListener('click', () =>
      engine.setVariant(voice.id, button.dataset.variant)
    )
  })

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
    engine.setVoice(voice.id, 'muted', !(voice.pendingMuted ?? voice.muted))
    updateVoice(voice.id)
  })

  cards.set(voice.id, card)
  updateVoice(voice.id)
  return card
}

function updateVoice(id) {
  const voice = voices.find((item) => item.id === id)
  const card = cards.get(id)
  if (!card) return
  const muteButton = card.querySelector('.mute-button')
  muteButton.setAttribute('aria-pressed', String(voice.muted))
  muteButton.setAttribute(
    'aria-label',
    voice.pendingMuted !== null
      ? `Отменить ${voice.pendingMuted ? 'выключение' : 'включение'} голоса ${voice.name}`
      : `${voice.muted ? 'Включить' : 'Выключить'} голос ${voice.name}`
  )
  muteButton.disabled = ['starting', 'tail', 'stopping'].includes(engine.state)
  muteButton.classList.toggle('is-pending', voice.pendingMuted !== null)
  let muteLabel = voice.muted ? 'Выключен' : 'Включён'
  if (voice.pendingMuted !== null) {
    muteLabel = voice.pendingMuted ? 'Выключится…' : 'Включится…'
  }
  card.querySelector('.mute-label').textContent = muteLabel
  card.classList.toggle('is-muted', voice.muted)
  card.querySelector('select').value = voice.mode
  card.querySelectorAll('input').forEach((input) => {
    const control = controls.find((item) => item.key === input.dataset.property)
    input.value = voice[control.key]
    input.closest('.control').querySelector('output').value = control.format(
      voice[control.key]
    )
    updateRange(input)
  })
  card.querySelectorAll('[data-variant]').forEach((button) => {
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.variant === voice.variant)
    )
    button.classList.toggle(
      'is-pending',
      button.dataset.variant === voice.pendingVariant
    )
    button.disabled = ['starting', 'stopping', 'tail'].includes(engine.state)
  })
  const selected = voice.variants.find(
    (item) => item.id === (voice.pendingVariant ?? voice.variant)
  )
  const pending = []
  if (voice.pendingMuted !== null) {
    pending.push(voice.pendingMuted ? 'голос затихнет' : 'голос вступит')
  }
  if (voice.pendingVariant) pending.push(selected.name)
  card.querySelector('.variant-status').textContent = pending.length
    ? `Со следующего такта: ${pending.join(' · ')}`
    : `Партия: ${selected.name}`
}

function updateRange(input) {
  const fill =
    (Number(input.value) - Number(input.min)) /
    (Number(input.max) - Number(input.min))
  input.style.setProperty('--fill', `${fill * 100}%`)
}

function setPlaybackState(state) {
  const labels = {
    stopped: 'Готов к исполнению',
    starting: 'Загружаем инструменты…',
    playing: 'Играет',
    ending: 'Доигрываем фразу…',
    tail: 'Затухание…',
    stopping: 'Останавливаем…'
  }
  status.textContent = labels[state]
  document.body.dataset.playback = state
  playButton.disabled = state !== 'stopped'
  stopButton.disabled = !['playing', 'ending', 'tail'].includes(state)
  finishButton.disabled = !['playing', 'ending'].includes(state)
  finishButton.textContent =
    state === 'ending' ? 'Продолжить фразу' : 'Завершить фразу'
  finishButton.setAttribute('aria-pressed', String(state === 'ending'))
  resetButton.disabled = state !== 'stopped'
  voices.forEach((voice) => updateVoice(voice.id))
  syncMeter()
}

voices.forEach((voice, index) =>
  document.querySelector('#voices').append(createVoicePanel(voice, index))
)

playButton.addEventListener('click', async () => {
  errorMessage.hidden = true
  try {
    await engine.start()
  } catch {
    errorMessage.textContent =
      'Не удалось загрузить инструменты. Проверьте соединение и попробуйте ещё раз.'
    errorMessage.hidden = false
  }
})

stopButton.addEventListener('click', () => engine.stop())
finishButton.addEventListener('click', () => engine.finish())

const tempo = document.querySelector('#tempo')
tempo.value = settings.tempo
document.querySelector('#tempo-value').value = `${settings.tempo} BPM`
tempo.addEventListener('input', () => {
  engine.setTempo(Number(tempo.value))
  document.querySelector('#tempo-value').value = `${tempo.value} BPM`
  updateRange(tempo)
})

const master = document.querySelector('#master')
master.value = settings.volume
document.querySelector('#master-value').value = formatDb(settings.volume)
master.addEventListener('input', () => {
  engine.setVolume(Number(master.value))
  document.querySelector('#master-value').value = formatDb(Number(master.value))
  updateRange(master)
})

resetButton.addEventListener('click', () => {
  engine.reset()
  tempo.value = settings.tempo
  document.querySelector('#tempo-value').value = `${settings.tempo} BPM`
  master.value = settings.volume
  document.querySelector('#master-value').value = formatDb(settings.volume)
  updateRange(tempo)
  updateRange(master)
  errorMessage.hidden = true
})

document.querySelectorAll('input[type="range"]').forEach(updateRange)

const meter = document.querySelector('#level')
const levelValue = document.querySelector('#level-value')
let meterTimer

function updateMeter() {
  const level = engine.getLevel()
  const value = Math.max(-60, Math.min(0, Math.round(level)))
  const label = level > -60 ? formatDb(value) : '−∞ дБ'
  if (meter.value !== value) meter.value = value
  if (levelValue.value !== label) levelValue.value = label
  space.energy = Math.max(0, Math.min(1, (level + 42) / 36))
}

function syncMeter() {
  clearInterval(meterTimer)
  engine.setVisible(!document.hidden)
  if (engine.playing && !document.hidden) {
    meterTimer = setInterval(updateMeter, 100)
  }
  if (!document.hidden) updateMeter()
}

document.addEventListener('visibilitychange', syncMeter)

const stopOnHide = () => {
  engine.dispose()
}
window.addEventListener('pagehide', stopOnHide)
setPlaybackState('stopped')

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearInterval(meterTimer)
    document.removeEventListener('visibilitychange', syncMeter)
    window.removeEventListener('pagehide', stopOnHide)
    space.dispose()
    engine.dispose()
  })
}
