# Type Duel Audit

Date: 2026-03-10

## Fixed in this pass

- WebSocket join actions no longer rely on a hard-coded 500ms delay.
  The client now queues outbound messages while the socket is in `CONNECTING`, then flushes them on `open`. This removes a race where slow connections could drop `JOIN_QUEUE`, `CREATE_ROOM`, `JOIN_ROOM`, or `SPECTATE_ROOM`.

- Server-side typing stats no longer overcount after backspacing a correct character.
  Previously, a player could type a correct character, backspace it, and retype it to inflate `totalCorrect`, WPM, and damage. `GameRoom` now rolls back the relevant counters on backspace.

- Live match screens now show the real shareable room code.
  `GameState` now includes `roomCode`, and both the player and spectator UIs render that code instead of slicing the internal room UUID.

- Leaving spectator mode or returning to the lobby from results now closes the socket first.
  This prevents clients from staying attached to stale rooms and receiving old room traffic after the UI has already reset.

- Spectators no longer get pushed into the player results flow on `ROUND_END`.
  They remain in spectate mode instead of being treated like participants.

- Quick match now respects the selected difficulty.
  The server matcher only pairs queued players who requested the same tier, instead of silently using the first player’s selection for both.

- Session resume now works across socket drops and page reloads.
  The client persists per-tab room session data, attempts an automatic `RESUME_SESSION`, and the server rebinds the original player identity to the new socket during the disconnect grace window. This now covers waiting room, countdown, active matches, results, and spectator sessions.

- Waiting room is now a first-class screen instead of local component state.
  That makes private-room creation resumable before the second player joins.

## Added coverage

- Server test for backspace stat rollback and `roomCode` exposure:
  [packages/server/src/__tests__/game-room.test.ts](/Users/huntermeherin/type-duel/packages/server/src/__tests__/game-room.test.ts)

- Client lobby tests for immediate send behavior:
  [packages/client/src/components/__tests__/Lobby.test.tsx](/Users/huntermeherin/type-duel/packages/client/src/components/__tests__/Lobby.test.tsx)

- Playwright reload test for multiplayer session resume:
  [tests/game.spec.ts](/Users/huntermeherin/type-duel/tests/game.spec.ts)

## Remaining gaps

- Multiplayer E2E startup is still timing-sensitive under the dev-server test harness.
  The app behavior is passing, but Playwright currently relies on a single retry for a few room-start tests because those assertions occasionally miss the room-transition window on the first attempt.
