import { useCallback } from 'react'
import { MessageType, AbilityId, type ClientMessage, type ServerMessage } from '@typeduel/shared'
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

export function useWebSocket() {
  const store = useGameStore()

  const connect = useCallback(() => {
    if (globalWs?.readyState === WebSocket.OPEN || globalWs?.readyState === WebSocket.CONNECTING) {
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.hostname}:3001`
    const ws = new WebSocket(wsUrl)
    globalWs = ws

    ws.onopen = () => {
      useGameStore.getState().setWs(ws)
    }

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data)
      const s = useGameStore.getState()

      switch (msg.type) {
        case MessageType.WELCOME:
          s.setPlayerId(msg.playerId)
          break

        case MessageType.MATCH_FOUND:
          if (msg.opponent.id) {
            s.setOpponentName(msg.opponent.displayName)
          }
          s.setRoomCode(msg.roomCode)
          if (msg.opponent.id) {
            s.setScreen('countdown')
          }
          break

        case MessageType.COUNTDOWN:
          s.setCountdown(msg.seconds)
          s.setScreen('countdown')
          if (msg.seconds > 0) sfx.countdown()
          else sfx.countdownGo()
          break

        case MessageType.GAME_STATE:
          s.setGameState(msg.state)
          if (msg.state.status === 'active') {
            s.setScreen('game')
          }
          break

        case MessageType.ROUND_END: {
          s.setResults(msg.winner, msg.stats)
          s.setScreen('results')
          const isWinner = msg.winner === useGameStore.getState().playerId
          s.addCombatLogEntry(isWinner ? 'You win!' : 'You lose!', isWinner ? 'green' : 'red')
          if (isWinner) sfx.victory()
          else sfx.defeat()
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
          break
        }

        case MessageType.ERROR:
          console.error(`Server error: ${msg.code} - ${msg.message}`)
          break
      }
    }

    ws.onclose = () => {
      useGameStore.getState().setWs(null)
      globalWs = null
    }
  }, [])

  const send = useCallback((msg: ClientMessage) => {
    if (globalWs?.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify(msg))
    }
  }, [])

  const disconnect = useCallback(() => {
    globalWs?.close()
    globalWs = null
    useGameStore.getState().setWs(null)
  }, [])

  return { connect, send, disconnect }
}
