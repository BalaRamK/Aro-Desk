import { createTestHierarchyData } from '@/app/actions/test-data'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { redirect } from 'next/navigation'

async function handleCreateTestData() {
  'use server'
  const result = await createTestHierarchyData()
  redirect('/dashboard/accounts?testdata=created')
}

export default function TestDataPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Create Test Data</CardTitle>
          <CardDescription>
            Generate sample accounts with parent-child hierarchy and multi-dimensional health scores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="prose prose-sm">
            <h3 className="text-lg font-semibold mb-2">Test Data Overview</h3>
            <p className="text-sm text-slate-600 mb-4">
              This will create the following test accounts in your tenant:
            </p>
            
            <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-sm">
              <div className="font-semibold">Parent Account Hierarchy:</div>
              <ul className="ml-4 space-y-1">
                <li>🏢 <strong>Enterprise Corp (Parent)</strong> - $500k ARR, Health: 85</li>
                <li className="ml-6">└─ Enterprise Corp - North Region - $200k ARR, Health: 75</li>
                <li className="ml-6">└─ Enterprise Corp - South Region - $150k ARR, Health: 45 (At Risk)</li>
              </ul>
              
              <div className="font-semibold mt-4">Standalone Accounts:</div>
              <ul className="ml-4 space-y-1">
                <li>🚀 <strong>Startup Inc</strong> - $50k ARR, Health: 92 (Excellent)</li>
                <li>⚠️ <strong>TechCo Solutions</strong> - $120k ARR, Status: At Risk</li>
              </ul>
              
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <strong>Total Hierarchy ARR:</strong> $850k (Parent + Children)
              </div>
            </div>
            
            <h3 className="text-lg font-semibold mt-6 mb-2">Health Metrics Components</h3>
            <p className="text-sm text-slate-600 mb-2">
              Each account includes multi-dimensional health scores:
            </p>
            <ul className="text-sm text-slate-600 list-disc ml-6 space-y-1">
              <li>Product Usage Score</li>
              <li>Engagement Score</li>
              <li>Support Health Score</li>
              <li>Adoption Score</li>
              <li>Relationship Score</li>
            </ul>
          </div>
          
          <form action={handleCreateTestData}>
            <Button type="submit" className="w-full" size="lg">
              Create Test Data
            </Button>
          </form>
          
          <p className="text-xs text-slate-500 text-center">
            Note: If test data already exists, this action will be skipped.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
