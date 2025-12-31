import { redirect } from 'next/navigation'
import { getUserProfile, signOutAction } from '@/app/actions/auth-local'
import { isSuperAdmin } from '@/app/actions/admin'
import { getRecentAccounts } from '@/app/actions/dashboard'
import { 
  LayoutDashboard, 
  Users, 
  Route, 
  Settings, 
  Zap,
  Search,
  ChevronRight,
  Building2,
  LogOut,
  Database,
  Shield
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CommandPalette } from '@/components/command-palette'

const navigation = [
  { name: 'Executive Dashboard', href: '/dashboard/executive', icon: LayoutDashboard },
  { name: 'Account360', href: '/dashboard/accounts', icon: Users },
  { name: 'Customer Journey', href: '/dashboard/journey', icon: Route },
  { name: 'Integrations', href: '/dashboard/integrations', icon: Database },
  { name: 'CS Handbook', href: '/dashboard/admin', icon: Settings },
  { name: 'Automation', href: '/dashboard/automation', icon: Zap },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getUserProfile()
  const isAdmin = await isSuperAdmin()
  
  if (!profile) {
    redirect('/login')
  }

  const recentAccounts = await getRecentAccounts()

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-white dark:bg-slate-800 flex flex-col">
        {/* Logo */}
        <div className="h-16 border-b flex items-center px-6">
          <Building2 className="h-6 w-6 text-blue-600 mr-2" />
          <span className="font-bold text-lg">CS Platform</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          ))}

          {/* Recent Accounts Section */}
          <div className="pt-6">
            <div className="px-3 mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Recent Accounts
              </span>
            </div>
            <div className="space-y-1">
              {recentAccounts.map((account) => (
                <Link
                  key={account.id}
                  href={`/dashboard/accounts/${account.id}`}
                  className="flex items-center px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                      {account.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {account.current_stage}
                    </p>
                  </div>
                  <div className={`ml-2 flex-shrink-0 w-2 h-2 rounded-full ${
                    account.overall_score >= 70 ? 'bg-green-500' :
                    account.overall_score >= 40 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`} />
                </Link>
              ))}
            </div>
          </div>
        </nav>

        {/* User Section */}
        <div className="border-t p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center w-full px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {profile.full_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {profile.role}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{profile.full_name}</p>
                  <p className="text-xs text-muted-foreground">{profile.tenant?.name}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isAdmin && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="flex items-center">
                      <Shield className="mr-2 h-4 w-4" />
                      <span>Admin Account</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <form action={signOutAction} className="w-full">
                  <button type="submit" className="flex items-center w-full">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 border-b bg-white dark:bg-slate-800 flex items-center px-6">
          <div className="flex-1">
            <CommandPalette />
          </div>
          
          {/* Tenant Switcher (for multi-tenant admins) */}
          <div className="ml-4">
            <div className="flex items-center px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md">
              <Building2 className="h-4 w-4 mr-2" />
              {profile.tenant?.name}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
