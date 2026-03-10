import { useState } from 'react'
import { MessageType } from '@typeduel/shared'
import { useGameStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'
import { WpmChart } from './WpmChart'

export function Results() {
  const { winnerId, finalStats, playerId, reset, opponentWantsRematch, roundWins, opponentName } = useGameStore()
  const { send, disconnect } = useWebSocket()
  const [rematchSent, setRematchSent] = useState(false)

  if (!finalStats) return null

  const isWinner = winnerId === playerId
  const players = Object.entries(finalStats)
  const myWins = playerId ? (roundWins[playerId] ?? 0) : 0
  const oppWins = Object.entries(roundWins).find(([id]) => id !== playerId)?.[1] ?? 0

  const handleRematch = () => {
    send({ type: MessageType.REMATCH })
    setRematchSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-surface border border-border rounded-lg p-8 w-full max-w-2xl">
        {/* Match score */}
        <div className="flex items-center justify-center gap-6 mb-4 text-2xl font-mono">
          <span className="text-xs uppercase tracking-wider text-text/40">You</span>
          <span className="text-green-400 text-3xl">{myWins}</span>
          <span className="text-text/20">—</span>
          <span className="text-red-400 text-3xl">{oppWins}</span>
          <span className="text-xs uppercase tracking-wider text-text/40">{opponentName ?? 'Opp'}</span>
        </div>

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
                <div className="mt-2">
                  <div className="text-[10px] text-text/30 uppercase">WPM Over Time</div>
                  <WpmChart data={stats.wpmHistory} />
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
