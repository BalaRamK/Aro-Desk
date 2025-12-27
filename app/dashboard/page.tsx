import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  // Redirect to Executive Dashboard by default
  redirect('/dashboard/executive')
}
