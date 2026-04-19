'use client'

import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { RevenueTableView } from '@/components/admin/RevenueTableView'

export default function TableViewPage() {
  const router = useRouter()
  const { corpId, loading: authLoading } = useAuth()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.refresh()
    window.location.href = '/login'
  }

  if (authLoading) return <div className="p-10 text-slate-400 font-bold animate-pulse">Loading...</div>
  if (!corpId) return <div className="p-10 text-red-500 font-bold">Access Denied: No Corporation ID found.</div>

  // /table_view は FWLRNER6 専用
  if (corpId !== 'FWLRNER6') {
    return <div className="p-10 text-red-500 font-bold">このページはアクセス権限がありません。</div>
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <button
        onClick={handleLogout}
        className="fixed top-4 right-4 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-full text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-all shadow-sm z-50 cursor-pointer"
      >
        ログアウト 🚪
      </button>

      <div className="max-w-[1440px] mx-auto space-y-8">
        <header className="flex flex-wrap justify-between items-end bg-white p-8 rounded-3xl shadow-sm border border-slate-200 gap-4">
          <div className="flex gap-4 items-start">
            <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">Revenue Table</h1>
              <p className="text-xs font-bold text-slate-400 tracking-widest uppercase italic">売上テーブルビュー</p>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/" prefetch={false} className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Clinic View 🏥</Link>
              <Link href="/staff" prefetch={false} className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Staff View 👤</Link>
              <Link href="/admin" prefetch={false} className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Admin ⚙️</Link>
            </div>
          </div>
        </header>

        <RevenueTableView corpId={corpId} />
      </div>
    </div>
  )
}
