'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'

const TRIGGER_TYPES = [
  { value: 'health_score_drop', label: 'Health Score Drops Below' },
  { value: 'stage_change', label: 'Account Moves to Stage' },
  { value: 'usage_decline', label: 'Usage Declining' },
  { value: 'support_spike', label: 'Support Ticket Spike' },
  { value: 'contract_approaching', label: 'Contract End Date Approaching' },
]

const ACTION_TYPES = [
  { value: 'slack_notification', label: 'Send Slack Notification' },
  { value: 'email_notification', label: 'Send Email Alert' },
  { value: 'create_task', label: 'Create CSM Task' },
  { value: 'escalate_to_manager', label: 'Escalate to Manager' },
  { value: 'webhook_call', label: 'Call External Webhook' },
]

interface Trigger {
  type: string
  params: Record<string, any>
}

interface Action {
  id: string
  type: string
  params: Record<string, any>
}

export function TriggerBuilder() {
  const [triggerType, setTriggerType] = useState<string>('')
  const [triggerParams, setTriggerParams] = useState<Record<string, any>>({})
  const [actions, setActions] = useState<Action[]>([])
  const [actionType, setActionType] = useState<string>('')
  const [actionParams, setActionParams] = useState<Record<string, any>>({})
  const [playbookName, setPlaybookName] = useState('')
  const [playbookDescription, setPlaybookDescription] = useState('')

  const handleAddAction = () => {
    if (!actionType) {
      alert('Please select an action type')
      return
    }

    const newAction: Action = {
      id: crypto.randomUUID(),
      type: actionType,
      params: actionParams
    }

    setActions([...actions, newAction])
    setActionType('')
    setActionParams({})
  }

  const handleRemoveAction = (id: string) => {
    setActions(actions.filter(a => a.id !== id))
  }

  const handleCreatePlaybook = async () => {
    if (!playbookName.trim()) {
      alert('Playbook name is required')
      return
    }

    if (!triggerType) {
      alert('Please select a trigger type')
      return
    }

    if (actions.length === 0) {
      alert('Please add at least one action')
      return
    }

    const playbookData = {
      name: playbookName,
      description: playbookDescription,
      trigger: {
        type: triggerType,
        params: triggerParams
      },
      actions: actions
    }

    console.log('Creating playbook:', playbookData)
    alert('Playbook created successfully! (Demo)')
  }

  const getTriggerParamFields = (type: string) => {
    switch (type) {
      case 'health_score_drop':
        return [
          { name: 'threshold', label: 'Health Score Threshold', type: 'number', placeholder: '50' },
          { name: 'duration', label: 'Time Window (hours)', type: 'number', placeholder: '24' }
        ]
      case 'stage_change':
        return [
          { name: 'stage', label: 'Stage Name', type: 'text', placeholder: 'e.g., At Risk' }
        ]
      case 'contract_approaching':
        return [
          { name: 'days_before', label: 'Days Before Expiration', type: 'number', placeholder: '30' }
        ]
      default:
        return []
    }
  }

  const getActionParamFields = (type: string) => {
    switch (type) {
      case 'slack_notification':
        return [
          { name: 'channel', label: 'Slack Channel', type: 'text', placeholder: '#success-alerts' },
          { name: 'message', label: 'Message', type: 'textarea', placeholder: 'Alert message...' }
        ]
      case 'email_notification':
        return [
          { name: 'recipients', label: 'Email Recipients (comma-separated)', type: 'text', placeholder: 'csm@example.com' },
          { name: 'subject', label: 'Email Subject', type: 'text', placeholder: 'Account Alert' }
        ]
      case 'webhook_call':
        return [
          { name: 'url', label: 'Webhook URL', type: 'text', placeholder: 'https://example.com/webhook' },
          { name: 'method', label: 'HTTP Method', type: 'text', placeholder: 'POST' }
        ]
      default:
        return []
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Playbook Configuration</CardTitle>
          <CardDescription>
            Create an "If-This-Then-That" automation workflow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Playbook Name */}
          <div className="space-y-2">
            <Label htmlFor="playbook-name">Playbook Name</Label>
            <Input
              id="playbook-name"
              value={playbookName}
              onChange={(e) => setPlaybookName(e.target.value)}
              placeholder="e.g., Health Score Alert"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="playbook-desc">Description</Label>
            <Textarea
              id="playbook-desc"
              value={playbookDescription}
              onChange={(e) => setPlaybookDescription(e.target.value)}
              placeholder="What does this playbook do?"
              rows={3}
            />
          </div>

          {/* Trigger Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold">IF THIS HAPPENS:</h3>
            </div>

            <div className="space-y-4 ml-7">
              <div className="space-y-2">
                <Label htmlFor="trigger">Trigger Type</Label>
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger id="trigger">
                    <SelectValue placeholder="Select a trigger..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic Trigger Params */}
              {getTriggerParamFields(triggerType).map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name}>{field.label}</Label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      id={field.name}
                      value={triggerParams[field.name] || ''}
                      onChange={(e) => setTriggerParams({
                        ...triggerParams,
                        [field.name]: e.target.value
                      })}
                      placeholder={field.placeholder}
                    />
                  ) : (
                    <Input
                      id={field.name}
                      type={field.type}
                      value={triggerParams[field.name] || ''}
                      onChange={(e) => setTriggerParams({
                        ...triggerParams,
                        [field.name]: field.type === 'number' ? parseInt(e.target.value) : e.target.value
                      })}
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <h3 className="font-semibold">THEN DO THIS:</h3>

            <div className="space-y-4 ml-4">
              {/* Add Action Form */}
              <div className="space-y-3 p-3 bg-white dark:bg-slate-800 rounded border">
                <div className="space-y-2">
                  <Label htmlFor="action">Action Type</Label>
                  <Select value={actionType} onValueChange={setActionType}>
                    <SelectTrigger id="action">
                      <SelectValue placeholder="Select an action..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dynamic Action Params */}
                {getActionParamFields(actionType).map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={`action-${field.name}`}>{field.label}</Label>
                    {field.type === 'textarea' ? (
                      <Textarea
                        id={`action-${field.name}`}
                        value={actionParams[field.name] || ''}
                        onChange={(e) => setActionParams({
                          ...actionParams,
                          [field.name]: e.target.value
                        })}
                        placeholder={field.placeholder}
                      />
                    ) : (
                      <Input
                        id={`action-${field.name}`}
                        type={field.type}
                        value={actionParams[field.name] || ''}
                        onChange={(e) => setActionParams({
                          ...actionParams,
                          [field.name]: e.target.value
                        })}
                        placeholder={field.placeholder}
                      />
                    )}
                  </div>
                ))}

                <Button onClick={handleAddAction} className="w-full" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Action
                </Button>
              </div>

              {/* Action List */}
              {actions.length > 0 && (
                <div className="space-y-2">
                  {actions.map((action) => (
                    <div
                      key={action.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded border"
                    >
                      <div>
                        <p className="font-medium">
                          {ACTION_TYPES.find(a => a.value === action.type)?.label}
                        </p>
                        {Object.keys(action.params).length > 0 && (
                          <p className="text-xs text-slate-500 mt-1">
                            {JSON.stringify(action.params)}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAction(action.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Create Button */}
          <Button 
            onClick={handleCreatePlaybook} 
            className="w-full" 
            size="lg"
            disabled={!playbookName || !triggerType || actions.length === 0}
          >
            Create Playbook
          </Button>
        </CardContent>
      </Card>

      {/* Preview */}
      {playbookName && triggerType && actions.length > 0 && (
        <Card className="border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/10">
          <CardHeader>
            <CardTitle className="text-green-700 dark:text-green-400">Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-semibold text-green-700 dark:text-green-400">
                {playbookName}
              </p>
              {playbookDescription && (
                <p className="text-green-600 dark:text-green-300 text-xs mt-1">
                  {playbookDescription}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <p className="font-semibold">When:</p>
              <code className="block bg-white dark:bg-slate-800 p-2 rounded text-xs overflow-auto">
                {TRIGGER_TYPES.find(t => t.value === triggerType)?.label}
              </code>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">Execute:</p>
              <div className="space-y-1">
                {actions.map((action) => (
                  <code key={action.id} className="block bg-white dark:bg-slate-800 p-2 rounded text-xs">
                    {ACTION_TYPES.find(a => a.value === action.type)?.label}
                  </code>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
