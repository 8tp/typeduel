import { useState, useEffect } from 'react'
import { AbilityId, ABILITY_CONFIGS, type PlayerState } from '@typeduel/shared'
import { useGameStore } from '../store'

const ABILITY_ORDER: AbilityId[] = [
  AbilityId.SURGE,
  AbilityId.BLACKOUT,
  AbilityId.SCRAMBLE,
  AbilityId.PHANTOM_KEYS,
  AbilityId.FREEZE,
  AbilityId.MIRROR,
]

const ABILITY_ICONS: Record<AbilityId, string> = {
  [AbilityId.SURGE]: '⚡',
  [AbilityId.BLACKOUT]: '🌑',
  [AbilityId.SCRAMBLE]: '🔀',
  [AbilityId.PHANTOM_KEYS]: '👻',
  [AbilityId.FREEZE]: '❄️',
  [AbilityId.MIRROR]: '🛡️',
}

interface AbilityBarProps {
  player: PlayerState
}

export function AbilityBar({ player }: AbilityBarProps) {
  const abilityCooldowns = useGameStore(s => s.abilityCooldowns)
  const [now, setNow] = useState(Date.now())

  // Tick every 100ms to update cooldown timers
  useEffect(() => {
    const hasCooldowns = Object.values(abilityCooldowns).some(exp => exp && exp > Date.now())
    if (!hasCooldowns) return
    const interval = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(interval)
  }, [abilityCooldowns])

  return (
    <div className="flex justify-center gap-2 mt-4" data-testid="ability-bar">
      {ABILITY_ORDER.map((abilityId) => {
        const config = ABILITY_CONFIGS[abilityId]
        const hasEnergy = player.energy >= config.cost
        const isActive = player.activeEffects.some(e => e.abilityId === abilityId)
        const cooldownExpiry = abilityCooldowns[abilityId]
        const cooldownRemaining = cooldownExpiry ? Math.max(0, Math.ceil((cooldownExpiry - now) / 1000)) : 0
        const onCooldown = cooldownRemaining > 0

        return (
          <div
            key={abilityId}
            className={`
              relative flex flex-col items-center px-3 py-2 rounded border text-xs font-mono
              min-w-[90px]
              ${isActive
                ? 'border-accent bg-accent/10 text-accent'
                : onCooldown
                ? 'border-damage/30 text-text/20'
                : hasEnergy
                ? 'border-accent/30 text-text/60'
                : 'border-border text-text/20'
              }
            `}
            data-ability={abilityId}
            title={config.description}
          >
            <span className="text-lg mb-0.5">{ABILITY_ICONS[abilityId]}</span>
            <span className="font-bold text-[10px] uppercase tracking-wider">{abilityId.replace('_', ' ')}</span>
            <span className={`text-[10px] ${hasEnergy ? 'text-energy' : 'text-text/20'}`}>
              {config.cost} EP
            </span>
            {isActive && (
              <span className="absolute top-0.5 right-1 text-[9px] text-accent font-bold">
                ACTIVE
              </span>
            )}
            {cooldownRemaining > 0 && (
              <span className="absolute inset-0 flex items-center justify-center bg-bg/60 rounded text-damage font-bold text-sm" data-testid="cooldown-timer">
                {cooldownRemaining}s
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
