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

// export default function StaffDashboard() {
//   const router = useRouter()
//   const { corpId, mode, loading: authLoading } = useAuth()

//   const supabase = createBrowserClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
//   )

//   const [staffOptions, setStaffOptions] = useState<{label: string, value: string, clinic: string}[]>([])
//   const [targetStaff, setTargetStaff] = useState('')
//   const [compareStaff, setCompareStaff] = useState('')
//   const [selectedYear, setSelectedYear] = useState(2025)
//   const [selectedMonth, setSelectedMonth] = useState(6)
//   const [activeTab, setActiveTab] = useState('profitability')
  
//   // 取得データを配列として保持するための初期化
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

//   // 元の正しい50音順ソート処理とラベル設定を完全復元
//   useEffect(() => {
//     if (authLoading || !corpId) return

//     const fetchData = async () => {
//       const { data } = await supabase
//         .from('unique_staff_options')
//         .select('staff_name, clinic_name')
//         .eq('corporation_id', corpId)
      
//       if (data) {
//         const sortedData = [...data].sort((a, b) => {
//           if (a.clinic_name !== b.clinic_name) {
//             return a.clinic_name.localeCompare(b.clinic_name, 'ja');
//           }
//           return a.staff_name.localeCompare(b.staff_name, 'ja');
//         });

//         const options = sortedData.map(d => ({
//           label: mode === 'single' ? d.staff_name : `${d.staff_name} / ${d.clinic_name}`,
//           value: d.staff_name,
//           clinic: d.clinic_name
//         }));
//         setStaffOptions(options);
        
//         if (options.length > 0) {
//           setTargetStaff(options[0].value);
//           setCompareStaff(options[1]?.value || options[0].value);
//         }
//       }
//       setLoading(false)
//     };
//     fetchData();
//   }, [corpId, authLoading, supabase, mode]);

//   useEffect(() => {
//     if (!targetStaff || !corpId) return;
//     setLoading(true);
    
//     const fetchData = async () => {
//       // 取得先を flexible_kpis に変更。staff_nameに不正な文字が混ざらないため正しく取得されます
//       const [targetRes, compRes, prevRes, historyRes] = await Promise.all([
//         supabase.from('flexible_kpis').select('*').eq('corporation_id', corpId).eq('staff_name', targetStaff).eq('year', selectedYear).eq('month', selectedMonth),
//         supabase.from('flexible_kpis').select('*').eq('corporation_id', corpId).eq('staff_name', compareStaff).eq('year', selectedYear).eq('month', selectedMonth),
//         supabase.from('flexible_kpis').select('*').eq('corporation_id', corpId).eq('staff_name', targetStaff).eq('year', selectedYear).eq('month', selectedMonth - 1),
//         supabase.from('flexible_kpis').select('*').eq('corporation_id', corpId).eq('staff_name', targetStaff).eq('year', selectedYear).order('month', { ascending: true })
//       ]);
      
//       setTargetData(targetRes.data || []);
//       setCompData(compRes.data || []);
//       setPrevData(prevRes.data || []);
//       setHistoryData(historyRes.data || []);
//       setLoading(false);
//     };
//     fetchData();
//   }, [targetStaff, compareStaff, selectedYear, selectedMonth, corpId, supabase]);

//   // KpiEngineを使用してグラフデータを計算
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
//   if (loading && staffOptions.length === 0) return <div className="p-10 text-slate-400 font-black uppercase italic animate-pulse">Loading Staff Analytics...</div>

//   return (
//     <div className="min-h-screen bg-slate-50 text-slate-900 p-8 font-sans relative">
//       <button 
//         onClick={handleLogout}
//         className="fixed top-4 right-4 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-full text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-all shadow-sm z-50 cursor-pointer"
//       >
//         ログアウト 🚪
//       </button>

//       <div className="max-w-7xl mx-auto space-y-8">
//         <header className="flex flex-wrap justify-between items-end bg-white p-8 rounded-3xl shadow-sm border border-slate-200 gap-4">
//           <div className="flex gap-4 items-start">
//             <div className="space-y-1">
//               <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">
//                 {mode === 'single' ? 'Staff Performance' : 'Staff Analytics'}
//               </h1>
//               <p className="text-xs font-bold text-slate-400 tracking-widest uppercase italic">Performance Report</p>
//             </div>
//             <div className="flex flex-col gap-2">
//               <Link href="/" className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Clinic View 🏥</Link>
//               <Link href="/admin" className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Admin ⚙️</Link>
//             </div>
//           </div>
          
//           <div className="flex flex-wrap gap-3 items-end">
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
//             <SelectBox label="対象スタッフ" value={targetStaff} onChange={setTargetStaff} options={staffOptions} highlight />
//             <SelectBox label="比較スタッフ" value={compareStaff} onChange={setCompareStaff} options={staffOptions} />
//           </div>
//         </header>

//         <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-[400px]" style={{ minHeight: '400px' }}>
//           <div style={{ width: '100%', height: '100%' }}>
//             <ResponsiveContainer width="100%" height="100%">
//               <ComposedChart data={chartData}>
//                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
//                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold', fill: '#94a3b8'}} />
//                 <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
//                 <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
//                 <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
//                 <Bar yAxisId="right" dataKey="来院人数" fill="#4185f4" radius={[4, 4, 0, 0]} barSize={40} />
//                 <Line yAxisId="left" type="linear" dataKey="売上" stroke="#ea4335" strokeWidth={3} dot={{r: 4, fill: '#ea4335'}} />
//               </ComposedChart>
//             </ResponsiveContainer>
//           </div>
//         </div>

//         <div className="flex gap-2 p-1 bg-slate-200/50 rounded-2xl w-fit">
//           {DASHBOARD_TABS.map(tab => (
//             <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{tab.label}</button>
//           ))}
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//           {DASHBOARD_TABS.find(t => t.id === activeTab)?.items.map(kpi => {
//             const val = KpiEngine.calc(targetData, kpi.id)
//             const compVal = KpiEngine.calc(compData, kpi.id)
//             const prevVal = KpiEngine.calc(prevData, kpi.id)
            
//             const isCountKpi = kpi.id.includes('count') || kpi.id === 'total_amount'
//             const mom = KpiEngine.calcRatio(val, prevVal)
            
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
//                 compareClinic={staffOptions.find(s => s.value === compareStaff)?.label || ''} 
//                 isCountKpi={isCountKpi}
//                 prevVal={prevVal}
//                 goalVal={0}
//                 mom={mom}
//                 mode={mode}
//               />
//             )
//           })}
//         </div>
//       </div>
//     </div>
//   )
// }

// // 元の正しいUIとvalue構造を完全復元
// function SelectBox({ label, value, onChange, options, highlight }: any) {
//     return (
//       <div className="flex flex-col gap-1">
//         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
//         <select 
//           value={value} 
//           onChange={e => onChange(e.target.value)} 
//           className={`border-none rounded-2xl px-4 py-2.5 h-[42px] text-xs font-black outline-none cursor-pointer shadow-sm transition-all w-[200px] max-w-[200px] overflow-hidden whitespace-nowrap ${highlight ? 'bg-sky-100 text-black' : 'bg-slate-100 text-slate-700'}`}
//         >
//           {options.map((opt: any) => (
//             <option key={opt.label} value={opt.value}>
//               {opt.label}
//             </option>
//           ))}
//         </select>
//       </div>
//     )
// }

'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useState, useEffect } from 'react'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { KpiEngine } from '@/lib/kpi-engine'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/context/AuthContext'

const DASHBOARD_TABS = [
  {
    id: 'profitability',
    label: '収益性',
    items: [
      { id: 'total_amount', label: '売上', unit: '円' },
      { id: 'avg_price_per_day', label: '1日平均単価', unit: '円' }, 
      { id: 'recept_price', label: 'レセプト単価', unit: '円' },
      { id: 'recept_count', label: 'レセプト数', unit: '件' },
      { id: 'avg_price', label: '平均単価', unit: '円' },
      { id: 'patients_count', label: '来院数', unit: '名' },
    ]
  },
  {
    id: 'booking',
    label: '予約精度',
    items: [
      { id: 'reserved_count', label: '当月の予約数', unit: '名' },
      { id: 'visit_rate', label: '来院率', unit: '%' },
      { id: 'next_reserve_count', label: '次回予約取得数', unit: '件' },
      { id: 'next_reserve_rate', label: '次回予約取得率', unit: '%' },
      { id: 'cancel_count', label: 'キャンセル数', unit: '件' },
      { id: 'cancel_rate', label: 'キャンセル率', unit: '%' },
      { id: 'today_cancel_count', label: '当日キャンセル数', unit: '件' },
      { id: 'today_cancel_rate', label: '当日キャンセル率', unit: '%' },
      { id: 'noshow_cancel_count', label: '無断キャンセル数', unit: '件' },
      { id: 'noshow_cancel_rate', label: '無断キャンセル率', unit: '%' },
      { id: 'prior_cancel_count', label: '事前キャンセル数', unit: '件' },
      { id: 'prior_cancel_rate', label: '事前キャンセル率', unit: '%' },
    ]
  },
  {
    id: 'utilization',
    label: 'メンテ・稼働・離脱',
    items: [
      { id: 'mente_count', label: 'メンテナンス数', unit: '件'},
      { id: 'mente_rate', label: 'メンテナンス率', unit: '%'},
      { id: 'churn_patients_count', label: '離脱数', unit: '名' },
      { id: 'churn_patients_rate', label: '離脱率', unit: '%' },
      { id: 'chair_util_rate', label: 'チェア稼働率', unit: '%' },
    ]
  }
]

export default function StaffDashboard() {
  const router = useRouter()
  const { corpId, mode, loading: authLoading } = useAuth()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [staffOptions, setStaffOptions] = useState<{label: string, value: string, clinic: string}[]>([])
  const [targetStaff, setTargetStaff] = useState('')
  const [compareStaff, setCompareStaff] = useState('')
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

    const fetchData = async () => {
      const { data } = await supabase
        .from('unique_staff_options')
        .select('staff_name, clinic_name')
        .eq('corporation_id', corpId)
      
      if (data) {
        const sortedData = [...data].sort((a, b) => {
          if (a.clinic_name !== b.clinic_name) {
            return a.clinic_name.localeCompare(b.clinic_name, 'ja');
          }
          return a.staff_name.localeCompare(b.staff_name, 'ja');
        });

        const options = sortedData.map(d => ({
          label: mode === 'single' ? d.staff_name : `${d.staff_name} / ${d.clinic_name}`,
          value: d.staff_name,
          clinic: d.clinic_name
        }));
        setStaffOptions(options);
        
        if (options.length > 0) {
          setTargetStaff(options[0].value);
          setCompareStaff(options[1]?.value || options[0].value);
        }
      }
      setLoading(false)
    };
    fetchData();
  }, [corpId, authLoading, supabase, mode]);

  useEffect(() => {
    if (!targetStaff || !corpId) return;
    setLoading(true);
    
    const fetchData = async () => {
      const [targetRes, compRes, prevRes, historyRes] = await Promise.all([
        supabase.from('flexible_kpis').select('*').eq('corporation_id', corpId).eq('staff_name', targetStaff).eq('year', selectedYear).eq('month', selectedMonth),
        supabase.from('flexible_kpis').select('*').eq('corporation_id', corpId).eq('staff_name', compareStaff).eq('year', selectedYear).eq('month', selectedMonth),
        supabase.from('flexible_kpis').select('*').eq('corporation_id', corpId).eq('staff_name', targetStaff).eq('year', selectedYear).eq('month', selectedMonth - 1),
        supabase.from('flexible_kpis').select('*').eq('corporation_id', corpId).eq('staff_name', targetStaff).eq('year', selectedYear).order('month', { ascending: true })
      ]);
      
      setTargetData(targetRes.data || []);
      setCompData(compRes.data || []);
      setPrevData(prevRes.data || []);
      setHistoryData(historyRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [targetStaff, compareStaff, selectedYear, selectedMonth, corpId, supabase]);

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
  if (loading && staffOptions.length === 0) return <div className="p-10 text-slate-400 font-black uppercase italic animate-pulse">Loading Staff Analytics...</div>

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8 font-sans relative">
      <button 
        onClick={handleLogout}
        className="fixed top-4 right-4 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-full text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-all shadow-sm z-50 cursor-pointer"
      >
        ログアウト 🚪
      </button>

      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-wrap justify-between items-end bg-white p-8 rounded-3xl shadow-sm border border-slate-200 gap-4">
          <div className="flex gap-4 items-start">
            <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">
                {mode === 'single' ? 'Staff Performance' : 'Staff Analytics'}
              </h1>
              <p className="text-xs font-bold text-slate-400 tracking-widest uppercase italic">Performance Report</p>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/" className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Clinic View 🏥</Link>
              <Link href="/admin" className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Admin ⚙️</Link>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3 items-end">
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
            <SelectBox label="対象スタッフ" value={targetStaff} onChange={setTargetStaff} options={staffOptions} highlight />
            <SelectBox label="比較スタッフ" value={compareStaff} onChange={setCompareStaff} options={staffOptions} />
          </div>
        </header>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-[400px]" style={{ minHeight: '400px' }}>
          <div style={{ width: '100%', height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold', fill: '#94a3b8'}} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                
                {/* 💡 凡例を追加 */}
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
                compareClinic={staffOptions.find(s => s.value === compareStaff)?.label || ''} 
                isCountKpi={isCountKpi}
                prevVal={prevVal}
                goalVal={0}
                mom={mom}
                mode={mode}
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
        <select 
          value={value} 
          onChange={e => onChange(e.target.value)} 
          className={`border-none rounded-2xl px-4 py-2.5 h-[42px] text-xs font-black outline-none cursor-pointer shadow-sm transition-all w-[200px] max-w-[200px] overflow-hidden whitespace-nowrap ${highlight ? 'bg-sky-100 text-black' : 'bg-slate-100 text-slate-700'}`}
        >
          {options.map((opt: any) => (
            <option key={opt.label} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    )
}