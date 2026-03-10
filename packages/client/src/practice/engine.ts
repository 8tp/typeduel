// Client-side practice mode engine — no WebSocket needed
import {
  type Difficulty,
  type ActiveEffect,
  AbilityId,
  ABILITY_CONFIGS,
  MAX_HP,
  MAX_ENERGY,
  PASSAGES,
  getRandomPassage,
} from '@typeduel/shared'
import { sfx } from '../audio'

export type PracticeMode = 'free' | 'timed' | 'accuracy' | 'bot'

export interface PracticeConfig {
  mode: PracticeMode
  difficulty: Difficulty
  duration: number // seconds (for timed/bot mode: 15, 30, 60, 120)
  botDifficulty: 'easy' | 'medium' | 'hard'
}

const BOT_PRESETS = {
  easy: { wpm: 30, accuracy: 0.90, abilityChance: 0.02 },
  medium: { wpm: 60, accuracy: 0.95, abilityChance: 0.05 },
  hard: { wpm: 100, accuracy: 0.98, abilityChance: 0.08 },
}

export interface PracticeState {
  text: string
  status: 'countdown' | 'active' | 'finished'
  cursor: number
  totalCorrect: number
  totalKeystrokes: number
  wpm: number
  accuracy: number
  streak: number
  maxStreak: number
  startTime: number
  timeElapsed: number
  timeLeft: number
  wpmHistory: number[]
  errorIndex: number | null
  // Bot match state
  playerHp: number
  playerEnergy: number
  playerActiveEffects: ActiveEffect[]
  playerDamageDealt: number
  playerAbilitiesUsed: number
  botCursor: number
  botHp: number
  botWpm: number
  botAccuracy: number
  botEnergy: number
  botActiveEffects: ActiveEffect[]
  botDamageDealt: number
  countdownSeconds: number
}

function getAccuracyMultiplier(accuracy: number): number {
  if (accuracy < 80) return 0.5
  return 0.5 + ((accuracy - 80) / 20) * 1.0
}

function getText(difficulty: Difficulty, minLength: number): string {
  // For timed modes, concatenate multiple passages to ensure enough text
  let text = ''
  const pool = PASSAGES.filter(p => p.difficulty === difficulty)
  const used = new Set<number>()
  while (text.length < minLength) {
    let idx = Math.floor(Math.random() * pool.length)
    // Try to avoid repeats
    let attempts = 0
    while (used.has(idx) && attempts < pool.length) {
      idx = (idx + 1) % pool.length
      attempts++
    }
    used.add(idx)
    if (text.length > 0) text += ' '
    text += pool[idx].text
  }
  return text
}

export function createInitialState(config: PracticeConfig): PracticeState {
  const isBot = config.mode === 'bot'
  const isTimed = config.mode === 'timed' || isBot
  // For timed modes, use enough text for fast typers (~200 WPM = ~1000 chars/min)
  const minLength = isTimed ? Math.max(500, config.duration * 20) : 300
  const text = getText(config.difficulty, minLength)
  const preset = BOT_PRESETS[config.botDifficulty]

  return {
    text,
    status: 'countdown',
    cursor: 0,
    totalCorrect: 0,
    totalKeystrokes: 0,
    wpm: 0,
    accuracy: 100,
    streak: 0,
    maxStreak: 0,
    startTime: 0,
    timeElapsed: 0,
    timeLeft: isTimed ? config.duration : 0,
    wpmHistory: [],
    errorIndex: null,
    playerHp: MAX_HP,
    playerEnergy: 0,
    playerActiveEffects: [],
    playerDamageDealt: 0,
    playerAbilitiesUsed: 0,
    botCursor: 0,
    botHp: MAX_HP,
    botWpm: isBot ? preset.wpm : 0,
    botAccuracy: isBot ? preset.accuracy * 100 : 100,
    botEnergy: 0,
    botActiveEffects: [],
    botDamageDealt: 0,
    countdownSeconds: 3,
  }
}

export class PracticeEngine {
  state: PracticeState
  config: PracticeConfig
  private tickInterval: ReturnType<typeof setInterval> | null = null
  private botInterval: ReturnType<typeof setInterval> | null = null
  private countdownTimer: ReturnType<typeof setTimeout> | null = null
  private onChange: (state: PracticeState) => void
  private botPreset: typeof BOT_PRESETS['easy']

  constructor(config: PracticeConfig, onChange: (state: PracticeState) => void) {
    this.config = config
    this.state = createInitialState(config)
    this.onChange = onChange
    this.botPreset = BOT_PRESETS[config.botDifficulty]
  }

  start(): void {
    // 3-second countdown
    let count = 3
    this.state.countdownSeconds = count
    this.notify()
    sfx.countdown()

    const tick = () => {
      count--
      this.state.countdownSeconds = count
      this.notify()
      if (count > 0) {
        sfx.countdown()
        this.countdownTimer = setTimeout(tick, 1000)
      } else {
        sfx.countdownGo()
        this.beginRound()
      }
    }
    this.countdownTimer = setTimeout(tick, 1000)
  }

  private beginRound(): void {
    this.state.status = 'active'
    this.state.startTime = Date.now()
    this.notify()

    // Main tick: 1Hz for damage/timer/WPM history
    this.tickInterval = setInterval(() => this.damageTick(), 1000)

    // Bot typing interval (if bot mode)
    if (this.config.mode === 'bot') {
      const msPerChar = 60000 / (this.botPreset.wpm * 5)
      this.botInterval = setInterval(() => this.botType(), msPerChar)
    }
  }

  handleKeystroke(char: string): void {
    if (this.state.status !== 'active') return
    const s = this.state

    // Check if frozen
    const isFrozen = s.playerActiveEffects.some(e => e.abilityId === AbilityId.FREEZE)
    if (isFrozen) return

    if (char === 'BACKSPACE') {
      if (s.cursor > 0) {
        s.cursor--
        sfx.keystrokeError()
      }
      this.notify()
      return
    }

    if (char.length !== 1) return
    const expected = s.text[s.cursor]
    if (expected === undefined) return

    s.totalKeystrokes++

    if (char === expected) {
      s.totalCorrect++
      s.cursor++
      s.streak++
      if (s.streak > s.maxStreak) s.maxStreak = s.streak
      sfx.keystroke()

      // Energy from streaks
      if (s.streak > 0 && s.streak % 20 === 0 && this.config.mode === 'bot') {
        s.playerEnergy = Math.min(MAX_ENERGY, s.playerEnergy + 5)
      }

      // Accuracy challenge: game over if not perfect is handled in the mode check
      // Check text exhaustion (for free mode)
      if (this.config.mode === 'free' && s.cursor >= s.text.length) {
        this.finishRound()
        return
      }
    } else {
      s.streak = 0
      sfx.keystrokeError()
      s.errorIndex = s.cursor
      setTimeout(() => {
        this.state.errorIndex = null
        this.notify()
      }, 300)

      // Accuracy challenge: instant game over on wrong keystroke
      if (this.config.mode === 'accuracy') {
        this.finishRound()
        return
      }
    }

    // Update accuracy
    s.accuracy = s.totalKeystrokes > 0
      ? (s.totalCorrect / s.totalKeystrokes) * 100
      : 100

    // Update WPM
    const elapsed = (Date.now() - s.startTime) / 60000
    if (elapsed > 0) {
      s.wpm = Math.round((s.totalCorrect / 5) / elapsed)
    }

    this.notify()
  }

  handleAbility(abilityId: AbilityId): void {
    if (this.config.mode !== 'bot' || this.state.status !== 'active') return
    const s = this.state
    const config = ABILITY_CONFIGS[abilityId]
    if (!config) return
    if (s.playerEnergy < config.cost) return

    const now = Date.now()
    const isSelfBuff = abilityId === AbilityId.SURGE || abilityId === AbilityId.MIRROR
    const target = isSelfBuff ? s.playerActiveEffects : s.botActiveEffects

    // No stacking
    if (target.some(e => e.abilityId === abilityId)) return

    s.playerEnergy -= config.cost
    s.playerAbilitiesUsed++

    target.push({
      abilityId,
      expiresAt: now + config.duration,
      source: 'player',
    })

    sfx.abilityUse()
    this.notify()
  }

  private botType(): void {
    const s = this.state
    if (s.status !== 'active') return
    if (s.botCursor >= s.text.length) return

    // Check if bot is frozen
    const isFrozen = s.botActiveEffects.some(e => e.abilityId === AbilityId.FREEZE)
    if (isFrozen) return

    // Bot types with configured accuracy
    const isCorrect = Math.random() < this.botPreset.accuracy
    if (isCorrect) {
      s.botCursor++
    }
    // Bot doesn't actually need to track errors for WPM — use configured WPM

    // Bot energy accrual
    s.botEnergy = Math.min(MAX_ENERGY, s.botEnergy + 0.4)

    // Bot random ability usage
    if (s.botEnergy >= 20 && Math.random() < this.botPreset.abilityChance) {
      this.botUseAbility()
    }

    this.notify()
  }

  private botUseAbility(): void {
    const s = this.state
    const now = Date.now()

    // Pick a random offensive ability the bot can afford
    const offensive = [AbilityId.SCRAMBLE, AbilityId.BLACKOUT, AbilityId.FREEZE, AbilityId.PHANTOM_KEYS]
    const defensive = [AbilityId.SURGE, AbilityId.MIRROR]
    const all = [...offensive, ...defensive]

    const affordable = all.filter(id => {
      const config = ABILITY_CONFIGS[id]
      if (s.botEnergy < config.cost) return false
      const isSelf = id === AbilityId.SURGE || id === AbilityId.MIRROR
      const target = isSelf ? s.botActiveEffects : s.playerActiveEffects
      return !target.some(e => e.abilityId === id)
    })

    if (affordable.length === 0) return

    const abilityId = affordable[Math.floor(Math.random() * affordable.length)]
    const config = ABILITY_CONFIGS[abilityId]
    s.botEnergy -= config.cost

    const isSelf = abilityId === AbilityId.SURGE || abilityId === AbilityId.MIRROR
    const target = isSelf ? s.botActiveEffects : s.playerActiveEffects

    target.push({
      abilityId,
      expiresAt: now + config.duration,
      source: 'bot',
    })

    sfx.abilityUse()
  }

  private damageTick(): void {
    if (this.state.status !== 'active') return
    const s = this.state
    const now = Date.now()

    // Update time
    s.timeElapsed = Math.floor((now - s.startTime) / 1000)

    // Update WPM
    const elapsed = (now - s.startTime) / 60000
    if (elapsed > 0) {
      s.wpm = Math.round((s.totalCorrect / 5) / elapsed)
    }

    // WPM history snapshot
    s.wpmHistory.push(s.wpm)

    // Expire effects
    s.playerActiveEffects = s.playerActiveEffects.filter(e => e.expiresAt > now)
    s.botActiveEffects = s.botActiveEffects.filter(e => e.expiresAt > now)

    if (this.config.mode === 'timed') {
      s.timeLeft--
      if (s.timeLeft <= 0) {
        this.finishRound()
        return
      }
    }

    if (this.config.mode === 'bot') {
      s.timeLeft--

      // Energy accrual for player
      const recentlyTyped = s.streak > 0 || s.totalKeystrokes > 0
      if (recentlyTyped) {
        s.playerEnergy = Math.min(MAX_ENERGY, s.playerEnergy + 2)
        if (s.wpm > 40) {
          s.playerEnergy = Math.min(MAX_ENERGY, s.playerEnergy + Math.floor((s.wpm - 40) / 10))
        }
      }

      // Player damage to bot (differential model)
      const playerAccMult = getAccuracyMultiplier(s.accuracy)
      const playerWpmAdv = Math.max(0, s.wpm - s.botWpm)
      let playerDmg = (1.5 + playerWpmAdv * 0.06) * playerAccMult
      if (s.cursor >= s.text.length) playerDmg += 1
      if (s.playerActiveEffects.some(e => e.abilityId === AbilityId.SURGE)) playerDmg *= 1.5
      if (s.playerHp < 30) playerDmg *= 1.25

      // Bot damage to player (differential model)
      const botAccMult = getAccuracyMultiplier(s.botAccuracy)
      const botWpmAdv = Math.max(0, s.botWpm - s.wpm)
      let botDmg = (1.5 + botWpmAdv * 0.06) * botAccMult
      if (s.botActiveEffects.some(e => e.abilityId === AbilityId.SURGE)) botDmg *= 1.5
      if (s.botHp < 30) botDmg *= 1.25

      // Mirror reflections
      if (s.botActiveEffects.some(e => e.abilityId === AbilityId.MIRROR)) {
        s.playerHp = Math.max(0, s.playerHp - playerDmg * 0.5)
      }
      if (s.playerActiveEffects.some(e => e.abilityId === AbilityId.MIRROR)) {
        s.botHp = Math.max(0, s.botHp - botDmg * 0.5)
      }

      // Apply damage
      s.botHp = Math.max(0, s.botHp - playerDmg)
      s.playerHp = Math.max(0, s.playerHp - botDmg)
      s.playerDamageDealt += playerDmg
      s.botDamageDealt += botDmg

      if (s.playerHp > 0 && botDmg > 0) sfx.damage()
      if (s.botHp <= 0 || s.playerHp <= 0 || s.timeLeft <= 0) {
        if (s.botHp <= 0) sfx.ko()
        if (s.playerHp <= 0) sfx.ko()
        this.finishRound()
        return
      }
    }

    this.notify()
  }

  private finishRound(): void {
    this.state.status = 'finished'
    this.cleanup()

    // Final WPM/accuracy calc
    const elapsed = (Date.now() - this.state.startTime) / 60000
    if (elapsed > 0) {
      this.state.wpm = Math.round((this.state.totalCorrect / 5) / elapsed)
    }

    if (this.config.mode === 'bot') {
      const isWinner = this.state.botHp <= 0 || (this.state.playerHp > this.state.botHp)
      if (isWinner) sfx.victory()
      else sfx.defeat()
    }

    this.notify()
  }

  private notify(): void {
    this.onChange({ ...this.state })
  }

  cleanup(): void {
    if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null }
    if (this.botInterval) { clearInterval(this.botInterval); this.botInterval = null }
    if (this.countdownTimer) { clearTimeout(this.countdownTimer); this.countdownTimer = null }
  }
}

// Personal bests
export interface PersonalBest {
  wpm: number
  accuracy: number
  streak: number
  date: string
}

export function getPersonalBests(): Record<string, PersonalBest> {
  try {
    return JSON.parse(localStorage.getItem('typeduel_pbs') ?? '{}')
  } catch { return {} }
}

export function savePersonalBest(key: string, pb: PersonalBest): void {
  const pbs = getPersonalBests()
  const existing = pbs[key]
  if (!existing || pb.wpm > existing.wpm) {
    pbs[key] = pb
    localStorage.setItem('typeduel_pbs', JSON.stringify(pbs))
  }
}

export function getPbKey(config: PracticeConfig): string {
  if (config.mode === 'bot') return `bot_${config.difficulty}_${config.botDifficulty}`
  if (config.mode === 'timed') return `timed_${config.difficulty}_${config.duration}`
  return `${config.mode}_${config.difficulty}`
}
