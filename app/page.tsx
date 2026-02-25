// 'use client'
// import { createBrowserClient } from '@supabase/ssr'
// import { useState, useEffect } from 'react'
// import { KpiCard } from '@/components/dashboard/KpiCard'
// import { KpiEngine } from '@/lib/kpi-engine'
// import Link from 'next/link'
// import { useRouter } from 'next/navigation'
// import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
// import { useAuth } from '@/context/AuthContext'

// const DASHBOARD_TABS = [
//   {
//     id: 'profitability',
//     label: '収益性',
//     items: [
//       { id: 'total_amount', label: '売上', unit: '円' },
//       { id: 'avg_price_per_day', label: '1日平均単価', unit: '円' }, // 💡 ここに追加
//       { id: 'recept_price', label: 'レセプト単価', unit: '円' },
//       { id: 'recept_count', label: 'レセプト数', unit: '件' },
//       { id: 'avg_price', label: '平均単価', unit: '円' },
//       { id: 'patients_count', label: '来院数', unit: '名' },
//     ]
//   },
//   {
//     id: 'booking',
//     label: '予約精度',
//     items: [
//       { id: 'reserved_count', label: '当月の予約数', unit: '名' },
//       { id: 'visit_rate', label: '来院率', unit: '%' },
//       { id: 'next_reserve_count', label: '次回予約取得数', unit: '件' },
//       { id: 'next_reserve_rate', label: '次回予約取得率', unit: '%' },
//       { id: 'cancel_count', label: 'キャンセル数', unit: '件' },
//       { id: 'cancel_rate', label: 'キャンセル率', unit: '%' },
//       { id: 'today_cancel_count', label: '当日キャンセル数', unit: '件' },
//       { id: 'today_cancel_rate', label: '当日キャンセル率', unit: '%' },
//       { id: 'noshow_cancel_count', label: '無断キャンセル数', unit: '件' },
//       { id: 'noshow_cancel_rate', label: '無断キャンセル率', unit: '%' },
//       { id: 'prior_cancel_count', label: '事前キャンセル数', unit: '件' },
//       { id: 'prior_cancel_rate', label: '事前キャンセル率', unit: '%' },
//     ]
//   },
//   {
//     id: 'utilization',
//     label: 'メンテ・稼働・離脱',
//     items: [
//       { id: 'mente_count', label: 'メンテナンス数', unit: '件'},
//       { id: 'mente_rate', label: 'メンテナンス率', unit: '%'},
//       // { id: 'util_rate', label: '稼働率', unit: '%' },
//       { id: 'churn_patients_count', label: '離脱数', unit: '名' },
//       { id: 'churn_patients_rate', label: '離脱率', unit: '%' },
//       { id: 'chair_util_rate', label: 'チェア稼働率', unit: '%' },
     
//     ]
//   }
// ]

// export default function Dashboard() {
//   const router = useRouter()
//   const { corpId, mode, loading: authLoading } = useAuth()
  
//   const supabase = createBrowserClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
//   )

//   const [clinics, setClinics] = useState<string[]>([])
//   const [targetClinic, setTargetClinic] = useState('')
//   const [compareClinic, setCompareClinic] = useState('')
//   const [selectedYear, setSelectedYear] = useState(2025)
//   const [selectedMonth, setSelectedMonth] = useState(6)
//   const [activeTab, setActiveTab] = useState('profitability')
  
//   // 取得したデータは配列になるため初期値を[]に
//   const [targetData, setTargetData] = useState<any[]>([])
//   const [compData, setCompData] = useState<any[]>([])
//   const [prevData, setPrevData] = useState<any[]>([])
//   const [historyData, setHistoryData] = useState<any[]>([])
//   const [loading, setLoading] = useState(true)

//   const handleLogout = async () => {
//     await supabase.auth.signOut()
//     router.refresh()
//     window.location.href = '/login'
//   }

//   useEffect(() => {
//     if (authLoading || !corpId) return

//     const init = async () => {
//       const { data } = await supabase
//         .from('unique_clinic_options')
//         .select('clinic_name')
//         .eq('corporation_id', corpId)
      
//       const names = Array.from(new Set(data?.map(d => d.clinic_name))).sort()
//       setClinics(names)
      
//       if (names.length > 0) {
//         setTargetClinic(names[0])
//         setCompareClinic(names[1] || names[0])
//       } else {
//         setLoading(false)
//       }
//     }
//     init()
//   }, [corpId, authLoading, supabase])

//   useEffect(() => {
//     if (!targetClinic || !corpId || authLoading) return
//     setLoading(true)

//     const fetchData = async () => {
//       // 取得先を flexible_kpis に変更し、複数行のデータを取得する
//       const [targetRes, compRes, prevRes, historyRes] = await Promise.all([
//         supabase.from('flexible_kpis').select('*').eq('corporation_id', corpId).eq('clinic_name', targetClinic).eq('year', selectedYear).eq('month', selectedMonth),
//         supabase.from('flexible_kpis').select('*').eq('corporation_id', corpId).eq('clinic_name', compareClinic).eq('year', selectedYear).eq('month', selectedMonth),
//         supabase.from('flexible_kpis').select('*').eq('corporation_id', corpId).eq('clinic_name', targetClinic).eq('year', selectedYear).eq('month', selectedMonth - 1),
//         supabase.from('flexible_kpis').select('*').eq('corporation_id', corpId).eq('clinic_name', targetClinic).eq('year', selectedYear).order('month', { ascending: true })
//       ])
      
//       setTargetData(targetRes.data || [])
//       setCompData(compRes.data || [])
//       setPrevData(prevRes.data || [])
//       setHistoryData(historyRes.data || [])
//       setLoading(false)
//     }
//     fetchData()
//   }, [targetClinic, compareClinic, selectedYear, selectedMonth, corpId, authLoading, supabase])

//   // グラフ用のデータも KpiEngine を使って月ごとに計算
//   const chartData = Array.from({ length: 12 }, (_, i) => {
//     const m = i + 1;
//     const monthlyData = historyData.filter(h => h.month === m);
//     return {
//       name: `${m}月`,
//       売上: KpiEngine.calc(monthlyData, 'total_amount'),
//       来院人数: KpiEngine.calc(monthlyData, 'patients_count')
//     };
//   });

//   if (authLoading) return <div className="p-10 text-slate-400 font-black uppercase italic animate-pulse">Authenticating...</div>
//   if (loading && clinics.length === 0) return <div className="p-10 text-slate-400 font-black uppercase italic animate-pulse">Loading Dashboard...</div>

//   return (
//     <div className="min-h-screen bg-slate-50 text-slate-900 p-8 font-sans relative">
//       <button 
//         onClick={handleLogout}
//         className="fixed top-4 right-4 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-full text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-all shadow-sm z-50 cursor-pointer"
//       >
//         ログアウト 🚪
//       </button>

//       <div className="max-w-7xl mx-auto space-y-8">
//         <header className="flex flex-wrap justify-between items-end bg-white p-8 rounded-3xl shadow-sm border border-slate-200 gap-6">
//           <div className="flex gap-6 items-start">
//             <div className="space-y-1">
//               <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">
//                 {mode === 'single' ? 'Clinic Analytics' : 'Group KPI Dashboard'}
//               </h1>
//               <p className="text-xs font-bold text-slate-400 tracking-widest uppercase italic tracking-widest">
//                 Corp ID: {corpId}
//               </p>
//             </div>
//             <div className="flex flex-col gap-2">
//               <Link href="/staff" className="bg-blue-100 hover:bg-blue-200 text-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Staff View 👤</Link>
//               <Link href="/admin" className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Admin ⚙️</Link>
//             </div>
//           </div>
//           <div className="flex flex-wrap gap-4 items-end">
//             <div className="flex flex-col gap-1">
//               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Period</label>
//               <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl h-[42px] items-center">
//                 <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none text-xs font-black px-3 focus:ring-0 outline-none cursor-pointer">
//                   {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}年</option>)}
//                 </select>
//                 <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent border-none text-xs font-black px-3 focus:ring-0 outline-none cursor-pointer">
//                   {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}月</option>)}
//                 </select>
//               </div>
//             </div>
//             {mode === 'multi' && (
//               <>
//                 <SelectBox label="対象クリニック" value={targetClinic} onChange={setTargetClinic} options={clinics} highlight />
//                 <SelectBox label="比較対象" value={compareClinic} onChange={setCompareClinic} options={clinics} />
//               </>
//             )}
//           </div>
//         </header>

//         <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-80">
//           <ResponsiveContainer width="100%" height="100%">
//             <ComposedChart data={chartData}>
//               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
//               <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold', fill: '#94a3b8'}} />
//               <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
//               <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
//               <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
//               <Bar yAxisId="right" dataKey="来院人数" fill="#4185f4" radius={[4, 4, 0, 0]} barSize={40} />
//               <Line yAxisId="left" type="linear" dataKey="売上" stroke="#ea4335" strokeWidth={3} dot={{r: 4, fill: '#ea4335'}} />
//             </ComposedChart>
//           </ResponsiveContainer>
//         </div>

//         <div className="flex gap-2 p-1 bg-slate-200/50 rounded-2xl w-fit">
//           {DASHBOARD_TABS.map(tab => (
//             <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{tab.label}</button>
//           ))}
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//           {DASHBOARD_TABS.find(t => t.id === activeTab)?.items.map(kpi => {
//             // ■ KpiEngine.calc を使って配列データから目的の数値を計算
//             const val = KpiEngine.calc(targetData, kpi.id)
//             const compVal = KpiEngine.calc(compData, kpi.id)
//             const prevVal = KpiEngine.calc(prevData, kpi.id)
            
//             const isCountKpi = kpi.id.includes('count') || kpi.id === 'total_amount'
//             const mom = KpiEngine.calcRatio(val, prevVal)

//             // KpiEngine.calculateForecast を使用
//             const forecast = KpiEngine.calculateForecast(historyData, kpi.id, selectedYear, selectedMonth);

//             return (
//               <KpiCard
//                 key={kpi.id}
//                 label={kpi.label}
//                 value={val}
//                 unit={kpi.unit}
//                 forecast={forecast}
//                 compVal={compVal}
//                 achievement={mom}
//                 compareClinic={compareClinic}
//                 isCountKpi={isCountKpi}
//                 prevVal={prevVal}
//                 goalVal={0}
//                 mom={mom}
//                 mode={mode}
//                 hideCompare={mode === 'single'}
//               />
//             )
//           })}
//         </div>
//       </div>
//     </div>
//   )
// }

// function SelectBox({ label, value, onChange, options, highlight }: any) {
//   return (
//     <div className="flex flex-col gap-1">
//       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
//       <select value={value} onChange={e => onChange(e.target.value)} className={`border-none rounded-2xl px-4 py-2.5 h-[42px] text-xs font-black outline-none cursor-pointer shadow-sm transition-all min-w-[200px] ${highlight ? 'bg-sky-100 text-black' : 'bg-slate-100 text-slate-700'}`}>
//         {options.map((name: string) => <option key={name} value={name} className="text-slate-800">{name}</option>)}
//       </select>
//     </div>
//   )
// }

'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useState, useEffect } from 'react'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { KpiEngine } from '@/lib/kpi-engine'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
// 💡 Legend をインポートに追加
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useAuth } from '@/context/AuthContext'

const DASHBOARD_TABS = [
  {
    id: 'profitability',
    label: '収益性',
    items: [
      { id: 'total_amount', label: '売上', unit: '円' },
      { id: 'avg_price_per_day', label: '1日平均単価', unit: '円' },
      { id: 'recept_price', label: 'レセプト単価', unit: '円' },
      { id: 'avg_price', label: '平均単価', unit: '円' },
      { id: 'patients_count', label: '来院数', unit: '名' },
    ]
  },
  {
    id: 'booking',
    label: '予約精度',
    items: [
      { id: 'reserved_count', label: '予約数', unit: '名' },
      { id: 'visit_rate', label: '来院率', unit: '%' },
      { id: 'cancel_rate', label: 'キャンセル率', unit: '%' },
      { id: 'today_cancel_rate', label: '当日キャンセル率', unit: '%' },
      { id: 'noshow_cancel_rate', label: '無断キャンセル率', unit: '%' },
      { id: 'prior_cancel_rate', label: '事前キャンセル率', unit: '%' },
      { id: 'next_reserve_count', label: '次回予約取得数', unit: '件' },
      { id: 'next_reserve_rate', label: '次回予約取得率', unit: '%' },
    ]
  },
  {
    id: 'utilization',
    label: '稼働・離脱',
    items: [
      { id: 'chair_util_rate', label: 'チェア稼働率', unit: '%' },
      { id: 'util_rate', label: '稼働率', unit: '%' },
      { id: 'churn_patients_rate', label: '離脱率', unit: '%' },
      { id: 'churn_patients_count', label: '離脱患者数', unit: '名' },
    ]
  }
]

export default function Dashboard() {
  const router = useRouter()
  const { corpId, mode, loading: authLoading } = useAuth()
  
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
  
  const [targetData, setTargetData] = useState<any[]>([])
  const [compData, setCompData] = useState<any[]>([])
  const [prevData, setPrevData] = useState<any[]>([])
  const [historyData, setHistoryData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.refresh()
    window.location.href = '/login'
  }

  useEffect(() => {
    if (authLoading || !corpId) return

    const init = async () => {
      const { data } = await supabase
        .from('unique_clinic_options')
        .select('clinic_name')
        .eq('corporation_id', corpId)
      
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
  }, [corpId, authLoading, supabase])

  useEffect(() => {
    if (!targetClinic || !corpId || authLoading) return
    setLoading(true)

    const fetchData = async () => {
      const [targetRes, compRes, prevRes, historyRes] = await Promise.all([
        supabase.from('flexible_kpis').select('*').eq('corporation_id', corpId).eq('clinic_name', targetClinic).eq('year', selectedYear).eq('month', selectedMonth),
        supabase.from('flexible_kpis').select('*').eq('corporation_id', corpId).eq('clinic_name', compareClinic).eq('year', selectedYear).eq('month', selectedMonth),
        supabase.from('flexible_kpis').select('*').eq('corporation_id', corpId).eq('clinic_name', targetClinic).eq('year', selectedYear).eq('month', selectedMonth - 1),
        supabase.from('flexible_kpis').select('*').eq('corporation_id', corpId).eq('clinic_name', targetClinic).eq('year', selectedYear).order('month', { ascending: true })
      ])
      
      setTargetData(targetRes.data || [])
      setCompData(compRes.data || [])
      setPrevData(prevRes.data || [])
      setHistoryData(historyRes.data || [])
      setLoading(false)
    }
    fetchData()
  }, [targetClinic, compareClinic, selectedYear, selectedMonth, corpId, authLoading, supabase])

  const chartData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const monthlyData = historyData.filter(h => h.month === m);
    return {
      name: `${m}月`,
      売上: KpiEngine.calc(monthlyData, 'total_amount'),
      来院人数: KpiEngine.calc(monthlyData, 'patients_count'),
      次回予約取得率: KpiEngine.calc(monthlyData, 'next_reserve_rate'),
      キャンセル率: KpiEngine.calc(monthlyData, 'cancel_rate'),
      メンテナンス率: KpiEngine.calc(monthlyData, 'mente_rate'),
      離脱率: KpiEngine.calc(monthlyData, 'churn_patients_rate')
    };
  });

  if (authLoading) return <div className="p-10 text-slate-400 font-black uppercase italic animate-pulse">Authenticating...</div>
  if (loading && clinics.length === 0) return <div className="p-10 text-slate-400 font-black uppercase italic animate-pulse">Loading Dashboard...</div>

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8 font-sans relative">
      <button 
        onClick={handleLogout}
        className="fixed top-4 right-4 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-full text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-all shadow-sm z-50 cursor-pointer"
      >
        ログアウト 🚪
      </button>

      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-wrap justify-between items-end bg-white p-8 rounded-3xl shadow-sm border border-slate-200 gap-6">
          <div className="flex gap-6 items-start">
            <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">
                {mode === 'single' ? 'Clinic Analytics' : 'Group KPI Dashboard'}
              </h1>
              <p className="text-xs font-bold text-slate-400 tracking-widest uppercase italic tracking-widest">
                Corp ID: {corpId}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/staff" className="bg-blue-100 hover:bg-blue-200 text-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Staff View 👤</Link>
              <Link href="/admin" className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Admin ⚙️</Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Period</label>
              <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl h-[42px] items-center">
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none text-xs font-black px-3 focus:ring-0 outline-none cursor-pointer">
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}年</option>)}
                </select>
                <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent border-none text-xs font-black px-3 focus:ring-0 outline-none cursor-pointer">
                  {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}月</option>)}
                </select>
              </div>
            </div>
            {mode === 'multi' && (
              <>
                <SelectBox label="対象クリニック" value={targetClinic} onChange={setTargetClinic} options={clinics} highlight />
                <SelectBox label="比較対象" value={compareClinic} onChange={setCompareClinic} options={clinics} />
              </>
            )}
          </div>
        </header>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold', fill: '#94a3b8'}} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
              <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
              
              {/* 💡 グラフ上部に項目名（凡例）を追加 */}
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }} />

              {activeTab === 'profitability' && (
                <>
                  <Bar yAxisId="right" dataKey="来院人数" fill="#4185f4" radius={[4, 4, 0, 0]} barSize={40} />
                  <Line yAxisId="left" type="linear" dataKey="売上" stroke="#ea4335" strokeWidth={3} dot={{r: 4, fill: '#ea4335'}} />
                </>
              )}
              {activeTab === 'booking' && (
                <>
                  <Line yAxisId="left" type="linear" dataKey="次回予約取得率" stroke="#4185f4" strokeWidth={3} dot={{r: 4, fill: '#4185f4'}} />
                  <Line yAxisId="right" type="linear" dataKey="キャンセル率" stroke="#ea4335" strokeWidth={3} dot={{r: 4, fill: '#ea4335'}} />
                </>
              )}
              {activeTab === 'utilization' && (
                <>
                  <Line yAxisId="left" type="linear" dataKey="メンテナンス率" stroke="#34a853" strokeWidth={3} dot={{r: 4, fill: '#34a853'}} />
                  <Line yAxisId="right" type="linear" dataKey="離脱率" stroke="#fbbc04" strokeWidth={3} dot={{r: 4, fill: '#fbbc04'}} />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="flex gap-2 p-1 bg-slate-200/50 rounded-2xl w-fit">
          {DASHBOARD_TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{tab.label}</button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {DASHBOARD_TABS.find(t => t.id === activeTab)?.items.map(kpi => {
            const val = KpiEngine.calc(targetData, kpi.id)
            const compVal = KpiEngine.calc(compData, kpi.id)
            const prevVal = KpiEngine.calc(prevData, kpi.id)
            
            const isCountKpi = kpi.id.includes('count') || kpi.id === 'total_amount'
            const mom = KpiEngine.calcRatio(val, prevVal)

            const forecast = KpiEngine.calculateForecast(historyData, kpi.id, selectedYear, selectedMonth);

            return (
              <KpiCard
                key={kpi.id}
                label={kpi.label}
                value={val}
                unit={kpi.unit}
                forecast={forecast}
                compVal={compVal}
                achievement={mom}
                compareClinic={compareClinic}
                isCountKpi={isCountKpi}
                prevVal={prevVal}
                goalVal={0}
                mom={mom}
                mode={mode}
                hideCompare={mode === 'single'}
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
    <div className="flex flex-col gap-1">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={`border-none rounded-2xl px-4 py-2.5 h-[42px] text-xs font-black outline-none cursor-pointer shadow-sm transition-all min-w-[200px] ${highlight ? 'bg-sky-100 text-black' : 'bg-slate-100 text-slate-700'}`}>
        {options.map((name: string) => <option key={name} value={name} className="text-slate-800">{name}</option>)}
      </select>
    </div>
  )
}