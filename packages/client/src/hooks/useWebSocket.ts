import { useCallback, useEffect } from 'react'
import {
  MessageType,
  AbilityId,
  ABILITY_CONFIGS,
  type ClientMessage,
  type ResumeSessionMessage,
  type ServerMessage,
} from '@typeduel/shared'
import { useGameStore } from '../store'
import { sfx } from '../audio'

const ABILITY_NAMES: Record<string, string> = {
  [AbilityId.SURGE]: 'Surge',
  [AbilityId.BLACKOUT]: 'Blackout',
  [AbilityId.SCRAMBLE]: 'Scramble',
  [AbilityId.PHANTOM_KEYS]: 'Phantom Keys',
  [AbilityId.FREEZE]: 'Freeze',
  [AbilityId.MIRROR]: 'Mirror',
}

// Singleton WebSocket — shared across all components
let globalWs: WebSocket | null = null
let pendingMessages: ClientMessage[] = []
let pendingResumeSession: ResumeSessionMessage | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let intentionalClose = false

const RESUME_SESSION_STORAGE_KEY = 'typeduel_resume_session'

export interface StoredResumeSession {
  playerId: string
  roomCode: string
  isSpectating: boolean
}

function saveStoredResumeSession(session: StoredResumeSession): void {
  sessionStorage.setItem(RESUME_SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function loadStoredResumeSession(): StoredResumeSession | null {
  const raw = sessionStorage.getItem(RESUME_SESSION_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<StoredResumeSession>
    if (!parsed.playerId || !parsed.roomCode || typeof parsed.isSpectating !== 'boolean') {
      return null
    }
    return {
      playerId: parsed.playerId,
      roomCode: parsed.roomCode,
      isSpectating: parsed.isSpectating,
    }
  } catch {
    return null
  }
}

export function clearStoredResumeSession(): void {
  sessionStorage.removeItem(RESUME_SESSION_STORAGE_KEY)
}

function getResumeSessionFromStore(): StoredResumeSession | null {
  const state = useGameStore.getState()
  if (!state.playerId || !state.roomCode) {
    return null
  }

  if (!['waiting-room', 'countdown', 'game', 'results', 'spectating'].includes(state.screen)) {
    return null
  }

  return {
    playerId: state.playerId,
    roomCode: state.roomCode,
    isSpectating: state.isSpectating,
  }
}

function syncStoredResumeSession(): void {
  const session = getResumeSessionFromStore()
  if (session) {
    saveStoredResumeSession(session)
  }
}

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function flushPendingMessages(ws: WebSocket): void {
  while (pendingMessages.length > 0) {
    const msg = pendingMessages.shift()
    if (msg) {
      ws.send(JSON.stringify(msg))
    }
  }
}

export function useWebSocket() {
  const store = useGameStore()

  useEffect(() => {
    const markIntentionalClose = () => {
      intentionalClose = true
    }

    window.addEventListener('beforeunload', markIntentionalClose)
    window.addEventListener('pagehide', markIntentionalClose)

    return () => {
      window.removeEventListener('beforeunload', markIntentionalClose)
      window.removeEventListener('pagehide', markIntentionalClose)
    }
  }, [])

  const connect = useCallback((resumeSession?: StoredResumeSession) => {
    if (globalWs?.readyState === WebSocket.OPEN || globalWs?.readyState === WebSocket.CONNECTING) {
      return
    }
    clearReconnectTimer()
    intentionalClose = false
    pendingResumeSession = resumeSession
      ? {
          type: MessageType.RESUME_SESSION,
          playerId: resumeSession.playerId,
          roomCode: resumeSession.roomCode,
          spectator: resumeSession.isSpectating,
        }
      : null

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = import.meta.env.DEV
      ? `${protocol}//${window.location.hostname}:3001`
      : `${protocol}//${window.location.host}`
    const ws = new WebSocket(wsUrl)
    globalWs = ws

    ws.onopen = () => {
      useGameStore.getState().setWs(ws)
      if (pendingResumeSession) {
        ws.send(JSON.stringify(pendingResumeSession))
        return
      }

      flushPendingMessages(ws)
    }

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data)
      const s = useGameStore.getState()

      switch (msg.type) {
        case MessageType.WELCOME:
          if (!pendingResumeSession) {
            s.setPlayerId(msg.playerId)
            syncStoredResumeSession()
          }
          break

        case MessageType.SESSION_RESUMED:
          pendingResumeSession = null
          s.setPlayerId(msg.playerId)
          s.setRoomCode(msg.roomCode)
          s.setIsSpectating(msg.isSpectating)
          s.setOpponentName(msg.opponent?.displayName ?? null)
          saveStoredResumeSession({
            playerId: msg.playerId,
            roomCode: msg.roomCode,
            isSpectating: msg.isSpectating,
          })
          if (globalWs?.readyState === WebSocket.OPEN) {
            flushPendingMessages(globalWs)
          }
          break

        case MessageType.MATCH_FOUND:
          if (msg.opponent.id) {
            s.setOpponentName(msg.opponent.displayName)
            s.setScreen('countdown')
          } else {
            s.setOpponentName(null)
            s.setScreen('waiting-room')
          }
          s.setRoomCode(msg.roomCode)
          syncStoredResumeSession()
          break

        case MessageType.COUNTDOWN:
          s.setCountdown(msg.seconds)
          s.setScreen('countdown')
          if (msg.seconds > 0) sfx.countdown()
          else sfx.countdownGo()
          break

        case MessageType.GAME_STATE:
          s.setGameState(msg.state)
          if (msg.state.status === 'countdown' && msg.state.countdownSeconds > 0) {
            s.setCountdown(msg.state.countdownSeconds)
          }
          if (msg.state.status === 'waiting') {
            s.setScreen(s.isSpectating ? 'spectating' : 'waiting-room')
          } else if (msg.state.status === 'active') {
            s.setScreen(s.isSpectating ? 'spectating' : 'game')
          } else if (msg.state.status === 'countdown') {
            s.setScreen('countdown')
          } else if (msg.state.status === 'finished' && s.isSpectating) {
            s.setScreen('spectating')
          }
          if (msg.state.status !== 'finished') {
            syncStoredResumeSession()
          }
          break

        case MessageType.ROUND_END: {
          if (s.isSpectating) {
            s.addCombatLogEntry('Match finished', 'white')
            s.setOpponentWantsRematch(false)
            break
          }
          s.setResults(msg.winner, msg.stats)
          s.setScreen('results')
          s.setOpponentWantsRematch(false)
          syncStoredResumeSession()
          const currentPid = useGameStore.getState().playerId
          const isWinner = msg.winner === currentPid
          s.addCombatLogEntry(isWinner ? 'You win!' : 'You lose!', isWinner ? 'green' : 'red')
          if (isWinner) sfx.victory()
          else sfx.defeat()
          // Save match history
          if (currentPid && msg.stats) {
            const myStats = msg.stats[currentPid]
            const oppEntry = Object.entries(msg.stats).find(([id]) => id !== currentPid)
            if (myStats && oppEntry) {
              const oppName = useGameStore.getState().opponentName ?? 'Unknown'
              s.addMatchHistory({
                date: new Date().toISOString(),
                opponent: oppName,
                result: isWinner ? 'W' : 'L',
                wpm: myStats.wpm,
                accuracy: myStats.accuracy,
                damageDealt: myStats.damageDealt,
              })
            }
          }
          break
        }

        case MessageType.ABILITY_USED: {
          sfx.abilityUse()
          const pid = useGameStore.getState().playerId
          const isYou = msg.by === pid
          const actor = isYou ? 'You' : 'Opponent'
          const abilityName = ABILITY_NAMES[msg.ability] ?? msg.ability
          const isSelfBuff = msg.by === msg.target
          const logText = isSelfBuff
            ? `${actor} activated ${abilityName}`
            : `${actor} used ${abilityName}`
          s.addCombatLogEntry(logText, isYou ? 'green' : 'red')
          // Track cooldown client-side for timer display
          if (isYou) {
            const config = ABILITY_CONFIGS[msg.ability]
            if (config) {
              s.setAbilityCooldown(msg.ability, Date.now() + config.cooldown)
            }
          }
          break
        }

        case MessageType.TAUNT_RECEIVED: {
          sfx.taunt()
          s.setActiveTaunt({ tauntId: msg.tauntId, from: msg.from })
          setTimeout(() => useGameStore.getState().setActiveTaunt(null), 2000)
          break
        }

        case MessageType.REMATCH_VOTED:
          s.setOpponentWantsRematch(true)
          break

        case MessageType.ERROR:
          if (msg.code === 'SESSION_RESUME_FAILED') {
            pendingMessages = []
            pendingResumeSession = null
            clearReconnectTimer()
            clearStoredResumeSession()
            intentionalClose = true
            globalWs?.close()
            globalWs = null
            s.reset()
          }
          console.error(`Server error: ${msg.code} - ${msg.message}`)
          break
      }
    }

    ws.onclose = () => {
      useGameStore.getState().setWs(null)
      globalWs = null
      const resumeSession = pendingResumeSession
        ? {
            playerId: pendingResumeSession.playerId,
            roomCode: pendingResumeSession.roomCode,
            isSpectating: pendingResumeSession.spectator ?? false,
          }
        : getResumeSessionFromStore() ?? loadStoredResumeSession()

      if (!intentionalClose && resumeSession) {
        reconnectTimer = setTimeout(() => {
          connect(resumeSession)
        }, 250)
      } else {
        pendingMessages = []
        pendingResumeSession = null
      }

      intentionalClose = false
    }
  }, [])

  const send = useCallback((msg: ClientMessage) => {
    if (globalWs?.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify(msg))
      return
    }

    if (globalWs?.readyState === WebSocket.CONNECTING) {
      pendingMessages.push(msg)
    }
  }, [])

  const disconnect = useCallback(() => {
    intentionalClose = true
    clearReconnectTimer()
    pendingMessages = []
    pendingResumeSession = null
    clearStoredResumeSession()
    globalWs?.close()
    globalWs = null
    useGameStore.getState().setWs(null)
  }, [])

  return { connect, send, disconnect }
}
