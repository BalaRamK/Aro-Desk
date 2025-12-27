'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GripVertical, DollarSign } from 'lucide-react'
import Link from 'next/link'

interface KanbanCardProps {
  id: string
  name: string
  arr: string
  healthScore: number
  riskLevel: string
  csmName: string
}

export function KanbanCard({ 
  id, 
  name, 
  arr, 
  healthScore, 
  riskLevel,
  csmName 
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const getHealthColor = (score: number) => {
    if (score >= 70) return 'bg-green-500'
    if (score >= 40) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getRiskBadgeVariant = (risk: string) => {
    if (risk === 'Critical') return 'destructive'
    if (risk === 'High') return 'default'
    return 'secondary'
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="p-3 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start gap-2">
          {/* Drag Handle */}
          <button
            className="mt-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {/* Card Content */}
          <div className="flex-1 min-w-0">
            <Link 
              href={`/dashboard/accounts/${id}`}
              className="block hover:text-blue-600"
            >
              <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                {name}
              </h4>
            </Link>

            <div className="flex items-center gap-2 mt-2">
              <DollarSign className="h-3 w-3 text-slate-400" />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {arr ? `$${parseInt(arr).toLocaleString()}` : 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getHealthColor(healthScore)}`} />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {healthScore}
                </span>
              </div>
              <Badge variant={getRiskBadgeVariant(riskLevel)} className="text-xs">
                {riskLevel}
              </Badge>
            </div>

            <div className="text-xs text-slate-500 mt-2 truncate">
              CSM: {csmName || 'Unassigned'}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
