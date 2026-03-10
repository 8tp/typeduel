import { WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import {
  type GameState,
  type PlayerState,
  type ActiveEffect,
  type ServerMessage,
  type KeystrokeMessage,
  type UseAbilityMessage,
  type TauntMessage,
  type SpectateRoomMessage,
  MessageType,
  AbilityId,
  ABILITY_CONFIGS,
  MAX_HP,
  MAX_ENERGY,
  ROUND_DURATION,
  STATE_BROADCAST_MS,
  DAMAGE_TICK_MS,
  DISCONNECT_GRACE_MS,
} from '@typeduel/shared'
import { getRandomPassage } from './text-corpus.js'
import { generateRoomCode, getAccuracyMultiplier as getAccMult } from './formulas.js'

interface Keystroke {
  char: string
  timestamp: number
  correct: boolean
}

interface ServerPlayerState extends PlayerState {
  ws: WebSocket
  keystrokeLog: Keystroke[]
  totalCorrect: number
  totalKeystrokes: number
  startTime: number
  lastKeystrokeTime: number
  consecutiveCorrect: number
  damageDealt: number
  abilitiesUsed: number
  cooldowns: Map<AbilityId, number> // abilityId → timestamp when cooldown expires
  frozenKeystrokeBuffer: { char: string; timestamp: number }[]
  wpmHistory: number[]
}

export class GameRoom {
  roomId: string
  roomCode: string
  status: 'waiting' | 'countdown' | 'active' | 'finished' = 'waiting'
  text: string = ''
  timeLeft: number = ROUND_DURATION
  players: Map<string, ServerPlayerState> = new Map()
  spectators: Map<string, WebSocket> = new Map() // spectatorId → ws

  private broadcastInterval: ReturnType<typeof setInterval> | null = null
  private damageInterval: ReturnType<typeof setInterval> | null = null
  private countdownTimer: ReturnType<typeof setTimeout> | null = null
  private destroyTimer: ReturnType<typeof setTimeout> | null = null
  private disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private rematchVotes: Set<string> = new Set()
  private onDestroy: (roomId: string) => void
  difficulty?: 'easy' | 'medium' | 'hard'

  constructor(onDestroy: (roomId: string) => void, difficulty?: 'easy' | 'medium' | 'hard') {
    this.roomId = uuidv4()
    this.roomCode = generateRoomCode()
    this.onDestroy = onDestroy
    this.difficulty = difficulty
  }

  addPlayer(id: string, displayName: string, ws: WebSocket): PlayerState {
    const player: ServerPlayerState = {
      id,
      displayName,
      hp: MAX_HP,
      cursor: 0,
      wpm: 0,
      accuracy: 100,
      energy: 0,
      activeEffects: [],
      streak: 0,
      ws,
      keystrokeLog: [],
      totalCorrect: 0,
      totalKeystrokes: 0,
      startTime: 0,
      lastKeystrokeTime: 0,
      consecutiveCorrect: 0,
      damageDealt: 0,
      abilitiesUsed: 0,
      cooldowns: new Map(),
      frozenKeystrokeBuffer: [],
      wpmHistory: [],
    }
    this.players.set(id, player)
    return this.toPlayerState(player)
  }

  get playerCount(): number {
    return this.players.size
  }

  isFull(): boolean {
    return this.players.size >= 2
  }

  startCountdown(): void {
    if (this.status !== 'waiting') return
    this.status = 'countdown'

    const passage = getRandomPassage(this.difficulty)
    this.text = passage.text

    let count = 3
    this.broadcast({
      type: MessageType.COUNTDOWN,
      seconds: count,
    })

    const tick = () => {
      count--
      if (count > 0) {
        this.broadcast({
          type: MessageType.COUNTDOWN,
          seconds: count,
        })
        this.countdownTimer = setTimeout(tick, 1000)
      } else {
        this.startRound()
      }
    }
    this.countdownTimer = setTimeout(tick, 1000)
  }

  private startRound(): void {
    this.status = 'active'
    this.timeLeft = ROUND_DURATION

    const now = Date.now()
    for (const player of this.players.values()) {
      player.startTime = now
      player.lastKeystrokeTime = now
    }

    // Broadcast state at 10Hz
    this.broadcastInterval = setInterval(() => {
      this.broadcastState()
    }, STATE_BROADCAST_MS)

    // Damage tick every 1s
    this.damageInterval = setInterval(() => {
      this.damageTick()
    }, DAMAGE_TICK_MS)
  }

  handleAbility(playerId: string, msg: UseAbilityMessage): void {
    if (this.status !== 'active') return

    const player = this.players.get(playerId)
    if (!player) return

    const abilityId = msg.abilityId
    const config = ABILITY_CONFIGS[abilityId]
    if (!config) return

    const now = Date.now()

    // Check energy
    if (player.energy < config.cost) return

    // Check cooldown
    const cooldownExpiry = player.cooldowns.get(abilityId) ?? 0
    if (now < cooldownExpiry) return

    // Find opponent
    const opponent = [...this.players.values()].find(p => p.id !== playerId)
    if (!opponent) return

    // Check same ability not already active on target (no stacking)
    const target = abilityId === AbilityId.SURGE || abilityId === AbilityId.MIRROR ? player : opponent
    const alreadyActive = target.activeEffects.some(e => e.abilityId === abilityId)
    if (alreadyActive) return

    // Deduct energy and set cooldown
    player.energy -= config.cost
    player.cooldowns.set(abilityId, now + config.cooldown)
    player.abilitiesUsed++

    // Add active effect
    const effect: ActiveEffect = {
      abilityId,
      expiresAt: now + config.duration,
      source: playerId,
    }
    target.activeEffects.push(effect)

    // Broadcast ability usage
    this.broadcast({
      type: MessageType.ABILITY_USED,
      by: playerId,
      ability: abilityId,
      target: target.id,
    })
  }

  private hasEffect(player: ServerPlayerState, abilityId: AbilityId): boolean {
    return player.activeEffects.some(e => e.abilityId === abilityId)
  }

  private expireEffects(): void {
    const now = Date.now()
    for (const player of this.players.values()) {
      const before = player.activeEffects.length
      player.activeEffects = player.activeEffects.filter(e => e.expiresAt > now)

      // If FREEZE just expired, replay buffered keystrokes at 2x speed
      const hadFreeze = before > player.activeEffects.length &&
        !this.hasEffect(player, AbilityId.FREEZE)
      if (hadFreeze && player.frozenKeystrokeBuffer.length > 0) {
        // Replay buffered keystrokes immediately (all at once = 2x speed effect)
        for (const buffered of player.frozenKeystrokeBuffer) {
          this.processKeystroke(player, buffered.char)
        }
        player.frozenKeystrokeBuffer = []
      }
    }
  }

  private processKeystroke(player: ServerPlayerState, char: string): void {
    if (char === 'BACKSPACE') {
      if (player.cursor > 0) {
        player.cursor--
      }
      return
    }

    if (char.length !== 1) return
    const expectedChar = this.text[player.cursor]
    if (expectedChar === undefined) return

    player.totalKeystrokes++

    if (char === expectedChar) {
      player.totalCorrect++
      player.cursor++
      player.consecutiveCorrect++

      if (player.consecutiveCorrect > 0 && player.consecutiveCorrect % 20 === 0) {
        player.energy = Math.min(MAX_ENERGY, player.energy + 5)
      }
    } else {
      player.consecutiveCorrect = 0
    }

    player.accuracy = player.totalKeystrokes > 0
      ? (player.totalCorrect / player.totalKeystrokes) * 100
      : 100

    const now = Date.now()
    const elapsedMinutes = (now - player.startTime) / 60000
    if (elapsedMinutes > 0) {
      player.wpm = Math.round((player.totalCorrect / 5) / elapsedMinutes)
    }
  }

  handleKeystroke(playerId: string, msg: KeystrokeMessage): void {
    if (this.status !== 'active') return

    const player = this.players.get(playerId)
    if (!player) return

    const now = Date.now()
    player.lastKeystrokeTime = now

    // If player is frozen, buffer the keystroke
    if (this.hasEffect(player, AbilityId.FREEZE)) {
      player.frozenKeystrokeBuffer.push({ char: msg.char, timestamp: now })
      return
    }

    this.processKeystroke(player, msg.char)

    player.keystrokeLog.push({
      char: msg.char,
      timestamp: now,
      correct: msg.char === this.text[player.cursor - 1],
    })
  }

  private getAccuracyMultiplier(accuracy: number): number {
    return getAccMult(accuracy)
  }

  private damageTick(): void {
    if (this.status !== 'active') return

    this.timeLeft--

    // Expire active effects (and replay freeze buffers)
    this.expireEffects()

    const playerArr = [...this.players.values()]

    // Energy accrual
    for (const player of playerArr) {
      const now = Date.now()
      const recentlyTyped = (now - player.lastKeystrokeTime) < 2000

      if (recentlyTyped) {
        // +2 base energy
        player.energy = Math.min(MAX_ENERGY, player.energy + 2)

        // +1 per 10 WPM above 40
        if (player.wpm > 40) {
          const bonus = Math.floor((player.wpm - 40) / 10)
          player.energy = Math.min(MAX_ENERGY, player.energy + bonus)
        }
      }
    }

    // Track WPM history (one snapshot per second)
    for (const player of playerArr) {
      player.wpmHistory.push(player.wpm)
    }

    // Damage calculation: each player deals damage to opponent
    // Collect damage amounts first, then apply (so MIRROR works symmetrically)
    const damageMap = new Map<string, number>() // playerId → damage they will receive

    for (const player of playerArr) {
      const opponent = playerArr.find(p => p.id !== player.id)
      if (!opponent) continue

      // Base damage = (wpm / 20) * accuracyMultiplier
      const accuracyMultiplier = this.getAccuracyMultiplier(player.accuracy)
      let damage = (player.wpm / 20) * accuracyMultiplier

      // Text exhaustion bonus: +3/tick if player finished the passage
      if (player.cursor >= this.text.length) {
        damage += 3
      }

      // SURGE: 1.5x damage boost for caster
      if (this.hasEffect(player, AbilityId.SURGE)) {
        damage *= 1.5
      }

      // Comeback mechanic: 1.25x damage when below 30 HP
      if (player.hp < 30) {
        damage *= 1.25
      }

      if (damage > 0) {
        player.damageDealt += damage

        // Apply damage to opponent
        const existing = damageMap.get(opponent.id) ?? 0
        damageMap.set(opponent.id, existing + damage)

        // MIRROR: reflect 50% back to attacker
        if (this.hasEffect(opponent, AbilityId.MIRROR)) {
          const reflected = damage * 0.5
          const existingReflect = damageMap.get(player.id) ?? 0
          damageMap.set(player.id, existingReflect + reflected)
        }
      }
    }

    // Apply all damage
    for (const [playerId, damage] of damageMap) {
      const player = this.players.get(playerId)
      if (player) {
        player.hp = Math.max(0, player.hp - damage)
      }
    }

    // Check for KO (HP reaches 0)
    for (const player of playerArr) {
      if (player.hp <= 0) {
        this.endRound()
        return
      }
    }

    // Check timer
    if (this.timeLeft <= 0) {
      this.endRound()
      return
    }
  }

  private endRound(): void {
    this.status = 'finished'
    this.cleanup()

    // Determine winner (highest HP, tiebreak by WPM)
    const playerArr = [...this.players.values()]
    playerArr.sort((a, b) => {
      if (b.hp !== a.hp) return b.hp - a.hp
      return b.wpm - a.wpm
    })

    const winner = playerArr[0]

    const stats: Record<string, { wpm: number; accuracy: number; damageDealt: number; abilitiesUsed: number; hpRemaining: number; wpmHistory: number[] }> = {}
    for (const p of playerArr) {
      stats[p.id] = {
        wpm: p.wpm,
        accuracy: Math.round(p.accuracy * 10) / 10,
        damageDealt: Math.round(p.damageDealt * 10) / 10,
        abilitiesUsed: p.abilitiesUsed,
        hpRemaining: Math.round(p.hp * 10) / 10,
        wpmHistory: p.wpmHistory,
      }
    }

    this.broadcast({
      type: MessageType.ROUND_END,
      winner: winner?.id ?? '',
      stats,
    })

    // Destroy room after a delay (unless rematch)
    this.destroyTimer = setTimeout(() => {
      this.onDestroy(this.roomId)
    }, 30000)
  }

  private broadcastState(): void {
    const state = this.getGameState()
    this.broadcast({
      type: MessageType.GAME_STATE,
      state,
    })
  }

  getGameState(): GameState {
    const players: Record<string, PlayerState> = {}
    for (const [id, p] of this.players) {
      players[id] = this.toPlayerState(p)
    }
    return {
      roomId: this.roomId,
      status: this.status,
      text: this.text,
      timeLeft: this.timeLeft,
      players,
      spectatorCount: this.spectators.size,
    }
  }

  private toPlayerState(p: ServerPlayerState): PlayerState {
    return {
      id: p.id,
      displayName: p.displayName,
      hp: p.hp,
      cursor: p.cursor,
      wpm: p.wpm,
      accuracy: Math.round(p.accuracy * 10) / 10,
      energy: p.energy,
      activeEffects: p.activeEffects,
      streak: p.consecutiveCorrect,
    }
  }

  broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg)
    for (const player of this.players.values()) {
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(data)
      }
    }
    // Also send to spectators
    for (const [specId, ws] of this.spectators) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      } else {
        this.spectators.delete(specId)
      }
    }
  }

  sendTo(playerId: string, msg: ServerMessage): void {
    const player = this.players.get(playerId)
    if (player && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(msg))
    }
  }

  addSpectator(spectatorId: string, ws: WebSocket): void {
    this.spectators.set(spectatorId, ws)
    // Send current game state immediately so spectator sees the match
    const state = this.getGameState()
    ws.send(JSON.stringify({ type: MessageType.GAME_STATE, state }))
  }

  removeSpectator(spectatorId: string): void {
    this.spectators.delete(spectatorId)
  }

  handleTaunt(playerId: string, msg: TauntMessage): void {
    const opponent = [...this.players.values()].find(p => p.id !== playerId)
    if (!opponent) return
    this.sendTo(opponent.id, {
      type: MessageType.TAUNT_RECEIVED,
      from: playerId,
      tauntId: msg.tauntId,
    })
  }

  handleDisconnect(playerId: string): void {
    if (this.status === 'active') {
      // Start grace period — if they don't reconnect, opponent wins
      const timer = setTimeout(() => {
        this.disconnectTimers.delete(playerId)
        // Player didn't reconnect — end round, opponent wins
        const player = this.players.get(playerId)
        if (player) {
          player.hp = 0
          this.endRound()
        }
      }, DISCONNECT_GRACE_MS)
      this.disconnectTimers.set(playerId, timer)
    } else {
      this.removePlayer(playerId)
    }
  }

  handleReconnect(playerId: string, ws: WebSocket): boolean {
    const player = this.players.get(playerId)
    if (!player) return false

    // Clear disconnect timer
    const timer = this.disconnectTimers.get(playerId)
    if (timer) {
      clearTimeout(timer)
      this.disconnectTimers.delete(playerId)
    }

    player.ws = ws
    return true
  }

  handleRematch(playerId: string): void {
    if (this.status !== 'finished') return
    this.rematchVotes.add(playerId)

    // Notify the other player that this player voted for rematch
    if (this.rematchVotes.size === 1) {
      const opponent = [...this.players.values()].find(p => p.id !== playerId)
      if (opponent) {
        this.sendTo(opponent.id, {
          type: MessageType.REMATCH_VOTED,
          playerId,
        })
      }
    }

    if (this.rematchVotes.size >= 2) {
      // Both players want rematch — reset and start new round
      if (this.destroyTimer) {
        clearTimeout(this.destroyTimer)
        this.destroyTimer = null
      }
      this.rematchVotes.clear()
      this.status = 'waiting'
      this.text = ''
      this.timeLeft = ROUND_DURATION

      for (const player of this.players.values()) {
        player.hp = MAX_HP
        player.cursor = 0
        player.wpm = 0
        player.accuracy = 100
        player.energy = 0
        player.activeEffects = []
        player.keystrokeLog = []
        player.totalCorrect = 0
        player.totalKeystrokes = 0
        player.startTime = 0
        player.lastKeystrokeTime = 0
        player.consecutiveCorrect = 0
        player.streak = 0
        player.damageDealt = 0
        player.abilitiesUsed = 0
        player.cooldowns.clear()
        player.frozenKeystrokeBuffer = []
        player.wpmHistory = []
      }

      this.startCountdown()
    }
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId)
    if (this.players.size === 0) {
      this.cleanup()
      this.onDestroy(this.roomId)
    }
  }

  private cleanup(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval)
      this.broadcastInterval = null
    }
    if (this.damageInterval) {
      clearInterval(this.damageInterval)
      this.damageInterval = null
    }
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer)
      this.countdownTimer = null
    }
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer)
    }
    this.disconnectTimers.clear()
  }
}
