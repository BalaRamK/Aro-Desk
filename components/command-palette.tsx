'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Search, Users, LayoutDashboard, Route, Settings, Zap } from 'lucide-react'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const navigate = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center w-full max-w-md px-3 py-2 text-sm text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
      >
        <Search className="mr-2 h-4 w-4" />
        <span>Search accounts, pages...</span>
        <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            <CommandItem onSelect={() => navigate('/dashboard/executive')}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Executive Dashboard</span>
            </CommandItem>
            <CommandItem onSelect={() => navigate('/dashboard/accounts')}>
              <Users className="mr-2 h-4 w-4" />
              <span>Account360</span>
            </CommandItem>
            <CommandItem onSelect={() => navigate('/dashboard/journey')}>
              <Route className="mr-2 h-4 w-4" />
              <span>Customer Journey</span>
            </CommandItem>
            <CommandItem onSelect={() => navigate('/dashboard/admin')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Admin Panel</span>
            </CommandItem>
            <CommandItem onSelect={() => navigate('/dashboard/automation')}>
              <Zap className="mr-2 h-4 w-4" />
              <span>Automation</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
