// Client-side practice mode engine — no WebSocket needed
import {
  type Difficulty,
  type ActiveEffect,
  AbilityId,
  ABILITY_CONFIGS,
  MAX_HP,
  MAX_ENERGY,
  BASE_DRAIN,
  WPM_DIFF_SCALE,
  TEXT_EXHAUST_BONUS,
  PASSAGES,
  ROUND_DURATION,
} from '@typeduel/shared'
import { sfx } from '../audio'

export type PracticeMode = 'free' | 'timed' | 'accuracy' | 'sudden-death' | 'marathon' | 'bot'

export interface PracticeConfig {
  mode: PracticeMode
  difficulty: Difficulty
  duration: number // seconds (for timed mode: 15, 30, 60, 120)
  botDifficulty: 'easy' | 'medium' | 'hard'
}

const BOT_PRESETS = {
  easy: { wpmBase: 35, wpmVariance: 10, accuracy: 0.90, abilityChance: 0.02 },
  medium: { wpmBase: 65, wpmVariance: 15, accuracy: 0.95, abilityChance: 0.05 },
  hard: { wpmBase: 110, wpmVariance: 18, accuracy: 0.98, abilityChance: 0.10 },
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
  botAbilitiesUsed: number
  botWpmHistory: number[]
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
  const isTimed = config.mode === 'timed' || isBot || config.mode === 'marathon' || config.mode === 'sudden-death'
  // For timed/marathon modes, use enough text for fast typers
  const duration = config.mode === 'marathon' ? 300 : config.mode === 'sudden-death' ? 120 : (isBot ? ROUND_DURATION : config.duration)
  const minLength = isTimed ? Math.max(500, duration * 20) : 300
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
    timeLeft: isBot ? ROUND_DURATION : config.mode === 'marathon' ? 300 : config.mode === 'sudden-death' ? 120 : (isTimed ? config.duration : 0),
    wpmHistory: [],
    errorIndex: null,
    playerHp: MAX_HP,
    playerEnergy: 0,
    playerActiveEffects: [],
    playerDamageDealt: 0,
    playerAbilitiesUsed: 0,
    botCursor: 0,
    botHp: MAX_HP,
    botWpm: isBot ? preset.wpmBase : 0,
    botAccuracy: isBot ? preset.accuracy * 100 : 100,
    botEnergy: 0,
    botActiveEffects: [],
    botDamageDealt: 0,
    botAbilitiesUsed: 0,
    botWpmHistory: [],
    countdownSeconds: 3,
  }
}

export class PracticeEngine {
  state: PracticeState
  config: PracticeConfig
  private tickInterval: ReturnType<typeof setInterval> | null = null
  private botInterval: ReturnType<typeof setInterval> | null = null
  private botSpeedUpdateInterval: ReturnType<typeof setInterval> | null = null
  private countdownTimer: ReturnType<typeof setTimeout> | null = null
  private onChange: (state: PracticeState) => void
  private botPreset: typeof BOT_PRESETS['easy']
  private botCurrentWpm: number
  private botTargetWpm: number
  private botTotalCorrect: number = 0
  private botTotalKeystrokes: number = 0
  private botRecentCorrect: number[] = [] // timestamps of recent correct keystrokes

  constructor(config: PracticeConfig, onChange: (state: PracticeState) => void) {
    this.config = config
    this.state = createInitialState(config)
    this.onChange = onChange
    this.botPreset = BOT_PRESETS[config.botDifficulty]
    // Start bot WPM near target with slight ramp-up
    this.botCurrentWpm = this.botPreset.wpmBase * 0.85
    this.botTargetWpm = this.botPreset.wpmBase
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
      this.updateBotTypingSpeed()

      // Periodically vary bot WPM to feel human-like
      this.botSpeedUpdateInterval = setInterval(() => {
        this.updateBotTarget()
        this.updateBotTypingSpeed()
      }, 2000 + Math.random() * 2000) // Every 2-4 seconds
    }
  }

  private updateBotTarget(): void {
    // Vary bot target WPM naturally (+/- variance from base)
    const variance = this.botPreset.wpmVariance
    this.botTargetWpm = this.botPreset.wpmBase + (Math.random() * 2 - 1) * variance

    // Abilities slow the bot down (moderate impact, not crippling)
    if (this.state.botActiveEffects.some(e => e.abilityId === AbilityId.SCRAMBLE)) {
      this.botTargetWpm *= 0.75
    }
    if (this.state.botActiveEffects.some(e => e.abilityId === AbilityId.PHANTOM_KEYS)) {
      this.botTargetWpm *= 0.85
    }
    if (this.state.botActiveEffects.some(e => e.abilityId === AbilityId.BLACKOUT)) {
      this.botTargetWpm *= 0.9
    }
  }

  private updateBotTypingSpeed(): void {
    // Quickly approach target WPM
    this.botCurrentWpm += (this.botTargetWpm - this.botCurrentWpm) * 0.6

    // Clear existing bot interval
    if (this.botInterval) {
      clearInterval(this.botInterval)
      this.botInterval = null
    }

    if (this.botCurrentWpm > 5) {
      const msPerChar = 60000 / (this.botCurrentWpm * 5)
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

      // Check text exhaustion
      if (s.cursor >= s.text.length) {
        if (this.config.mode === 'accuracy' || this.config.mode === 'sudden-death' || this.config.mode === 'marathon') {
          // Append more text for infinite modes
          const extra = getText(this.config.difficulty, 400)
          s.text = s.text + ' ' + extra
        } else if (this.config.mode === 'free') {
          this.finishRound()
          return
        }
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

    this.botTotalKeystrokes++

    // Bot types with configured accuracy (affected by effects)
    let accuracy = this.botPreset.accuracy
    // Scramble reduces bot accuracy slightly
    if (s.botActiveEffects.some(e => e.abilityId === AbilityId.SCRAMBLE)) {
      accuracy *= 0.88
    }
    // Phantom keys cause a few more errors
    if (s.botActiveEffects.some(e => e.abilityId === AbilityId.PHANTOM_KEYS)) {
      accuracy *= 0.92
    }

    const isCorrect = Math.random() < accuracy
    const now = Date.now()
    if (isCorrect) {
      s.botCursor++
      this.botTotalCorrect++
      this.botRecentCorrect.push(now)
    }

    // Update bot accuracy display
    s.botAccuracy = this.botTotalKeystrokes > 0
      ? (this.botTotalCorrect / this.botTotalKeystrokes) * 100
      : 100

    // Update bot WPM using recent window (last 10s) for responsive display
    const windowMs = 10000
    this.botRecentCorrect = this.botRecentCorrect.filter(t => now - t < windowMs)
    if (this.botRecentCorrect.length >= 2) {
      const windowStart = this.botRecentCorrect[0]
      const windowElapsed = (now - windowStart) / 60000
      if (windowElapsed > 0) {
        s.botWpm = Math.round((this.botRecentCorrect.length / 5) / windowElapsed)
      }
    } else {
      // Fallback to cumulative for first few seconds
      const elapsed = (now - s.startTime) / 60000
      if (elapsed > 0) {
        s.botWpm = Math.round((this.botTotalCorrect / 5) / elapsed)
      }
    }

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

    const all = Object.values(AbilityId)
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
    s.botAbilitiesUsed++

    const isSelf = abilityId === AbilityId.SURGE || abilityId === AbilityId.MIRROR
    const target = isSelf ? s.botActiveEffects : s.playerActiveEffects

    target.push({
      abilityId,
      expiresAt: Date.now() + config.duration,
      source: 'bot',
    })

    sfx.abilityUse()
  }

  private playerAutoAbility(): void {
    const s = this.state
    if (s.playerEnergy < 20) return
    if (Math.random() > 0.4) return

    const all = Object.values(AbilityId)
    const affordable = all.filter(id => {
      const config = ABILITY_CONFIGS[id]
      if (s.playerEnergy < config.cost) return false
      const isSelf = id === AbilityId.SURGE || id === AbilityId.MIRROR
      const target = isSelf ? s.playerActiveEffects : s.botActiveEffects
      return !target.some(e => e.abilityId === id)
    })

    if (affordable.length === 0) return

    const abilityId = affordable[Math.floor(Math.random() * affordable.length)]
    this.handleAbility(abilityId)
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

    if (this.config.mode === 'timed' || this.config.mode === 'marathon') {
      s.timeLeft--
      if (s.timeLeft <= 0) {
        this.finishRound()
        return
      }
    }

    // Sudden death: WPM must stay above threshold after warmup (10s grace)
    if (this.config.mode === 'sudden-death') {
      s.timeLeft--
      if (s.timeLeft <= 0) {
        this.finishRound()
        return
      }
      const threshold = this.config.difficulty === 'easy' ? 20 : this.config.difficulty === 'medium' ? 35 : 50
      if (s.timeElapsed > 10 && s.wpm > 0 && s.wpm < threshold) {
        this.finishRound()
        return
      }
    }

    if (this.config.mode === 'bot') {
      s.timeLeft--

      // Bot WPM history
      s.botWpmHistory.push(s.botWpm)

      // Energy accrual for player
      const recentlyTyped = s.streak > 0 || s.totalKeystrokes > 0
      if (recentlyTyped) {
        s.playerEnergy = Math.min(MAX_ENERGY, s.playerEnergy + 2)
        if (s.wpm > 40) {
          s.playerEnergy = Math.min(MAX_ENERGY, s.playerEnergy + Math.floor((s.wpm - 40) / 10))
        }
      }

      // Auto-ability for player
      this.playerAutoAbility()

      // Player damage to bot (differential model)
      const playerAccMult = getAccuracyMultiplier(s.accuracy)
      const playerWpmAdv = Math.max(0, s.wpm - s.botWpm)
      let playerDmg = (BASE_DRAIN + playerWpmAdv * WPM_DIFF_SCALE) * playerAccMult
      if (s.cursor >= s.text.length) playerDmg += TEXT_EXHAUST_BONUS
      if (s.playerActiveEffects.some(e => e.abilityId === AbilityId.SURGE)) playerDmg *= 1.5
      if (s.playerHp < 30) playerDmg *= 1.25

      // Bot damage to player (differential model)
      const botAccMult = getAccuracyMultiplier(s.botAccuracy)
      const botWpmAdv = Math.max(0, s.botWpm - s.wpm)
      let botDmg = (BASE_DRAIN + botWpmAdv * WPM_DIFF_SCALE) * botAccMult
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
      // Recalculate bot WPM as cumulative average (not rolling window)
      if (elapsed > 0) {
        this.state.botWpm = Math.round((this.botTotalCorrect / 5) / elapsed)
      }
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
    if (this.botSpeedUpdateInterval) { clearInterval(this.botSpeedUpdateInterval); this.botSpeedUpdateInterval = null }
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
  if (config.mode === 'marathon') return `marathon_${config.difficulty}`
  if (config.mode === 'sudden-death') return `suddendeath_${config.difficulty}`
  return `${config.mode}_${config.difficulty}`
}
