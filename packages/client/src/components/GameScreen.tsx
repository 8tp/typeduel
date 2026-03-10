import { useEffect, useRef, useCallback, useState } from 'react'
import { MessageType, AbilityId } from '@typeduel/shared'
import { useGameStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'
import { sfx } from '../audio'
import { PlayerPanel } from './PlayerPanel'
import { AbilityBar } from './AbilityBar'
import { CombatLog } from './CombatLog'

const ABILITY_HOTKEYS: AbilityId[] = [
  AbilityId.SURGE,
  AbilityId.BLACKOUT,
  AbilityId.SCRAMBLE,
  AbilityId.PHANTOM_KEYS,
  AbilityId.FREEZE,
  AbilityId.MIRROR,
]

export function GameScreen() {
  const { gameState, playerId, shaking, toggleCrt, crtEnabled } = useGameStore()
  const { send } = useWebSocket()
  const hiddenInputRef = useRef<HTMLInputElement>(null)
  const [koFlash, setKoFlash] = useState(false)
  const prevLocalHpRef = useRef(100)

  // KO flash when any player's HP hits 0
  useEffect(() => {
    if (!gameState || !playerId) return
    const localPlayer = gameState.players[playerId]
    if (localPlayer && localPlayer.hp <= 0 && prevLocalHpRef.current > 0) {
      setKoFlash(true)
      setTimeout(() => setKoFlash(false), 400)
    }
    if (localPlayer) prevLocalHpRef.current = localPlayer.hp
  }, [gameState, playerId])

  const handleUseAbility = useCallback(
    (abilityId: AbilityId) => {
      send({
        type: MessageType.USE_ABILITY,
        abilityId,
      })
    },
    [send]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl+[1-6] → ability hotkeys
      if (e.ctrlKey && e.key >= '1' && e.key <= '6') {
        e.preventDefault()
        const idx = parseInt(e.key) - 1
        const abilityId = ABILITY_HOTKEYS[idx]
        if (abilityId) {
          handleUseAbility(abilityId)
        }
        return
      }

      // Prevent defaults for game keys
      if (e.key === 'Backspace' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault()
      }

      if (e.key === 'Backspace') {
        sfx.keystrokeError()
        send({
          type: MessageType.KEYSTROKE,
          char: 'BACKSPACE',
          timestamp: Date.now(),
        })
        return
      }

      // Printable character (length 1, no modifier)
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        sfx.keystroke()
        send({
          type: MessageType.KEYSTROKE,
          char: e.key,
          timestamp: Date.now(),
        })
      }
    },
    [send, handleUseAbility]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    hiddenInputRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Refocus on click anywhere
  useEffect(() => {
    const refocus = () => hiddenInputRef.current?.focus()
    window.addEventListener('click', refocus)
    return () => window.removeEventListener('click', refocus)
  }, [])

  if (!gameState) return null

  const players = Object.values(gameState.players)
  const localPlayer = players.find((p) => p.id === playerId)
  const opponent = players.find((p) => p.id !== playerId)

  if (!localPlayer) return null

  const minutes = Math.floor(gameState.timeLeft / 60)
  const seconds = gameState.timeLeft % 60

  return (
    <div className={`min-h-screen flex flex-col p-4 ${shaking ? 'screen-shake' : ''}`}>
      {/* KO flash overlay */}
      {koFlash && (
        <div className="fixed inset-0 bg-white z-50 pointer-events-none ko-flash" />
      )}

      {/* Hidden input for capturing keystrokes */}
      <input
        ref={hiddenInputRef}
        className="opacity-0 absolute w-0 h-0"
        autoFocus
        onBlur={(e) => e.target.focus()}
      />

      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-text/40 text-sm">
          Room: <span className="text-accent">{gameState.roomId.slice(0, 6)}</span>
        </div>
        <div className="text-4xl font-bold text-accent tabular-nums">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>
        <button
          onClick={toggleCrt}
          className="text-text/20 hover:text-text/40 text-xs transition-colors"
          title="Toggle CRT scanlines"
          data-testid="settings-toggle"
        >
          {crtEnabled ? 'CRT:ON' : 'CRT:OFF'}
        </button>
      </div>

      {/* Player Panels */}
      <div className="flex-1 flex gap-6">
        <PlayerPanel
          player={localPlayer}
          text={gameState.text}
          isLocal={true}
          label="You"
        />
        {opponent && (
          <>
            <div className="w-px bg-border" />
            <PlayerPanel
              player={opponent}
              text={gameState.text}
              isLocal={false}
              label="Opponent"
            />
          </>
        )}
      </div>

      {/* Ability Bar */}
      <AbilityBar player={localPlayer} onUseAbility={handleUseAbility} />

      {/* Combat Log */}
      <CombatLog />
    </div>
  )
}
