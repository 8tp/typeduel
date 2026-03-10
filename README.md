# TypeDuel

Real-time multiplayer typing combat game. MonkeyType meets a fighting game.

Two players type the same passage simultaneously, dealing damage based on WPM and accuracy while disrupting each other with combat abilities. Last player standing wins.

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Server:** Node.js + Express + ws (raw WebSockets)
- **State:** Zustand
- **Monorepo:** npm workspaces
- **Font:** JetBrains Mono

## Project Structure

```
packages/
  shared/    → types, constants, enums
  server/    → Express + ws, port 3001
  client/    → React + Vite, port 5173
```

## Getting Started

```bash
npm install
npm run --workspace=packages/shared build
npm run --workspace=packages/server dev    # starts server on port 3001
npm run --workspace=packages/client dev    # starts client on port 5173
```

Open two browser tabs to `localhost:5173` to play.

## Testing

```bash
npx playwright test
```

Runs 29 end-to-end tests covering lobby UI, matchmaking, game screen, combat mechanics, abilities, and full game flow.

## Features

- **Real-time WebSocket multiplayer** -- server-authoritative game state broadcast at 10Hz
- **HP and damage system** -- WPM and accuracy determine damage output each tick
- **6 combat abilities** -- spend energy to disrupt your opponent or boost yourself
- **Synthesized sound effects** -- Web Audio API, no external audio files
- **Visual effects** -- screen shake, floating damage numbers, CRT scanlines, KO flash
- **Matchmaking queue** -- automatic pairing or private rooms via room codes
- **Difficulty selection** -- easy, medium, or hard text passages
- **Combat log** -- collapsible event feed showing ability usage and round results
- **Sound toggle** -- mute/unmute with localStorage persistence
- **Rematch flow** -- rematch prompt with disconnect grace period
- **Dark terminal/cyberpunk aesthetic** -- JetBrains Mono, scanline overlays, neon accents

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

## License

MIT
