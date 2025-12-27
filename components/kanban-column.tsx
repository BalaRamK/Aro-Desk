'use client'

import { useDroppable } from '@dnd-kit/core'
import { Clock, TrendingUp } from 'lucide-react'

interface KanbanColumnProps {
  id: string
  title: string
  count: number
  targetDays: number
  avgDays: number | null
  color: string
  children: React.ReactNode
}

export function KanbanColumn({ 
  id, 
  title, 
  count, 
  targetDays, 
  avgDays,
  color,
  children 
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div 
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 bg-white dark:bg-slate-800 rounded-lg border-2 transition-all ${
        isOver ? 'border-blue-500 shadow-lg' : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      {/* Column Header */}
      <div 
        className="p-4 border-b border-slate-200 dark:border-slate-700"
        style={{ 
          borderTopColor: color,
          borderTopWidth: '4px',
          borderTopLeftRadius: '0.5rem',
          borderTopRightRadius: '0.5rem'
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          <span className="text-sm font-medium text-slate-500">
            {count}
          </span>
        </div>
        
        {/* Velocity Metrics */}
        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Target: {targetDays}d</span>
          </div>
          {avgDays !== null && (
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span>Avg: {Math.round(avgDays)}d</span>
            </div>
          )}
        </div>
      </div>

      {/* Cards Container */}
      <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto">
        {children}
        {count === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-slate-400">
            No accounts in this stage
          </div>
        )}
      </div>
    </div>
  )
}
