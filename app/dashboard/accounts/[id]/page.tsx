import { getAccountDetails } from '@/app/actions/dashboard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { 
  Phone, Mail, Calendar, TrendingUp, TrendingDown, Activity,
  Building2, DollarSign, Users, Clock
} from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'

export default async function AccountDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  const data = await getAccountDetails(id)

  if (!data || !data.account) {
    notFound()
  }

  const { account, subsidiaries, journey, metrics } = data

  // Build hierarchy breadcrumb
  const hierarchyPath = account.hierarchy_path?.split('.') || []
  
  const getHealthColor = (score: number | null) => {
    if (!score) return 'bg-slate-100 text-slate-600'
    if (score >= 70) return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
    if (score >= 40) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
    return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
  }

  return (
    <div className="p-6 space-y-6">
      {/* Hierarchical Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/dashboard/accounts" className="hover:text-slate-700">
            Accounts
          </Link>
          {account.parent_name && (
            <>
              <span>/</span>
              <span>{account.parent_name}</span>
            </>
          )}
          <span>/</span>
          <span className="text-slate-900 dark:text-slate-100 font-medium">
            {account.name}
          </span>
        </div>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {account.name}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="outline">
                {account.current_stage || 'Not Set'}
              </Badge>
              <Badge className={account.parent_id ? 'bg-slate-500' : 'bg-blue-500'}>
                {account.parent_id ? 'Subsidiary' : 'Parent Account'}
              </Badge>
              <Badge variant={account.status === 'Active' ? 'default' : 'secondary'}>
                {account.status}
              </Badge>
            </div>
          </div>

          {/* Health Score Display */}
          <div className={`flex items-center justify-center w-24 h-24 rounded-full ${getHealthColor(account.overall_score)}`}>
            <div className="text-center">
              <div className="text-3xl font-bold">
                {account.overall_score || 'N/A'}
              </div>
              <div className="text-xs uppercase tracking-wide">
                Health
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - CRM Data & Metrics */}
        <div className="lg:col-span-2 space-y-6">
          {/* CRM Data Grid */}
          <Card>
            <CardHeader>
              <CardTitle>Account Overview</CardTitle>
              <CardDescription>CRM data and key metrics</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-500">Annual Recurring Revenue</p>
                  <p className="text-xl font-bold">
                    ${account.crm_attributes?.arr ? parseInt(account.crm_attributes.arr).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-500">Contract End Date</p>
                  <p className="text-xl font-bold">
                    {account.crm_attributes?.contract_end_date || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-500">Customer Success Manager</p>
                  <p className="text-lg font-semibold">
                    {account.csm_name || 'Unassigned'}
                  </p>
                  {account.csm_email && (
                    <p className="text-sm text-slate-500">{account.csm_email}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-500">Industry</p>
                  <p className="text-lg font-semibold">
                    {account.crm_attributes?.industry || 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Health Score Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Health Score Components</CardTitle>
              <CardDescription>
                Individual scores contributing to overall health
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Usage Score', value: account.usage_score, icon: Activity },
                { label: 'Engagement Score', value: account.engagement_score, icon: TrendingUp },
                { label: 'Support Score', value: account.support_score, icon: Phone },
                { label: 'Adoption Score', value: account.adoption_score, icon: Users },
              ].map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <span className="text-sm font-bold">{item.value || 'N/A'}</span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        (item.value || 0) >= 70 ? 'bg-green-500' :
                        (item.value || 0) >= 40 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${item.value || 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tabs for Journey History & Usage Metrics */}
          <Tabs defaultValue="journey" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="journey">Journey History</TabsTrigger>
              <TabsTrigger value="metrics">Usage Telemetry</TabsTrigger>
            </TabsList>

            <TabsContent value="journey">
              <Card>
                <CardHeader>
                  <CardTitle>Stage Transitions</CardTitle>
                  <CardDescription>
                    Historical journey through lifecycle stages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {journey.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-8">
                        No journey history recorded yet
                      </p>
                    ) : (
                      journey.map((entry) => (
                        <div key={entry.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                          <div className="flex-shrink-0 mt-1">
                            <Clock className="h-5 w-5 text-slate-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{entry.from_stage || 'Start'}</Badge>
                              <span className="text-slate-400">→</span>
                              <Badge>{entry.to_stage}</Badge>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                              {entry.notes || 'Stage transition'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {format(new Date(entry.entered_at), 'MMM dd, yyyy h:mm a')}
                              {entry.duration_days && ` • ${Math.round(entry.duration_days)} days in stage`}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="metrics">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Usage Metrics</CardTitle>
                  <CardDescription>
                    Product telemetry and activity data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {metrics.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-8">
                        No usage metrics recorded yet
                      </p>
                    ) : (
                      metrics.slice(0, 10).map((metric) => (
                        <div key={metric.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-3">
                            <Activity className="h-4 w-4 text-slate-400" />
                            <div>
                              <p className="text-sm font-medium">{metric.metric_type}</p>
                              <p className="text-xs text-slate-500">
                                {format(new Date(metric.recorded_at), 'MMM dd, yyyy h:mm a')}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-bold">{metric.metric_value}</span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Action Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Phone className="mr-2 h-4 w-4" />
                Log a Call
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="mr-2 h-4 w-4" />
                Schedule Meeting
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                Change Owner
              </Button>
            </CardContent>
          </Card>

          {/* Subsidiaries */}
          {subsidiaries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Subsidiaries</CardTitle>
                <CardDescription>
                  {subsidiaries.length} related {subsidiaries.length === 1 ? 'account' : 'accounts'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {subsidiaries.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/dashboard/accounts/${sub.id}`}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{sub.name}</p>
                      <p className="text-xs text-slate-500">{sub.current_stage}</p>
                    </div>
                    <Badge variant="outline">Level {sub.hierarchy_level}</Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Risk Alert */}
          {account.overall_score && account.overall_score < 50 && (
            <Card className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10">
              <CardHeader>
                <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2">
                  <TrendingDown className="h-5 w-5" />
                  At Risk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-red-600 dark:text-red-300">
                  This account requires immediate attention. Health score is below threshold.
                </p>
                <Button variant="destructive" className="w-full mt-4">
                  Create Success Plan
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
