'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { MailWarning, X } from 'lucide-react'

export function EmailVerifyBanner() {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [sending, setSending] = useState(false)

  if (!user || user.email_confirmed_at || dismissed) return null

  async function resend() {
    setSending(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email: user!.email! })
    if (error) toast.error(error.message)
    else toast.success(`Đã gửi lại email xác nhận về ${user!.email}`)
    setSending(false)
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm text-amber-800">
        <MailWarning className="w-4 h-4 shrink-0" />
        <span>Email <b>{user.email}</b> chưa được xác nhận.</span>
        <button
          onClick={resend}
          disabled={sending}
          className="underline font-medium hover:text-amber-900 disabled:opacity-50"
        >
          {sending ? 'Đang gửi...' : 'Gửi lại email xác nhận'}
        </button>
      </div>
      <button onClick={() => setDismissed(true)} className="text-amber-600 hover:text-amber-900 shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
