'use client'

import { useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { KanbanColumn } from '@/components/kanban-column'
import { KanbanCard } from '@/components/kanban-card'
import { updateAccountStage } from '@/app/actions/dashboard'
import { useRouter } from 'next/navigation'

interface Account {
  id: string
  name: string
  current_stage: string
  arr: string
  overall_score: number
  risk_level: string
  csm_name: string
}

interface Stage {
  id: string
  name: string
  display_order: number
  target_duration_days: number
  color_hex: string
  account_count: number
  avg_duration_days: number
}

interface JourneyKanbanClientProps {
  stages: Stage[]
  accounts: Account[]
}

export function JourneyKanbanClient({ stages, accounts }: JourneyKanbanClientProps) {
  const [accountsState, setAccountsState] = useState(accounts)
  const router = useRouter()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over) return

    const activeAccount = accountsState.find((a) => a.id === active.id)
    if (!activeAccount) return

    const newStage = over.id as string

    if (activeAccount.current_stage === newStage) return

    // Optimistic update
    setAccountsState((prevAccounts) =>
      prevAccounts.map((acc) =>
        acc.id === activeAccount.id ? { ...acc, current_stage: newStage } : acc
      )
    )

    try {
      await updateAccountStage(activeAccount.id, newStage, `Moved from ${activeAccount.current_stage} to ${newStage} via Kanban`)
      router.refresh()
    } catch (error) {
      console.error('Failed to update account stage:', error)
      // Revert optimistic update
      setAccountsState((prevAccounts) =>
        prevAccounts.map((acc) =>
          acc.id === activeAccount.id ? { ...acc, current_stage: activeAccount.current_stage } : acc
        )
      )
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          // Match accounts using the canonical stage value, not display name
          const stageAccounts = accountsState.filter((acc) => acc.current_stage === stage.stage)
          
          return (
            <KanbanColumn
              key={stage.id}
              id={stage.stage}
              title={stage.name ?? stage.stage}
              count={stageAccounts.length}
              targetDays={stage.target_duration_days}
              avgDays={stage.avg_duration_days}
              color={stage.color_hex}
            >
              <SortableContext
                items={stageAccounts.map((acc) => acc.id)}
                strategy={verticalListSortingStrategy}
              >
                {stageAccounts.map((account) => (
                  <KanbanCard
                    key={account.id}
                    id={account.id}
                    name={account.name}
                    arr={account.arr}
                    healthScore={account.overall_score}
                    riskLevel={account.risk_level}
                    csmName={account.csm_name}
                  />
                ))}
              </SortableContext>
            </KanbanColumn>
          )
        })}
      </div>
    </DndContext>
  )
}
