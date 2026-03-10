// Synthesized sound effects using Web Audio API — no external files needed
// Respects the soundEnabled flag from localStorage (checked at play time)

let ctx: AudioContext | null = null

function isMuted(): boolean {
  return localStorage.getItem('typeduel_sound') === 'false'
}

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.15,
  detune = 0
) {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  osc.detune.value = detune
  gain.gain.setValueAtTime(volume, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start()
  osc.stop(c.currentTime + duration)
}

function playNoise(duration: number, volume = 0.08) {
  const c = getCtx()
  const bufferSize = c.sampleRate * duration
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  const source = c.createBufferSource()
  source.buffer = buffer
  const gain = c.createGain()
  gain.gain.setValueAtTime(volume, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  source.connect(gain)
  gain.connect(c.destination)
  source.start()
}

function play(fn: () => void) {
  if (!isMuted()) fn()
}

export const sfx = {
  keystroke() {
    play(() => playTone(800 + Math.random() * 200, 0.04, 'square', 0.06))
  },

  keystrokeError() {
    play(() => playTone(200, 0.1, 'sawtooth', 0.08))
  },

  damage() {
    play(() => {
      playTone(120, 0.2, 'sawtooth', 0.12)
      playNoise(0.08, 0.1)
    })
  },

  abilityUse() {
    play(() => {
      playTone(600, 0.08, 'sine', 0.12)
      setTimeout(() => playTone(900, 0.12, 'sine', 0.1), 60)
    })
  },

  countdown() {
    play(() => playTone(440, 0.15, 'sine', 0.15))
  },

  countdownGo() {
    play(() => playTone(880, 0.3, 'sine', 0.18))
  },

  victory() {
    play(() => {
      playTone(523, 0.15, 'sine', 0.15)
      setTimeout(() => playTone(659, 0.15, 'sine', 0.15), 120)
      setTimeout(() => playTone(784, 0.3, 'sine', 0.18), 240)
    })
  },

  defeat() {
    play(() => {
      playTone(400, 0.2, 'sawtooth', 0.1)
      setTimeout(() => playTone(300, 0.3, 'sawtooth', 0.1), 150)
      setTimeout(() => playTone(200, 0.5, 'sawtooth', 0.08), 300)
    })
  },

  ko() {
    play(() => {
      playNoise(0.3, 0.15)
      playTone(80, 0.4, 'sawtooth', 0.15)
    })
  },

  freeze() {
    play(() => {
      playTone(1200, 0.15, 'sine', 0.1)
      setTimeout(() => playTone(1600, 0.2, 'sine', 0.08), 80)
    })
  },

  surge() {
    play(() => {
      playTone(300, 0.1, 'square', 0.1)
      setTimeout(() => playTone(600, 0.15, 'square', 0.12), 50)
    })
  },
}
