'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

import { DataUpload } from '@/components/admin/DataUpload'
import { GoalSetter } from '@/components/admin/GoalSetter'
import { DataEditor } from '@/components/admin/DataEditor'
import { MappingManager } from '@/components/admin/MappingManager'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Menu = 'upload' | 'goals' | 'edit' | 'mapping'

export default function AdminPage() {
  const [activeMenu, setActiveMenu] = useState<Menu>('upload')
  const [globalGoals, setGlobalGoals] = useState<any[]>([])

  const fetchGoals = async () => {
    const { data } = await supabase.from('flexible_kpis').select('*').eq('is_target', true).eq('clinic_name', 'GLOBAL')
    if (data) setGlobalGoals(data)
  }

  useEffect(() => { fetchGoals() }, [])

  return (
    <div className="flex min-h-screen bg-gray-100 text-slate-800 font-sans">
      <aside className="w-64 bg-slate-900 text-white flex flex-col p-6 shadow-xl shrink-0">
        <div className="mb-10 text-lg font-black text-blue-400 uppercase italic">Dental Admin</div>
        <nav className="space-y-2 flex-1">
          <MenuButton active={activeMenu === 'upload'} onClick={() => setActiveMenu('upload')} icon="📤" label="データアップロード" />
          <MenuButton active={activeMenu === 'goals'} onClick={() => setActiveMenu('goals')} icon="🎯" label="目標入力" />
          <MenuButton active={activeMenu === 'edit'} onClick={() => setActiveMenu('edit')} icon="📝" label="データ修正" />
          <MenuButton active={activeMenu === 'mapping'} onClick={() => setActiveMenu('mapping')} icon="🔗" label="マッピング" />
        </nav>
        <div className="pt-6 border-t border-slate-800"><Link href="/" className="text-xs font-bold text-slate-500 hover:text-white transition-colors">← Dashboard</Link></div>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{activeMenu} Mode</h2>
            <Link href="/" target="_blank" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg">📊 画面を確認</Link>
          </div>
          {activeMenu === 'upload' && <DataUpload />}
          {activeMenu === 'goals' && <GoalSetter goals={globalGoals} onUpdate={fetchGoals} />}
          {activeMenu === 'edit' && <DataEditor />}
          {activeMenu === 'mapping' && <MappingManager />}
        </div>
      </main>
    </div>
  )
}

function MenuButton({ active, onClick, icon, label }: any) {
  return (<button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 cursor-pointer'}`}><span className="text-lg">{icon}</span>{label}</button>)
}