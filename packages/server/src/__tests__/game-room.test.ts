import { describe, it, expect, vi } from 'vitest'
import { WebSocket } from 'ws'
import { GameRoom } from '../game-room.js'
import { MessageType } from '@typeduel/shared'

function createMockWebSocket() {
  return {
    readyState: WebSocket.OPEN,
    send: vi.fn(),
  } as unknown as WebSocket
}

describe('GameRoom', () => {
  it('keeps totalCorrect and WPM stable when a correct character is backspaced and retyped', () => {
    const room = new GameRoom(() => {})
    const playerWs = createMockWebSocket()
    const opponentWs = createMockWebSocket()

    room.addPlayer('p1', 'Player 1', playerWs)
    room.addPlayer('p2', 'Player 2', opponentWs)
    room.status = 'active'
    room.text = 'abc'

    const player = room.players.get('p1') as any
    player.startTime = Date.now() - 12000

    room.handleKeystroke('p1', { type: MessageType.KEYSTROKE, char: 'a', timestamp: Date.now() })
    room.handleKeystroke('p1', { type: MessageType.KEYSTROKE, char: 'BACKSPACE', timestamp: Date.now() })
    room.handleKeystroke('p1', { type: MessageType.KEYSTROKE, char: 'a', timestamp: Date.now() })

    expect(player.cursor).toBe(1)
    expect(player.totalCorrect).toBe(1)
    expect(player.wpm).toBe(1)
  })

  it('includes the shareable room code in game state', () => {
    const room = new GameRoom(() => {})
    room.addPlayer('p1', 'Player 1', createMockWebSocket())

    const state = room.getGameState()

    expect(state.roomCode).toBe(room.roomCode)
    expect(state.roomCode).toHaveLength(6)
  })
})
