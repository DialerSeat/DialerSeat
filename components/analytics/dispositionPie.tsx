// =============================================================================
// THE DISPOSITION PIE, IN ONE PLACE
// =============================================================================
// This lived inside app/dashboard/analytics/page.tsx, where the team pages
// could not reach it — so the teams overview drew its own bar list instead and
// the same figure wore two different shapes depending on which screen you
// opened. Extracted rather than copied: 130 lines of label collision-avoidance
// is exactly the kind of thing that drifts once there are two of it.
//
// The palette is inlined rather than imported. The two pages have separate T
// objects with the same values for these five tokens, and importing one page's
// palette into a shared component would tie the component to whichever page
// happened to define it first.
// =============================================================================

const T = {
  text: '#1a1c24',
  accent: '#2a4a8a',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}

export const DISPOSITION_COLORS: Record<string, string> = {
  'CLOSED': T.green,
  'APPOINTMENT': T.accent,
  'NOT INTERESTED': T.amber,
  'DO NOT CALL': T.red,
  'SKIPPED': '#888',
  'NO ANSWER': '#bbb',
  'NO_ANSWER': '#bbb',
}

// Renders disposition-pie labels without letting them collide.
// Recharts' built-in `label` fn places every label at the same fixed
// radius using only that slice's own angle, so slices that are close
// together (lots of thin slivers) end up with overlapping text. This
// groups labels by which side of the pie they're on, spaces them out
// vertically so they never overlap, and draws a short leader line back
// to the slice so it's still clear which label belongs to which wedge.
export function renderDispositionLabels(props: {
  cx: number
  cy: number
  outerRadius: number
  index: number
  data: { disposition: string; count: number }[]
  chartHeight: number
}) {
  const { cx, cy, outerRadius, index, data, chartHeight } = props
  // Recharts invokes `label` once per slice. We only want to compute
  // and draw the *entire* label set a single time (on the first slice)
  // so labels don't get stacked on top of themselves N times.
  if (index !== 0) return null
  const total = data.reduce((sum, d) => sum + (d.count || 0), 0)
  if (total <= 0) return null

  const RADIAN = Math.PI / 180
  const labelRadius = outerRadius + 22
  const lineInnerRadius = outerRadius + 4
  const lineBendRadius = outerRadius + 16
  const lineHeight = 12 // min vertical spacing between stacked labels
  const fontSize = 11
  const chartMargin = 10 // keep labels this far from the chart's top/bottom edge

  // Compute each slice's midpoint angle exactly the way Recharts does
  // internally (verified against its own computePieSectors output): with
  // no startAngle/endAngle/paddingAngle/minAngle props set on <Pie>, the
  // first slice starts at raw angle 0 (screen: 3 o'clock) and each
  // subsequent slice's angle increases by its share of 360deg, which
  // sweeps counter-clockwise on screen. Getting this exact convention
  // right is what keeps the label leader lines landing on the true slice
  // instead of a mirrored/rotated position elsewhere on the pie.
  let cumulative = 0
  const items = data.map((d) => {
    const value = d.count || 0
    const fraction = value / total
    const startAngle = (cumulative / total) * 360
    cumulative += value
    const endAngle = (cumulative / total) * 360
    const midAngle = (startAngle + endAngle) / 2
    const angleRad = -midAngle * RADIAN
    const x = cx + labelRadius * Math.cos(angleRad)
    const y = cy + labelRadius * Math.sin(angleRad)
    const anchorX = cx + lineInnerRadius * Math.cos(angleRad)
    const anchorY = cy + lineInnerRadius * Math.sin(angleRad)
    const bendX = cx + lineBendRadius * Math.cos(angleRad)
    return {
      name: d.disposition,
      value,
      fraction,
      color: DISPOSITION_COLORS[d.disposition] || '#bbb',
      side: Math.cos(angleRad) >= 0 ? 'right' : 'left',
      x,
      y,
      anchorX,
      anchorY,
      bendX,
    }
  }).filter((it) => it.value > 0)

  // Resolve vertical overlaps independently on each side of the pie,
  // since labels on the left never collide with labels on the right.
  const sides: Array<typeof items> = [
    items.filter((it) => it.side === 'right').sort((a, b) => a.y - b.y),
    items.filter((it) => it.side === 'left').sort((a, b) => a.y - b.y),
  ]

  sides.forEach((group) => {
    if (group.length === 0) return
    // Capture each label's natural (pre-collision) y and their average —
    // this is the vertical center we want the final stack to sit on.
    const idealMid = group.reduce((s, it) => s + it.y, 0) / group.length

    // Push labels down if they're too close to the one above them.
    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1]
      const cur = group[i]
      if (cur.y - prev.y < lineHeight) {
        cur.y = prev.y + lineHeight
      }
    }

    // If every disposition has a label, a long stack can end up taller
    // than the chart itself. Rather than let it run off the top/bottom,
    // compress the spacing just enough for the whole stack to fit,
    // while still keeping strict top-to-bottom ordering (never re-overlaps).
    const availableHeight = chartHeight - 2 * chartMargin
    const stackHeight = group[group.length - 1].y - group[0].y
    if (stackHeight > availableHeight && group.length > 1) {
      const scale = availableHeight / stackHeight
      const base = group[0].y
      group.forEach((it) => { it.y = base + (it.y - base) * scale })
    }

    // Re-center the resulting stack on that original midpoint so it
    // doesn't drift toward the bottom of the chart.
    const first = group[0]
    const last = group[group.length - 1]
    const naturalMid = (first.y + last.y) / 2
    const shift = idealMid - naturalMid
    group.forEach((it) => { it.y += shift })

    // Final safety clamp: keep the whole stack within the chart bounds
    // even after re-centering, sliding it up/down as one unit.
    const top = group[0].y
    const bottom = group[group.length - 1].y
    if (top < chartMargin) {
      const nudge = chartMargin - top
      group.forEach((it) => { it.y += nudge })
    } else if (bottom > chartHeight - chartMargin) {
      const nudge = bottom - (chartHeight - chartMargin)
      group.forEach((it) => { it.y -= nudge })
    }
  })

  const dotRadius = 3

  return (
    <g>
      {items.map((it, i) => {
        const textAnchor = it.side === 'right' ? 'start' : 'end'
        const dotX = it.side === 'right' ? it.x + dotRadius : it.x - dotRadius
        const labelX = it.side === 'right' ? it.x + dotRadius * 2 + 4 : it.x - dotRadius * 2 - 4
        return (
          <g key={i}>
            <polyline
              points={`${it.anchorX},${it.anchorY} ${it.bendX},${it.y} ${it.x},${it.y}`}
              fill="none"
              stroke={it.color}
              strokeWidth={1.5}
            />
            <circle cx={dotX} cy={it.y} r={dotRadius} fill={it.color} />
            <text
              x={labelX}
              y={it.y}
              dy={4}
              textAnchor={textAnchor}
              fontSize={fontSize}
              fill={T.text}
            >
              {it.name}
            </text>
          </g>
        )
      })}
    </g>
  )
}
