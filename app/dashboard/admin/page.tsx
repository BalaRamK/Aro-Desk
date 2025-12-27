import { getJourneyStages } from '@/app/actions/dashboard'
import { getHealthScoreWeighting } from '@/app/actions/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StageDesigner } from '@/components/stage-designer'
import { HealthScoreWeighting } from '@/components/health-score-weighting'
import { MilestoneManager } from '@/components/milestone-manager'
import { Settings, Layers, Target } from 'lucide-react'

export default async function AdminPanelPage() {
  const [stages, weighting] = await Promise.all([
    getJourneyStages(),
    getHealthScoreWeighting()
  ])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Admin Panel
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Define the rules of engagement for your Customer Success platform
        </p>
      </div>

      <Tabs defaultValue="stages" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stages" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Stage Designer
          </TabsTrigger>
          <TabsTrigger value="milestones" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Milestones
          </TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Health Score
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stages" className="space-y-6">
          <StageDesigner stages={stages} />
        </TabsContent>

        <TabsContent value="milestones" className="space-y-6">
          <MilestoneManager stages={stages} />
        </TabsContent>

        <TabsContent value="health" className="space-y-6">
          <HealthScoreWeighting weighting={weighting} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
