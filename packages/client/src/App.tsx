import { useEffect } from 'react'
import { useGameStore } from './store'
import { Lobby } from './components/Lobby'
import { Matchmaking } from './components/Matchmaking'
import { WaitingRoom } from './components/WaitingRoom'
import { Countdown } from './components/Countdown'
import { GameScreen } from './components/GameScreen'
import { Results } from './components/Results'
import { RoundEnd } from './components/RoundEnd'
import { SpectateScreen } from './components/SpectateScreen'
import { PracticeSetup } from './components/PracticeSetup'
import { PracticeGame } from './components/PracticeGame'
import { PracticeResults } from './components/PracticeResults'
import { SettingsPanel } from './components/SettingsPanel'
import { loadStoredResumeSession, useWebSocket } from './hooks/useWebSocket'

export function App() {
  const screen = useGameStore((s) => s.screen)
  const setScreen = useGameStore((s) => s.setScreen)
  const setIsSpectating = useGameStore((s) => s.setIsSpectating)
  const crtEnabled = useGameStore((s) => s.crtEnabled)
  const uiScale = useGameStore((s) => s.uiScale)
  const highContrast = useGameStore((s) => s.highContrast)
  const reducedMotion = useGameStore((s) => s.reducedMotion)
  const settingsOpen = useGameStore((s) => s.settingsOpen)
  const { connect } = useWebSocket()

  useEffect(() => {
    const sizes = { small: '14px', medium: '16px', large: '20px' }
    document.documentElement.style.fontSize = sizes[uiScale]
  }, [uiScale])

  useEffect(() => {
    const resumeSession = loadStoredResumeSession()
    if (!resumeSession) return

    setIsSpectating(resumeSession.isSpectating)
    setScreen(resumeSession.isSpectating ? 'spectating' : 'waiting-room')
    connect(resumeSession)
  }, [connect, setIsSpectating, setScreen])

  useEffect(() => {
    if (!import.meta.env.DEV) return

    ;(window as Window & { __typeduelStore?: typeof useGameStore }).__typeduelStore = useGameStore
    return () => {
      delete (window as Window & { __typeduelStore?: typeof useGameStore }).__typeduelStore
    }
  }, [])

  const rootClasses = [
    crtEnabled ? 'crt-scanlines' : '',
    highContrast ? 'high-contrast' : '',
    reducedMotion ? 'reduced-motion' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={rootClasses}>
      {screen === 'lobby' && <Lobby />}
      {screen === 'matchmaking' && <Matchmaking />}
      {screen === 'waiting-room' && <WaitingRoom />}
      {screen === 'countdown' && <Countdown />}
      {screen === 'game' && <GameScreen />}
      {screen === 'spectating' && <SpectateScreen />}
      {screen === 'round-end' && <RoundEnd />}
      {screen === 'results' && <Results />}
      {screen === 'practice-setup' && <PracticeSetup />}
      {screen === 'practice' && <PracticeGame />}
      {screen === 'practice-results' && <PracticeResults />}
      {settingsOpen && <SettingsPanel />}
    </div>
  )
}
