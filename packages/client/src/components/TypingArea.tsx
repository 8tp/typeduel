import { useRef, useEffect, useState } from 'react'
import { AbilityId, type PlayerState } from '@typeduel/shared'

interface TypingAreaProps {
  text: string
  player: PlayerState
  isLocal: boolean
  cursorOverride?: number
  errorIndex?: number | null
}

function useScramble(text: string, cursor: number, active: boolean): string {
  const [scrambled, setScrambled] = useState(text)

  useEffect(() => {
    if (!active) {
      setScrambled(text)
      return
    }
    // Scramble upcoming characters (next ~50 chars after cursor)
    const scrambleText = () => {
      const chars = text.split('')
      const start = cursor
      const end = Math.min(cursor + 50, chars.length)
      for (let i = start; i < end; i++) {
        if (chars[i] !== ' ') {
          // Replace with random printable char
          const pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
          chars[i] = pool[Math.floor(Math.random() * pool.length)]
        }
      }
      setScrambled(chars.join(''))
    }

    scrambleText()
    const interval = setInterval(scrambleText, 100) // Re-scramble every 100ms for glitch effect
    return () => clearInterval(interval)
  }, [active, text, cursor])

  return active ? scrambled : text
}

export function TypingArea({ text, player, isLocal, cursorOverride, errorIndex }: TypingAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cursor = cursorOverride ?? player.cursor

  const hasScramble = isLocal && player.activeEffects.some(e => e.abilityId === AbilityId.SCRAMBLE)
  const hasPhantom = isLocal && player.activeEffects.some(e => e.abilityId === AbilityId.PHANTOM_KEYS)

  const displayText = useScramble(text, cursor, hasScramble)

  // Auto-scroll to keep cursor visible
  useEffect(() => {
    if (!containerRef.current || !isLocal) return
    const cursorSpan = containerRef.current.querySelector('[data-cursor]') as HTMLElement | null
    if (!cursorSpan) return
    const container = containerRef.current
    // Keep cursor roughly 30% from left edge for read-ahead room
    const targetOffset = container.clientWidth * 0.3
    const cursorLeft = cursorSpan.offsetLeft
    container.scrollLeft = cursorLeft - targetOffset
  }, [cursor, isLocal])

  return (
    <div
      ref={containerRef}
      data-testid="typing-area"
      className="bg-bg border border-border rounded p-4 h-14 overflow-x-hidden overflow-y-hidden text-lg whitespace-nowrap select-none"
    >
      {displayText.split('').map((char, i) => {
        let className = 'text-text/30' // upcoming
        if (i < cursor) {
          className = 'text-accent' // correct (validated)
        }
        if (i === cursor && isLocal) {
          const hasError = errorIndex === i
          return (
            <span key={i} data-cursor className={`relative ${hasError ? 'error-char' : ''}`}>
              <span className={`absolute -left-[1px] top-0 w-[2px] h-[1.2em] ${hasError ? 'bg-damage' : 'bg-accent'} animate-pulse`} />
              {/* Phantom keys: show ghost characters before real char */}
              {hasPhantom && (
                <span className="text-text/20 italic">
                  {String.fromCharCode(97 + Math.floor(Math.random() * 26))}
                </span>
              )}
              <span className={hasError ? 'text-damage font-bold' : 'text-text/60'}>{char === ' ' ? '\u00A0' : char}</span>
            </span>
          )
        }
        if (i === cursor && !isLocal) {
          return (
            <span key={i} className="relative">
              <span className="absolute -left-[1px] top-0 w-[2px] h-[1.2em] bg-damage" />
              <span className="text-text/30">{char === ' ' ? '\u00A0' : char}</span>
            </span>
          )
        }
        return (
          <span key={i} className={className}>
            {char === ' ' ? '\u00A0' : char}
          </span>
        )
      })}
    </div>
  )
}
