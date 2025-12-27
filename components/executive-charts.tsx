'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts'
import { TrendingDown } from 'lucide-react'

const HEALTH_COLORS = {
  'Healthy': '#10b981',
  'At Risk': '#f59e0b',
  'Critical': '#ef4444',
}

interface HealthDistribution {
  health_category: string
  count: string
  percentage: string
}

interface PortfolioGrowth {
  date: string
  accounts: number
}

export function HealthPieChart({ data }: { data: HealthDistribution[] }) {
  const pieData = data.map(item => ({
    name: item.health_category,
    value: parseInt(item.count),
    percentage: parseFloat(item.percentage)
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Health Distribution</CardTitle>
        <CardDescription>Current portfolio health overview</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(props: any) => `${props.name}: ${props.percentage}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={HEALTH_COLORS[entry.name as keyof typeof HEALTH_COLORS]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function PortfolioGrowthChart({ data }: { data: PortfolioGrowth[] }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Portfolio Growth</CardTitle>
            <CardDescription>Account count over time</CardDescription>
          </div>
          <TrendingDown className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="accounts" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
