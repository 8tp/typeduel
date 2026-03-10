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
  onUseAbility: (abilityId: AbilityId) => void
}

export function AbilityBar({ player, onUseAbility }: AbilityBarProps) {
  const [flashingId, setFlashingId] = useState<AbilityId | null>(null)
  const abilityCooldowns = useGameStore(s => s.abilityCooldowns)
  const [now, setNow] = useState(Date.now())

  // Tick every 100ms to update cooldown timers
  useEffect(() => {
    const hasCooldowns = Object.values(abilityCooldowns).some(exp => exp && exp > Date.now())
    if (!hasCooldowns) return
    const interval = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(interval)
  }, [abilityCooldowns])

  const handleClick = (abilityId: AbilityId) => {
    onUseAbility(abilityId)
    setFlashingId(abilityId)
    setTimeout(() => setFlashingId(null), 300)
  }

  return (
    <div className="flex justify-center gap-2 mt-4" data-testid="ability-bar">
      {ABILITY_ORDER.map((abilityId, idx) => {
        const config = ABILITY_CONFIGS[abilityId]
        const hasEnergy = player.energy >= config.cost
        const isOnCooldown = player.activeEffects.some(
          e => e.abilityId === abilityId && e.source === player.id
        )
        const cooldownExpiry = abilityCooldowns[abilityId]
        const cooldownRemaining = cooldownExpiry ? Math.max(0, Math.ceil((cooldownExpiry - now) / 1000)) : 0
        const onCooldown = isOnCooldown || cooldownRemaining > 0
        const disabled = !hasEnergy || onCooldown

        return (
          <button
            key={abilityId}
            onClick={() => !disabled && handleClick(abilityId)}
            disabled={disabled}
            className={`
              relative flex flex-col items-center px-3 py-2 rounded border text-xs font-mono
              transition-all duration-150 min-w-[90px]
              ${disabled
                ? 'border-border text-text/20 cursor-not-allowed'
                : 'border-accent/50 text-text hover:bg-accent/10 hover:border-accent cursor-pointer'
              }
              ${flashingId === abilityId ? 'ability-flash' : ''}
            `}
            data-ability={abilityId}
            title={`${config.description} (Ctrl+${idx + 1})`}
          >
            <span className="text-lg mb-0.5">{ABILITY_ICONS[abilityId]}</span>
            <span className="font-bold text-[10px] uppercase tracking-wider">{abilityId.replace('_', ' ')}</span>
            <span className={`text-[10px] ${hasEnergy ? 'text-energy' : 'text-text/20'}`}>
              {config.cost} EP
            </span>
            <span className="absolute top-0.5 right-1 text-[9px] text-text/30">
              ^{idx + 1}
            </span>
            {cooldownRemaining > 0 && (
              <span className="absolute inset-0 flex items-center justify-center bg-bg/60 rounded text-damage font-bold text-sm" data-testid="cooldown-timer">
                {cooldownRemaining}s
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
