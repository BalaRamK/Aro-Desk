'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MoreVertical } from 'lucide-react'
import { updateAccount, deleteAccount } from '@/app/actions/dashboard'

export function AccountActions({ account, allAccounts }: { account: any; allAccounts?: any[] }) {
  const router = useRouter()
  const [openEdit, setOpenEdit] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    name: account.name,
    arr: account.arr || '',
    status: account.status || 'Active',
    parent_id: account.parent_id || '',
  })

  async function handleUpdate() {
    setLoading(true)
    try {
      await updateAccount(account.id, {
        name: formData.name,
        arr: formData.arr ? Number(formData.arr) : null,
        status: formData.status,
        parent_id: formData.parent_id || null,
      })
      setOpenEdit(false)
      router.refresh()
    } catch (error) {
      console.error('Error updating account:', error)
      alert('Failed to update account')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setLoading(true)
    try {
      await deleteAccount(account.id)
      router.refresh()
    } catch (error) {
      console.error('Error deleting account:', error)
      alert('Failed to delete account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">Edit</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>Update account details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Account Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Account name"
              />
            </div>
            <div>
              <Label htmlFor="edit-arr">Annual Recurring Revenue (ARR)</Label>
              <Input
                id="edit-arr"
                type="number"
                value={formData.arr}
                onChange={(e) => setFormData({ ...formData, arr: e.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="edit-status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="AtRisk">At Risk</SelectItem>
                  <SelectItem value="Churned">Churned</SelectItem>
                  <SelectItem value="Prospect">Prospect</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {allAccounts && allAccounts.length > 0 && (
              <div>
                <Label htmlFor="edit-parent">Parent Account</Label>
                <Select value={formData.parent_id} onValueChange={(value) => setFormData({ ...formData, parent_id: value })}>
                  <SelectTrigger id="edit-parent">
                    <SelectValue placeholder="None - Root account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None - Root account</SelectItem>
                    {allAccounts
                      .filter(acc => acc.id !== account.id)
                      .map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name} {acc.arr ? `($${(acc.arr / 1000).toFixed(0)}k ARR)` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleUpdate} disabled={loading} className="w-full">
              {loading ? 'Updating...' : 'Update Account'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openDelete} onOpenChange={setOpenDelete}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">Delete</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{account.name}</strong>? This action cannot be undone. All journey history and health scores will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setOpenDelete(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={loading}
            >
              {loading ? 'Deleting...' : 'Delete Account'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
