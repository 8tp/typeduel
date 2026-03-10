import { create } from 'zustand'
import type { GameState } from '@typeduel/shared'
import { sfx } from './audio'

type Screen = 'lobby' | 'matchmaking' | 'countdown' | 'game' | 'results'

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
  }> | null

  // Local optimistic cursor
  localCursor: number

  // Polish state
  crtEnabled: boolean
  soundEnabled: boolean
  shaking: boolean
  prevHp: number

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
  addCombatLogEntry: (text: string, color: 'green' | 'red' | 'white') => void
  toggleCrt: () => void
  toggleSound: () => void
  triggerShake: () => void
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
  crtEnabled: localStorage.getItem('typeduel_crt') !== 'false',
  soundEnabled: localStorage.getItem('typeduel_sound') !== 'false',
  shaking: false,
  prevHp: 100,

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
      const newHp = state.players[playerId].hp
      if (newHp < prev.prevHp) {
        get().triggerShake()
        sfx.damage()
        if (newHp <= 0) sfx.ko()
        set({ prevHp: newHp })
      }
    }
    set({ gameState: state })
  },
  setResults: (winnerId, stats) => set({ winnerId, finalStats: stats }),
  setLocalCursor: (cursor) => set({ localCursor: cursor }),
  addCombatLogEntry: (text, color) => {
    set(s => ({ combatLog: [...s.combatLog.slice(-50), { id: Date.now() + Math.random(), text, color }] }))
  },
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
    set({ shaking: true })
    setTimeout(() => set({ shaking: false }), 200)
  },
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
    prevHp: 100,
  }),
}))
