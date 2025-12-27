import { getHealthDistribution, getRevenueAtRisk, getPortfolioGrowth } from '@/app/actions/dashboard'
import { listRecentCdiEvents } from '@/app/actions/customer_success'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { HealthPieChart, PortfolioGrowthChart } from '@/components/executive-charts'
import { DollarSign, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default async function ExecutiveDashboardPage({ searchParams }: { searchParams?: Promise<{ start?: string; end?: string; range?: string }> }) {
  const sp = await searchParams ?? {}
  const rangeDays = sp.range ? parseInt(sp.range, 10) : null

  let startDate = sp.start || ''
  let endDate = sp.end || ''
  if (rangeDays && !Number.isNaN(rangeDays)) {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - (rangeDays - 1))
    startDate = start.toISOString().slice(0, 10)
    endDate = end.toISOString().slice(0, 10)
  }

  const dateFilters = { startDate, endDate }

  const [healthDistribution, revenueAtRisk, portfolioGrowth, recentSignals] = await Promise.all([
    getHealthDistribution(dateFilters),
    getRevenueAtRisk(dateFilters),
    getPortfolioGrowth(90, dateFilters),
    listRecentCdiEvents(10)
  ])

  // Calculate total accounts and revenue metrics
  const totalAccounts = healthDistribution.reduce((sum, item) => sum + parseInt(item.count), 0)
  const criticalCount = healthDistribution.find(h => h.health_category === 'Critical')?.count || 0
  const totalRevAtRisk = revenueAtRisk.reduce((sum, acc) => sum + parseInt(acc.arr || '0'), 0)
  
  const healthyPercentage = healthDistribution.find(h => h.health_category === 'Healthy')
    ? ((parseInt(healthDistribution.find(h => h.health_category === 'Healthy')!.count) / totalAccounts) * 100).toFixed(0)
    : '0'

  // Prepare portfolio growth chart data
  const growthData = portfolioGrowth.map(row => ({
    date: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    accounts: parseInt(row.cumulative_count)
  }))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Executive Dashboard
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Command center for monitoring the health of your book of business
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
          <CardDescription>Limit metrics to a window (defaults to last 90 days)</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="GET" className="grid gap-3 md:grid-cols-4 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Start</label>
              <input type="date" name="start" defaultValue={startDate} className="mt-1 w-full border rounded-md p-2 text-sm bg-white dark:bg-slate-900" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">End</label>
              <input type="date" name="end" defaultValue={endDate} className="mt-1 w-full border rounded-md p-2 text-sm bg-white dark:bg-slate-900" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="text-xs text-muted-foreground w-full">Quick ranges</div>
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
            <div className="flex gap-2">
              <button type="submit" className="border rounded-md px-3 py-2 text-sm">Apply</button>
              <Link href="/dashboard/executive" className="border rounded-md px-3 py-2 text-sm">Reset</Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" title="Parent accounts only" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" title="Parent accounts in scope">{totalAccounts}</div>
            <p className="text-xs text-muted-foreground">
              {criticalCount} critical {criticalCount === '1' ? 'account' : 'accounts'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue at Risk</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" title="Accounts under $50 health" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(totalRevAtRisk / 1000).toFixed(0)}K
            </div>
            <p className="text-xs text-muted-foreground">
              From {revenueAtRisk.length} high-value accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthyPercentage}%
            </div>
            <p className="text-xs text-muted-foreground">
              Accounts in healthy state
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        <HealthPieChart data={healthDistribution} />
        <PortfolioGrowthChart data={growthData} />
      </div>

      {/* Revenue at Risk Table */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue at Risk</CardTitle>
          <CardDescription>
            High-value parent accounts with health scores below 50
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {revenueAtRisk.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No high-value accounts at risk. Great work! 🎉
              </p>
            ) : (
              revenueAtRisk.map((account) => (
                <Link 
                  key={account.id}
                  href={`/dashboard/accounts/${account.id}`}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {account.name}
                      </h3>
                      <Badge variant={
                        account.risk_level === 'Critical' ? 'destructive' :
                        account.risk_level === 'High' ? 'default' :
                        'secondary'
                      }>
                        {account.risk_level}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
                      <span>ARR: ${parseInt(account.arr).toLocaleString()}</span>
                      <span>•</span>
                      <span>Health: {account.overall_score}/100</span>
                      <span>•</span>
                      <span>CSM: {account.csm_name || 'Unassigned'}</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20">
                      <span className="text-xl font-bold text-red-600 dark:text-red-400">
                        {account.overall_score}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Signals (CDI) */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Signals</CardTitle>
          <CardDescription>Unified support, analytics, and CRM events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentSignals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent signals</p>
            ) : (
              recentSignals.map((s: any) => (
                <Link key={s.id} href={`/dashboard/accounts/${s.account_id}`} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{s.account_name || 'Unknown'} • {s.source_type} • {s.event_type}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.occurred_at).toLocaleString()}</p>
                  </div>
                  <Badge variant="outline">signal</Badge>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
