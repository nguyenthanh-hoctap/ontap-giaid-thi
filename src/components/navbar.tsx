'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { BookOpen, LogOut, Home, HelpCircle } from 'lucide-react'

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
          <span className="hidden sm:inline">Ôn Tập Giải Đề</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <Home className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Trang chủ</span>
            </Button>
          </Link>
          <Link href="/huong-dan">
            <Button variant="ghost" size="sm">
              <HelpCircle className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Hướng dẫn</span>
            </Button>
          </Link>

          {!loading && (
            <>
              {user ? (
                <>
                  <Link href="/exams">
                    <Button variant="ghost" size="sm" className="hidden sm:flex">Đề của tôi</Button>
                  </Link>
                  <Link href="/profile">
                    <Button variant="ghost" size="sm" className="text-indigo-600 font-medium max-w-[160px] truncate">
                      {user.user_metadata?.full_name || user.email}
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Đăng xuất</span>
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
