import { useEffect } from 'react'
import type { Difficulty } from '@typeduel/shared'
import { useGameStore } from '../store'
import { sfx, type SoundPreset } from '../audio'

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-text/60">{label}</span>
      <button onClick={onChange} className={`w-10 h-5 rounded-full transition-colors ${value ? 'bg-accent' : 'bg-border'}`}>
        <div className={`w-4 h-4 rounded-full bg-text transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

const SOUND_PRESETS: { value: SoundPreset; label: string }[] = [
  { value: 'thock', label: 'Thock' },
  { value: 'clack', label: 'Clack' },
  { value: 'click', label: 'Click' },
  { value: 'typewriter', label: 'Typewriter' },
  { value: 'silent', label: 'Silent' },
]

const UI_SCALES: { value: 'small' | 'medium' | 'large'; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
]

export function SettingsPanel() {
  const {
    uiScale, setUiScale,
    crtEnabled, toggleCrt,
    reducedMotion, toggleReducedMotion,
    highContrast, toggleHighContrast,
    soundEnabled, toggleSound,
    soundVolume, setSoundVolume,
    soundPreset, setSoundPreset,
    defaultDifficulty, setDefaultDifficulty,
    showCombatLog, toggleCombatLog,
    setSettingsOpen,
  } = useGameStore()

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [setSettingsOpen])

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-bg/80" onClick={() => setSettingsOpen(false)}>
      <div
        className="bg-surface border border-border rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={() => setSettingsOpen(false)}
          className="absolute top-4 right-4 text-text/40 hover:text-text/80 transition-colors"
          data-testid="settings-close"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4l12 12M16 4L4 16" />
          </svg>
        </button>

        <h2 className="text-xl font-bold text-accent mb-6">Settings</h2>

        {/* Visual Section */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-text/40 uppercase tracking-wider mb-3">Visual</h3>

          {/* UI Scale */}
          <div className="py-2">
            <span className="text-text/60 text-sm block mb-2">UI Scale</span>
            <div className="flex gap-2">
              {UI_SCALES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setUiScale(s.value)}
                  className={`flex-1 py-1.5 rounded border text-sm font-bold transition-colors ${
                    uiScale === s.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-text/40 hover:border-text/30'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <Toggle label="CRT Scanlines" value={crtEnabled} onChange={toggleCrt} />
          <Toggle label="Reduced Motion" value={reducedMotion} onChange={toggleReducedMotion} />
          <Toggle label="High Contrast" value={highContrast} onChange={toggleHighContrast} />
        </div>

        {/* Audio Section */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-text/40 uppercase tracking-wider mb-3">Audio</h3>

          <Toggle label="Sound Effects" value={soundEnabled} onChange={toggleSound} />

          {soundEnabled && (
            <>
              <div className="py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-text/60 text-sm">Volume</span>
                  <span className="text-text/40 text-xs tabular-nums">{soundVolume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={soundVolume}
                  onChange={(e) => setSoundVolume(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>

              <div className="py-2">
                <span className="text-text/60 text-sm block mb-2">Key Sound</span>
                <div className="flex gap-1.5 flex-wrap">
                  {SOUND_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => {
                        setSoundPreset(p.value)
                        // Play a preview
                        sfx.keystroke()
                      }}
                      className={`px-3 py-1.5 rounded border text-xs font-bold transition-colors ${
                        soundPreset === p.value
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-text/40 hover:border-text/30'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Gameplay Section */}
        <div className="mb-2">
          <h3 className="text-sm font-bold text-text/40 uppercase tracking-wider mb-3">Gameplay</h3>

          {/* Default Difficulty */}
          <div className="py-2">
            <span className="text-text/60 text-sm block mb-2">Default Difficulty</span>
            <div className="flex gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDefaultDifficulty(d.value)}
                  className={`flex-1 py-1.5 rounded border text-sm font-bold transition-colors ${
                    defaultDifficulty === d.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-text/40 hover:border-text/30'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <Toggle label="Combat Log" value={showCombatLog} onChange={toggleCombatLog} />
        </div>
      </div>
    </div>
  )
}
