// ── Message Types ──

export enum MessageType {
  JOIN_QUEUE = 'JOIN_QUEUE',
  JOIN_ROOM = 'JOIN_ROOM',
  CREATE_ROOM = 'CREATE_ROOM',
  MATCH_FOUND = 'MATCH_FOUND',
  COUNTDOWN = 'COUNTDOWN',
  GAME_STATE = 'GAME_STATE',
  KEYSTROKE = 'KEYSTROKE',
  USE_ABILITY = 'USE_ABILITY',
  ABILITY_USED = 'ABILITY_USED',
  ROUND_END = 'ROUND_END',
  REMATCH = 'REMATCH',
  ERROR = 'ERROR',
  WELCOME = 'WELCOME',
}

// ── Abilities ──

export enum AbilityId {
  SCRAMBLE = 'SCRAMBLE',
  BLACKOUT = 'BLACKOUT',
  FREEZE = 'FREEZE',
  MIRROR = 'MIRROR',
  SURGE = 'SURGE',
  PHANTOM_KEYS = 'PHANTOM_KEYS',
}

export interface AbilityConfig {
  cost: number
  duration: number // ms
  cooldown: number // ms
  description: string
}

export const ABILITY_CONFIGS: Record<AbilityId, AbilityConfig> = {
  [AbilityId.SCRAMBLE]:     { cost: 30, duration: 4000,  cooldown: 10000, description: "Scramble opponent's upcoming text" },
  [AbilityId.BLACKOUT]:     { cost: 25, duration: 3000,  cooldown: 10000, description: "Dim opponent's screen" },
  [AbilityId.FREEZE]:       { cost: 40, duration: 2500,  cooldown: 10000, description: "Freeze opponent's cursor" },
  [AbilityId.MIRROR]:       { cost: 50, duration: 5000,  cooldown: 10000, description: 'Reflect 50% damage back' },
  [AbilityId.SURGE]:        { cost: 20, duration: 5000,  cooldown: 10000, description: 'Boost own damage 1.5x' },
  [AbilityId.PHANTOM_KEYS]: { cost: 35, duration: 4000,  cooldown: 10000, description: 'Inject ghost characters' },
}

// ── Game State ──

export interface ActiveEffect {
  abilityId: AbilityId
  expiresAt: number
  source: string // playerId who cast it
}

export interface PlayerState {
  id: string
  displayName: string
  hp: number
  cursor: number
  wpm: number
  accuracy: number
  energy: number
  activeEffects: ActiveEffect[]
}

export interface GameState {
  roomId: string
  status: 'waiting' | 'countdown' | 'active' | 'finished'
  text: string
  timeLeft: number
  players: Record<string, PlayerState>
}

// ── Constants ──

export const MAX_HP = 100
export const MAX_ENERGY = 100
export const ROUND_DURATION = 60 // seconds
export const DAMAGE_TICK_MS = 1000
export const STATE_BROADCAST_MS = 100
export const DISCONNECT_GRACE_MS = 10000

// ── Client → Server Messages ──

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface JoinQueueMessage {
  type: MessageType.JOIN_QUEUE
  displayName: string
  difficulty?: Difficulty
}

export interface JoinRoomMessage {
  type: MessageType.JOIN_ROOM
  displayName: string
  roomCode: string
  difficulty?: Difficulty
}

export interface CreateRoomMessage {
  type: MessageType.CREATE_ROOM
  displayName: string
  difficulty?: Difficulty
}

export interface KeystrokeMessage {
  type: MessageType.KEYSTROKE
  char: string
  timestamp: number
}

export interface UseAbilityMessage {
  type: MessageType.USE_ABILITY
  abilityId: AbilityId
}

export interface RematchMessage {
  type: MessageType.REMATCH
}

export type ClientMessage =
  | JoinQueueMessage
  | JoinRoomMessage
  | CreateRoomMessage
  | KeystrokeMessage
  | UseAbilityMessage
  | RematchMessage

// ── Server → Client Messages ──

export interface PlayerInfo {
  id: string
  displayName: string
}

export interface MatchFoundMessage {
  type: MessageType.MATCH_FOUND
  opponent: PlayerInfo
  roomId: string
  roomCode: string
}

export interface CountdownMessage {
  type: MessageType.COUNTDOWN
  seconds: number
}

export interface GameStateMessage {
  type: MessageType.GAME_STATE
  state: GameState
}

export interface AbilityUsedMessage {
  type: MessageType.ABILITY_USED
  by: string
  ability: AbilityId
  target: string
}

export interface FinalStats {
  wpm: number
  accuracy: number
  damageDealt: number
  abilitiesUsed: number
  hpRemaining: number
}

export interface RoundEndMessage {
  type: MessageType.ROUND_END
  winner: string
  stats: Record<string, FinalStats>
}

export interface ErrorMessage {
  type: MessageType.ERROR
  code: string
  message: string
}

export interface WelcomeMessage {
  type: MessageType.WELCOME
  playerId: string
}

export type ServerMessage =
  | MatchFoundMessage
  | CountdownMessage
  | GameStateMessage
  | AbilityUsedMessage
  | RoundEndMessage
  | ErrorMessage
  | WelcomeMessage
