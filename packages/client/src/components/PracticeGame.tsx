import { useEffect, useRef, useCallback, useState } from 'react'
import { AbilityId } from '@typeduel/shared'
import { useGameStore } from '../store'
import { sfx } from '../audio'
import { PracticeEngine, type PracticeState, type PracticeConfig } from '../practice/engine'
import { TypingArea } from './TypingArea'
import { EffectOverlays } from './EffectOverlays'
import { AbilityBar } from './AbilityBar'

const ABILITY_HOTKEYS: AbilityId[] = [
  AbilityId.SURGE, AbilityId.BLACKOUT, AbilityId.SCRAMBLE,
  AbilityId.PHANTOM_KEYS, AbilityId.FREEZE, AbilityId.MIRROR,
]

export function PracticeGame() {
  const config = useGameStore(s => s.practiceConfig)
  const setScreen = useGameStore(s => s.setScreen)
  const setPracticeState = useGameStore(s => s.setPracticeState)
  const hiddenInputRef = useRef<HTMLInputElement>(null)
  const engineRef = useRef<PracticeEngine | null>(null)
  const [state, setState] = useState<PracticeState | null>(null)

  useEffect(() => {
    if (!config) return
    const engine = new PracticeEngine(config, (newState) => {
      setState(newState)
      if (newState.status === 'finished') {
        setPracticeState(newState)
        setTimeout(() => setScreen('practice-results'), 500)
      }
    })
    engineRef.current = engine
    engine.start()
    return () => engine.cleanup()
  }, [config, setScreen, setPracticeState])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const engine = engineRef.current
    if (!engine || !state || state.status !== 'active') return

    // Ctrl+[1-6] → ability hotkeys (bot mode only)
    if (config?.mode === 'bot' && e.ctrlKey && e.key >= '1' && e.key <= '6') {
      e.preventDefault()
      const idx = parseInt(e.key) - 1
      const abilityId = ABILITY_HOTKEYS[idx]
      if (abilityId) engine.handleAbility(abilityId)
      return
    }

    if (e.key === 'Backspace' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey)) {
      e.preventDefault()
    }

    if (e.key === 'Backspace') {
      engine.handleKeystroke('BACKSPACE')
      return
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      engine.handleKeystroke(e.key)
    }
  }, [state, config])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    hiddenInputRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    const refocus = () => hiddenInputRef.current?.focus()
    window.addEventListener('click', refocus)
    return () => window.removeEventListener('click', refocus)
  }, [])

  if (!config || !state) return null

  // Countdown screen
  if (state.status === 'countdown') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-text/40 text-sm mb-4 uppercase tracking-wider">
            {config.mode === 'bot' ? `Bot Match (${config.botDifficulty})` :
             config.mode === 'timed' ? `Timed (${config.duration}s)` :
             config.mode === 'accuracy' ? 'Accuracy Challenge' : 'Free Practice'}
          </div>
          <div className="text-[120px] font-bold text-accent leading-none animate-pulse">
            {state.countdownSeconds || '...'}
          </div>
          <p className="text-text/40 text-sm mt-4">Get ready to type!</p>
        </div>
      </div>
    )
  }

  const isBot = config.mode === 'bot'
  const isTimed = config.mode === 'timed' || isBot
  const isLowHp = isBot && state.playerHp > 0 && state.playerHp < 20

  // Build a fake PlayerState for TypingArea compatibility
  const localPlayer = {
    id: 'player',
    displayName: 'You',
    hp: state.playerHp,
    cursor: state.cursor,
    wpm: state.wpm,
    accuracy: Math.round(state.accuracy * 10) / 10,
    energy: state.playerEnergy,
    activeEffects: state.playerActiveEffects,
    streak: state.streak,
  }

  const minutes = isTimed ? Math.floor(state.timeLeft / 60) : Math.floor(state.timeElapsed / 60)
  const seconds = isTimed ? state.timeLeft % 60 : state.timeElapsed % 60

  return (
    <div className="min-h-screen flex flex-col p-4">
      {/* Low HP vignette */}
      {isLowHp && (
        <div className="fixed inset-0 z-40 pointer-events-none low-hp-vignette" />
      )}

      {/* Hidden input */}
      <input
        ref={hiddenInputRef}
        className="opacity-0 absolute w-0 h-0"
        autoFocus
        onBlur={(e) => e.target.focus()}
      />

      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-text/40 text-sm uppercase tracking-wider" data-testid="practice-mode-label">
          {config.mode === 'bot' ? `Bot Match` :
           config.mode === 'timed' ? `Timed` :
           config.mode === 'accuracy' ? 'Accuracy' : 'Free Practice'}
        </div>
        <div className="text-4xl font-bold text-accent tabular-nums" data-testid="practice-timer">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>
        <button
          onClick={() => {
            engineRef.current?.cleanup()
            setScreen('practice-setup')
          }}
          className="text-text/20 hover:text-text/40 text-xs transition-colors"
        >
          Quit
        </button>
      </div>

      {/* Main Area */}
      <div className={`flex-1 flex ${isBot ? 'gap-6' : 'justify-center'}`}>
        {/* Player Panel */}
        <div className={`${isBot ? 'flex-1' : 'w-full max-w-3xl'} min-w-0 relative`}>
          {/* Effect overlays */}
          <EffectOverlays effects={state.playerActiveEffects} />

          {/* Streak combo */}
          {state.streak >= 10 && (
            <div
              className={`absolute top-0 right-0 font-bold z-10 ${
                state.streak >= 50
                  ? 'text-lg combo-fire text-accent'
                  : state.streak >= 20
                  ? 'text-base combo-glow text-accent/80'
                  : 'text-sm combo-pulse text-accent/40'
              }`}
              data-testid="practice-combo"
            >
              {state.streak >= 50 ? 'UNSTOPPABLE' : state.streak >= 20 ? 'ON FIRE' : 'STREAK'} x{state.streak}
            </div>
          )}

          {/* Stats Row */}
          <div className="flex gap-6 mb-3">
            <div>
              <span className="text-3xl font-bold text-accent" data-testid="practice-wpm">{state.wpm}</span>
              <span className="text-xs text-text/40 ml-1">WPM</span>
            </div>
            <div>
              <span className="text-xl font-bold text-text/80">{state.accuracy.toFixed(1)}%</span>
              <span className="text-xs text-text/40 ml-1">ACC</span>
            </div>
            {config.mode === 'accuracy' && (
              <div>
                <span className="text-xl font-bold text-accent">{state.totalCorrect}</span>
                <span className="text-xs text-text/40 ml-1">chars</span>
              </div>
            )}
          </div>

          {/* HP Bar (bot mode) */}
          {isBot && (
            <div className="mb-2">
              <div className="flex justify-between text-xs text-text/40 mb-1">
                <span>Your HP</span>
                <span>{Math.round(state.playerHp)}/100</span>
              </div>
              <div className="w-full h-3 bg-bg border border-border rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${
                    state.playerHp > 60 ? 'bg-accent' : state.playerHp > 30 ? 'bg-warning' : 'bg-damage'
                  }`}
                  style={{ width: `${state.playerHp}%` }}
                />
              </div>
            </div>
          )}

          {/* Energy Bar (bot mode) */}
          {isBot && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-text/40 mb-1">
                <span>Energy</span>
                <span>{Math.round(state.playerEnergy)}/100</span>
              </div>
              <div className="w-full h-2 bg-bg border border-border rounded-full overflow-hidden">
                <div className="h-full bg-energy transition-all duration-300" style={{ width: `${state.playerEnergy}%` }} />
              </div>
            </div>
          )}

          {/* Typing Area */}
          <TypingArea
            text={state.text}
            player={localPlayer}
            isLocal={true}
            cursorOverride={state.cursor}
            errorIndex={state.errorIndex}
          />
        </div>

        {/* Bot Panel (bot mode only) */}
        {isBot && (
          <>
            <div className="w-px bg-border" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text/60 uppercase tracking-wider">Bot</span>
                <span className="font-bold text-lg text-damage">{config.botDifficulty.toUpperCase()}</span>
              </div>

              {/* Bot HP */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-text/40 mb-1">
                  <span>HP</span>
                  <span>{Math.round(state.botHp)}/100</span>
                </div>
                <div className="w-full h-3 bg-bg border border-border rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      state.botHp > 60 ? 'bg-accent' : state.botHp > 30 ? 'bg-warning' : 'bg-damage'
                    }`}
                    style={{ width: `${state.botHp}%` }}
                  />
                </div>
              </div>

              {/* Bot Stats */}
              <div className="flex gap-4 mb-3">
                <div>
                  <span className="text-3xl font-bold text-damage">{state.botWpm}</span>
                  <span className="text-xs text-text/40 ml-1">WPM</span>
                </div>
                <div>
                  <span className="text-xl font-bold text-text/80">{state.botAccuracy.toFixed(1)}%</span>
                  <span className="text-xs text-text/40 ml-1">ACC</span>
                </div>
              </div>

              {/* Bot Typing Area */}
              <TypingArea
                text={state.text}
                player={{
                  id: 'bot',
                  displayName: 'Bot',
                  hp: state.botHp,
                  cursor: state.botCursor,
                  wpm: state.botWpm,
                  accuracy: state.botAccuracy,
                  energy: state.botEnergy,
                  activeEffects: state.botActiveEffects,
                  streak: 0,
                }}
                isLocal={false}
              />
            </div>
          </>
        )}
      </div>

      {/* Ability Bar (bot mode) */}
      {isBot && (
        <AbilityBar
          player={localPlayer}
          onUseAbility={(id) => engineRef.current?.handleAbility(id)}
        />
      )}
    </div>
  )
}
