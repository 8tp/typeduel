import { useGameStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'
import { PlayerPanel } from './PlayerPanel'

export function SpectateScreen() {
  const { gameState, reset } = useGameStore()
  const { disconnect } = useWebSocket()

  if (!gameState) return null

  const players = Object.values(gameState.players)
  const p1 = players[0]
  const p2 = players[1]

  const minutes = Math.floor(gameState.timeLeft / 60)
  const seconds = gameState.timeLeft % 60

  return (
    <div className="min-h-screen flex flex-col p-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-text/40 text-sm">
          Room: <span className="text-accent">{gameState.roomCode}</span>
        </div>
        <div className="text-4xl font-bold text-accent tabular-nums">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>
        <div className="flex items-center gap-3">
          {gameState.spectatorCount > 0 && (
            <span className="text-text/30 text-xs" data-testid="spectator-count-badge">
              {gameState.spectatorCount} watching
            </span>
          )}
          <button
            onClick={() => {
              disconnect()
              reset()
            }}
            className="text-text/20 hover:text-text/40 text-xs transition-colors"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Spectator Banner */}
      <div className="text-center mb-4" data-testid="spectator-banner">
        <span className="text-xs uppercase tracking-wider text-warning/60 bg-warning/10 border border-warning/20 rounded px-3 py-1">
          Spectating
        </span>
      </div>

      {/* Player Panels */}
      <div className="flex-1 flex gap-6">
        {p1 && (
          <PlayerPanel
            player={p1}
            text={gameState.text}
            isLocal={false}
            label={p1.displayName}
          />
        )}
        {p1 && p2 && <div className="w-px bg-border" />}
        {p2 && (
          <PlayerPanel
            player={p2}
            text={gameState.text}
            isLocal={false}
            label={p2.displayName}
          />
        )}
      </div>
    </div>
  )
}
