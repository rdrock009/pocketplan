import { memo, useMemo } from 'react'
import type { Paise } from '../finance'
import { money } from '../month/format'

interface Props {
  /** Array of daily closing cash values from the forecast */
  days: readonly { date: string; closingCash: Paise }[]
  /** Height of the chart in px */
  height?: number
}

/**
 * Inline SVG sparkline chart showing the daily forecast trajectory.
 * Uses no external charting library — pure SVG for minimal bundle impact.
 * Highlights the danger zone (negative balance) in red.
 */
export const ForecastChart = memo(function ForecastChart({ days, height = 180 }: Props) {
  const chartData = useMemo(() => {
    if (days.length < 2) return null
    const values = days.map(d => d.closingCash)
    const min = Math.min(...values, 0)
    const max = Math.max(...values, 1)
    const range = max - min || 1
    const width = 100
    const padding = 12

    const points = values.map((v, i) => ({
      x: padding + (i / (values.length - 1)) * (width - 2 * padding),
      y: padding + ((max - v) / range) * (height - 2 * padding),
    }))

    const firstPoint = points[0]
    const lastPoint = points[points.length - 1]
    if (!firstPoint || !lastPoint) return null

    const zeroY = padding + ((max - 0) / range) * (height - 2 * padding)
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
    const areaPath = `${linePath} L${lastPoint.x},${height - padding} L${firstPoint.x},${height - padding} Z`

    // Danger area (below zero)
    const dangerPoints = points.filter((_, i) => (values[i] ?? 0) < 0)

    return { points, linePath, areaPath, zeroY, min, max, width, padding, values, dangerPoints }
  }, [days, height])

  if (!chartData) {
    return <p className="empty-state">Not enough data to chart. At least 2 forecast days are needed.</p>
  }

  const startValue = chartData.values[0] ?? (0 as Paise)
  const endValue = chartData.values[chartData.values.length - 1] ?? (0 as Paise)

  return (
    <div className="forecast-chart" role="img" aria-label={`Forecast chart showing daily closing cash from ${money(startValue)} to ${money(endValue)}`}>
      <svg
        viewBox={`0 0 ${chartData.width} ${height}`}
        preserveAspectRatio="none"
        className="forecast-chart-svg"
        style={{ width: '100%', height: `${height}px` }}
      >
        <defs>
          <linearGradient id="forecast-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--green)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--green)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="danger-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--error)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--error)" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={chartData.areaPath} fill="url(#forecast-gradient)" />

        {/* Zero line */}
        {chartData.min < 0 && (
          <line
            x1={chartData.padding}
            x2={chartData.width - chartData.padding}
            y1={chartData.zeroY}
            y2={chartData.zeroY}
            stroke="var(--error)"
            strokeWidth="0.3"
            strokeDasharray="2,2"
            opacity="0.6"
          />
        )}

        {/* Danger zone fill */}
        {chartData.dangerPoints.length > 0 && (
          <rect
            x={chartData.padding}
            y={chartData.zeroY}
            width={chartData.width - 2 * chartData.padding}
            height={height - chartData.padding - chartData.zeroY}
            fill="url(#danger-gradient)"
          />
        )}

        {/* Main line */}
        <path
          d={chartData.linePath}
          fill="none"
          stroke="var(--green)"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Data points */}
        {chartData.points.map((p, i) => {
          const val = chartData.values[i] ?? (0 as Paise)
          const day = days[i]
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="1.2"
              fill={val < 0 ? 'var(--error)' : 'var(--green)'}
            >
              {day && <title>{day.date}: {money(day.closingCash)}</title>}
            </circle>
          )
        })}
      </svg>
      <div className="forecast-chart-labels">
        <span className="chart-label-max">{money(chartData.max as Paise)}</span>
        <span className="chart-label-min">{money(chartData.min as Paise)}</span>
      </div>
    </div>
  )
})
