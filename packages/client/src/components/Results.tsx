import { useState, useMemo } from 'react'
import { MessageType } from '@typeduel/shared'
import { useGameStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'

function WpmSparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 200
  const h = 40
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - (v / max) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="mt-2" data-testid="wpm-sparkline">
      <polyline
        points={points}
        fill="none"
        stroke="#22c55e"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Results() {
  const { winnerId, finalStats, playerId, reset, opponentWantsRematch } = useGameStore()
  const { send, disconnect } = useWebSocket()
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
          className={`text-4xl font-bold text-center mb-8 results-title ${
            isWinner ? 'text-accent' : 'text-damage'
          }`}
        >
          {isWinner ? 'VICTORY' : 'DEFEAT'}
        </h2>

        <div className="grid grid-cols-2 gap-8 mb-8">
          {players.map(([id, stats], idx) => (
            <div
              key={id}
              className={`p-4 rounded border results-card ${
                idx === 0 ? 'results-card-1' : 'results-card-2'
              } ${
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
              {stats.wpmHistory && stats.wpmHistory.length >= 2 && (
                <div>
                  <div className="text-[10px] text-text/30 mt-2 uppercase">WPM Over Time</div>
                  <WpmSparkline data={stats.wpmHistory} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Opponent rematch indicator */}
        {opponentWantsRematch && !rematchSent && (
          <div className="text-center mb-4 text-accent text-sm animate-pulse" data-testid="opponent-rematch">
            Opponent wants a rematch!
          </div>
        )}

        <div className="flex gap-3 results-buttons">
          <button
            onClick={handleRematch}
            disabled={rematchSent}
            className={`flex-1 border font-bold py-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              opponentWantsRematch && !rematchSent
                ? 'border-accent bg-accent/20 text-accent hover:bg-accent/30'
                : 'border-accent text-accent hover:bg-accent/10'
            }`}
            data-testid="rematch-btn"
          >
            {rematchSent ? 'Waiting for opponent...' : opponentWantsRematch ? 'Accept Rematch' : 'Rematch'}
          </button>
          <button
            onClick={() => {
              disconnect()
              reset()
            }}
            className="flex-1 bg-accent text-bg font-bold py-3 rounded hover:bg-accent/90 transition-colors"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  )
}
