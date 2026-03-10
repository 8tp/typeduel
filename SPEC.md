# TYPEDUEL — Product Spec & Implementation Guide

> Real-time multiplayer typing combat. MonkeyType meets a fighting game.
> Two players type the same passage, deal damage based on WPM/accuracy, and disrupt each other with combat abilities.

---

## 1. Overview

TypeDuel is a real-time multiplayer typing duel where two players race through a shared text passage while attacking each other. Your WPM is your weapon, your accuracy is your shield, and strategic ability usage determines the winner.

Players connect via WebSocket, enter a lobby, and duel head-to-head. Each player has an HP bar (100 HP). Damage is dealt continuously based on typing performance. Players earn energy through sustained performance and spend it on combat abilities that disrupt their opponent.

### Core Fantasy

The player feels like a hacker in a cyberpunk duel — typing furiously as attacks ripple across their screen, fighting through disruptions to maintain speed and accuracy while launching their own offensive.

---

## 2. Tech Stack

| Layer     | Technology                    | Notes                              |
|-----------|-------------------------------|------------------------------------|
| Frontend  | React 18 + Vite + TypeScript | Fast HMR, strict types             |
| Styling   | Tailwind CSS                 | Dark theme, neon accent palette    |
| State     | Zustand                      | Lightweight, no boilerplate        |
| Server    | Node.js + Express            | HTTP endpoints + WS upgrade        |
| WebSocket | `ws` (npm)                   | Raw WS, no Socket.IO overhead      |
| Monorepo  | npm workspaces               | Shared types package               |
| Font      | JetBrains Mono               | Terminal aesthetic                  |

**Do NOT use Socket.IO. Use the `ws` npm package directly.**

---

## 3. Game Architecture

### 3.1 Connection Flow

1. Player opens app, enters a display name (persisted in localStorage)
2. Player clicks "Find Match" or creates/joins a room via room code
3. WebSocket connection established. Server assigns a player ID (UUID v4)
4. Matchmaking pairs two players. Server sends `MATCH_FOUND` with opponent info
5. Both clients enter a 3-second countdown, then the round begins
6. Round runs for a configurable duration (default 60s). Server is authoritative on time
7. Round ends when timer expires or a player's HP reaches 0

### 3.2 Server Authority Model

**The server is the single source of truth for all game state.** Clients are dumb terminals that send keystrokes and receive state updates. This prevents cheating and ensures consistency.

#### Server Responsibilities

- Generate and distribute text passages (server picks from a corpus)
- Validate every keystroke (correct/incorrect) and track cursor positions
- Calculate real-time WPM and accuracy per player
- Compute damage ticks (every 1 second)
- Manage energy accrual and ability activation
- Apply ability effects (server-side timers and state mutations)
- Broadcast authoritative game state to both clients at 10Hz (100ms tick)

#### Client Responsibilities

- Render the typing interface and opponent status
- Capture keystrokes and send them to the server immediately
- Apply visual effects for abilities (screen shake, blur, scramble animations)
- Play sound effects locally
- Optimistically show typed characters (reconcile with server state)

### 3.3 WebSocket Message Protocol

All messages are JSON with a `type` field. Clients send actions, server broadcasts events.

#### Client → Server

| Type         | Payload                                      |
|--------------|----------------------------------------------|
| `JOIN_QUEUE` | `{ displayName: string }`                    |
| `JOIN_ROOM`  | `{ displayName: string, roomCode: string }`  |
| `KEYSTROKE`  | `{ char: string, timestamp: number }`        |
| `USE_ABILITY`| `{ abilityId: string }`                      |
| `REMATCH`    | `{}`                                         |

#### Server → Client

| Type           | Payload                                                        |
|----------------|----------------------------------------------------------------|
| `MATCH_FOUND`  | `{ opponent: PlayerInfo, roomId: string }`                     |
| `COUNTDOWN`    | `{ seconds: number }`                                          |
| `GAME_STATE`   | `{ players: PlayerState[], text: string, timeLeft: number }`   |
| `ABILITY_USED` | `{ by: playerId, ability: AbilityId, target: playerId }`       |
| `ROUND_END`    | `{ winner: playerId, stats: FinalStats }`                      |
| `ERROR`        | `{ code: string, message: string }`                            |

### 3.4 Game State Shape (Server)

```typescript
GameRoom {
  roomId: string
  roomCode: string          // 6-char alphanumeric
  status: 'waiting' | 'countdown' | 'active' | 'finished'
  text: string              // the passage
  timeLeft: number
  players: Map<string, ServerPlayerState>
}

ServerPlayerState extends PlayerState {
  ws: WebSocket
  keystrokeLog: Keystroke[]
  cooldowns: Map<AbilityId, number>
  totalCorrect: number
  totalKeystrokes: number
}

PlayerState {
  id: string
  displayName: string
  hp: number                // 0–100
  cursor: number            // index into text
  wpm: number
  accuracy: number
  energy: number            // 0–100
  activeEffects: ActiveEffect[]
}
```

---

## 4. Combat System

### 4.1 Damage Formula

Damage calculated every 1-second tick:

```
baseDamage = (wpm / 20) * accuracyMultiplier
```

`accuracyMultiplier` scales linearly from 0.5 (at 80% accuracy) to 1.5 (at 100% accuracy). Below 80%, damage is halved.

| WPM | Accuracy | Multiplier | Damage/tick | Time to KO |
|-----|----------|------------|-------------|------------|
| 60  | 95%      | 1.25x      | 3.75        | ~27s       |
| 80  | 98%      | 1.4x       | 5.6         | ~18s       |
| 100 | 100%     | 1.5x       | 7.5         | ~13s       |
| 120 | 92%      | 1.1x       | 6.6         | ~15s       |

### 4.2 Energy System

Energy is the resource for casting abilities:

- **Passive:** +2 energy/sec while typing (at least 1 correct keystroke in the window)
- **Performance bonus:** +1 energy per 10 WPM above 40 (e.g., 80 WPM = +4 bonus/tick)
- **Accuracy streak bonus:** +5 energy for every 20 consecutive correct characters
- **Energy cap:** 100. Abilities cost 20–50 energy each.

### 4.3 Abilities

All abilities available to all players. No loadouts for v1. Activated via hotkeys (Ctrl+1 through Ctrl+6) or clicking ability buttons. Each ability has a **10-second cooldown** (server-enforced). Same ability cannot stack. Different abilities can overlap.

| Ability       | Cost | Duration | Effect |
|---------------|------|----------|--------|
| **SCRAMBLE**      | 30   | 4s       | Visually shuffles upcoming 10 words on opponent's screen. Actual text unchanged (server validates against original). Opponent types blind or waits. |
| **BLACKOUT**      | 25   | 3s       | Dims opponent's screen to near-black. Text at ~10% opacity. Opponent relies on muscle memory. |
| **FREEZE**        | 40   | 2.5s     | Opponent's cursor freezes. Keystrokes buffered server-side, replayed at 2x speed when freeze ends. High risk/reward. |
| **MIRROR**        | 50   | 5s       | Reflects 50% of damage dealt by opponent back to them. Defensive. Shield VFX on caster. |
| **SURGE**         | 20   | 5s       | Boosts own damage by 1.5x. Cheapest ability, rewards aggression. Green glow VFX. |
| **PHANTOM KEYS**  | 35   | 4s       | Injects fake ghost characters into opponent's input that look real. Opponent must backspace through them. |

---

## 5. Text Corpus

Server maintains 30+ hardcoded passages across difficulty tiers:

- **Easy:** Common words, short sentences, <5 char avg word length
- **Medium:** Mixed vocabulary, varied punctuation
- **Hard:** Technical terms, special characters, long words

Both players always type the same passage. Full text sent at match start.

---

## 6. UI/UX Design

### 6.1 Visual Identity

Dark terminal aesthetic:

- Background: `#060d06` (near-black green)
- Primary text: `#e2e8e2` (soft white-green)
- Accent: `#22c55e` (vivid green)
- Damage/Error: `#ef4444` (red)
- Energy: `#3b82f6` (blue)
- Font: JetBrains Mono everywhere
- Subtle CRT scanline overlay (CSS pseudo-element, toggleable)

### 6.2 Game Screen Layout

#### Top Bar
- Timer (center, large countdown)
- Room code (top-left, small)
- Settings gear (top-right)

#### Player Panel (Left 50%)
- Display name + HP bar (green → yellow → red gradient)
- WPM counter (large, real-time) + accuracy % (smaller, beside WPM)
- Energy bar (blue, below HP)
- Typing area: passage text with cursor. Correct chars green, errors red, upcoming dim

#### Opponent Panel (Right 50%)
- Mirror layout, read-only
- Shows opponent cursor position, WPM, HP, energy, text progress

#### Ability Bar (Bottom Center)
- 6 slots: icon + name + cost + cooldown timer
- Greyed out if insufficient energy or on cooldown
- Hotkeys on each slot (Ctrl+1 through Ctrl+6)
- Flash animation on activation

#### Combat Log (Bottom, collapsible)
- Scrolling event feed, color-coded: green (yours), red (opponent), white (system)

### 6.3 Lobby Screen
- Centered card with display name input
- "Quick Match" button + "Create Room" button (generates code)
- "Join Room" input for friend's room code
- Animated typing cursor while waiting

### 6.4 Results Screen
- Full-screen overlay, winner announcement with animation
- Side-by-side stats: WPM, accuracy, damage dealt, abilities used, HP remaining
- "Rematch" button + "Back to Lobby" button

### 6.5 Ability VFX (Client-Side)

- **SCRAMBLE:** Letters jumble with glitch animation (CSS transform + opacity, chars swap every 100ms)
- **BLACKOUT:** CRT-off animation, text to 10% opacity
- **FREEZE:** Blue frost overlay, cursor pulses but doesn't move
- **MIRROR:** Translucent shield SVG overlay with pulse
- **SURGE:** Green glow on panel borders + text (box-shadow + text-shadow)
- **PHANTOM KEYS:** Ghost chars in gray italic at cursor position

---

## 7. Project Structure

```
typeduel/
  packages/
    shared/     ← TypeScript types, constants, shared logic
    server/     ← Node.js + Express + ws
    client/     ← React 18 + Vite + TypeScript + Tailwind CSS
  package.json  (workspaces config)
  tsconfig.base.json
```

### packages/shared
- TypeScript types for all WS messages (MessageType enum, payload interfaces)
- Game constants (HP max, energy costs, ability durations, damage formula coefficients)
- AbilityConfig map
- Shared validation functions

### packages/server
- Node.js + Express + ws
- `GameRoom` class managing each active duel
- Matchmaking queue (simple FIFO)
- Game loop: `setInterval` at 100ms (state broadcast), 1000ms (damage ticks)
- Ability effect engine (apply/remove timed effects)
- Text corpus loader (text-corpus.ts)

### packages/client
- React 18 + Vite + TypeScript + Tailwind CSS
- Zustand store synced from server state
- Components: TypingArea, HealthBar, EnergyBar, AbilityBar, OpponentPanel, CombatLog, Lobby, Results
- Hooks: useWebSocket, useGameState, useAbilities, useTypingInput, useVisualEffects
- Custom Tailwind theme

---

## 8. Implementation Phases

### Phase 1: Foundation (Core Loop)
Two players connect, type the same passage, see each other's progress.
- WebSocket server with room creation and matchmaking
- Shared types package
- Basic client with lobby + typing area
- Keystroke send/validate loop
- Real-time WPM and accuracy calculation
- State broadcast at 10Hz

### Phase 2: Combat System
Typing performance deals damage. Games end on HP depletion or timer.
- HP system with damage formula
- Health bar UI with color transitions
- Energy accrual system
- Round timer with server authority
- Round end detection + results screen

### Phase 3: Abilities
All 6 abilities functional with server enforcement and client VFX.
- Ability bar UI with hotkey bindings
- Server-side activation, cooldowns, effect timers
- Each ability's unique logic (see §4.3)

### Phase 4: Polish
- Sound effects (keystroke, ability, damage, round events)
- Animations (screen shake, combo counters)
- CRT scanline toggle
- Rematch flow
- Disconnect handling + reconnection (10s grace period)
- Room code copy-to-clipboard
- Responsive layout (min-width 1024px)

---

## 9. Non-Goals (v1)

- Persistent accounts, auth, or profiles
- Database or data persistence (all in-memory)
- More than 2 players per room
- Spectator mode
- Custom ability loadouts or character selection
- Mobile support (desktop keyboard required)
- Leaderboards or ranking
- Player chat

---

## 10. Edge Cases

- **Disconnect mid-game:** Opponent wins after 10s grace period. Reconnect within 10s to resume.
- **Simultaneous abilities:** Both apply. No cancellation.
- **Energy overflow:** Capped at 100, excess lost.
- **HP at 0:** Round ends immediately on next damage tick.
- **Text exhaustion:** Player finishes passage → bonus passive damage (+3/tick) for remainder.
- **Backspace:** Moves cursor back. Doesn't affect accuracy (errors counted on forward stroke).
- **Tab/special keys:** Ignored. Only printable chars and backspace processed.

---

## 11. Shared Types Reference

```typescript
// packages/shared/src/types.ts

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
}

export enum AbilityId {
  SCRAMBLE = 'SCRAMBLE',
  BLACKOUT = 'BLACKOUT',
  FREEZE = 'FREEZE',
  MIRROR = 'MIRROR',
  SURGE = 'SURGE',
  PHANTOM_KEYS = 'PHANTOM_KEYS',
}

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

export interface AbilityConfig {
  cost: number
  duration: number  // ms
  cooldown: number  // ms
  description: string
}

// Constants
export const MAX_HP = 100
export const MAX_ENERGY = 100
export const ROUND_DURATION = 60 // seconds
export const DAMAGE_TICK_MS = 1000
export const STATE_BROADCAST_MS = 100
export const DISCONNECT_GRACE_MS = 10000

export const ABILITY_CONFIGS: Record<AbilityId, AbilityConfig> = {
  [AbilityId.SCRAMBLE]:     { cost: 30, duration: 4000,  cooldown: 10000, description: 'Scramble opponent\'s upcoming text' },
  [AbilityId.BLACKOUT]:     { cost: 25, duration: 3000,  cooldown: 10000, description: 'Dim opponent\'s screen' },
  [AbilityId.FREEZE]:       { cost: 40, duration: 2500,  cooldown: 10000, description: 'Freeze opponent\'s cursor' },
  [AbilityId.MIRROR]:       { cost: 50, duration: 5000,  cooldown: 10000, description: 'Reflect 50% damage back' },
  [AbilityId.SURGE]:        { cost: 20, duration: 5000,  cooldown: 10000, description: 'Boost own damage 1.5x' },
  [AbilityId.PHANTOM_KEYS]: { cost: 35, duration: 4000,  cooldown: 10000, description: 'Inject ghost characters' },
}
```

---

## 12. Tailwind Theme Config

```javascript
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#060d06',
        surface: '#0a1a0a',
        border: '#1a3a1a',
        text: '#e2e8e2',
        accent: '#22c55e',
        damage: '#ef4444',
        energy: '#3b82f6',
        warning: '#eab308',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
```

---

## 13. Key Constraints

> **SERVER IS AUTHORITATIVE.** Never trust client-computed WPM, accuracy, or HP. The client sends keystrokes and ability requests only. The server validates everything and broadcasts canonical state.

> **NO SOCKET.IO.** Use the `ws` npm package directly. Keep the protocol simple and JSON-based.

> **ALL GAME LOGIC ON SERVER.** Damage, abilities, energy, WPM — all computed server-side. The client is a rendering layer.

---

## 14. Keyboard Input Handling

Do NOT use a visible `<input>` or `<textarea>` for the typing area. Instead:

- Hidden input (opacity 0, position absolute) that stays focused
- On printable character: send `KEYSTROKE` to server
- On Backspace: send `KEYSTROKE` with char `'BACKSPACE'`
- On Ctrl+[1-6]: send `USE_ABILITY`
- Prevent default on all captured keys
- Optimistically update local cursor, reconcile with server state on next `GAME_STATE`

---

## 15. Animation & Polish Details

- JetBrains Mono everywhere (Google Fonts CDN in index.html)
- Background `#060d06`, panels with subtle `#1a3a1a` border + inner glow
- CRT scanlines: `repeating-linear-gradient` pseudo-element, `pointer-events: none`, `z-index: 9999`, `opacity: 0.03`, toggleable
- Screen shake on damage: `translateX(2px)` alternating CSS animation, 200ms, triggered by HP decrease
- Combo counter: accuracy >95% for 10+ chars → faint "COMBO x[N]" in corner, grows with streak
- Ability activation: white flash on button, ripple outward
- HP "delayed damage" bar: instant red drop + slow lighter overlay shrink (fighting game style)
