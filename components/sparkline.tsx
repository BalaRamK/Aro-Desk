'use client'

import React from 'react'

export function Sparkline({ data, width = 160, height = 40, stroke = '#3b82f6' }: { data: number[]; width?: number; height?: number; stroke?: string }) {
  if (!data || data.length === 0) {
    return <div className="text-xs text-slate-500">No data</div>
  }
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        points={points}
      />
    </svg>
  )
}

export function SentimentSparkline({ scores, width = 160, height = 40 }: { scores: number[]; width?: number; height?: number }) {
  const color = (val: number) => (val < -0.2 ? '#ef4444' : val > 0.2 ? '#10b981' : '#6b7280')
  if (!scores || scores.length === 0) return <div className="text-xs text-slate-500">No data</div>
  const max = Math.max(...scores)
  const min = Math.min(...scores)
  const range = max - min || 1
  const pts = scores.map((v, i) => {
    const x = (i / (scores.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return { x, y, v }
  })
  const path = pts.map(p => `${p.x},${p.y}`).join(' ')
  return (
    <svg width={width} height={height}>
      <polyline fill="none" stroke="#6b7280" strokeWidth={2} points={path} />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2} fill={color(p.v)} />
      ))}
    </svg>
  )
}

export function PlanProgress({ completed, total, width = 160, height = 8 }: { completed: number; total: number; width?: number; height?: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div style={{ width, height }} className="bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, height }} className="bg-green-500" />
      </div>
      <span className="text-xs text-slate-600 dark:text-slate-400">{completed}/{total}</span>
    </div>
  )
}
