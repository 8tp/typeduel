// ── Message Types ──

export enum MessageType {
  JOIN_QUEUE = 'JOIN_QUEUE',
  JOIN_ROOM = 'JOIN_ROOM',
  CREATE_ROOM = 'CREATE_ROOM',
  RESUME_SESSION = 'RESUME_SESSION',
  LEAVE_ROOM = 'LEAVE_ROOM',
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
  TAUNT = 'TAUNT',
  TAUNT_RECEIVED = 'TAUNT_RECEIVED',
  SPECTATE_ROOM = 'SPECTATE_ROOM',
  REMATCH_VOTED = 'REMATCH_VOTED',
  SESSION_RESUMED = 'SESSION_RESUMED',
}

export type TauntId = 'GG' | 'NICE' | 'OUCH' | 'GL'

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
  streak: number
}

export interface GameState {
  roomId: string
  roomCode: string
  status: 'waiting' | 'countdown' | 'active' | 'finished'
  countdownSeconds: number
  text: string
  timeLeft: number
  players: Record<string, PlayerState>
  spectatorCount: number
  currentRound: number
  roundWins: Record<string, number>
}

// ── Constants ──

export const MAX_HP = 100
export const MAX_ENERGY = 100
export const ROUND_DURATION = 90 // seconds
export const ROUNDS_TO_WIN = 2  // best-of-3 (first to 2 wins)
export const ROUND_BREAK_MS = 5000 // pause between rounds
export const DAMAGE_TICK_MS = 1000
export const STATE_BROADCAST_MS = 100
export const DISCONNECT_GRACE_MS = 10000

// Damage formula constants (differential model)
export const BASE_DRAIN = 1.1        // HP/tick dealt by every active player
export const WPM_DIFF_SCALE = 0.03   // bonus HP/tick per WPM advantage over opponent
export const TEXT_EXHAUST_BONUS = 1   // bonus HP/tick when passage is completed

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

export interface ResumeSessionMessage {
  type: MessageType.RESUME_SESSION
  playerId: string
  roomCode: string
  spectator?: boolean
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

export interface LeaveRoomMessage {
  type: MessageType.LEAVE_ROOM
}

export interface TauntMessage {
  type: MessageType.TAUNT
  tauntId: TauntId
}

export interface SpectateRoomMessage {
  type: MessageType.SPECTATE_ROOM
  roomCode: string
}

export type ClientMessage =
  | JoinQueueMessage
  | JoinRoomMessage
  | CreateRoomMessage
  | ResumeSessionMessage
  | KeystrokeMessage
  | UseAbilityMessage
  | RematchMessage
  | LeaveRoomMessage
  | TauntMessage
  | SpectateRoomMessage

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

export interface SessionResumedMessage {
  type: MessageType.SESSION_RESUMED
  playerId: string
  roomId: string
  roomCode: string
  isSpectating: boolean
  opponent: PlayerInfo | null
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
  wpmHistory?: number[]
}

export interface RoundEndMessage {
  type: MessageType.ROUND_END
  winner: string
  stats: Record<string, FinalStats>
  roundWins: Record<string, number>
  currentRound: number
  isMatchOver: boolean
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

export interface TauntReceivedMessage {
  type: MessageType.TAUNT_RECEIVED
  from: string
  tauntId: TauntId
}

export interface RematchVotedMessage {
  type: MessageType.REMATCH_VOTED
  playerId: string
}

export type ServerMessage =
  | MatchFoundMessage
  | SessionResumedMessage
  | CountdownMessage
  | GameStateMessage
  | AbilityUsedMessage
  | RoundEndMessage
  | ErrorMessage
  | WelcomeMessage
  | TauntReceivedMessage
  | RematchVotedMessage

// ── Passages (shared between server and client for practice mode) ──

export interface Passage {
  text: string
  difficulty: Difficulty
}

export const PASSAGES: Passage[] = [
  // Easy
  { difficulty: 'easy', text: 'The quick brown fox jumps over the lazy dog. She sells sea shells by the sea shore. A warm cup of tea sat on the table near the window.' },
  { difficulty: 'easy', text: 'The sun was low in the sky and the air was cool and still. Birds sang from the tall trees and the river ran slow and clear over smooth stones.' },
  { difficulty: 'easy', text: 'He ran to the store to get milk and bread. The dog sat by the door and waited. She read a book in the park under a big old tree.' },
  { difficulty: 'easy', text: 'Rain fell on the roof all night long. The cat slept by the fire and did not move. In the morning the sky was clear and the grass was wet.' },
  { difficulty: 'easy', text: 'The boat moved slow on the lake. Fish swam just below the top of the water. A bird flew down and took one in its claws then rose back up.' },
  { difficulty: 'easy', text: 'They walked down the path to the old barn. The door was red and the roof was made of tin. A horse stood in the shade and ate some hay.' },
  { difficulty: 'easy', text: 'She put on her coat and hat and went out. The wind was cold but the sun was bright. Snow had fallen in the night and made the world white.' },
  { difficulty: 'easy', text: 'The clock on the wall said it was late. He closed his book and turned off the lamp. The house was dark and still and he went up to bed.' },
  { difficulty: 'easy', text: 'A small girl sat on the steps and drew with chalk. Her dog lay next to her in the sun. The sky was blue and there were no clouds at all.' },
  { difficulty: 'easy', text: 'The man drove his truck down a long dirt road. Dust rose up in a cloud and then fell back down. He could see the farm from the top of the hill.' },
  { difficulty: 'easy', text: 'The kids played in the yard all day long. They ran and jumped and laughed until the sun went down. Then they went inside for dinner and warm soup.' },
  { difficulty: 'easy', text: 'A fox sat on a log and watched the moon rise. The stars came out one by one. The air was cold and crisp and he could see his breath.' },
  { difficulty: 'easy', text: 'The old man sat on the porch in his chair. He had a pipe and a good book. The dog slept at his feet and the wind blew through the trees.' },
  { difficulty: 'easy', text: 'She found a shell on the beach that was pink and white. The waves came in and went back out. Sand was warm under her feet and the sky was blue.' },
  { difficulty: 'easy', text: 'He made a cake for his mom on her day. It was not the best cake but she loved it. She gave him a hug and said it was the best gift.' },
  // Medium
  { difficulty: 'medium', text: 'Programming is the art of telling another human what one wants the computer to do. Good code is its own best documentation, and when you find yourself adding comments, consider rewriting the code instead.' },
  { difficulty: 'medium', text: 'The greatest enemy of knowledge is not ignorance, it is the illusion of knowledge. Every expert was once a beginner, and every professional was once an amateur learning their craft.' },
  { difficulty: 'medium', text: 'Distributed systems are fundamentally about trade-offs between consistency, availability, and partition tolerance. Understanding these constraints helps engineers design resilient architectures.' },
  { difficulty: 'medium', text: 'Effective debugging requires patience and systematic thinking. Start by reproducing the bug reliably, then isolate the failing component. Binary search through your assumptions until you find the root cause.' },
  { difficulty: 'medium', text: 'The internet transformed how humans communicate, collaborate, and create. What began as a military research network evolved into the backbone of modern civilization, connecting billions of devices worldwide.' },
  { difficulty: 'medium', text: "Version control is a system that records changes to files over time so that you can recall specific versions later. It allows multiple developers to collaborate without overwriting each other's work." },
  { difficulty: 'medium', text: 'Typography matters more than most people realize. The spacing between letters, the weight of the strokes, and the shape of each character all contribute to readability and the feeling a text conveys.' },
  { difficulty: 'medium', text: 'Machine learning algorithms identify patterns in data without being explicitly programmed. They improve through experience, adjusting their parameters to minimize prediction errors across training examples.' },
  { difficulty: 'medium', text: 'The scientific method involves forming hypotheses, designing experiments, collecting data, and drawing conclusions. Peer review ensures that findings are scrutinized before being accepted by the community.' },
  { difficulty: 'medium', text: 'Open source software has reshaped the technology landscape. Projects maintained by global communities of volunteers power everything from web servers to operating systems to artificial intelligence frameworks.' },
  { difficulty: 'medium', text: 'Functional programming treats computation as the evaluation of mathematical functions and avoids changing state. Immutability and pure functions lead to code that is easier to reason about, test, and parallelize.' },
  { difficulty: 'medium', text: 'Cryptographic hash functions produce a fixed-size digest from arbitrary input. Even a single bit change results in a completely different hash. This property makes them ideal for data integrity verification and password storage.' },
  { difficulty: 'medium', text: 'Containerization revolutionized software deployment by packaging applications with their dependencies into isolated environments. Docker popularized the approach, while Kubernetes emerged as the standard for orchestrating containers at scale.' },
  { difficulty: 'medium', text: 'Test-driven development inverts the traditional coding workflow: write a failing test first, then implement just enough code to make it pass. This discipline catches bugs early and produces well-tested, modular codebases.' },
  { difficulty: 'medium', text: 'The observer pattern defines a one-to-many dependency so that when one object changes state, all its dependents are notified automatically. This decouples event producers from consumers and is fundamental to reactive programming.' },
  // Hard
  { difficulty: 'hard', text: "The Byzantine Generals' Problem illustrates the difficulty of achieving consensus in distributed systems where participants may be unreliable. Lamport's solution requires 3f+1 nodes to tolerate f Byzantine faults." },
  { difficulty: 'hard', text: 'Quantum entanglement - described by Einstein as "spooky action at a distance" - enables correlations between particles that persist regardless of separation. This phenomenon underpins quantum cryptography and teleportation protocols.' },
  { difficulty: 'hard', text: 'The Curry-Howard correspondence establishes a deep isomorphism between computer programs and mathematical proofs: types correspond to propositions, and programs correspond to proofs. This duality bridges logic and computation.' },
  { difficulty: 'hard', text: 'Implementing lock-free data structures requires careful use of atomic compare-and-swap (CAS) operations. The ABA problem - where a value changes from A to B and back to A - can cause subtle, non-deterministic bugs.' },
  { difficulty: 'hard', text: 'CRISPR-Cas9 gene editing leverages bacterial immune mechanisms to make precise modifications to DNA sequences. Off-target effects remain a significant concern; specificity depends on guide RNA complementarity and PAM recognition.' },
  { difficulty: 'hard', text: "Zero-knowledge proofs allow one party (the prover) to convince another (the verifier) that a statement is true without revealing any information beyond the statement's validity. zk-SNARKs achieve this non-interactively." },
  { difficulty: 'hard', text: "Rust's ownership model prevents data races at compile time through three rules: each value has exactly one owner; ownership can be transferred (moved) or borrowed; mutable references are exclusive." },
  { difficulty: 'hard', text: 'Paxos consensus proceeds in two phases: prepare/promise (phase 1a/1b) and accept/accepted (phase 2a/2b). A proposer must secure a majority quorum in each phase. Multi-Paxos optimizes by electing a stable leader.' },
  { difficulty: 'hard', text: 'Homomorphic encryption enables computation on ciphertexts such that decrypting the result yields the same output as performing the operations on plaintext. Fully homomorphic encryption (FHE) supports arbitrary circuits but incurs 10,000x overhead.' },
  { difficulty: 'hard', text: "Category theory provides a unifying framework for mathematics through objects and morphisms. Functors map between categories preserving composition; natural transformations relate functors while respecting structure. Monads - endofunctors with unit and join - model side effects in pure languages." },
  { difficulty: 'hard', text: "The halting problem proves that no general algorithm can decide whether an arbitrary program terminates. Turing's 1936 proof uses diagonalization: assuming such a decider H exists leads to a program that halts iff H says it does not - a contradiction." },
  { difficulty: 'hard', text: 'Bloom filters are space-efficient probabilistic data structures that test set membership. False positives are possible (tunable via hash count k and bit array size m), but false negatives never occur. Counting variants support deletion at the cost of extra memory.' },
  { difficulty: 'hard', text: 'Formal verification uses mathematical proof to establish program correctness. Dependent types (Coq, Agda, Lean) encode specifications as types; a well-typed program constitutes a machine-checked proof that it meets its specification, eliminating entire bug classes.' },
  { difficulty: 'hard', text: 'WebAssembly (Wasm) defines a portable binary instruction format for a stack-based virtual machine. Its sandboxed execution model, near-native performance, and language-agnostic compilation target make it suitable for browsers, edge computing, and plugin architectures.' },
]

export function getRandomPassage(difficulty?: Difficulty): Passage {
  const pool = difficulty ? PASSAGES.filter(p => p.difficulty === difficulty) : PASSAGES
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Build a long passage (~600+ chars) by concatenating multiple passages.
 * Ensures enough text for a full 90s round at high WPM.
 */
export function buildLongPassage(difficulty?: Difficulty, targetLength: number = 700): Passage {
  const pool = difficulty ? PASSAGES.filter(p => p.difficulty === difficulty) : PASSAGES
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  let text = ''
  let i = 0
  while (text.length < targetLength && i < shuffled.length) {
    if (text.length > 0) text += ' '
    text += shuffled[i].text
    i++
  }
  return { text, difficulty: difficulty ?? 'medium' }
}
