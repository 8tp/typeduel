import { useRef, useEffect, useState, memo } from 'react'
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
    // Scramble 1-2 letters per word (skip words with 2 or fewer chars)
    const scrambleText = () => {
      const chars = text.split('')
      const upcoming = text.slice(cursor, cursor + 80)
      // Find word boundaries in the upcoming text
      const words = upcoming.match(/\S+/g) || []
      let offset = cursor
      for (const word of words) {
        const wordStart = text.indexOf(word, offset)
        if (wordStart === -1) continue
        offset = wordStart + word.length

        // Skip short words (1-2 chars)
        if (word.length <= 2) continue

        // Pick 1-2 random positions within this word to swap
        const swapCount = word.length >= 5 ? 2 : 1
        const positions = new Set<number>()
        while (positions.size < swapCount) {
          positions.add(Math.floor(Math.random() * word.length))
        }
        const pool = 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%'
        for (const pos of positions) {
          const charIdx = wordStart + pos
          // Replace with a random letter (not the same one)
          let replacement = pool[Math.floor(Math.random() * pool.length)]
          while (replacement === chars[charIdx]) {
            replacement = pool[Math.floor(Math.random() * pool.length)]
          }
          chars[charIdx] = replacement
        }
      }
      setScrambled(chars.join(''))
    }

    scrambleText()
    const interval = setInterval(scrambleText, 150)
    return () => clearInterval(interval)
  }, [active, text, cursor])

  return active ? scrambled : text
}

export const TypingArea = memo(function TypingArea({ text, player, isLocal, cursorOverride, errorIndex }: TypingAreaProps) {
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
}, (prev, next) => {
  // Only re-render when cursor, text, effects, or error actually change
  const prevCursor = prev.cursorOverride ?? prev.player.cursor
  const nextCursor = next.cursorOverride ?? next.player.cursor
  return (
    prev.text === next.text &&
    prevCursor === nextCursor &&
    prev.errorIndex === next.errorIndex &&
    prev.isLocal === next.isLocal &&
    prev.player.activeEffects.length === next.player.activeEffects.length &&
    prev.player.activeEffects.every((e, i) => e.abilityId === next.player.activeEffects[i]?.abilityId)
  )
})
