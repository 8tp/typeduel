import { useGameStore } from '../store'
import { ROUNDS_TO_WIN } from '@typeduel/shared'

export function RoundEnd() {
  const playerId = useGameStore((s) => s.playerId)
  const winnerId = useGameStore((s) => s.winnerId)
  const roundWins = useGameStore((s) => s.roundWins)
  const currentRound = useGameStore((s) => s.currentRound)
  const opponentName = useGameStore((s) => s.opponentName)
  const finalStats = useGameStore((s) => s.finalStats)

  const isWinner = winnerId === playerId
  const myWins = playerId ? (roundWins[playerId] ?? 0) : 0
  const oppWins = Object.entries(roundWins).find(([id]) => id !== playerId)?.[1] ?? 0

  const myStats = playerId && finalStats ? finalStats[playerId] : null
  const maxRounds = ROUNDS_TO_WIN * 2 - 1

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-6 animate-fade-in">
        <p className="text-sm uppercase tracking-widest text-gray-500">
          Round {currentRound} of {maxRounds}
        </p>

        <h1 className={`text-5xl font-black tracking-wider ${isWinner ? 'text-green-400' : 'text-red-400'}`}>
          {isWinner ? 'ROUND WON' : 'ROUND LOST'}
        </h1>

        {/* Score display */}
        <div className="flex items-center justify-center gap-8 text-3xl font-mono">
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">You</p>
            <span className="text-green-400">{myWins}</span>
          </div>
          <span className="text-gray-600">—</span>
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{opponentName ?? 'Opponent'}</p>
            <span className="text-red-400">{oppWins}</span>
          </div>
        </div>

        {/* Quick stats */}
        {myStats && (
          <div className="flex gap-6 justify-center text-sm text-gray-400">
            <span>{myStats.wpm} WPM</span>
            <span>{myStats.accuracy}% ACC</span>
            <span>{myStats.damageDealt} DMG</span>
          </div>
        )}

        <p className="text-gray-600 text-sm animate-pulse">
          Next round starting...
        </p>
      </div>
    </div>
  )
}
