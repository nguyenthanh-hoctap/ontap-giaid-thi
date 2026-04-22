'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { BookOpen, LogOut, User, Settings } from 'lucide-react'

export function Navbar() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  async function handleSignOut() {
    await signOut()
    router.push('/')
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-indigo-600 text-lg">
          <BookOpen className="w-5 h-5" />
          Ôn Tập Giải Đề
        </Link>

        <div className="flex items-center gap-3">
          {!loading && (
            <>
              {user ? (
                <>
                  <Link href="/exams">
                    <Button variant="ghost" size="sm">Đề của tôi</Button>
                  </Link>
                  <Link href="/profile">
                    <Button variant="ghost" size="sm" className="hidden sm:flex items-center gap-1 text-gray-600">
                      <User className="w-4 h-4" />
                      {user.user_metadata?.full_name || user.email?.split('@')[0]}
                    </Button>
                  </Link>
                  <Link href="/profile">
                    <Button variant="ghost" size="sm" className="sm:hidden">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-1" />
                    Đăng xuất
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="ghost" size="sm">Đăng nhập</Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">Đăng ký</Button>
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
