import { useState } from 'react'
import { useGameStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'

export function WaitingRoom() {
  const { roomCode, reset } = useGameStore()
  const { disconnect } = useWebSocket()
  const [copied, setCopied] = useState(false)

  const handleCopyCode = async () => {
    if (!roomCode) return

    try {
      await navigator.clipboard.writeText(roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access may be unavailable in non-HTTPS dev contexts.
    }
  }

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
          {roomCode ?? '......'}
        </button>
        <p className="text-xs text-text/30 mb-4">
          {copied ? 'Copied!' : 'Click to copy'}
        </p>
        <p className="text-text/40 text-sm">Waiting for opponent to join...</p>
        <div className="mt-4 flex justify-center">
          <span className="inline-block w-2 h-2 bg-accent rounded-full animate-pulse" />
        </div>

        <button
          onClick={() => {
            disconnect()
            reset()
          }}
          className="mt-6 w-full border border-text/20 text-text/60 font-bold py-2 rounded hover:border-accent/50 hover:text-accent transition-colors"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  )
}
