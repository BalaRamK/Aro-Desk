import { getAccounts } from '@/app/actions/dashboard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default async function AccountsListPage() {
  const accounts = await getAccounts()

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
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Account360
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          View and manage all customer accounts with hierarchical structure
        </p>
      </div>

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
                <TableHead>Account Name</TableHead>
                <TableHead>Hierarchy</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>ARR</TableHead>
                <TableHead>Health Score</TableHead>
                <TableHead>CSM</TableHead>
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
                          <Badge variant="outline">Parent</Badge>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
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
