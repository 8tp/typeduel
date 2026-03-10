import { useState } from 'react'
import { MessageType, type Difficulty } from '@typeduel/shared'
import { useGameStore, type MatchHistoryEntry } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'


const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

export function Lobby() {
  const { displayName, setDisplayName, setScreen, roomCode, matchHistory, setIsSpectating, defaultDifficulty, setSettingsOpen } = useGameStore()
  const { connect, send } = useWebSocket()
  const [joinCode, setJoinCode] = useState('')
  const [spectateCode, setSpectateCode] = useState('')
  const [waitingRoom, setWaitingRoom] = useState(false)
  const [copied, setCopied] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>(defaultDifficulty)
  const [showHistory, setShowHistory] = useState(false)

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

  const handleSpectate = () => {
    if (!spectateCode.trim()) return
    connect()
    setTimeout(() => {
      send({
        type: MessageType.SPECTATE_ROOM,
        roomCode: spectateCode.trim().toUpperCase(),
      })
      setIsSpectating(true)
      setScreen('spectating')
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

        {/* Practice */}
        <button
          onClick={() => setScreen('practice-setup')}
          className="w-full border border-text/20 text-text/60 font-bold py-3 rounded mb-3 hover:border-accent/50 hover:text-accent transition-colors"
          data-testid="practice-btn"
        >
          Practice Mode
        </button>

        {/* Spectate */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={spectateCode}
            onChange={(e) => setSpectateCode(e.target.value.toUpperCase())}
            placeholder="SPECTATE CODE"
            maxLength={6}
            className="flex-1 bg-bg border border-border rounded px-4 py-2 text-text font-mono tracking-wider text-center focus:border-accent focus:outline-none uppercase"
            data-testid="spectate-input"
          />
          <button
            onClick={handleSpectate}
            disabled={spectateCode.length < 6}
            className="px-6 border border-text/20 text-text/40 font-bold py-2 rounded hover:bg-text/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            data-testid="spectate-btn"
          >
            Watch
          </button>
        </div>

        {/* Match History */}
        {matchHistory.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full text-xs text-text/30 hover:text-text/50 transition-colors text-left"
              data-testid="history-toggle"
            >
              Match History ({matchHistory.length}) {showHistory ? '[-]' : '[+]'}
            </button>
            {showHistory && (
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1" data-testid="match-history">
                {[...matchHistory].reverse().map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs bg-bg border border-border rounded px-3 py-1.5"
                  >
                    <span className={entry.result === 'W' ? 'text-accent font-bold' : 'text-damage font-bold'}>
                      {entry.result}
                    </span>
                    <span className="text-text/60">vs {entry.opponent}</span>
                    <span className="text-text/40">{entry.wpm} WPM</span>
                    <span className="text-text/40">{entry.accuracy}%</span>
                    <span className="text-text/20">{new Date(entry.date).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings */}
        <div className="flex items-center justify-center text-text/30">
          <button
            onClick={() => setSettingsOpen(true)}
            className="hover:text-text/60 transition-colors"
            data-testid="settings-btn"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              <path d="M16.2 12.2a1.4 1.4 0 00.28 1.54l.05.05a1.7 1.7 0 11-2.4 2.4l-.05-.05a1.4 1.4 0 00-1.54-.28 1.4 1.4 0 00-.85 1.28v.15a1.7 1.7 0 11-3.4 0v-.08a1.4 1.4 0 00-.92-1.28 1.4 1.4 0 00-1.54.28l-.05.05a1.7 1.7 0 11-2.4-2.4l.05-.05a1.4 1.4 0 00.28-1.54 1.4 1.4 0 00-1.28-.85h-.15a1.7 1.7 0 110-3.4h.08a1.4 1.4 0 001.28-.92 1.4 1.4 0 00-.28-1.54l-.05-.05a1.7 1.7 0 112.4-2.4l.05.05a1.4 1.4 0 001.54.28h.07a1.4 1.4 0 00.85-1.28v-.15a1.7 1.7 0 113.4 0v.08a1.4 1.4 0 00.85 1.28 1.4 1.4 0 001.54-.28l.05-.05a1.7 1.7 0 112.4 2.4l-.05.05a1.4 1.4 0 00-.28 1.54v.07a1.4 1.4 0 001.28.85h.15a1.7 1.7 0 110 3.4h-.08a1.4 1.4 0 00-1.28.85z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
