import { getAccountsByStage } from '@/app/actions/dashboard'
import { JourneyKanbanClient } from '@/components/journey-kanban-client'

export default async function CustomerJourneyPage() {
  const { stages, accounts } = await getAccountsByStage()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Customer Journey
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Visualize account flow through lifecycle stages. Drag and drop to move accounts.
        </p>
      </div>

      <JourneyKanbanClient stages={stages} accounts={accounts} />
    </div>
  )
}
