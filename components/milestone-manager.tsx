'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit2, Trash2, CheckCircle, Circle } from 'lucide-react'
import { getStageMilestones, createMilestone, updateMilestone, deleteMilestone } from '@/app/actions/admin'

interface Stage {
  id: string
  name: string
  display_order: number
  target_duration_days: number
  color_hex: string
}

interface Milestone {
  id: string
  name: string
  description: string
  order: number
}

interface MilestoneManagerProps {
  stages: Stage[]
}

export function MilestoneManager({ stages }: MilestoneManagerProps) {
  const [selectedStageId, setSelectedStageId] = useState<string>(stages[0]?.id || '')
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [open, setOpen] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })

  const selectedStage = stages.find(s => s.id === selectedStageId)

  // Load milestones when stage changes
  async function loadMilestones(stageId: string) {
    try {
      const rows = await getStageMilestones(stageId)
      setMilestones(rows as any)
    } catch (err) {
      console.error('Failed to load milestones', err)
    }
  }

  // initial and on change load
  useEffect(() => {
    if (selectedStageId) loadMilestones(selectedStageId)
  }, [selectedStageId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      alert('Milestone name is required')
      return
    }

    try {
      if (editingMilestone) {
        await updateMilestone(editingMilestone.id, {
          name: formData.name,
          description: formData.description,
        })
      } else {
        const nextOrder = Math.max(...milestones.map(m => m.order), 0) + 1
        await createMilestone({
          stageId: selectedStageId,
          name: formData.name,
          description: formData.description,
          order: nextOrder,
        })
      }
      await loadMilestones(selectedStageId)
      setOpen(false)
      setEditingMilestone(null)
      setFormData({ name: '', description: '' })
    } catch (err) {
      alert('Failed to save milestone')
    }
  }

  const handleEdit = (milestone: Milestone) => {
    setEditingMilestone(milestone)
    setFormData({
      name: milestone.name,
      description: milestone.description
    })
    setOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this milestone?')) {
      try {
        await deleteMilestone(id)
        await loadMilestones(selectedStageId)
      } catch (err) {
        alert('Failed to delete milestone')
      }
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Stage Selection</CardTitle>
          <CardDescription>
            Select a stage to define its mandatory milestones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedStageId} onValueChange={setSelectedStageId}>
            <SelectTrigger id="milestone_stage" aria-labelledby="milestone_stage_label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: stage.color_hex }}
                    />
                    {stage.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedStage && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle id="milestone_stage_label">
                Milestones for {selectedStage.name}
              </CardTitle>
              <CardDescription>
                Define mandatory goals that accounts must complete in this stage
              </CardDescription>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingMilestone(null)
                  setFormData({ name: '', description: '' })
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Milestone
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingMilestone ? 'Edit Milestone' : 'Create New Milestone'}
                  </DialogTitle>
                  <DialogDescription>
                    for <strong>{selectedStage.name}</strong>
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="milestone_name">Milestone Name</Label>
                    <Input
                      id="milestone_name"
                      name="milestone_name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Complete training, Setup SSO"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="milestone_description">Description</Label>
                    <Textarea
                      id="milestone_description"
                      name="milestone_description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="What does successful completion look like?"
                      rows={4}
                      autoComplete="off"
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    {editingMilestone ? 'Update Milestone' : 'Create Milestone'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {milestones.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No milestones defined yet. Add your first milestone to get started.
                </p>
              ) : (
                milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="flex items-start gap-4 p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Circle className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {milestone.name}
                      </p>
                      {milestone.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          {milestone.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(milestone)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(milestone.id)}
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
      )}
    </div>
  )
}
