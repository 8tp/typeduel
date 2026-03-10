import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useGameStore, type MatchHistoryEntry } from '../store'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('useGameStore', () => {
  beforeEach(() => {
    localStorageMock.clear()
    useGameStore.setState({
      playerId: null,
      displayName: '',
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
      matchHistory: [],
      practiceConfig: null,
      practiceState: null,
      crtEnabled: true,
      soundEnabled: true,
      shaking: false,
      prevHp: 100,
      prevOpponentHp: 100,
    })
  })

  describe('initial state', () => {
    it('starts with lobby screen', () => {
      expect(useGameStore.getState().screen).toBe('lobby')
    })

    it('starts with no playerId', () => {
      expect(useGameStore.getState().playerId).toBeNull()
    })

    it('starts with prevHp at 100', () => {
      expect(useGameStore.getState().prevHp).toBe(100)
    })

    it('starts with empty combat log', () => {
      expect(useGameStore.getState().combatLog).toEqual([])
    })
  })

  describe('setDisplayName', () => {
    it('sets the display name', () => {
      useGameStore.getState().setDisplayName('TestPlayer')
      expect(useGameStore.getState().displayName).toBe('TestPlayer')
    })

    it('persists to localStorage', () => {
      useGameStore.getState().setDisplayName('SavedName')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('typeduel_name', 'SavedName')
    })
  })

  describe('addMatchHistory', () => {
    it('adds an entry', () => {
      const entry: MatchHistoryEntry = {
        date: '2024-01-01',
        opponent: 'Bot',
        result: 'W',
        wpm: 60,
        accuracy: 95,
        damageDealt: 50,
      }
      useGameStore.getState().addMatchHistory(entry)
      expect(useGameStore.getState().matchHistory).toHaveLength(1)
      expect(useGameStore.getState().matchHistory[0]).toEqual(entry)
    })

    it('caps at 20 entries', () => {
      for (let i = 0; i < 25; i++) {
        useGameStore.getState().addMatchHistory({
          date: `2024-01-${i}`,
          opponent: `Bot${i}`,
          result: 'W',
          wpm: 60,
          accuracy: 95,
          damageDealt: 50,
        })
      }
      expect(useGameStore.getState().matchHistory).toHaveLength(20)
    })

    it('persists to localStorage', () => {
      useGameStore.getState().addMatchHistory({
        date: '2024-01-01',
        opponent: 'Bot',
        result: 'W',
        wpm: 60,
        accuracy: 95,
        damageDealt: 50,
      })
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'typeduel_history',
        expect.any(String),
      )
    })
  })

  describe('addCombatLogEntry', () => {
    it('adds entries', () => {
      useGameStore.getState().addCombatLogEntry('Hit!', 'green')
      expect(useGameStore.getState().combatLog).toHaveLength(1)
      expect(useGameStore.getState().combatLog[0].text).toBe('Hit!')
      expect(useGameStore.getState().combatLog[0].color).toBe('green')
    })

    it('caps at approximately 51 entries (slice -50 + 1 new)', () => {
      for (let i = 0; i < 60; i++) {
        useGameStore.getState().addCombatLogEntry(`Entry ${i}`, 'white')
      }
      expect(useGameStore.getState().combatLog.length).toBeLessThanOrEqual(51)
    })
  })

  describe('toggleCrt', () => {
    it('toggles CRT from true to false', () => {
      expect(useGameStore.getState().crtEnabled).toBe(true)
      useGameStore.getState().toggleCrt()
      expect(useGameStore.getState().crtEnabled).toBe(false)
    })

    it('toggles CRT from false to true', () => {
      useGameStore.setState({ crtEnabled: false })
      useGameStore.getState().toggleCrt()
      expect(useGameStore.getState().crtEnabled).toBe(true)
    })

    it('persists to localStorage', () => {
      useGameStore.getState().toggleCrt()
      expect(localStorageMock.setItem).toHaveBeenCalledWith('typeduel_crt', 'false')
    })
  })

  describe('toggleSound', () => {
    it('toggles sound from true to false', () => {
      expect(useGameStore.getState().soundEnabled).toBe(true)
      useGameStore.getState().toggleSound()
      expect(useGameStore.getState().soundEnabled).toBe(false)
    })

    it('persists to localStorage', () => {
      useGameStore.getState().toggleSound()
      expect(localStorageMock.setItem).toHaveBeenCalledWith('typeduel_sound', 'false')
    })
  })

  describe('reset', () => {
    it('returns to defaults', () => {
      useGameStore.getState().setScreen('game')
      useGameStore.getState().setRoomCode('ABC123')
      useGameStore.getState().setOpponentName('Foe')
      useGameStore.getState().reset()

      const state = useGameStore.getState()
      expect(state.screen).toBe('lobby')
      expect(state.roomCode).toBeNull()
      expect(state.opponentName).toBeNull()
      expect(state.gameState).toBeNull()
      expect(state.combatLog).toEqual([])
      expect(state.winnerId).toBeNull()
      expect(state.prevHp).toBe(100)
    })
  })

  describe('setPracticeConfig / setPracticeState', () => {
    it('sets practice config', () => {
      const config = { mode: 'free' as const, difficulty: 'easy' as const, duration: 60, botDifficulty: 'medium' as const }
      useGameStore.getState().setPracticeConfig(config)
      expect(useGameStore.getState().practiceConfig).toEqual(config)
    })

    it('sets practice state', () => {
      const state = { text: 'hello', status: 'active' as const } as any
      useGameStore.getState().setPracticeState(state)
      expect(useGameStore.getState().practiceState).toEqual(state)
    })
  })
})
