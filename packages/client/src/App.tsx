import { useEffect } from 'react'
import { useGameStore } from './store'
import { Lobby } from './components/Lobby'
import { Matchmaking } from './components/Matchmaking'
import { Countdown } from './components/Countdown'
import { GameScreen } from './components/GameScreen'
import { Results } from './components/Results'
import { SpectateScreen } from './components/SpectateScreen'
import { PracticeSetup } from './components/PracticeSetup'
import { PracticeGame } from './components/PracticeGame'
import { PracticeResults } from './components/PracticeResults'
import { SettingsPanel } from './components/SettingsPanel'

export function App() {
  const screen = useGameStore((s) => s.screen)
  const crtEnabled = useGameStore((s) => s.crtEnabled)
  const uiScale = useGameStore((s) => s.uiScale)
  const highContrast = useGameStore((s) => s.highContrast)
  const reducedMotion = useGameStore((s) => s.reducedMotion)
  const settingsOpen = useGameStore((s) => s.settingsOpen)

  useEffect(() => {
    const sizes = { small: '14px', medium: '16px', large: '20px' }
    document.documentElement.style.fontSize = sizes[uiScale]
  }, [uiScale])

  const rootClasses = [
    crtEnabled ? 'crt-scanlines' : '',
    highContrast ? 'high-contrast' : '',
    reducedMotion ? 'reduced-motion' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={rootClasses}>
      {screen === 'lobby' && <Lobby />}
      {screen === 'matchmaking' && <Matchmaking />}
      {screen === 'countdown' && <Countdown />}
      {screen === 'game' && <GameScreen />}
      {screen === 'spectating' && <SpectateScreen />}
      {screen === 'results' && <Results />}
      {screen === 'practice-setup' && <PracticeSetup />}
      {screen === 'practice' && <PracticeGame />}
      {screen === 'practice-results' && <PracticeResults />}
      {settingsOpen && <SettingsPanel />}
    </div>
  )
}
