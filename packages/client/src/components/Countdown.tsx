import { useGameStore } from '../store'

export function Countdown() {
  const { countdownSeconds, opponentName, displayName } = useGameStore()

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center gap-16 mb-8">
          <div className="text-accent text-xl font-bold">{displayName}</div>
          <div className="text-text/40 text-xl">vs</div>
          <div className="text-damage text-xl font-bold">{opponentName ?? '...'}</div>
        </div>

        <div className="text-[120px] font-bold text-accent leading-none animate-pulse">
          {countdownSeconds || '...'}
        </div>

        <p className="text-text/40 text-sm mt-4">Get ready to type!</p>
      </div>
    </div>
  )
}
