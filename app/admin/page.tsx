'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

import { DataUpload } from '@/components/admin/DataUpload'
import { GoalSetter } from '@/components/admin/GoalSetter'
import { DataEditor } from '@/components/admin/DataEditor'
import { MappingManager } from '@/components/admin/MappingManager'

export default function AdminPage() {
  const router = useRouter()
  // 認証情報 (corpId, mode) を取得
  const { corpId, mode, loading: authLoading } = useAuth()
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [activeMenu, setActiveMenu] = useState<'upload' | 'goals' | 'edit' | 'mapping'>('upload')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.refresh()
    window.location.href = '/login'
  }

  // ロード中または法人IDがない場合のガード
  if (authLoading) return <div className="p-10 text-slate-400 font-bold animate-pulse">Loading Admin...</div>
  if (!corpId) return <div className="p-10 text-red-500 font-bold">Access Denied: No Corporation ID found.</div>

  // マッピング機能は新心会(TN32FBH8)のみ表示
  const showMapping = corpId === 'TN32FBH8'

  return (
    <div className="flex min-h-screen bg-gray-100 text-slate-800 font-sans">
      <aside className="w-64 bg-slate-900 text-white flex flex-col p-6 shadow-xl shrink-0">
        <div className="mb-10 text-lg font-black text-blue-400 uppercase italic">Dental Admin</div>
        <nav className="space-y-2 flex-1">
          <MenuButton active={activeMenu === 'upload'} onClick={() => setActiveMenu('upload')} icon="📤" label="データアップロード" />
          <MenuButton active={activeMenu === 'goals'} onClick={() => setActiveMenu('goals')} icon="🎯" label="目標入力" />
          <MenuButton active={activeMenu === 'edit'} onClick={() => setActiveMenu('edit')} icon="📝" label="データ修正" />
          {/* 条件付きレンダリング: 特定法人以外にはボタン自体を表示しない */}
          {showMapping && (
            <MenuButton active={activeMenu === 'mapping'} onClick={() => setActiveMenu('mapping')} icon="🔗" label="マッピング" />
          )}
        </nav>
        <div className="pt-6 border-t border-slate-800"><Link href="/" className="text-xs font-bold text-slate-500 hover:text-white transition-colors">← Dashboard</Link></div>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{activeMenu} Mode</h2>
            <div className="flex gap-3 items-center">
              <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg">📊 画面を確認</Link>
              <button 
                onClick={handleLogout}
                className="bg-white border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-xs font-black hover:bg-red-50 hover:text-red-600 transition-all shadow-md cursor-pointer"
              >
                Logout 🚪
              </button>
            </div>
          </div>
          
          {/* corpId と mode を各コンポーネントに渡す */}
          {activeMenu === 'upload' && <DataUpload corpId={corpId} />}
          {activeMenu === 'goals' && <GoalSetter corpId={corpId} />}
          {activeMenu === 'edit' && <DataEditor corpId={corpId} mode={mode} />}
          
          {/* コンテンツ側でもガードをかける */}
          {activeMenu === 'mapping' && showMapping && <MappingManager corpId={corpId} />}
        </div>
      </main>
    </div>
  )
}

function MenuButton({ active, onClick, icon, label }: any) {
  return (<button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 cursor-pointer'}`}><span className="text-lg">{icon}</span>{label}</button>)
}