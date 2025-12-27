'use client'

import React, { useTransition, useState } from 'react'
import { Button } from '@/components/ui/button'
import { triggerAiFollowUpAction } from '@/app/actions/customer_success'

export function SendReengagementEmailButton({ accountId, context }: { accountId: string; context?: Record<string, any> }) {
  const [isPending, startTransition] = useTransition()
  const [preview, setPreview] = useState<string>('')

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full justify-start"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await triggerAiFollowUpAction(accountId, context || {})
            if ((result as any).error) {
              alert((result as any).error)
              return
            }
            setPreview((result as any).email_body || '')
            alert('AI follow-up generated and logged')
          })
        }}
      >
        {isPending ? 'Generating…' : 'Send Re-engagement Email'}
      </Button>
      {preview && (
        <div className="text-xs p-2 border rounded-md bg-slate-50 dark:bg-slate-900/30">
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold">Preview</div>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(preview)
                  alert('Copied to clipboard')
                } catch (e) {
                  alert('Copy failed')
                }
              }}
            >Copy</Button>
          </div>
          <pre className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{preview}</pre>
        </div>
      )}
    </div>
  )
}
