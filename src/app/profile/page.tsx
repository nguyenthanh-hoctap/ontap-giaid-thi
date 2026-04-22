'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, User, Lock, Mail, CheckCircle } from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const [sendingReset, setSendingReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
    if (user) {
      setDisplayName(user.user_metadata?.full_name || user.user_metadata?.name || '')
    }
  }, [authLoading, user, router])

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    setSavingName(true)
    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName },
    })
    if (error) toast.error(error.message)
    else toast.success('Đã cập nhật tên hiển thị')
    setSavingName(false)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp')
      return
    }
    setSavingPassword(true)

    // Verify current password by re-signing in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: currentPassword,
    })
    if (signInError) {
      toast.error('Mật khẩu hiện tại không đúng')
      setSavingPassword(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) toast.error(error.message)
    else {
      toast.success('Đã đổi mật khẩu thành công')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSavingPassword(false)
  }

  async function handleResetPassword() {
    if (!user?.email) return
    setSendingReset(true)
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) toast.error(error.message)
    else {
      setResetSent(true)
      toast.success(`Đã gửi link đặt lại mật khẩu về ${user.email}`)
    }
    setSendingReset(false)
  }

  if (authLoading || !user) return null

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Thông tin tài khoản</h1>
          <p className="text-gray-500 text-sm mt-1">Quản lý thông tin và bảo mật tài khoản của bạn</p>
        </div>

        {/* Account info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="w-4 h-4" />
              Thông tin cá nhân
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg flex items-center gap-2 text-sm text-gray-600">
              <Mail className="w-4 h-4 shrink-0" />
              <span>{user.email}</span>
            </div>
            <form onSubmit={handleSaveName} className="space-y-4">
              <div>
                <Label htmlFor="displayName">Tên hiển thị</Label>
                <Input
                  id="displayName"
                  placeholder="Nhập tên của bạn"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={savingName} className="bg-indigo-600 hover:bg-indigo-700">
                {savingName && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Lưu thay đổi
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="w-4 h-4" />
              Đổi mật khẩu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="newPassword">Mật khẩu mới</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Ít nhất 6 ký tự"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={savingPassword} className="bg-indigo-600 hover:bg-indigo-700">
                {savingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Đổi mật khẩu
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500 mb-3">Quên mật khẩu hiện tại? Gửi link đặt lại về email.</p>
              {resetSent ? (
                <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  Đã gửi về {user.email}
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={handleResetPassword} disabled={sendingReset}>
                  {sendingReset && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Gửi link đặt lại mật khẩu
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
