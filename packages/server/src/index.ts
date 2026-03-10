import express from 'express'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { MessageType, type ClientMessage } from '@typeduel/shared'
import { GameRoom } from './game-room.js'
import path from 'path'
import { fileURLToPath } from 'url'

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
app.get('/health', (_req, res) => res.json({ ok: true }))

// In production, serve the client build
const clientDist = path.resolve(__dirname, '../../client/dist')
app.use(express.static(clientDist))
app.get('*', (_req, res, next) => {
  // Skip API/health routes
  if (_req.path.startsWith('/health')) return next()
  res.sendFile(path.join(clientDist, 'index.html'))
})

const server = createServer(app)
const wss = new WebSocketServer({ server })

// ── State ──

const rooms = new Map<string, GameRoom>()          // roomId → GameRoom
const roomsByCode = new Map<string, GameRoom>()     // roomCode → GameRoom
const playerRooms = new Map<string, string>()       // playerId → roomId

// Matchmaking queue: [{ id, displayName, ws }]
const matchQueue: { id: string; displayName: string; ws: WebSocket; difficulty?: 'easy' | 'medium' | 'hard' }[] = []

function destroyRoom(roomId: string) {
  const room = rooms.get(roomId)
  if (room) {
    roomsByCode.delete(room.roomCode)
    rooms.delete(roomId)
    for (const [pid, rid] of playerRooms) {
      if (rid === roomId) playerRooms.delete(pid)
    }
  }
}

function tryMatchmaking() {
  // Remove disconnected players from queue
  for (let i = matchQueue.length - 1; i >= 0; i--) {
    if (matchQueue[i].ws.readyState !== WebSocket.OPEN) {
      matchQueue.splice(i, 1)
    }
  }

  while (matchQueue.length >= 2) {
    const p1 = matchQueue.shift()!
    const p2 = matchQueue.shift()!

    const room = new GameRoom(destroyRoom, p1.difficulty)
    rooms.set(room.roomId, room)
    roomsByCode.set(room.roomCode, room)

    room.addPlayer(p1.id, p1.displayName, p1.ws)
    room.addPlayer(p2.id, p2.displayName, p2.ws)
    playerRooms.set(p1.id, room.roomId)
    playerRooms.set(p2.id, room.roomId)

    // Notify both players
    room.sendTo(p1.id, {
      type: MessageType.MATCH_FOUND,
      opponent: { id: p2.id, displayName: p2.displayName },
      roomId: room.roomId,
      roomCode: room.roomCode,
    })
    room.sendTo(p2.id, {
      type: MessageType.MATCH_FOUND,
      opponent: { id: p1.id, displayName: p1.displayName },
      roomId: room.roomId,
      roomCode: room.roomCode,
    })

    // Start countdown
    room.startCountdown()
  }
}

// ── WebSocket handling ──

wss.on('connection', (ws) => {
  const playerId = uuidv4()

  // Send player ID immediately
  ws.send(JSON.stringify({ type: MessageType.WELCOME, playerId }))

  ws.on('message', (raw) => {
    let msg: ClientMessage
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }

    switch (msg.type) {
      case MessageType.JOIN_QUEUE: {
        matchQueue.push({ id: playerId, displayName: msg.displayName, ws, difficulty: msg.difficulty })
        tryMatchmaking()
        break
      }

      case MessageType.CREATE_ROOM: {
        const room = new GameRoom(destroyRoom, msg.difficulty)
        rooms.set(room.roomId, room)
        roomsByCode.set(room.roomCode, room)
        room.addPlayer(playerId, msg.displayName, ws)
        playerRooms.set(playerId, room.roomId)

        // Send the room code back so the player can share it
        room.sendTo(playerId, {
          type: MessageType.MATCH_FOUND,
          opponent: { id: '', displayName: '' },
          roomId: room.roomId,
          roomCode: room.roomCode,
        })
        break
      }

      case MessageType.JOIN_ROOM: {
        const room = roomsByCode.get(msg.roomCode.toUpperCase())
        if (!room) {
          const errMsg = JSON.stringify({
            type: MessageType.ERROR,
            code: 'ROOM_NOT_FOUND',
            message: 'Room not found',
          })
          ws.send(errMsg)
          return
        }
        if (room.isFull()) {
          const errMsg = JSON.stringify({
            type: MessageType.ERROR,
            code: 'ROOM_FULL',
            message: 'Room is full',
          })
          ws.send(errMsg)
          return
        }

        room.addPlayer(playerId, msg.displayName, ws)
        playerRooms.set(playerId, room.roomId)

        // Notify both players
        const players = [...room.players.values()]
        const opponent = players.find(p => p.id !== playerId)
        if (opponent) {
          room.sendTo(playerId, {
            type: MessageType.MATCH_FOUND,
            opponent: { id: opponent.id, displayName: opponent.displayName },
            roomId: room.roomId,
            roomCode: room.roomCode,
          })
          room.sendTo(opponent.id, {
            type: MessageType.MATCH_FOUND,
            opponent: { id: playerId, displayName: msg.displayName },
            roomId: room.roomId,
            roomCode: room.roomCode,
          })
        }

        if (room.isFull()) {
          room.startCountdown()
        }
        break
      }

      case MessageType.KEYSTROKE: {
        const roomId = playerRooms.get(playerId)
        if (!roomId) return
        const room = rooms.get(roomId)
        if (!room) return
        room.handleKeystroke(playerId, msg)
        break
      }

      case MessageType.USE_ABILITY: {
        const abilityRoomId = playerRooms.get(playerId)
        if (!abilityRoomId) return
        const abilityRoom = rooms.get(abilityRoomId)
        if (!abilityRoom) return
        abilityRoom.handleAbility(playerId, msg)
        break
      }

      case MessageType.REMATCH: {
        const rematchRoomId = playerRooms.get(playerId)
        if (!rematchRoomId) return
        const rematchRoom = rooms.get(rematchRoomId)
        if (!rematchRoom) return
        rematchRoom.handleRematch(playerId)
        break
      }

      case MessageType.TAUNT: {
        const tauntRoomId = playerRooms.get(playerId)
        if (!tauntRoomId) return
        const tauntRoom = rooms.get(tauntRoomId)
        if (!tauntRoom) return
        tauntRoom.handleTaunt(playerId, msg)
        break
      }

      case MessageType.SPECTATE_ROOM: {
        const room = roomsByCode.get(msg.roomCode.toUpperCase())
        if (!room) {
          ws.send(JSON.stringify({
            type: MessageType.ERROR,
            code: 'ROOM_NOT_FOUND',
            message: 'Room not found',
          }))
          return
        }
        room.addSpectator(playerId, ws)
        playerRooms.set(playerId, room.roomId)
        break
      }
    }
  })

  ws.on('close', () => {
    // Remove from queue
    const idx = matchQueue.findIndex(p => p.id === playerId)
    if (idx !== -1) matchQueue.splice(idx, 1)

    // Handle disconnect with grace period
    const roomId = playerRooms.get(playerId)
    if (roomId) {
      const room = rooms.get(roomId)
      if (room) {
        // Check if spectator
        if (room.spectators.has(playerId)) {
          room.removeSpectator(playerId)
          playerRooms.delete(playerId)
        } else {
          room.handleDisconnect(playerId)
        }
      } else {
        playerRooms.delete(playerId)
      }
    }
  })
})

server.listen(PORT, () => {
  console.log(`TypeDuel server listening on port ${PORT}`)
})
