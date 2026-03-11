import { useState, useEffect, useRef, memo } from 'react'
import type { PlayerState } from '@typeduel/shared'
import { TypingArea } from './TypingArea'
import { EffectOverlays } from './EffectOverlays'

interface PlayerPanelProps {
  player: PlayerState
  text: string
  isLocal: boolean
  label: string
  localCursor?: number
  errorIndex?: number | null
}

interface DamagePopup {
  id: number
  amount: number
}

let popupId = 0

export const PlayerPanel = memo(function PlayerPanel({ player, text, isLocal, label, localCursor, errorIndex }: PlayerPanelProps) {
  // HP bar color: green > 60, yellow > 30, red <= 30
  const hpColor =
    player.hp > 60 ? 'bg-accent' : player.hp > 30 ? 'bg-warning' : 'bg-damage'

  // Delayed damage bar (fighting game style)
  const [delayedHp, setDelayedHp] = useState(player.hp)
  const delayedHpRef = useRef(player.hp)
  const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([])

  useEffect(() => {
    // Animate delayed bar shrinking slowly
    if (player.hp < delayedHpRef.current) {
      const dmg = Math.round(delayedHpRef.current - player.hp)
      if (dmg > 0) {
        const id = ++popupId
        setDamagePopups(prev => [...prev, { id, amount: dmg }])
        setTimeout(() => setDamagePopups(prev => prev.filter(p => p.id !== id)), 800)
      }
      const timer = setTimeout(() => {
        delayedHpRef.current = player.hp
        setDelayedHp(player.hp)
      }, 600)
      return () => clearTimeout(timer)
    } else {
      delayedHpRef.current = player.hp
      setDelayedHp(player.hp)
    }
  }, [player.hp])

  // Streak-based combo (uses server-tracked consecutive correct count)
  const streak = player.streak ?? 0
  const comboTier = streak >= 50 ? 3 : streak >= 20 ? 2 : streak >= 10 ? 1 : 0

  return (
    <div className="flex-1 min-w-0 relative">
      {/* Effect overlays (shown on both sides) */}
      <EffectOverlays effects={player.activeEffects} />

      {/* Combo counter with escalating visuals */}
      {isLocal && comboTier >= 1 && (
        <div
          className={`absolute top-0 right-0 font-bold z-10 ${
            comboTier === 3
              ? 'text-lg combo-fire text-accent'
              : comboTier === 2
              ? 'text-base combo-glow text-accent/80'
              : 'text-sm combo-pulse text-accent/40'
          }`}
          data-testid="combo"
        >
          {comboTier === 3 ? 'UNSTOPPABLE' : comboTier === 2 ? 'ON FIRE' : 'STREAK'} x{streak}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-text/60 uppercase tracking-wider">{label}</span>
        <span className="font-bold text-lg">{player.displayName}</span>
      </div>

      {/* HP Bar with delayed damage */}
      <div className="mb-2 relative">
        {/* Floating damage numbers */}
        {damagePopups.map(p => (
          <div
            key={p.id}
            className="absolute -top-1 right-4 text-damage font-bold text-lg z-20 damage-float pointer-events-none"
          >
            -{p.amount}
          </div>
        ))}
        <div className="flex justify-between text-xs text-text/40 mb-1">
          <span>HP</span>
          <span>{Math.round(player.hp)}/100</span>
        </div>
        <div className="w-full h-3 bg-bg border border-border rounded-full overflow-hidden relative">
          {/* Delayed damage bar (lighter, behind) */}
          <div
            className="absolute h-full bg-damage/40 transition-all duration-700 ease-out"
            style={{ width: `${delayedHp}%` }}
          />
          {/* Current HP bar (on top) */}
          <div
            className={`relative h-full ${hpColor} transition-all duration-500 ease-out`}
            style={{ width: `${player.hp}%` }}
          />
        </div>
      </div>

      {/* Energy Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-text/40 mb-1">
          <span>Energy</span>
          <span>{Math.round(player.energy)}/100</span>
        </div>
        <div className="w-full h-2 bg-bg border border-border rounded-full overflow-hidden">
          <div
            className="h-full bg-energy transition-all duration-500 ease-out"
            style={{ width: `${player.energy}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-3">
        <div>
          <span className="text-3xl font-bold text-accent">{player.wpm}</span>
          <span className="text-xs text-text/40 ml-1">WPM</span>
        </div>
        <div>
          <span className="text-xl font-bold text-text/80">{player.accuracy.toFixed(1)}%</span>
          <span className="text-xs text-text/40 ml-1">ACC</span>
        </div>
      </div>

      {/* Typing Area */}
      <TypingArea text={text} player={player} isLocal={isLocal} cursorOverride={isLocal ? localCursor : undefined} errorIndex={isLocal ? errorIndex : undefined} />
    </div>
  )
})
