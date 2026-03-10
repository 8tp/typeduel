import { useEffect, useRef, useCallback, useState } from 'react'
import { MessageType, AbilityId, ROUNDS_TO_WIN, type TauntId } from '@typeduel/shared'
import { useGameStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'
import { sfx } from '../audio'
import { PlayerPanel } from './PlayerPanel'
import { AbilityBar } from './AbilityBar'
import { CombatLog } from './CombatLog'

const TAUNT_LABELS: Record<TauntId, string> = {
  GG: 'GG',
  NICE: 'Nice!',
  OUCH: 'Ouch!',
  GL: 'GL HF',
}

export function GameScreen() {
  const { gameState, playerId, localCursor, activeTaunt, errorIndex, setSettingsOpen, showCombatLog } = useGameStore()
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

  // Low HP heartbeat
  useEffect(() => {
    if (!gameState || !playerId) return
    const localPlayer = gameState.players[playerId]
    if (localPlayer && localPlayer.hp > 0 && localPlayer.hp < 20) {
      sfx.heartbeat()
    }
  }, [gameState, playerId])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl+[7-9,0] → taunt hotkeys
      if (e.ctrlKey && e.key >= '7' && e.key <= '9') {
        e.preventDefault()
        const taunts: TauntId[] = ['GG', 'NICE', 'OUCH']
        const tauntId = taunts[parseInt(e.key) - 7]
        if (tauntId) {
          send({ type: MessageType.TAUNT, tauntId })
        }
        return
      }
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault()
        send({ type: MessageType.TAUNT, tauntId: 'GL' })
        return
      }

      // Prevent defaults for game keys
      if (e.key === 'Backspace' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault()
      }

      if (e.key === 'Backspace') {
        sfx.keystrokeError()
        // Optimistic cursor update
        const { localCursor } = useGameStore.getState()
        if (localCursor > 0) {
          useGameStore.getState().setLocalCursor(localCursor - 1)
        }
        send({
          type: MessageType.KEYSTROKE,
          char: 'BACKSPACE',
          timestamp: Date.now(),
        })
        return
      }

      // Printable character (length 1, no modifier)
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const s = useGameStore.getState()
        if (s.gameState && s.playerId) {
          const player = s.gameState.players[s.playerId]
          const isFrozen = player?.activeEffects.some(eff => eff.abilityId === AbilityId.FREEZE) ?? false
          const isCorrect = !isFrozen && e.key === s.gameState.text[s.localCursor]
          if (isCorrect) {
            sfx.keystroke()
            s.setLocalCursor(s.localCursor + 1)
          } else {
            sfx.keystrokeError()
            // Flash error at current cursor position
            s.setErrorIndex(s.localCursor)
            setTimeout(() => useGameStore.getState().setErrorIndex(null), 300)
          }
        } else {
          sfx.keystroke()
        }
        send({
          type: MessageType.KEYSTROKE,
          char: e.key,
          timestamp: Date.now(),
        })
      }
    },
    [send]
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
  const isLowHp = localPlayer.hp > 0 && localPlayer.hp < 20

  return (
    <div className="min-h-screen flex flex-col p-4">
      {/* KO flash overlay */}
      {koFlash && (
        <div className="fixed inset-0 bg-white z-50 pointer-events-none ko-flash" />
      )}

      {/* Low HP vignette */}
      {isLowHp && (
        <div className="fixed inset-0 z-40 pointer-events-none low-hp-vignette" data-testid="low-hp-vignette" />
      )}

      {/* Taunt display */}
      {activeTaunt && (
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 z-50 pointer-events-none taunt-popup" data-testid="taunt-display">
          <div className="text-3xl font-bold text-warning bg-bg/80 border border-warning/30 rounded-lg px-6 py-3">
            {TAUNT_LABELS[activeTaunt.tauntId] ?? activeTaunt.tauntId}
          </div>
        </div>
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
        <div className="text-text/40 text-sm space-y-0.5">
          <div>Room: <span className="text-accent">{gameState.roomCode}</span></div>
          <div className="text-xs">
            Round {gameState.currentRound}/{ROUNDS_TO_WIN * 2 - 1}
            {playerId && (
              <span className="ml-2 text-accent">
                {gameState.roundWins[playerId] ?? 0}–{Object.entries(gameState.roundWins).find(([id]) => id !== playerId)?.[1] ?? 0}
              </span>
            )}
          </div>
        </div>
        <div className="text-4xl font-bold text-accent tabular-nums">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>
        <div className="flex items-center gap-3">
          {gameState.spectatorCount > 0 && (
            <span className="text-text/30 text-xs" data-testid="spectator-count">
              {gameState.spectatorCount} watching
            </span>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-text/20 hover:text-text/40 transition-colors"
            title="Settings"
            data-testid="settings-toggle"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              <path d="M16.2 12.2a1.4 1.4 0 00.28 1.54l.05.05a1.7 1.7 0 11-2.4 2.4l-.05-.05a1.4 1.4 0 00-1.54-.28 1.4 1.4 0 00-.85 1.28v.15a1.7 1.7 0 11-3.4 0v-.08a1.4 1.4 0 00-.92-1.28 1.4 1.4 0 00-1.54.28l-.05.05a1.7 1.7 0 11-2.4-2.4l.05-.05a1.4 1.4 0 00.28-1.54 1.4 1.4 0 00-1.28-.85h-.15a1.7 1.7 0 110-3.4h.08a1.4 1.4 0 001.28-.92 1.4 1.4 0 00-.28-1.54l-.05-.05a1.7 1.7 0 112.4-2.4l.05.05a1.4 1.4 0 001.54.28h.07a1.4 1.4 0 00.85-1.28v-.15a1.7 1.7 0 113.4 0v.08a1.4 1.4 0 00.85 1.28 1.4 1.4 0 001.54-.28l.05-.05a1.7 1.7 0 112.4 2.4l-.05.05a1.4 1.4 0 00-.28 1.54v.07a1.4 1.4 0 001.28.85h.15a1.7 1.7 0 110 3.4h-.08a1.4 1.4 0 00-1.28.85z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Player Panels */}
      <div className="flex-1 flex gap-6">
        <PlayerPanel
          player={localPlayer}
          text={gameState.text}
          isLocal={true}
          label="You"
          localCursor={localCursor}
          errorIndex={errorIndex}
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
      <AbilityBar player={localPlayer} />

      {/* Combat Log */}
      {showCombatLog && <CombatLog />}
    </div>
  )
}
