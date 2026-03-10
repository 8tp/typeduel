import { useState } from 'react'
import { MessageType, type Difficulty } from '@typeduel/shared'
import { useGameStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'
import { sfx } from '../audio'

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

export function Lobby() {
  const { displayName, setDisplayName, setScreen, roomCode, toggleCrt, crtEnabled, soundEnabled, toggleSound } = useGameStore()
  const { connect, send } = useWebSocket()
  const [joinCode, setJoinCode] = useState('')
  const [waitingRoom, setWaitingRoom] = useState(false)
  const [copied, setCopied] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')

  const handleQuickMatch = () => {
    if (!displayName.trim()) return
    connect()
    setTimeout(() => {
      send({ type: MessageType.JOIN_QUEUE, displayName: displayName.trim(), difficulty })
      setScreen('matchmaking')
    }, 500)
  }

  const handleCreateRoom = () => {
    if (!displayName.trim()) return
    connect()
    setTimeout(() => {
      send({ type: MessageType.CREATE_ROOM, displayName: displayName.trim(), difficulty })
      setWaitingRoom(true)
    }, 500)
  }

  const handleJoinRoom = () => {
    if (!displayName.trim() || !joinCode.trim()) return
    connect()
    setTimeout(() => {
      send({
        type: MessageType.JOIN_ROOM,
        displayName: displayName.trim(),
        roomCode: joinCode.trim().toUpperCase(),
      })
    }, 500)
  }

  const handleCopyCode = async () => {
    if (!roomCode) return
    try {
      await navigator.clipboard.writeText(roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for non-HTTPS
    }
  }

  if (waitingRoom && roomCode) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-surface border border-border rounded-lg p-8 w-full max-w-md text-center">
          <h2 className="text-2xl font-bold text-accent mb-4">Room Created</h2>
          <p className="text-text/60 mb-2">Share this code with your opponent:</p>
          <button
            onClick={handleCopyCode}
            className="w-full text-4xl font-bold tracking-[0.3em] text-accent bg-bg border border-border rounded p-4 mb-2 hover:border-accent/50 transition-colors cursor-pointer"
            title="Click to copy"
            data-testid="room-code"
          >
            {roomCode}
          </button>
          <p className="text-xs text-text/30 mb-4">
            {copied ? 'Copied!' : 'Click to copy'}
          </p>
          <p className="text-text/40 text-sm">Waiting for opponent to join...</p>
          <div className="mt-4 flex justify-center">
            <span className="inline-block w-2 h-2 bg-accent rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-surface border border-border rounded-lg p-8 w-full max-w-md">
        <h1 className="text-4xl font-bold text-accent text-center mb-2">TYPEDUEL</h1>
        <p className="text-text/40 text-center text-sm mb-8">Real-time typing combat</p>

        {/* Display Name */}
        <div className="mb-6">
          <label className="block text-sm text-text/60 mb-1">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name..."
            maxLength={20}
            className="w-full bg-bg border border-border rounded px-4 py-2 text-text font-mono focus:border-accent focus:outline-none"
          />
        </div>

        {/* Difficulty */}
        <div className="mb-4">
          <label className="block text-sm text-text/60 mb-1">Difficulty</label>
          <div className="flex gap-2">
            {DIFFICULTIES.map(d => (
              <button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                className={`flex-1 py-2 rounded border text-sm font-bold transition-colors ${
                  difficulty === d.value
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-text/40 hover:border-text/30'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Match */}
        <button
          onClick={handleQuickMatch}
          disabled={!displayName.trim()}
          className="w-full bg-accent text-bg font-bold py-3 rounded mb-3 hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Quick Match
        </button>

        <div className="flex gap-3 mb-3">
          <button
            onClick={handleCreateRoom}
            disabled={!displayName.trim()}
            className="flex-1 border border-accent text-accent font-bold py-3 rounded hover:bg-accent/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Create Room
          </button>
        </div>

        {/* Join Room */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ROOM CODE"
            maxLength={6}
            className="flex-1 bg-bg border border-border rounded px-4 py-2 text-text font-mono tracking-wider text-center focus:border-accent focus:outline-none uppercase"
          />
          <button
            onClick={handleJoinRoom}
            disabled={!displayName.trim() || joinCode.length < 6}
            className="px-6 border border-accent text-accent font-bold py-2 rounded hover:bg-accent/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Join
          </button>
        </div>

        {/* Settings */}
        <div className="flex items-center justify-center gap-4 text-xs text-text/30">
          <button
            onClick={toggleCrt}
            className="hover:text-text/60 transition-colors"
            data-testid="crt-toggle"
          >
            CRT: {crtEnabled ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => { toggleSound(); sfx.keystroke() }}
            className="hover:text-text/60 transition-colors"
          >
            Sound: {soundEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    </div>
  )
}
