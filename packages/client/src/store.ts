import { create } from 'zustand'
import type { GameState, AbilityId, TauntId, Difficulty } from '@typeduel/shared'
import { sfx } from './audio'

import type { PracticeConfig, PracticeState } from './practice/engine'

type Screen = 'lobby' | 'matchmaking' | 'countdown' | 'game' | 'results' | 'spectating' | 'practice-setup' | 'practice' | 'practice-results'

export interface MatchHistoryEntry {
  date: string
  opponent: string
  result: 'W' | 'L'
  wpm: number
  accuracy: number
  damageDealt: number
}

interface GameStore {
  // Connection
  playerId: string | null
  displayName: string
  ws: WebSocket | null

  // Screen
  screen: Screen

  // Match info
  roomCode: string | null
  opponentName: string | null

  // Countdown
  countdownSeconds: number

  // Game state from server
  gameState: GameState | null

  // Combat log
  combatLog: { id: number; text: string; color: 'green' | 'red' | 'white' }[]

  // Results
  winnerId: string | null
  finalStats: Record<string, {
    wpm: number
    accuracy: number
    damageDealt: number
    abilitiesUsed: number
    hpRemaining: number
    wpmHistory?: number[]
  }> | null

  // Local optimistic cursor
  localCursor: number

  // Error flash (index of char that was wrong)
  errorIndex: number | null

  // Ability cooldowns (client-side tracking)
  abilityCooldowns: Partial<Record<AbilityId, number>> // abilityId → expiry timestamp

  // Taunt
  activeTaunt: { tauntId: TauntId; from: string } | null

  // Spectating
  isSpectating: boolean

  // Rematch
  opponentWantsRematch: boolean

  // Match history
  matchHistory: MatchHistoryEntry[]

  // Practice mode
  practiceConfig: PracticeConfig | null
  practiceState: PracticeState | null

  // Settings
  uiScale: 'small' | 'medium' | 'large'
  shakeEnabled: boolean
  reducedMotion: boolean
  soundVolume: number
  defaultDifficulty: Difficulty
  showCombatLog: boolean
  highContrast: boolean
  settingsOpen: boolean

  // Polish state
  crtEnabled: boolean
  soundEnabled: boolean
  shaking: boolean
  prevHp: number
  prevOpponentHp: number

  // Actions
  setDisplayName: (name: string) => void
  setWs: (ws: WebSocket | null) => void
  setPlayerId: (id: string | null) => void
  setScreen: (screen: Screen) => void
  setRoomCode: (code: string | null) => void
  setOpponentName: (name: string | null) => void
  setCountdown: (seconds: number) => void
  setGameState: (state: GameState) => void
  setResults: (winnerId: string, stats: Record<string, any>) => void
  setLocalCursor: (cursor: number) => void
  setErrorIndex: (index: number | null) => void
  setAbilityCooldown: (abilityId: AbilityId, expiresAt: number) => void
  setActiveTaunt: (taunt: { tauntId: TauntId; from: string } | null) => void
  addCombatLogEntry: (text: string, color: 'green' | 'red' | 'white') => void
  setIsSpectating: (val: boolean) => void
  setOpponentWantsRematch: (val: boolean) => void
  addMatchHistory: (entry: MatchHistoryEntry) => void
  setPracticeConfig: (config: PracticeConfig) => void
  setPracticeState: (state: PracticeState) => void
  toggleCrt: () => void
  toggleSound: () => void
  triggerShake: () => void
  setUiScale: (scale: 'small' | 'medium' | 'large') => void
  toggleShake: () => void
  toggleReducedMotion: () => void
  setSoundVolume: (vol: number) => void
  setDefaultDifficulty: (d: Difficulty) => void
  toggleCombatLog: () => void
  toggleHighContrast: () => void
  setSettingsOpen: (open: boolean) => void
  reset: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  playerId: null,
  displayName: localStorage.getItem('typeduel_name') ?? '',
  ws: null,
  screen: 'lobby',
  roomCode: null,
  opponentName: null,
  countdownSeconds: 0,
  gameState: null,
  combatLog: [],
  winnerId: null,
  finalStats: null,
  localCursor: 0,
  errorIndex: null,
  abilityCooldowns: {},
  activeTaunt: null,
  isSpectating: false,
  opponentWantsRematch: false,
  matchHistory: JSON.parse(localStorage.getItem('typeduel_history') ?? '[]'),
  practiceConfig: null,
  practiceState: null,
  uiScale: (localStorage.getItem('typeduel_uiScale') as 'small' | 'medium' | 'large') || 'medium',
  shakeEnabled: localStorage.getItem('typeduel_shakeEnabled') !== 'false',
  reducedMotion: localStorage.getItem('typeduel_reducedMotion') === 'true',
  soundVolume: Number(localStorage.getItem('typeduel_volume') ?? '75'),
  defaultDifficulty: (localStorage.getItem('typeduel_defaultDifficulty') as Difficulty) || 'medium',
  showCombatLog: localStorage.getItem('typeduel_showCombatLog') !== 'false',
  highContrast: localStorage.getItem('typeduel_highContrast') === 'true',
  settingsOpen: false,
  crtEnabled: localStorage.getItem('typeduel_crt') !== 'false',
  soundEnabled: localStorage.getItem('typeduel_sound') !== 'false',
  shaking: false,
  prevHp: 100,
  prevOpponentHp: 100,

  setDisplayName: (name) => {
    localStorage.setItem('typeduel_name', name)
    set({ displayName: name })
  },
  setWs: (ws) => set({ ws }),
  setPlayerId: (id) => set({ playerId: id }),
  setScreen: (screen) => set({ screen }),
  setRoomCode: (code) => set({ roomCode: code }),
  setOpponentName: (name) => set({ opponentName: name }),
  setCountdown: (seconds) => set({ countdownSeconds: seconds }),
  setGameState: (state) => {
    const prev = get()
    const playerId = prev.playerId
    if (playerId && state.players[playerId]) {
      const player = state.players[playerId]
      const newHp = player.hp
      if (newHp < prev.prevHp) {
        get().triggerShake()
        sfx.damage()
        if (newHp <= 0) sfx.ko()
        set({ prevHp: newHp })
      }
      // Reconcile optimistic cursor with server authority
      set({ localCursor: player.cursor })
    }
    // Track opponent HP for hit indicators
    if (playerId) {
      const opponent = Object.values(state.players).find(p => p.id !== playerId)
      if (opponent) {
        set({ prevOpponentHp: opponent.hp })
      }
    }
    set({ gameState: state })
  },
  setResults: (winnerId, stats) => set({ winnerId, finalStats: stats }),
  setLocalCursor: (cursor) => set({ localCursor: cursor }),
  setErrorIndex: (index) => set({ errorIndex: index }),
  setAbilityCooldown: (abilityId, expiresAt) => {
    set(s => ({ abilityCooldowns: { ...s.abilityCooldowns, [abilityId]: expiresAt } }))
  },
  setActiveTaunt: (taunt) => set({ activeTaunt: taunt }),
  setIsSpectating: (val) => set({ isSpectating: val }),
  setOpponentWantsRematch: (val) => set({ opponentWantsRematch: val }),
  addMatchHistory: (entry) => {
    const history = [...get().matchHistory, entry].slice(-20)
    localStorage.setItem('typeduel_history', JSON.stringify(history))
    set({ matchHistory: history })
  },
  addCombatLogEntry: (text, color) => {
    set(s => ({ combatLog: [...s.combatLog.slice(-50), { id: Date.now() + Math.random(), text, color }] }))
  },
  setPracticeConfig: (config) => set({ practiceConfig: config }),
  setPracticeState: (state) => set({ practiceState: state }),
  toggleCrt: () => {
    const next = !get().crtEnabled
    localStorage.setItem('typeduel_crt', String(next))
    set({ crtEnabled: next })
  },
  toggleSound: () => {
    const next = !get().soundEnabled
    localStorage.setItem('typeduel_sound', String(next))
    set({ soundEnabled: next })
  },
  triggerShake: () => {
    if (!get().shakeEnabled) return
    set({ shaking: true })
    setTimeout(() => set({ shaking: false }), 200)
  },
  setUiScale: (scale) => {
    localStorage.setItem('typeduel_uiScale', scale)
    set({ uiScale: scale })
  },
  toggleShake: () => {
    const next = !get().shakeEnabled
    localStorage.setItem('typeduel_shakeEnabled', String(next))
    set({ shakeEnabled: next })
  },
  toggleReducedMotion: () => {
    const next = !get().reducedMotion
    localStorage.setItem('typeduel_reducedMotion', String(next))
    set({ reducedMotion: next })
  },
  setSoundVolume: (vol) => {
    localStorage.setItem('typeduel_volume', String(vol))
    set({ soundVolume: vol })
  },
  setDefaultDifficulty: (d) => {
    localStorage.setItem('typeduel_defaultDifficulty', d)
    set({ defaultDifficulty: d })
  },
  toggleCombatLog: () => {
    const next = !get().showCombatLog
    localStorage.setItem('typeduel_showCombatLog', String(next))
    set({ showCombatLog: next })
  },
  toggleHighContrast: () => {
    const next = !get().highContrast
    localStorage.setItem('typeduel_highContrast', String(next))
    set({ highContrast: next })
  },
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  reset: () => set({
    screen: 'lobby',
    roomCode: null,
    opponentName: null,
    countdownSeconds: 0,
    gameState: null,
    combatLog: [],
    winnerId: null,
    finalStats: null,
    localCursor: 0,
    errorIndex: null,
    abilityCooldowns: {},
    activeTaunt: null,
    isSpectating: false,
    opponentWantsRematch: false,
    practiceConfig: null,
    practiceState: null,
    prevHp: 100,
    prevOpponentHp: 100,
  }),
}))
