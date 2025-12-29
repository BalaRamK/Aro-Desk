'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Edit2, Trash2, GripVertical } from 'lucide-react'
import { updateJourneyStage, createJourneyStage, deleteJourneyStage } from '@/app/actions/admin'
import { useRouter } from 'next/navigation'

interface Stage {
  id: string
  name: string
  display_order: number
  target_duration_days: number
  color_hex: string
  account_count?: number
}

interface StageDesignerProps {
  stages: Stage[]
}

export function StageDesigner({ stages: initialStages }: StageDesignerProps) {
  const [stages, setStages] = useState(initialStages)
  const [open, setOpen] = useState(false)
  const [editingStage, setEditingStage] = useState<Stage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    targetDurationDays: 30,
    colorHex: '#3b82f6'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    if (!formData.name.trim()) {
      setError('Stage name is required')
      setLoading(false)
      return
    }

    try {
      if (editingStage) {
        // Update existing stage
        await updateJourneyStage(editingStage.id, {
          name: formData.name,
          targetDurationDays: formData.targetDurationDays,
          colorHex: formData.colorHex
        })
        setStages(stages.map(s => s.id === editingStage.id ? {
          ...s,
          name: formData.name,
          target_duration_days: formData.targetDurationDays,
          color_hex: formData.colorHex
        } : s))
      } else {
        // Create new stage
        const newStage = await createJourneyStage({
          name: formData.name,
          displayOrder: Math.max(...stages.map(s => s.display_order), 0) + 1,
          targetDurationDays: formData.targetDurationDays,
          colorHex: formData.colorHex
        })
        // Map DB columns to component interface
        const returnedStage = newStage as any
        setStages([...stages, {
          id: returnedStage.id,
          name: returnedStage.display_name || formData.name,
          display_order: returnedStage.display_order,
          target_duration_days: returnedStage.target_duration_days,
          color_hex: returnedStage.color_hex,
          account_count: 0
        }])
      }

      setOpen(false)
      setEditingStage(null)
      setFormData({ name: '', targetDurationDays: 30, colorHex: '#3b82f6' })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save stage')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (stage: Stage) => {
    setEditingStage(stage)
    setFormData({
      name: stage.name,
      targetDurationDays: stage.target_duration_days,
      colorHex: stage.color_hex
    })
    setOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this stage?')) {
      setLoading(true)
      try {
        await deleteJourneyStage(id)
        setStages(stages.filter(s => s.id !== id))
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete stage')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Journey Stages</CardTitle>
          <CardDescription>
            Create and customize the lifecycle stages for your accounts
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingStage(null)
              setFormData({ name: '', targetDurationDays: 30, colorHex: '#3b82f6' })
            }}>
              <Plus className="mr-2 h-4 w-4" />
              New Stage
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingStage ? 'Edit Stage' : 'Create New Stage'}
              </DialogTitle>
              <DialogDescription>
                Define a stage in your customer journey
              </DialogDescription>
            </DialogHeader>
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Stage Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Onboarding, Adoption"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetDays">Target Duration (days)</Label>
                <Input
                  id="targetDays"
                  type="number"
                  value={formData.targetDurationDays}
                  onChange={(e) => {
                    const v = parseInt(e.target.value)
                    setFormData({ ...formData, targetDurationDays: Number.isNaN(v) ? 1 : Math.max(1, v) })
                  }}
                  min="1"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="color"
                    type="color"
                    value={formData.colorHex}
                    onChange={(e) => setFormData({ ...formData, colorHex: e.target.value })}
                    className="h-10 w-20 cursor-pointer rounded border"
                    disabled={loading}
                  />
                  <span className="text-sm text-slate-500">{formData.colorHex}</span>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Saving...' : editingStage ? 'Update Stage' : 'Create Stage'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {stages.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              No stages created yet. Create your first stage to get started.
            </p>
          ) : (
            stages.map((stage) => (
              <div
                key={stage.id}
                className="flex items-center gap-4 p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <GripVertical className="h-5 w-5 text-slate-400 cursor-grab" />
                
                <div
                  className="w-4 h-4 rounded flex-shrink-0"
                  style={{ backgroundColor: stage.color_hex }}
                />
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {stage.name}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-500">
                      Target: {stage.target_duration_days} days
                    </span>
                    {stage.account_count && stage.account_count > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {stage.account_count} {stage.account_count === 1 ? 'account' : 'accounts'}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(stage)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(stage.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
