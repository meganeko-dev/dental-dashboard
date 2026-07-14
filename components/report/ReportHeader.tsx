'use client'

import Link from 'next/link'

type Props = {
  corpName: string
  corpId: string
  mode: 'single' | 'multi'
  clinics: string[]
  targetClinic: string
  setTargetClinic: (v: string) => void
  rangeLabel: string
}

export default function ReportHeader({
  corpName, corpId, mode,
  clinics, targetClinic, setTargetClinic,
  rangeLabel,
}: Props) {
  return (
    <header className="flex flex-wrap justify-between items-end bg-white p-8 rounded-xl shadow-sm border border-slate-200 gap-6">
      <div className="flex gap-6 items-start">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">Report</h1>
          <p className="text-xs font-bold text-slate-400 tracking-widest uppercase italic">
            {corpName || `Corp ID: ${corpId}`}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/" prefetch={false} className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Clinic View 🏥</Link>
          <Link href="/staff" prefetch={false} className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Staff View 👤</Link>
          <Link href="/admin" prefetch={false} className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Admin ⚙️</Link>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">対象期間</label>
          <div className="flex gap-2 bg-slate-100 px-4 rounded-2xl h-[42px] items-center">
            <span className="text-xs font-black text-slate-700 tabular-nums">{rangeLabel}</span>
            <span className="text-[9px] font-bold text-slate-400">（過去24ヶ月）</span>
          </div>
        </div>
        {mode === 'multi' && (
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">対象クリニック</label>
            <select
              value={targetClinic}
              onChange={e => setTargetClinic(e.target.value)}
              className="border-none rounded-2xl px-4 py-2.5 h-[42px] text-xs font-black outline-none cursor-pointer shadow-sm bg-sky-100 text-black min-w-[200px]"
            >
              {clinics.map(c => <option key={c} value={c} className="text-slate-800">{c}</option>)}
            </select>
          </div>
        )}
      </div>
    </header>
  )
}
