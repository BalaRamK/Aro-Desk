import { createAccount, getJourneyStages } from '@/app/actions/dashboard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const ACCOUNT_STATUS = ['Active', 'Onboarding', 'At Risk', 'Churned', 'Paused'] as const

export default async function NewAccountPage() {
  const stages = await getJourneyStages()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Add Customer</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Capture a new customer, set its lifecycle stage, and seed journey history.
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href="/dashboard/accounts">Cancel</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Details</CardTitle>
          <CardDescription>Required fields: name and lifecycle stage.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createAccount} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="name">
                  Account Name
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  placeholder="Acme Corp"
                  className="w-full rounded border px-3 py-2 bg-white dark:bg-slate-900"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="arr">
                  ARR (optional)
                </label>
                <input
                  id="arr"
                  name="arr"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="50000"
                  className="w-full rounded border px-3 py-2 bg-white dark:bg-slate-900"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="stage">
                  Lifecycle Stage
                </label>
                <select
                  id="stage"
                  name="stage"
                  required
                  className="w-full rounded border px-3 py-2 bg-white dark:bg-slate-900"
                  defaultValue=""
                >
                  <option value="" disabled>Select a stage</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.stage}>
                      {stage.display_name ?? stage.stage}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="status">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  className="w-full rounded border px-3 py-2 bg-white dark:bg-slate-900"
                  defaultValue="Active"
                >
                  {ACCOUNT_STATUS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit">Save Customer</Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/accounts">Back to list</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
