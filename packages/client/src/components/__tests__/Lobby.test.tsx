import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Lobby } from '../Lobby'
import { useGameStore } from '../../store'

const connectMock = vi.fn()
const sendMock = vi.fn()
const disconnectMock = vi.fn()

vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: () => ({ connect: connectMock, send: sendMock, disconnect: disconnectMock }),
}))

describe('Lobby', () => {
  beforeEach(() => {
    connectMock.mockReset()
    sendMock.mockReset()
    disconnectMock.mockReset()
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

  it('sends quick match immediately after connect', async () => {
    const user = userEvent.setup()
    useGameStore.setState({ displayName: 'TestPlayer' })
    render(<Lobby />)

    await user.click(screen.getByRole('button', { name: 'Quick Match' }))

    expect(connectMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith({
      type: 'JOIN_QUEUE',
      displayName: 'TestPlayer',
      difficulty: 'medium',
    })
    expect(useGameStore.getState().screen).toBe('matchmaking')
  })

  it('sends join room without relying on a timeout', async () => {
    const user = userEvent.setup()
    useGameStore.setState({ displayName: 'TestPlayer' })
    render(<Lobby />)

    await user.type(screen.getByPlaceholderText('ROOM CODE'), 'abc123')
    await user.click(screen.getByRole('button', { name: 'Join' }))

    expect(connectMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith({
      type: 'JOIN_ROOM',
      displayName: 'TestPlayer',
      roomCode: 'ABC123',
    })
  })
})
