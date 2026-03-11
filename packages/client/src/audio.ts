// Synthesized sound effects using Web Audio API — no external files needed
// Supports multiple keystroke sound presets (thock, clack, click, typewriter)

let ctx: AudioContext | null = null
let noiseBuffer: AudioBuffer | null = null

export type SoundPreset = 'thock' | 'clack' | 'click' | 'typewriter' | 'silent'

function isMuted(): boolean {
  return localStorage.getItem('typeduel_sound') === 'false'
}

function getVolumeMultiplier(): number {
  const raw = localStorage.getItem('typeduel_volume')
  const vol = raw !== null ? Number(raw) : 75
  return vol / 100
}

function getSoundPreset(): SoundPreset {
  return (localStorage.getItem('typeduel_soundPreset') as SoundPreset) || 'thock'
}

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

function getNoiseBuffer(): AudioBuffer {
  const c = getCtx()
  if (!noiseBuffer) {
    const size = c.sampleRate * 0.1 // 100ms of noise
    noiseBuffer = c.createBuffer(1, size, c.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < size; i++) {
      data[i] = Math.random() * 2 - 1
    }
  }
  return noiseBuffer
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
  const vol = volume * getVolumeMultiplier()
  gain.gain.setValueAtTime(vol, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start()
  osc.stop(c.currentTime + duration)
}

function playNoise(duration: number, volume = 0.08, filterFreq?: number, filterQ?: number) {
  const c = getCtx()
  const source = c.createBufferSource()
  source.buffer = getNoiseBuffer()
  const gain = c.createGain()
  const vol = volume * getVolumeMultiplier()
  gain.gain.setValueAtTime(vol, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)

  if (filterFreq) {
    const filter = c.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = filterFreq
    filter.Q.value = filterQ ?? 0.7
    source.connect(filter)
    filter.connect(gain)
  } else {
    source.connect(gain)
  }
  gain.connect(c.destination)
  source.start()
  source.stop(c.currentTime + duration)
}

// Layered mechanical keyboard sound with frequency sweep
function playMechKey(preset: SoundPreset) {
  const c = getCtx()
  const now = c.currentTime
  const volMul = getVolumeMultiplier()

  // Slight random variation per keypress for realism
  const variation = 0.85 + Math.random() * 0.3

  if (preset === 'thock') {
    // Layer 1: Low-frequency thump (body)
    const bodyOsc = c.createOscillator()
    const bodyGain = c.createGain()
    bodyOsc.type = 'triangle'
    bodyOsc.frequency.setValueAtTime((120 + Math.random() * 40) * variation, now)
    bodyOsc.frequency.exponentialRampToValueAtTime(35, now + 0.1)
    bodyGain.gain.setValueAtTime(0.35 * volMul, now)
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    bodyOsc.connect(bodyGain)
    bodyGain.connect(c.destination)
    bodyOsc.start(now)
    bodyOsc.stop(now + 0.1)

    // Layer 2: Click transient (soft)
    const clickOsc = c.createOscillator()
    const clickGain = c.createGain()
    clickOsc.type = 'square'
    clickOsc.frequency.setValueAtTime(800 * variation, now)
    clickOsc.frequency.exponentialRampToValueAtTime(300, now + 0.025)
    clickGain.gain.setValueAtTime(0.08 * volMul, now)
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025)
    clickOsc.connect(clickGain)
    clickGain.connect(c.destination)
    clickOsc.start(now)
    clickOsc.stop(now + 0.025)

    // Layer 3: Filtered noise (warm texture)
    playNoise(0.04, 0.06, 1500, 0.8)

  } else if (preset === 'clack') {
    // Layer 1: Mid-frequency body
    const bodyOsc = c.createOscillator()
    const bodyGain = c.createGain()
    bodyOsc.type = 'triangle'
    bodyOsc.frequency.setValueAtTime((250 + Math.random() * 80) * variation, now)
    bodyOsc.frequency.exponentialRampToValueAtTime(70, now + 0.06)
    bodyGain.gain.setValueAtTime(0.22 * volMul, now)
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
    bodyOsc.connect(bodyGain)
    bodyGain.connect(c.destination)
    bodyOsc.start(now)
    bodyOsc.stop(now + 0.06)

    // Layer 2: Sharp click transient
    const clickOsc = c.createOscillator()
    const clickGain = c.createGain()
    clickOsc.type = 'square'
    clickOsc.frequency.setValueAtTime(1800 * variation, now)
    clickOsc.frequency.exponentialRampToValueAtTime(500, now + 0.02)
    clickGain.gain.setValueAtTime(0.25 * volMul, now)
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02)
    clickOsc.connect(clickGain)
    clickGain.connect(c.destination)
    clickOsc.start(now)
    clickOsc.stop(now + 0.02)

    // Layer 3: High-freq noise burst
    playNoise(0.025, 0.15, 5000, 0.9)

  } else if (preset === 'click') {
    // Minimal: just a sharp click
    const clickOsc = c.createOscillator()
    const clickGain = c.createGain()
    clickOsc.type = 'square'
    clickOsc.frequency.setValueAtTime((3000 + Math.random() * 500) * variation, now)
    clickOsc.frequency.exponentialRampToValueAtTime(800, now + 0.015)
    clickGain.gain.setValueAtTime(0.18 * volMul, now)
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015)
    clickOsc.connect(clickGain)
    clickGain.connect(c.destination)
    clickOsc.start(now)
    clickOsc.stop(now + 0.015)

    // Tiny noise snap
    playNoise(0.012, 0.12, 7000, 1.2)

  } else if (preset === 'typewriter') {
    // Typewriter: metallic clunk + spring sound
    const bodyOsc = c.createOscillator()
    const bodyGain = c.createGain()
    bodyOsc.type = 'sawtooth'
    bodyOsc.frequency.setValueAtTime((400 + Math.random() * 100) * variation, now)
    bodyOsc.frequency.exponentialRampToValueAtTime(100, now + 0.04)
    bodyGain.gain.setValueAtTime(0.15 * volMul, now)
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
    bodyOsc.connect(bodyGain)
    bodyGain.connect(c.destination)
    bodyOsc.start(now)
    bodyOsc.stop(now + 0.04)

    // Metallic ring
    const ringOsc = c.createOscillator()
    const ringGain = c.createGain()
    ringOsc.type = 'sine'
    ringOsc.frequency.setValueAtTime(2200 * variation, now)
    ringGain.gain.setValueAtTime(0.06 * volMul, now)
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
    ringOsc.connect(ringGain)
    ringGain.connect(c.destination)
    ringOsc.start(now)
    ringOsc.stop(now + 0.06)

    playNoise(0.02, 0.1, 3000, 1.0)
  }
}

function play(fn: () => void) {
  if (!isMuted()) fn()
}

export const sfx = {
  keystroke() {
    play(() => {
      const preset = getSoundPreset()
      if (preset === 'silent') return
      playMechKey(preset)
    })
  },

  keystrokeError() {
    play(() => {
      const preset = getSoundPreset()
      if (preset === 'silent') {
        playTone(200, 0.08, 'sawtooth', 0.06)
        return
      }
      // Play the key sound but add a low buzz to indicate error
      playMechKey(preset)
      playTone(150, 0.08, 'sawtooth', 0.06)
    })
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

  heartbeat() {
    play(() => {
      playTone(60, 0.15, 'sine', 0.12)
      setTimeout(() => playTone(50, 0.2, 'sine', 0.1), 120)
    })
  },

  taunt() {
    play(() => {
      playTone(500, 0.06, 'square', 0.08)
      setTimeout(() => playTone(700, 0.06, 'square', 0.08), 60)
    })
  },
}
