import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Lobby } from '../Lobby'
import { useGameStore } from '../../store'

vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: () => ({ connect: vi.fn(), send: vi.fn(), disconnect: vi.fn() }),
}))

describe('Lobby', () => {
  beforeEach(() => {
    useGameStore.setState({
      displayName: '',
      roomCode: null,
      matchHistory: [],
      crtEnabled: true,
      soundEnabled: true,
      screen: 'lobby',
      isSpectating: false,
    })
  })

  it('renders title "TYPEDUEL"', () => {
    render(<Lobby />)
    expect(screen.getByText('TYPEDUEL')).toBeInTheDocument()
  })

  it('shows Practice Mode button', () => {
    render(<Lobby />)
    expect(screen.getByTestId('practice-btn')).toBeInTheDocument()
    expect(screen.getByTestId('practice-btn')).toHaveTextContent('Practice Mode')
  })

  it('Quick Match button is disabled without a name', () => {
    render(<Lobby />)
    expect(screen.getByRole('button', { name: 'Quick Match' })).toBeDisabled()
  })

  it('Create Room button is disabled without a name', () => {
    render(<Lobby />)
    expect(screen.getByRole('button', { name: 'Create Room' })).toBeDisabled()
  })

  it('Quick Match button is enabled with a name', () => {
    useGameStore.setState({ displayName: 'TestPlayer' })
    render(<Lobby />)
    expect(screen.getByRole('button', { name: 'Quick Match' })).toBeEnabled()
  })

  it('Create Room button is enabled with a name', () => {
    useGameStore.setState({ displayName: 'TestPlayer' })
    render(<Lobby />)
    expect(screen.getByRole('button', { name: 'Create Room' })).toBeEnabled()
  })

  it('shows difficulty buttons', () => {
    render(<Lobby />)
    expect(screen.getByRole('button', { name: 'Easy' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Medium' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hard' })).toBeInTheDocument()
  })

  it('shows display name input', () => {
    render(<Lobby />)
    expect(screen.getByPlaceholderText('Enter your name...')).toBeInTheDocument()
  })

  it('shows room code input and join button', () => {
    render(<Lobby />)
    expect(screen.getByPlaceholderText('ROOM CODE')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument()
  })

  it('shows spectate input and watch button', () => {
    render(<Lobby />)
    expect(screen.getByTestId('spectate-input')).toBeInTheDocument()
    expect(screen.getByTestId('spectate-btn')).toBeInTheDocument()
  })
})
