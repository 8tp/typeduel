import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AbilityBar } from '../AbilityBar'
import { useGameStore } from '../../store'
import { AbilityId, ABILITY_CONFIGS, type PlayerState } from '@typeduel/shared'

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'player1',
    displayName: 'Tester',
    hp: 100,
    cursor: 0,
    wpm: 60,
    accuracy: 95,
    energy: 0,
    activeEffects: [],
    streak: 0,
    ...overrides,
  }
}

describe('AbilityBar', () => {
  const onUseAbility = vi.fn()

  beforeEach(() => {
    onUseAbility.mockClear()
    useGameStore.setState({ abilityCooldowns: {} })
  })

  it('renders 6 ability slots', () => {
    const player = makePlayer()
    render(<AbilityBar player={player} onUseAbility={onUseAbility} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(6)
  })

  it('shows ability costs', () => {
    const player = makePlayer()
    render(<AbilityBar player={player} onUseAbility={onUseAbility} />)
    // Check that each ability cost is displayed
    expect(screen.getByText(`${ABILITY_CONFIGS[AbilityId.SURGE].cost} EP`)).toBeInTheDocument()
    expect(screen.getByText(`${ABILITY_CONFIGS[AbilityId.MIRROR].cost} EP`)).toBeInTheDocument()
    expect(screen.getByText(`${ABILITY_CONFIGS[AbilityId.FREEZE].cost} EP`)).toBeInTheDocument()
  })

  it('disables buttons when energy is insufficient', () => {
    const player = makePlayer({ energy: 0 })
    render(<AbilityBar player={player} onUseAbility={onUseAbility} />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => {
      expect(btn).toBeDisabled()
    })
  })

  it('enables buttons when energy is sufficient', () => {
    // SURGE costs 20, which is the cheapest
    const player = makePlayer({ energy: 100 })
    render(<AbilityBar player={player} onUseAbility={onUseAbility} />)
    const buttons = screen.getAllByRole('button')
    // All abilities should be enabled since we have 100 energy
    buttons.forEach(btn => {
      expect(btn).not.toBeDisabled()
    })
  })

  it('shows ability names', () => {
    const player = makePlayer()
    render(<AbilityBar player={player} onUseAbility={onUseAbility} />)
    expect(screen.getByText('SURGE')).toBeInTheDocument()
    expect(screen.getByText('BLACKOUT')).toBeInTheDocument()
    expect(screen.getByText('SCRAMBLE')).toBeInTheDocument()
    expect(screen.getByText('FREEZE')).toBeInTheDocument()
    expect(screen.getByText('MIRROR')).toBeInTheDocument()
    expect(screen.getByText('PHANTOM KEYS')).toBeInTheDocument()
  })

  it('shows hotkey labels ^1 through ^6', () => {
    const player = makePlayer()
    render(<AbilityBar player={player} onUseAbility={onUseAbility} />)
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByText(`^${i}`)).toBeInTheDocument()
    }
  })

  it('has data-testid="ability-bar"', () => {
    const player = makePlayer()
    render(<AbilityBar player={player} onUseAbility={onUseAbility} />)
    expect(screen.getByTestId('ability-bar')).toBeInTheDocument()
  })
})
