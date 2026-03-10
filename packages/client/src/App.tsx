import { useGameStore } from './store'
import { Lobby } from './components/Lobby'
import { Matchmaking } from './components/Matchmaking'
import { Countdown } from './components/Countdown'
import { GameScreen } from './components/GameScreen'
import { Results } from './components/Results'

export function App() {
  const screen = useGameStore((s) => s.screen)
  const crtEnabled = useGameStore((s) => s.crtEnabled)

  return (
    <div className={crtEnabled ? 'crt-scanlines' : ''}>
      {screen === 'lobby' && <Lobby />}
      {screen === 'matchmaking' && <Matchmaking />}
      {screen === 'countdown' && <Countdown />}
      {screen === 'game' && <GameScreen />}
      {screen === 'results' && <Results />}
    </div>
  )
}
