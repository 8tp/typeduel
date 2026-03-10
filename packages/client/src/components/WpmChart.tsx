import { useState, useRef, useCallback } from 'react'

interface WpmChartProps {
  data: number[]
  rawData?: number[]
  height?: number
}

export function WpmChart({ data, rawData, height = 48 }: WpmChartProps) {
  if (!data || data.length < 2) return null

  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null)

  const max = Math.max(...data, ...(rawData ?? []), 1)
  const padding = { top: 4, bottom: 4, left: 0, right: 0 }
  const chartH = height - padding.top - padding.bottom

  const getPoint = useCallback(
    (values: number[], i: number, w: number) => {
      const x = padding.left + (i / (values.length - 1)) * (w - padding.left - padding.right)
      const y = padding.top + chartH - (values[i] / max) * chartH
      return { x, y }
    },
    [max, chartH],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const w = rect.width
      const ratio = (mouseX - padding.left) / (w - padding.left - padding.right)
      const idx = Math.round(ratio * (data.length - 1))
      if (idx < 0 || idx >= data.length) {
        setHover(null)
        return
      }
      const pt = getPoint(data, idx, w)
      setHover({ idx, x: pt.x, y: pt.y })
    },
    [data, getPoint],
  )

  const buildPoints = (values: number[], w: number) =>
    values
      .map((_, i) => {
        const pt = getPoint(values, i, w)
        return `${pt.x},${pt.y}`
      })
      .join(' ')

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 200 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: `${height}px` }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        data-testid="wpm-sparkline"
      >
        {/* Raw WPM line (dimmer) */}
        {rawData && rawData.length >= 2 && (
          <polyline
            points={buildPoints(rawData, 200)}
            fill="none"
            stroke="#22c55e"
            strokeOpacity="0.2"
            strokeWidth="1"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Smoothed WPM line */}
        <polyline
          points={buildPoints(data, 200)}
          fill="none"
          stroke="#22c55e"
          strokeWidth="1.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Hover indicator */}
        {hover && (
          <>
            <line
              x1={getPoint(data, hover.idx, 200).x}
              y1={padding.top}
              x2={getPoint(data, hover.idx, 200).x}
              y2={height - padding.bottom}
              stroke="#22c55e"
              strokeOpacity="0.3"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={getPoint(data, hover.idx, 200).x}
              cy={getPoint(data, hover.idx, 200).y}
              r="3"
              fill="#22c55e"
              vectorEffect="non-scaling-stroke"
            />
            {rawData && rawData[hover.idx] !== undefined && (
              <circle
                cx={getPoint(rawData, hover.idx, 200).x}
                cy={getPoint(rawData, hover.idx, 200).y}
                r="2"
                fill="#22c55e"
                fillOpacity="0.4"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hover && (
        <div
          className="absolute pointer-events-none bg-gray-900/95 border border-green-500/30 rounded px-2 py-1 text-xs whitespace-nowrap z-10"
          style={{
            left: `${(getPoint(data, hover.idx, 100).x / 200) * 100}%`,
            top: '-2px',
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="text-green-400 font-bold">{data[hover.idx]} WPM</div>
          {rawData && rawData[hover.idx] !== undefined && rawData[hover.idx] !== data[hover.idx] && (
            <div className="text-green-400/50">{rawData[hover.idx]} raw</div>
          )}
          <div className="text-text/30">{hover.idx + 1}s</div>
        </div>
      )}
    </div>
  )
}
