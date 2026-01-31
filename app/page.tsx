'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useState, useEffect } from 'react'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { KpiEngine } from '@/lib/kpi-engine'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [clinics, setClinics] = useState<string[]>([])
  const [targetClinic, setTargetClinic] = useState('')
  const [compareClinic, setCompareClinic] = useState('')
  const [selectedYear, setSelectedYear] = useState(2025)
  const [selectedMonth, setSelectedMonth] = useState(6)
  const [activeTab, setActiveTab] = useState('profitability')
  const [targetData, setTargetData] = useState<any>(null)
  const [compData, setCompData] = useState<any>(null)
  const [prevData, setPrevData] = useState<any>(null)
  const [historyData, setHistoryData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // ログアウト処理
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.refresh()
    window.location.href = '/login'
  }

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.from('unique_clinic_options').select('clinic_name')
      const names = Array.from(new Set(data?.map(d => d.clinic_name))).sort()
      setClinics(names)
      if (names.length > 0) {
        setTargetClinic(names[0])
        setCompareClinic(names[1] || names[0])
      } else {
        setLoading(false)
      }
    }
    init()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      if (!targetClinic) return
      setLoading(true)
      const [targetRes, compRes, prevRes, historyRes] = await Promise.all([
        supabase.from('summarized_clinic_kpi').select('*').eq('clinic_name', targetClinic).eq('year', selectedYear).eq('month', selectedMonth).maybeSingle(),
        supabase.from('summarized_clinic_kpi').select('*').eq('clinic_name', compareClinic).eq('year', selectedYear).eq('month', selectedMonth).maybeSingle(),
        supabase.from('summarized_clinic_kpi').select('*').eq('clinic_name', targetClinic).eq('year', selectedYear).eq('month', selectedMonth - 1).maybeSingle(),
        supabase.from('summarized_clinic_kpi').select('*').eq('clinic_name', targetClinic).eq('year', selectedYear).order('month', { ascending: true })
      ])
      setTargetData(targetRes.data)
      setCompData(compRes.data)
      setPrevData(prevRes.data)
      setHistoryData(historyRes.data || [])
      setLoading(false)
    }
    fetchData()
  }, [targetClinic, compareClinic, selectedYear, selectedMonth])

  const DASHBOARD_TABS = [
    {
      id: 'profitability',
      label: '収益性',
      items: [
        { id: 'total_amount', label: '売上', unit: '円' },
        { id: 'recept_price', label: 'レセプト単価', unit: '円' },
        { id: 'avg_price', label: '平均単価', unit: '円' },
        { id: 'patients_count', label: '来院数', unit: '名' },
      ]
    },
    {
      id: 'booking',
      label: '予約精度',
      items: [
        { id: 'reserved_patients_count', label: '予約取得患者', unit: '名' },
        { id: 'reserved_rate', label: '予約率', unit: '%' },
        { id: 'today_cancel_count', label: '当日キャンセル数', unit: '件' },
        { id: 'today_cancel_rate', label: '当日キャンセル率', unit: '%' },
      ]
    }
  ]

  const chartData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const monthly = historyData.find(h => h.month === m);
    return { name: `${m}月`, 売上: monthly?.total_amount || 0, 来院人数: monthly?.patients_count || 0 };
  });

  if (loading && clinics.length === 0) return <div className="p-10 text-slate-400 font-black uppercase italic animate-pulse">Loading Dashboard...</div>

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8 font-sans relative">
      {/* ログアウトボタン */}
      <button 
        onClick={handleLogout} 
        className="fixed top-4 right-4 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-full text-xs font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all shadow-sm z-50"
      >
        ログアウト 🚪
      </button>

      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-wrap justify-between items-end bg-white p-8 rounded-3xl shadow-sm border border-slate-200 gap-6">
          <div className="flex gap-6 items-start">
            <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">KPI Dashboard</h1>
              <p className="text-xs font-bold text-slate-400 tracking-widest uppercase italic">Performance Report</p>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/staff" className="bg-blue-100 hover:bg-blue-200 text-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Staff View 👤</Link>
              <Link href="/admin" className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Admin ⚙️</Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <SelectBox label="Target Clinic" value={targetClinic} onChange={setTargetClinic} options={clinics} highlight />
            <SelectBox label="Compare Clinic" value={compareClinic} onChange={setCompareClinic} options={clinics} />
            <SelectBox label="Year" value={selectedYear} onChange={(v: any) => setSelectedYear(Number(v))} options={[2024, 2025]} />
            <SelectBox label="Month" value={selectedMonth} onChange={(v: any) => setSelectedMonth(Number(v))} options={Array.from({ length: 12 }, (_, i) => i + 1)} />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 italic">Trend Analysis</h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width=\"100%\" height=\"100%\">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray=\"3 3\" vertical={false} stroke=\"#f1f5f9\" />
                  <XAxis dataKey=\"name\" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <YAxis yAxisId=\"left\" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <YAxis yAxisId=\"right\" orientation=\"right\" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Bar yAxisId=\"left\" dataKey=\"売上\" fill=\"#e2e8f0\" radius={[4, 4, 0, 0]} />
                  <Line yAxisId=\"right\" type=\"monotone\" dataKey=\"来院人数\" stroke=\"#3b82f6\" strokeWidth={4} dot={{ r: 4, fill: '#3b82f6' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl text-white flex flex-col justify-center space-y-4">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 italic">Monthly Summary</div>
            <div className="text-5xl font-black tracking-tighter italic">
              {targetData?.total_amount ? `¥${(targetData.total_amount / 10000).toFixed(1)}M` : 'No Data'}
            </div>
            <div className="text-xs font-bold text-slate-400 leading-relaxed uppercase tracking-wider">
              Total revenue for {targetClinic} in {selectedMonth} / {selectedYear}. Performance is based on uploaded records.
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-1 bg-white w-fit rounded-2xl shadow-sm border border-slate-200 mb-6">
          {DASHBOARD_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {DASHBOARD_TABS.find(t => t.id === activeTab)?.items.map(kpi => {
            const val = targetData?.[kpi.id] || 0
            const compVal = compData?.[kpi.id] || 0
            const prevVal = prevData?.[kpi.id] || 0
            const isCountKpi = kpi.id.includes('count') || kpi.id === 'total_amount'
            const mom = KpiEngine.calcRatio(val, prevVal)

            return (
              <KpiCard
                key={kpi.id}
                label={kpi.label}
                value={val}
                unit={kpi.unit}
                forecast={0}
                compVal={compVal}
                achievement={mom}
                compareClinic={compareClinic}
                isCountKpi={isCountKpi}
                prevVal={prevVal}
                goalVal={0}
                mom={mom}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SelectBox({ label, value, onChange, options, highlight }: any) {
  return (
    <div className=\"flex flex-col gap-1\">
      <label className=\"text-[9px] font-black text-slate-400 uppercase tracking-widest\">{label}</label>
      <select 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className={`border-none rounded-2xl px-4 py-2.5 h-[42px] text-xs font-black outline-none cursor-pointer shadow-sm transition-all min-w-[160px] ${highlight ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
      >
        {options.map((opt: any) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  )
}