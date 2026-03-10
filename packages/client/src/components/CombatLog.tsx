import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store'

export function CombatLog() {
  const combatLog = useGameStore(s => s.combatLog)
  const [collapsed, setCollapsed] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current && !collapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [combatLog, collapsed])

  return (
    <div className="fixed bottom-20 left-4 z-40 w-72">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="text-[10px] text-text/30 hover:text-text/60 transition-colors uppercase tracking-wider mb-1"
      >
        Combat Log {collapsed ? '[+]' : '[-]'}
        {collapsed && combatLog.length > 0 && (
          <span className="ml-1 text-accent/50">({combatLog.length})</span>
        )}
      </button>

      {!collapsed && (
        <div
          ref={scrollRef}
          className="bg-bg/90 border border-border rounded p-2 max-h-40 overflow-y-auto text-[11px] font-mono"
        >
          {combatLog.length === 0 && (
            <div className="text-text/20 italic">No events yet...</div>
          )}
          {combatLog.map(entry => (
            <div
              key={entry.id}
              className={`leading-tight mb-0.5 ${
                entry.color === 'green'
                  ? 'text-accent/70'
                  : entry.color === 'red'
                    ? 'text-damage/70'
                    : 'text-text/50'
              }`}
            >
              {entry.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
