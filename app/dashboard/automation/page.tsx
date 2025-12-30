import { getPlaybooks, getWebhookQueue } from '@/app/actions/dashboard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TriggerBuilder } from '@/components/trigger-builder'
import { AIAutomationBuilder } from '@/components/ai-automation-builder'
import { AlertCircle, Zap, Clock, CheckCircle2, XCircle, Sparkles } from 'lucide-react'
import { format } from 'date-fns'

export default async function AutomationPanelPage() {
  const [playbooks, webhookQueue] = await Promise.all([
    getPlaybooks(),
    getWebhookQueue()
  ])

  const pendingWebhooks = webhookQueue.filter(w => w.status === 'pending')
  const successfulWebhooks = webhookQueue.filter(w => w.status === 'completed')
  const failedWebhooks = webhookQueue.filter(w => w.status === 'failed')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Automation Engine
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Create SuccessPlays to automate customer engagement and drive outcomes
        </p>
      </div>

      <Tabs defaultValue="playbooks" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="playbooks" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Playbooks
          </TabsTrigger>
          <TabsTrigger value="ai-builder" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Builder
          </TabsTrigger>
          <TabsTrigger value="triggers" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Trigger Builder
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Execution Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="playbooks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Playbooks</CardTitle>
              <CardDescription>
                Automated workflows that execute when trigger conditions are met
              </CardDescription>
            </CardHeader>
            <CardContent>
              {playbooks.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No playbooks configured yet. Create one using the AI Builder or Trigger Builder.
                </p>
              ) : (
                <div className="space-y-4">
                  {playbooks.map((playbook) => (
                    <div
                      key={playbook.id}
                      className="p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                            {playbook.name}
                          </h3>
                          {playbook.description && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                              {playbook.description}
                            </p>
                          )}
                        </div>
                        <Badge className={playbook.is_active ? 'bg-green-500' : 'bg-slate-500'}>
                          {playbook.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3 pt-3 border-t">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wider">
                            Total Executions
                          </p>
                          <p className="text-lg font-bold">
                            {playbook.total_executions || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wider">
                            Last 7 Days
                          </p>
                          <p className="text-lg font-bold">
                            {playbook.executions_last_7_days || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wider">
                            Last Executed
                          </p>
                          <p className="text-sm">
                            {playbook.last_executed_at 
                              ? format(new Date(playbook.last_executed_at), 'MMM dd, h:mm a')
                              : 'Never'
                            }
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t">
                        <p className="text-xs font-medium text-slate-500 mb-2">
                          Trigger Condition:
                        </p>
                        <code className="text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded block">
                          {JSON.stringify(playbook.trigger_criteria, null, 2)}
                        </code>
                      </div>

                      {playbook.webhook_url && (
                        <div className="pt-3 border-t">
                          <p className="text-xs font-medium text-slate-500 mb-2">
                            Webhook URL:
                          </p>
                          <code className="text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded block break-all">
                            {playbook.webhook_url}
                          </code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-builder" className="space-y-6">
          <AIAutomationBuilder />
        </TabsContent>

        <TabsContent value="triggers" className="space-y-6">
          <TriggerBuilder />
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          {/* Queue Status Summary */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  Pending
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingWebhooks.length}</div>
                <p className="text-xs text-slate-500">awaiting delivery</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Successful
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{successfulWebhooks.length}</div>
                <p className="text-xs text-slate-500">successfully delivered</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  Failed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{failedWebhooks.length}</div>
                <p className="text-xs text-slate-500">delivery failed</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Webhooks */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Webhook Queue</CardTitle>
              <CardDescription>
                All queued and completed webhook executions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Playbook</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Attempts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhookQueue.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                        No webhook executions recorded yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    webhookQueue.map((webhook) => (
                      <TableRow key={webhook.id}>
                        <TableCell className="font-medium">
                          {webhook.playbook_name || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          {webhook.account_name || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            webhook.status === 'pending' ? 'bg-yellow-500' :
                            webhook.status === 'completed' ? 'bg-green-500' :
                            'bg-red-500'
                          }>
                            {webhook.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {format(new Date(webhook.created_at), 'MMM dd, h:mm a')}
                        </TableCell>
                        <TableCell className="text-sm">
                          {webhook.attempts}/{webhook.max_attempts}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
