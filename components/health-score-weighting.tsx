'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Activity } from 'lucide-react'

interface HealthScoreWeightingProps {
  weighting: {
    usage_weight: number
    engagement_weight: number
    support_weight: number
    adoption_weight: number
  }
}

export function HealthScoreWeighting({ weighting: initialWeighting }: HealthScoreWeightingProps) {
  const [weights, setWeights] = useState({
    usage: initialWeighting.usage_weight * 100,
    engagement: initialWeighting.engagement_weight * 100,
    support: initialWeighting.support_weight * 100,
    adoption: initialWeighting.adoption_weight * 100,
  })
  const [saved, setSaved] = useState(false)

  const total = weights.usage + weights.engagement + weights.support + weights.adoption
  const isValid = Math.abs(total - 100) < 0.1

  const handleChange = (field: keyof typeof weights, value: number) => {
    setWeights(prev => ({
      ...prev,
      [field]: Math.max(0, Math.min(100, value))
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!isValid) {
      alert('Weights must sum to 100%')
      return
    }

    try {
      // Save to server
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      alert('Failed to save weights')
    }
  }

  const components = [
    {
      key: 'usage' as const,
      label: 'Usage Score',
      description: 'Product engagement and feature adoption metrics',
      icon: '📊'
    },
    {
      key: 'engagement' as const,
      label: 'Engagement Score',
      description: 'Team collaboration and participation',
      icon: '👥'
    },
    {
      key: 'support' as const,
      label: 'Support Score',
      description: 'Support tickets and issue resolution',
      icon: '🆘'
    },
    {
      key: 'adoption' as const,
      label: 'Adoption Score',
      description: 'Feature and value realization progress',
      icon: '🚀'
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Health Score Configuration
        </CardTitle>
        <CardDescription>
          Adjust the weight of each component in your health score calculation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {components.map((component) => (
            <div key={component.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor={`weight-${component.key}`} className="font-medium text-slate-900 dark:text-slate-100">
                    {component.label}
                  </label>
                  <p className="text-sm text-slate-500">{component.description}</p>
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {weights[component.key].toFixed(1)}%
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  id={`weight-${component.key}`}
                  name={`weight_${component.key}`}
                  type="range"
                  min="0"
                  aria-label={`${component.label} weight percentage`}
                  max="100"
                  step="1"
                  value={weights[component.key]}
                  onChange={(e) => handleChange(component.key, parseFloat(e.target.value))}
                  className="flex-1"
                />
                <Input
                  id={`weight-number-${component.key}`}
                  name={`weight_number_${component.key}`}
                  type="number"
                  min="0"
                  max="100"
                  value={weights[component.key].toFixed(1)}
                  onChange={(e) => handleChange(component.key, parseFloat(e.target.value))}
                  className="w-20"
                  aria-label={`${component.label} weight percentage number input`}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Total Bar */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <Label className="font-semibold">Total Weight</Label>
            <span className={`font-bold ${isValid ? 'text-green-600' : 'text-red-600'}`}>
              {total.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${isValid ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(total, 100)}%` }}
            />
          </div>
          {!isValid && (
            <p className="text-xs text-red-600 mt-2">
              Weights must sum to exactly 100%
            </p>
          )}
        </div>

        {/* Preview */}
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Example Health Score Calculation:
          </p>
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center justify-between">
              <span>Usage (75) × {(weights.usage / 100).toFixed(2)}</span>
              <span>= {(75 * weights.usage / 100).toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Engagement (80) × {(weights.engagement / 100).toFixed(2)}</span>
              <span>= {(80 * weights.engagement / 100).toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Support (90) × {(weights.support / 100).toFixed(2)}</span>
              <span>= {(90 * weights.support / 100).toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Adoption (70) × {(weights.adoption / 100).toFixed(2)}</span>
              <span>= {(70 * weights.adoption / 100).toFixed(1)}</span>
            </div>
            <div className="border-t pt-2 flex items-center justify-between font-bold">
              <span>Health Score</span>
              <span>
                {(
                  75 * weights.usage / 100 +
                  80 * weights.engagement / 100 +
                  90 * weights.support / 100 +
                  70 * weights.adoption / 100
                ).toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={!isValid}
          className="w-full"
        >
          {saved ? '✓ Saved' : 'Save Configuration'}
        </Button>
      </CardContent>
    </Card>
  )
}
