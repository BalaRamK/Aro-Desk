import { getAccounts, getJourneyStages } from '@/app/actions/dashboard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AccountActions } from '@/components/account-manager'
import Link from 'next/link'
import { ChevronRight, Plus } from 'lucide-react'

export default async function AccountsListPage({ searchParams }: { searchParams?: Promise<{ q?: string; health?: string; stage?: string; start?: string; end?: string; range?: string }> }) {
  const sp = await searchParams ?? {}
  const filters: any = {}
  const rangeDays = sp.range ? parseInt(sp.range, 10) : null

  // Derive date range from quick picks if provided
  let startDate = sp.start || ''
  let endDate = sp.end || ''
  if (rangeDays && !Number.isNaN(rangeDays)) {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - (rangeDays - 1))
    startDate = start.toISOString().slice(0, 10)
    endDate = end.toISOString().slice(0, 10)
  }

  if (sp.q) filters.searchTerm = sp.q
  if (sp.health) filters.healthFilter = sp.health
  if (sp.stage) filters.stageFilter = sp.stage
  if (startDate) filters.startDate = startDate
  if (endDate) filters.endDate = endDate

  const [accounts, stages] = await Promise.all([
    getAccounts(filters),
    getJourneyStages()
  ])

  const getHealthColor = (score: number | null) => {
    if (!score) return 'text-slate-400'
    if (score >= 70) return 'text-green-600'
    if (score >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getHealthBadge = (score: number | null) => {
    if (!score) return <Badge variant="secondary">No Data</Badge>
    if (score >= 70) return <Badge className="bg-green-500">Healthy</Badge>
    if (score >= 40) return <Badge className="bg-yellow-500">At Risk</Badge>
    return <Badge variant="destructive">Critical</Badge>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Account360
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            View and manage all customer accounts with hierarchical structure
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/accounts/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Refine the list by name, health, stage, and date window</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="GET" className="grid gap-3 md:grid-cols-7 items-end">
            <div>
              <label className="text-xs text-slate-500">Search</label>
              <input name="q" defaultValue={sp.q || ''} placeholder="Account name or keyword" className="mt-1 w-full border rounded-md p-2 text-sm bg-white dark:bg-slate-900" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Health</label>
              <select name="health" defaultValue={sp.health || ''} className="mt-1 w-full border rounded-md p-2 text-sm bg-white dark:bg-slate-900">
                <option value="">Any</option>
                <option value="Healthy">Healthy</option>
                <option value="At Risk">At Risk</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Stage</label>
              <select name="stage" defaultValue={sp.stage || ''} className="mt-1 w-full border rounded-md p-2 text-sm bg-white dark:bg-slate-900">
                <option value="">Any</option>
                {stages.map((s:any) => (
                  <option key={s.id} value={s.stage}>{s.stage}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Start Date</label>
              <input type="date" name="start" defaultValue={startDate} className="mt-1 w-full border rounded-md p-2 text-sm bg-white dark:bg-slate-900" />
            </div>
            <div>
              <label className="text-xs text-slate-500">End Date</label>
              <input type="date" name="end" defaultValue={endDate} className="mt-1 w-full border rounded-md p-2 text-sm bg-white dark:bg-slate-900" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="text-xs text-slate-500 w-full">Quick ranges</div>
              {[
                { label: 'Last 7d', value: '7' },
                { label: 'Last 30d', value: '30' },
                { label: 'Last 90d', value: '90' },
              ].map((range) => (
                <button
                  key={range.value}
                  type="submit"
                  name="range"
                  value={range.value}
                  className={`border rounded-md px-3 py-2 text-sm ${sp.range === range.value ? 'bg-slate-200 dark:bg-slate-800' : ''}`}
                  title={`Set date window to ${range.label}`}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="border rounded-md px-3 py-2 text-sm">Apply</button>
              <Link href="/dashboard/accounts" className="border rounded-md px-3 py-2 text-sm">Reset</Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Accounts</CardTitle>
          <CardDescription>
            Click any account to view detailed health metrics, telemetry, and CRM data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead title="Click to open the account detail">Account Name</TableHead>
                <TableHead title="Parent/child positioning">Hierarchy</TableHead>
                <TableHead title="Latest lifecycle stage">Stage</TableHead>
                <TableHead title="Annual recurring revenue from CRM">ARR</TableHead>
                <TableHead title="Lifecycle-adjusted overall health">Health Score</TableHead>
                <TableHead title="Assigned customer success manager">CSM</TableHead>
                <TableHead className="w-20">Actions</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                  <TableCell>
                    <Link 
                      href={`/dashboard/accounts/${account.id}`}
                      className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      {account.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span style={{ paddingLeft: `${account.hierarchy_level * 16}px` }}>
                        {account.parent_id ? (
                          <>
                            <span className="text-slate-400">└─</span>
                            <span className="text-xs text-slate-500 ml-2">
                              under {account.parent_name}
                            </span>
                          </>
                        ) : (
                          <Badge variant="outline" title="Top-level parent account">Parent</Badge>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" title="Current lifecycle stage">
                      {account.current_stage || 'Not Set'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    ${account.crm_attributes?.arr ? parseInt(account.crm_attributes.arr).toLocaleString() : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${getHealthColor(account.overall_score)}`}>
                        {account.overall_score || 'N/A'}
                      </span>
                      {getHealthBadge(account.overall_score)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {account.csm_name || 'Unassigned'}
                  </TableCell>
                  <TableCell>
                    <AccountActions account={account} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/dashboard/accounts/${account.id}`}>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
