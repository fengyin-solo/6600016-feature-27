import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { MORSE_TABLE, REVERSE_TABLE, textToMorse, morseToText } from '../utils/morse-code'
import type { TrainMode, HistoryEntry, PracticePreset } from '../types'

const PRESETS_KEY = 'morse-practice-presets'

function loadPresets(): PracticePreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return [
    { id: 'default-beginner', name: '入门慢速', wpm: 10, frequency: 700, volume: 0.6 },
    { id: 'default-normal', name: '标准练习', wpm: 20, frequency: 700, volume: 0.6 },
    { id: 'default-fast', name: '高速挑战', wpm: 30, frequency: 800, volume: 0.7 },
  ]
}

function savePresetsToStorage(presets: PracticePreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
}

export const useMorseStore = defineStore('morse', () => {
  const inputText = ref('')
  const morseOutput = ref('')
  const decodedText = ref('')
  const wpm = ref(15)
  const frequency = ref(700)
  const volume = ref(0.6)
  const trainMode = ref<TrainMode>('charToCode')
  const history = ref<HistoryEntry[]>([])
  const quizChar = ref('')
  const userAnswer = ref('')
  const score = ref({ correct: 0, total: 0 })
  const isPlaying = ref(false)
  const presets = ref<PracticePreset[]>(loadPresets())
  const activePresetId = ref<string | null>(null)
  let audioCtx: AudioContext | null = null
  let currentOscillator: OscillatorNode | null = null

  const dotDuration = computed(() => 1200 / wpm.value)

  function getAudioCtx(): AudioContext {
    if (!audioCtx) audioCtx = new AudioContext()
    return audioCtx
  }

  function playTone(duration: number): Promise<void> {
    return new Promise(resolve => {
      const ctx = getAudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = frequency.value
      gain.gain.value = volume.value
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      currentOscillator = osc
      setTimeout(() => { osc.stop(); currentOscillator = null; resolve() }, duration)
    })
  }

  async function playMorse(morse: string) {
    isPlaying.value = true
    const dd = dotDuration.value
    for (const token of morse.split(' ')) {
      if (token === '/') { await sleep(dd * 7); continue }
      for (const sym of token) {
        await playTone(sym === '.' ? dd : dd * 3)
        await sleep(dd)
      }
      await sleep(dd * 2)
    }
    isPlaying.value = false
  }

  function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
  }

  function encode() {
    morseOutput.value = textToMorse(inputText.value)
  }

  function decode() {
    decodedText.value = morseToText(inputText.value)
  }

  function generateQuiz() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    quizChar.value = chars[Math.floor(Math.random() * chars.length)]
    userAnswer.value = ''
  }

  function checkAnswer() {
    const correct = userAnswer.value.trim() === MORSE_TABLE[quizChar.value]
    score.value.total++
    if (correct) score.value.correct++
    history.value.unshift({
      id: Date.now(), input: quizChar.value, output: userAnswer.value,
      correct, timestamp: Date.now()
    })
    generateQuiz()
  }

  function resetScore() {
    score.value = { correct: 0, total: 0 }
    history.value = []
  }

  function applyPreset(id: string) {
    const preset = presets.value.find(p => p.id === id)
    if (!preset) return
    wpm.value = preset.wpm
    frequency.value = preset.frequency
    volume.value = preset.volume
    activePresetId.value = id
  }

  function savePreset(name: string) {
    const id = 'preset-' + Date.now()
    const newPreset: PracticePreset = {
      id,
      name: name.trim() || '自定义预设',
      wpm: wpm.value,
      frequency: frequency.value,
      volume: volume.value,
    }
    presets.value.push(newPreset)
    activePresetId.value = id
    savePresetsToStorage(presets.value)
  }

  function deletePreset(id: string) {
    const idx = presets.value.findIndex(p => p.id === id)
    if (idx === -1) return
    presets.value.splice(idx, 1)
    if (activePresetId.value === id) {
      activePresetId.value = null
    }
    savePresetsToStorage(presets.value)
  }

  watch([wpm, frequency, volume], () => {
    if (!activePresetId.value) return
    const preset = presets.value.find(p => p.id === activePresetId.value)
    if (!preset) return
    if (preset.wpm !== wpm.value || preset.frequency !== frequency.value || preset.volume !== volume.value) {
      activePresetId.value = null
    }
  })

  return {
    inputText, morseOutput, decodedText, wpm, frequency, volume,
    trainMode, history, quizChar, userAnswer, score, isPlaying,
    presets, activePresetId,
    dotDuration, encode, decode, playMorse, playTone,
    generateQuiz, checkAnswer, resetScore,
    applyPreset, savePreset, deletePreset,
  }
})
