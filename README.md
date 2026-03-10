# TypeDuel

Real-time multiplayer typing combat game. MonkeyType meets a fighting game.

Two players type the same passage simultaneously, dealing damage based on WPM and accuracy while disrupting each other with combat abilities. Last player standing wins.

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Server:** Node.js + Express + ws (raw WebSockets)
- **State:** Zustand
- **Monorepo:** npm workspaces
- **Font:** JetBrains Mono
- **Testing:** Vitest (95+ unit/component) + Playwright (10 e2e)

## Project Structure

```
packages/
  shared/    → types, constants, enums, passages
  server/    → Express + ws, port 3001
  client/    → React + Vite, port 5173
tests/       → Playwright e2e tests (critical multi-browser flows only)
```

## Getting Started

```bash
npm install
npm run --workspace=packages/shared build
npm run --workspace=packages/server dev    # starts server on port 3001
npm run --workspace=packages/client dev    # starts client on port 5173
```

Open two browser tabs to `localhost:5173` to play.

## Deployment

The app is designed to deploy as a single service. The server serves the client's static build in production.

```bash
npm run build    # builds shared → client → server
npm start        # starts the server (serves client + WebSocket on same port)
```

Railway auto-detects the `build` and `start` scripts. Set `PORT` env var if needed (Railway sets this automatically).

## Testing

```bash
npm test          # Vitest unit + component tests (~95 tests, <1s)
npm run test:e2e  # Playwright e2e tests (~10 tests, ~1.5min)
```

**Vitest** covers shared types/constants, server formulas, practice engine logic, Zustand store, and React component rendering. **Playwright** covers critical multi-browser flows: room creation/joining, typing damage, full game lifecycle, rematch, spectator mode, quick match, and session resume.

## Features

### Multiplayer Combat
- **Real-time WebSocket multiplayer** -- server-authoritative game state broadcast at 10Hz
- **HP and damage system** -- WPM and accuracy determine damage output each tick
- **6 combat abilities** -- spend energy to disrupt your opponent or boost yourself
- **Matchmaking queue** -- automatic pairing (difficulty-matched) or private rooms via room codes
- **Difficulty selection** -- easy, medium, and hard text passages (45 passages total)
- **Session resume** -- auto-reconnect on page reload or disconnect (10s grace period)
- **Waiting room** -- room creator sees code to share while waiting for opponent
- **Comeback mechanic** -- 1.25x damage boost when below 30% HP
- **Text exhaustion bonus** -- +3 damage/tick for finishing the passage first

### Practice Mode
- **Free Practice** -- type a passage at your own pace with no timer
- **Timed Mode** -- type as fast as possible in 15/30/60/120 seconds
- **Accuracy Challenge** -- one wrong keystroke ends the run
- **Bot Match** -- full combat against an AI opponent with configurable difficulty (easy/medium/hard)
- **Personal bests** -- tracked per mode/difficulty/duration in localStorage
- **WPM sparkline** -- visual WPM graph over time in results

### Social
- **Spectator mode** -- watch live games with a room code
- **Spectator count** -- players see how many spectators are watching
- **Match history** -- last 20 games stored locally with W/L, WPM, accuracy
- **Rematch voting** -- both players can vote for a rematch after a game
- **Taunt emotes** -- 6 taunt hotkeys (Ctrl+Shift+1-6) with popup animations

### Settings
- **UI scale** -- small, medium, large font sizes
- **Screen shake** -- toggle on/off
- **Reduced motion** -- disables animations for accessibility
- **High contrast** -- increases text opacity
- **Sound volume** -- adjustable slider with mute toggle
- **Default difficulty** -- persisted preference for matchmaking
- **Combat log** -- toggle visibility during games
- **CRT scanlines** -- toggle retro overlay effect

### Polish
- **Synthesized sound effects** -- 13 Web Audio API sounds, no external files
- **Visual effects** -- screen shake, floating damage numbers, CRT scanlines, KO flash
- **Typing streak/combo** -- 3 visual tiers at 10/20/50 streak (STREAK, ON FIRE, UNSTOPPABLE)
- **Low HP vignette** -- pulsing red overlay and heartbeat below 20% HP
- **Error highlighting** -- character shake animation on mistype
- **Optimistic cursor** -- instant local feedback with server reconciliation at 10Hz
- **Ability cooldown timers** -- circular progress indicators on ability bar
- **Results animations** -- bounce-in title, slide-up cards, WPM sparkline chart
- **Dark terminal aesthetic** -- JetBrains Mono, scanline overlays, neon green accents
- **Auto-reconnect** -- seamless WebSocket reconnection with session persistence via sessionStorage

## Combat Abilities

Energy accrues as you type. Spend it on abilities using hotkeys (Ctrl+1 through Ctrl+6).

| Ability      | Cost  | Effect                                |
|--------------|-------|---------------------------------------|
| Surge        | 20 EP | 1.5x damage boost for 5s             |
| Blackout     | 25 EP | Dims opponent's screen for 3s        |
| Scramble     | 30 EP | Shuffles opponent's text for 4s      |
| Phantom Keys | 35 EP | Injects fake characters for 4s       |
| Freeze       | 40 EP | Freezes opponent's cursor for 2.5s   |
| Mirror       | 50 EP | Reflects 50% damage back for 5s      |

## Damage Formula

```
damage = (wpm / 20) * accuracyMultiplier
```

- **Accuracy multiplier:** linear from 0.5 (at 80% accuracy) to 1.5 (at 100%), capped at 0.5 below 80%
- **Surge boost:** 1.5x multiplier while active
- **Comeback bonus:** 1.25x when below 30% HP
- **Text exhaustion:** +3 damage/tick for finishing the passage
- **Mirror reflect:** 50% of incoming damage reflected back

## Bot Difficulty

| Level  | WPM | Accuracy | Ability Chance/tick |
|--------|-----|----------|---------------------|
| Easy   | 30  | 90%      | 2%                  |
| Medium | 60  | 95%      | 5%                  |
| Hard   | 100 | 98%      | 8%                  |

## License

MIT
