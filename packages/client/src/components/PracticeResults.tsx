import { useEffect, useState } from 'react'
import { useGameStore } from '../store'
import { savePersonalBest, getPersonalBests, getPbKey, type PersonalBest } from '../practice/engine'

function WpmSparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 240
  const h = 50
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - (v / max) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="mt-2" data-testid="practice-wpm-sparkline">
      <polyline points={points} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function PracticeResults() {
  const practiceState = useGameStore(s => s.practiceState)
  const practiceConfig = useGameStore(s => s.practiceConfig)
  const setScreen = useGameStore(s => s.setScreen)
  const [isNewPb, setIsNewPb] = useState(false)

  useEffect(() => {
    if (!practiceState || !practiceConfig) return
    const key = getPbKey(practiceConfig)
    const existing = getPersonalBests()[key]
    const newPb: PersonalBest = {
      wpm: practiceState.wpm,
      accuracy: Math.round(practiceState.accuracy * 10) / 10,
      streak: practiceState.maxStreak,
      date: new Date().toISOString(),
    }
    if (!existing || newPb.wpm > existing.wpm) {
      setIsNewPb(true)
    }
    savePersonalBest(key, newPb)
  }, [practiceState, practiceConfig])

  if (!practiceState || !practiceConfig) return null

  const isBot = practiceConfig.mode === 'bot'
  const botWon = isBot && (practiceState.playerHp <= 0 || (practiceState.playerHp < practiceState.botHp && practiceState.timeLeft <= 0))
  const playerWon = isBot && !botWon

  const modeLabel = practiceConfig.mode === 'bot' ? 'Bot Match' :
    practiceConfig.mode === 'timed' ? `Timed (${practiceConfig.duration}s)` :
    practiceConfig.mode === 'accuracy' ? 'Accuracy Challenge' : 'Free Practice'

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-surface border border-border rounded-lg p-8 w-full max-w-xl">
        {/* Title */}
        <div className="text-center mb-6">
          {isBot ? (
            <h2 className={`text-4xl font-bold results-title ${playerWon ? 'text-accent' : 'text-damage'}`}>
              {playerWon ? 'VICTORY' : 'DEFEAT'}
            </h2>
          ) : (
            <h2 className="text-3xl font-bold text-accent results-title">PRACTICE COMPLETE</h2>
          )}
          <div className="text-text/40 text-sm mt-1">{modeLabel} - {practiceConfig.difficulty}</div>
        </div>

        {/* New PB badge */}
        {isNewPb && (
          <div className="text-center mb-4" data-testid="new-pb-badge">
            <span className="text-accent font-bold bg-accent/10 border border-accent/30 rounded-full px-4 py-1 text-sm new-pb-glow">
              NEW PERSONAL BEST!
            </span>
          </div>
        )}

        {/* Stats */}
        <div className={`${isBot ? 'grid grid-cols-2 gap-6' : ''} mb-6`}>
          <div className={`p-4 rounded border border-accent/30 results-card results-card-1 ${isBot ? '' : ''}`}>
            <div className="text-sm text-text/40 mb-3 uppercase tracking-wider">
              {isBot ? 'You' : 'Results'}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-text/60">WPM</span>
                <span className="font-bold text-accent text-lg" data-testid="practice-result-wpm">{practiceState.wpm}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text/60">Accuracy</span>
                <span className="font-bold">{practiceState.accuracy.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text/60">Max Streak</span>
                <span className="font-bold">{practiceState.maxStreak}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text/60">Chars Typed</span>
                <span className="font-bold">{practiceState.totalCorrect}</span>
              </div>
              {isBot && (
                <>
                  <div className="flex justify-between">
                    <span className="text-text/60">Damage Dealt</span>
                    <span className="font-bold text-damage">{Math.round(practiceState.playerDamageDealt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text/60">HP Remaining</span>
                    <span className="font-bold">{Math.round(practiceState.playerHp)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text/60">Abilities Used</span>
                    <span className="font-bold">{practiceState.playerAbilitiesUsed}</span>
                  </div>
                </>
              )}
            </div>
            {practiceState.wpmHistory.length >= 2 && (
              <div className="mt-3">
                <div className="text-[10px] text-text/30 uppercase">WPM Over Time</div>
                <WpmSparkline data={practiceState.wpmHistory} />
              </div>
            )}
          </div>

          {/* Bot stats */}
          {isBot && (
            <div className="p-4 rounded border border-border results-card results-card-2">
              <div className="text-sm text-text/40 mb-3 uppercase tracking-wider">Bot</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-text/60">WPM</span>
                  <span className="font-bold text-damage">{practiceState.botWpm}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text/60">Accuracy</span>
                  <span className="font-bold">{practiceState.botAccuracy.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text/60">Damage Dealt</span>
                  <span className="font-bold text-damage">{Math.round(practiceState.botDamageDealt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text/60">HP Remaining</span>
                  <span className="font-bold">{Math.round(practiceState.botHp)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 results-buttons">
          <button
            onClick={() => setScreen('practice')}
            className="flex-1 border border-accent text-accent font-bold py-3 rounded hover:bg-accent/10 transition-colors"
            data-testid="practice-retry"
          >
            Try Again
          </button>
          <button
            onClick={() => setScreen('practice-setup')}
            className="flex-1 border border-border text-text/40 font-bold py-3 rounded hover:border-text/30 transition-colors"
          >
            Change Settings
          </button>
          <button
            onClick={() => useGameStore.getState().reset()}
            className="flex-1 bg-accent text-bg font-bold py-3 rounded hover:bg-accent/90 transition-colors"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  )
}
