import { useRef, useEffect, useState } from 'react'
import { AbilityId, type PlayerState } from '@typeduel/shared'

interface TypingAreaProps {
  text: string
  player: PlayerState
  isLocal: boolean
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

export function TypingArea({ text, player, isLocal }: TypingAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const hasScramble = isLocal && player.activeEffects.some(e => e.abilityId === AbilityId.SCRAMBLE)
  const hasPhantom = isLocal && player.activeEffects.some(e => e.abilityId === AbilityId.PHANTOM_KEYS)

  const displayText = useScramble(text, player.cursor, hasScramble)

  // Auto-scroll to keep cursor visible
  useEffect(() => {
    if (!containerRef.current || !isLocal) return
    const cursorSpan = containerRef.current.querySelector('[data-cursor]')
    cursorSpan?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [player.cursor, isLocal])

  return (
    <div
      ref={containerRef}
      className="bg-bg border border-border rounded p-4 h-40 overflow-y-auto text-lg leading-relaxed select-none"
    >
      {displayText.split('').map((char, i) => {
        let className = 'text-text/30' // upcoming
        if (i < player.cursor) {
          className = 'text-accent' // correct (server validated)
        }
        if (i === player.cursor && isLocal) {
          return (
            <span key={i} data-cursor className="relative">
              <span className="absolute -left-[1px] top-0 w-[2px] h-[1.2em] bg-accent animate-pulse" />
              {/* Phantom keys: show ghost characters before real char */}
              {hasPhantom && (
                <span className="text-text/20 italic">
                  {String.fromCharCode(97 + Math.floor(Math.random() * 26))}
                </span>
              )}
              <span className="text-text/60">{char === ' ' ? '\u00A0' : char}</span>
            </span>
          )
        }
        if (i === player.cursor && !isLocal) {
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
