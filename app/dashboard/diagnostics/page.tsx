'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { diagnoseDatabaseState } from '@/app/actions/diagnostics'

export default function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function handleCheck() {
    setLoading(true)
    try {
      const result = await diagnoseDatabaseState()
      setDiagnostics(result)
    } catch (error) {
      setDiagnostics({ error: error instanceof Error ? error.message : 'Failed to fetch diagnostics' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Database Diagnostics</h1>
        <p className="text-slate-600 mt-1">Check what data exists in your database</p>
      </div>

      <Button onClick={handleCheck} disabled={loading} size="lg">
        {loading ? 'Checking...' : 'Check Database State'}
      </Button>

      {diagnostics && (
        <div className="space-y-4">
          {diagnostics.error ? (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-900">Error</CardTitle>
              </CardHeader>
              <CardContent className="text-red-800">
                {diagnostics.error}
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Tenant Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-sm">Tenant ID: {diagnostics.tenantId}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Accounts ({diagnostics.accountsCount})</CardTitle>
                  <CardDescription>Latest 10 accounts</CardDescription>
                </CardHeader>
                <CardContent>
                  {diagnostics.accountsCount === 0 ? (
                    <p className="text-sm text-slate-500">No accounts found</p>
                  ) : (
                    <div className="space-y-2">
                      {diagnostics.accounts.map((acc: any) => (
                        <div key={acc.id} className="text-sm p-2 bg-slate-50 rounded">
                          <div><strong>{acc.name}</strong></div>
                          <div className="text-slate-600">
                            ARR: ${acc.arr || 'N/A'} | Status: {acc.status} | Parent: {acc.parent_id ? 'Yes' : 'No'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Journey Stages ({diagnostics.stagesCount})</CardTitle>
                  <CardDescription>Latest 10 stages</CardDescription>
                </CardHeader>
                <CardContent>
                  {diagnostics.stagesCount === 0 ? (
                    <p className="text-sm text-slate-500">No journey stages found</p>
                  ) : (
                    <div className="space-y-2">
                      {diagnostics.stages.map((stage: any) => (
                        <div key={stage.id} className="text-sm p-2 bg-slate-50 rounded">
                          <strong>{stage.display_name}</strong> ({stage.stage})
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Health Scores ({diagnostics.healthScoresCount})</CardTitle>
                  <CardDescription>Latest 10 health records</CardDescription>
                </CardHeader>
                <CardContent>
                  {diagnostics.healthScoresCount === 0 ? (
                    <p className="text-sm text-slate-500">No health scores found</p>
                  ) : (
                    <div className="space-y-2">
                      {diagnostics.healthScores.map((score: any, idx: number) => (
                        <div key={idx} className="text-sm p-2 bg-slate-50 rounded">
                          <div><strong>Score: {score.overall_score}</strong></div>
                          <div className="text-slate-600">
                            Account ID: {score.account_id} | Calculated: {new Date(score.calculated_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Journey History ({diagnostics.journeyHistoryCount})</CardTitle>
                  <CardDescription>Latest 10 history entries</CardDescription>
                </CardHeader>
                <CardContent>
                  {diagnostics.journeyHistoryCount === 0 ? (
                    <p className="text-sm text-slate-500">No journey history found</p>
                  ) : (
                    <div className="space-y-2">
                      {diagnostics.journeyHistory.map((hist: any, idx: number) => (
                        <div key={idx} className="text-sm p-2 bg-slate-50 rounded">
                          <div className="text-slate-600">
                            Account ID: {hist.account_id} | Entered: {new Date(hist.entered_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  )
}
