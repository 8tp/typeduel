import { useState } from 'react'
import { MessageType } from '@typeduel/shared'
import { useGameStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'

export function Results() {
  const { winnerId, finalStats, playerId, reset } = useGameStore()
  const { send } = useWebSocket()
  const [rematchSent, setRematchSent] = useState(false)

  if (!finalStats) return null

  const isWinner = winnerId === playerId
  const players = Object.entries(finalStats)

  const handleRematch = () => {
    send({ type: MessageType.REMATCH })
    setRematchSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-surface border border-border rounded-lg p-8 w-full max-w-2xl">
        <h2
          className={`text-4xl font-bold text-center mb-8 ${
            isWinner ? 'text-accent' : 'text-damage'
          }`}
        >
          {isWinner ? 'VICTORY' : 'DEFEAT'}
        </h2>

        <div className="grid grid-cols-2 gap-8 mb-8">
          {players.map(([id, stats]) => (
            <div
              key={id}
              className={`p-4 rounded border ${
                id === playerId ? 'border-accent/50' : 'border-border'
              }`}
            >
              <div className="text-sm text-text/40 mb-3 uppercase tracking-wider">
                {id === playerId ? 'You' : 'Opponent'}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-text/60">WPM</span>
                  <span className="font-bold text-accent">{stats.wpm}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text/60">Accuracy</span>
                  <span className="font-bold">{stats.accuracy}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text/60">Damage Dealt</span>
                  <span className="font-bold text-damage">{stats.damageDealt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text/60">HP Remaining</span>
                  <span className="font-bold">{stats.hpRemaining}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text/60">Abilities Used</span>
                  <span className="font-bold">{stats.abilitiesUsed}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleRematch}
            disabled={rematchSent}
            className="flex-1 border border-accent text-accent font-bold py-3 rounded hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="rematch-btn"
          >
            {rematchSent ? 'Waiting for opponent...' : 'Rematch'}
          </button>
          <button
            onClick={reset}
            className="flex-1 bg-accent text-bg font-bold py-3 rounded hover:bg-accent/90 transition-colors"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  )
}
