import { useState } from 'react'
import type { Difficulty } from '@typeduel/shared'
import { useGameStore } from '../store'
import type { PracticeMode, PracticeConfig } from '../practice/engine'
import { getPersonalBests, getPbKey } from '../practice/engine'

const MODES: { value: PracticeMode; label: string; desc: string }[] = [
  { value: 'free', label: 'Free Practice', desc: 'Type a passage at your own pace' },
  { value: 'timed', label: 'Timed', desc: 'Type as much as possible before time runs out' },
  { value: 'accuracy', label: 'Accuracy', desc: 'Infinite text, one mistake ends the run' },
  { value: 'sudden-death', label: 'Sudden Death', desc: 'Drop below the WPM threshold and it\'s over' },
  { value: 'marathon', label: 'Marathon', desc: '5-minute endurance run, infinite text' },
  { value: 'bot', label: 'Bot Match', desc: 'Full combat against an AI opponent' },
]

const DURATIONS = [15, 30, 60, 120]
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
const BOT_DIFFICULTIES = [
  { value: 'easy' as const, label: 'Easy Bot', desc: '~35 WPM' },
  { value: 'medium' as const, label: 'Medium Bot', desc: '~65 WPM' },
  { value: 'hard' as const, label: 'Hard Bot', desc: '~110 WPM' },
]

export function PracticeSetup() {
  const { reset } = useGameStore()
  const setPracticeConfig = useGameStore(s => s.setPracticeConfig)
  const setScreen = useGameStore(s => s.setScreen)

  const [mode, setMode] = useState<PracticeMode>('free')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [duration, setDuration] = useState(60)
  const [botDifficulty, setBotDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')

  const pbs = getPersonalBests()

  const handleStart = () => {
    const config: PracticeConfig = { mode, difficulty, duration, botDifficulty }
    setPracticeConfig(config)
    setScreen('practice')
  }

  // Get PB for current config
  const currentConfig: PracticeConfig = { mode, difficulty, duration, botDifficulty }
  const pbKey = getPbKey(currentConfig)
  const pb = pbs[pbKey]

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-surface border border-border rounded-lg p-8 w-full max-w-lg">
        <h2 className="text-3xl font-bold text-accent text-center mb-2">PRACTICE</h2>
        <p className="text-text/40 text-center text-sm mb-6">Sharpen your typing skills</p>

        {/* Mode Selection */}
        <div className="mb-5">
          <label className="block text-sm text-text/60 mb-2">Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map(m => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`p-3 rounded border text-left transition-colors ${
                  mode === m.value
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-text/40 hover:border-text/30'
                }`}
                data-testid={`mode-${m.value}`}
              >
                <div className="font-bold text-sm">{m.label}</div>
                <div className="text-[10px] text-text/30 mt-0.5">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Text Difficulty */}
        <div className="mb-5">
          <label className="block text-sm text-text/60 mb-2">Text Difficulty</label>
          <div className="flex gap-2">
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`flex-1 py-2 rounded border text-sm font-bold transition-colors ${
                  difficulty === d
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-text/40 hover:border-text/30'
                }`}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Duration (timed/bot only) */}
        {mode === 'timed' && (
          <div className="mb-5">
            <label className="block text-sm text-text/60 mb-2">Duration</label>
            <div className="flex gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`flex-1 py-2 rounded border text-sm font-bold transition-colors ${
                    duration === d
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-text/40 hover:border-text/30'
                  }`}
                  data-testid={`duration-${d}`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bot Difficulty (bot only) */}
        {mode === 'bot' && (
          <div className="mb-5">
            <label className="block text-sm text-text/60 mb-2">Bot Difficulty</label>
            <div className="flex gap-2">
              {BOT_DIFFICULTIES.map(b => (
                <button
                  key={b.value}
                  onClick={() => setBotDifficulty(b.value)}
                  className={`flex-1 py-2 rounded border text-sm transition-colors ${
                    botDifficulty === b.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-text/40 hover:border-text/30'
                  }`}
                  data-testid={`bot-${b.value}`}
                >
                  <div className="font-bold">{b.label}</div>
                  <div className="text-[10px] text-text/30">{b.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Personal Best */}
        {pb && (
          <div className="mb-5 p-3 bg-bg border border-border rounded text-center" data-testid="personal-best">
            <div className="text-[10px] text-text/30 uppercase mb-1">Personal Best</div>
            <span className="text-accent font-bold text-lg">{pb.wpm} WPM</span>
            <span className="text-text/40 text-sm ml-2">{pb.accuracy}% acc</span>
            <span className="text-text/20 text-xs ml-2">x{pb.streak} streak</span>
          </div>
        )}

        {/* Start / Back */}
        <button
          onClick={handleStart}
          className="w-full bg-accent text-bg font-bold py-3 rounded mb-3 hover:bg-accent/90 transition-colors"
          data-testid="start-practice"
        >
          Start Practice
        </button>
        <button
          onClick={reset}
          className="w-full border border-border text-text/40 font-bold py-2 rounded hover:border-text/30 transition-colors"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  )
}
