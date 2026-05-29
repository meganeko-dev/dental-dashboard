'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useState, useEffect, useMemo } from 'react'
import KpiCard from '@/components/dashboard/KpiCard'
import { KpiEngine } from '@/lib/kpi-engine'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/context/AuthContext'
import { isHiddenClinicByName } from '@/lib/hidden-clinics'

const RATE_KEYS = new Set([
  '次回予約取得率',
  'キャンセル率',
  'メンテナンス率',
  '未予約率',
  '離脱率',
])

const formatChartTooltipValue = (value: number, name: string) => {
  const formatted = Number(value).toLocaleString('ja-JP', { maximumFractionDigits: 2 })
  return RATE_KEYS.has(name) ? `${formatted}%` : formatted
}

const toPercentValue = (value: number) => {
  if (!Number.isFinite(value)) return 0
  return Math.abs(value) <= 1 ? value * 100 : value
}

const calcStaffReservedRate = (rows: any[]) => {
  const value = rows
    .filter(row => row.segment === 'staff' && row.kpi_name === '予約率')
    .reduce((sum, row) => sum + (Number(row.value) || 0), 0)

  return toPercentValue(value)
}

const calcStaffCardValue = (summaryRow: any, rawRows: any[], kpiId: string) =>
  kpiId === 'reserved_rate'
    ? calcStaffReservedRate(rawRows)
    : KpiEngine.calcFromSummarizedStaff(summaryRow, kpiId)

const calculateStaffForecast = (summaryRows: any[], rawRows: any[], kpiId: string, currentYear: number, currentMonth: number) => {
  if (kpiId !== 'reserved_rate') {
    return KpiEngine.calculateForecastFromSummarizedStaff(summaryRows, kpiId, currentYear, currentMonth)
  }

  const monthlyRows = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const rows = rawRows.filter(row => Number(row.month) === month)
    return { year: currentYear, month, value: calcStaffReservedRate(rows) }
  })
  const past = monthlyRows.filter(row => row.year < currentYear || (row.year === currentYear && row.month < currentMonth))
  const values = past.filter(row => row.value > 0).slice(-3)
  if (values.length === 0) return null
  return values.reduce((sum, row) => sum + row.value, 0) / values.length
}

const getCurrentJstPeriod = () => {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date())

  return {
    year: Number(parts.find(part => part.type === 'year')?.value),
    month: Number(parts.find(part => part.type === 'month')?.value),
  }
}

const DASHBOARD_TABS = [
  {
    id: 'profitability',
    label: '収益性',
    items: [
      { id: 'total_amount',                label: '売上',            unit: '円' },
      { id: 'avg_price_per_day',           label: '1日平均単価',     unit: '円' },
      { id: 'insurance_amount',            label: '保険売上',        unit: '円' },
      { id: 'insurance_avg_price_per_day', label: '保険1日平均単価', unit: '円' },
      { id: 'private_amount',              label: '自費売上',        unit: '円' },
      { id: 'private_avg_price_per_day',   label: '自費1日平均単価', unit: '円' },
      { id: 'recept_price',                label: 'レセプト単価',    unit: '円/点' },
      { id: 'recept_count',                label: 'レセプト数',      unit: '件' },
      { id: 'avg_price',                   label: '平均単価',        unit: '円' },
      { id: 'patients_count',              label: '来院数',          unit: '名' },
    ]
  },
  {
    id: 'booking',
    label: '予約精度',
    items: [
      { id: 'reserved_count',       label: '予約数',            unit: '名' },
      { id: 'reserved_rate',        label: '予約率',            unit: '%' },
      { id: 'patients_count',       label: '来院数',            unit: '名' },
      { id: 'visit_rate',           label: '来院率',            unit: '%' },
      { id: 'today_reserve_count',  label: '当日予約取得数',    unit: '件' },
      { id: 'today_reserve_rate',   label: '当日予約取得率',    unit: '%' },
      { id: 'cancel_count',         label: 'キャンセル数',      unit: '件' },
      { id: 'cancel_rate',          label: 'キャンセル率',      unit: '%' },
      { id: 'today_cancel_count',   label: '当日キャンセル数',  unit: '件' },
      { id: 'today_cancel_rate',    label: '当日キャンセル率',  unit: '%' },
      { id: 'noshow_cancel_count',  label: '無断キャンセル数',  unit: '件' },
      { id: 'noshow_cancel_rate',   label: '無断キャンセル率',  unit: '%' },
      { id: 'prior_cancel_count',   label: '事前キャンセル数',  unit: '件' },
      { id: 'prior_cancel_rate',    label: '事前キャンセル率',  unit: '%' },
    ]
  },
  {
    id: 'utilization',
    label: 'メンテ・稼働・離脱',
    items: [
      { id: 'mente_count',          label: 'メンテナンス数',    unit: '件' },
      { id: 'mente_rate',           label: 'メンテナンス率',    unit: '%' },
      { id: 'mente_count',          label: '初回メンテナンス数', unit: '件' },
      { id: 'new_patients_count',   label: '新患数',            unit: '件' },
      { id: 'churn_patients_count', label: '未予約数',          unit: '名' },
      { id: 'churn_patients_rate',  label: '未予約率',          unit: '%' },
      { id: 'churn_patients_count', label: '離脱数',            unit: '名' },
      { id: 'churn_patients_rate',  label: '離脱率',            unit: '%' },
    ]
  }
]

export default function StaffDashboard() {
  const router = useRouter()
  const { corpId, mode, loading: authLoading } = useAuth()
  const currentPeriod = useMemo(() => getCurrentJstPeriod(), [])

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), [])

  const [staffOptions, setStaffOptions] = useState<{label: string, value: string, clinic: string}[]>([])
  const [targetStaff, setTargetStaff] = useState('')
  const [compareStaff, setCompareStaff] = useState('')
  const [availablePeriods, setAvailablePeriods] = useState<{year: number, month: number}[]>([])
  const [selectedYear, setSelectedYear] = useState(currentPeriod.year)
  const [selectedMonth, setSelectedMonth] = useState(currentPeriod.month)
  const [activeTab, setActiveTab] = useState('profitability')

  const [goals, setGoals] = useState<Record<string, number>>({})
  const [targetData, setTargetData] = useState<any[]>([])
  const [compData, setCompData] = useState<any[]>([])
  const [prevData, setPrevData] = useState<any[]>([])
  const [lastYearData, setLastYearData] = useState<any[]>([])
  const [historyData, setHistoryData] = useState<any[]>([])
  const [targetRawData, setTargetRawData] = useState<any[]>([])
  const [compRawData, setCompRawData] = useState<any[]>([])
  const [prevRawData, setPrevRawData] = useState<any[]>([])
  const [lastYearRawData, setLastYearRawData] = useState<any[]>([])
  const [historyRawData, setHistoryRawData] = useState<any[]>([])
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
        .from('unique_staff_options')
        .select('staff_name, clinic_name')
        .eq('corporation_id', corpId)

      const { data: clinicData } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('corporation_id', corpId)
        .order('id', { ascending: true })

      if (data) {
        const clinicOrder = new Map((clinicData ?? []).map((clinic, index) => [clinic.name, index]))
        // ハードコードされた非表示クリニック (lib/hidden-clinics.ts) はスタッフ一覧からも除外
        const visibleData = data.filter(d => !isHiddenClinicByName(corpId, d.clinic_name))
        const sortedData = [...visibleData].sort((a, b) => {
          if (a.clinic_name !== b.clinic_name) {
            const aOrder = clinicOrder.get(a.clinic_name) ?? Number.MAX_SAFE_INTEGER
            const bOrder = clinicOrder.get(b.clinic_name) ?? Number.MAX_SAFE_INTEGER
            if (aOrder !== bOrder) return aOrder - bOrder
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

      const { data: goalData } = await supabase
        .from('data_mappings')
        .select('key, value')
        .eq('mapping_type', 'kpi_goal')
        .eq('corporation_id', corpId)

      const formattedGoals: Record<string, number> = {}
      goalData?.forEach(d => {
        formattedGoals[d.key] = Number(d.value)
      })
      setGoals(formattedGoals)

      const { data: periodData } = await supabase
        .from('summarized_staff_kpi')
        .select('year, month')
        .eq('corporation_id', corpId)
        .or('total_amount.gt.0,patients_count.gt.0')
        .order('year', { ascending: true })
        .order('month', { ascending: true })

      if (periodData && periodData.length > 0) {
        const periods = [...new Map(
          periodData.map(d => [`${d.year}-${d.month}`, { year: Number(d.year), month: Number(d.month) }])
        ).values()].sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
        setAvailablePeriods(periods)
      }

      setLoading(false)
    };
    init();
  }, [corpId, authLoading, supabase, mode]);

  useEffect(() => {
    if (!targetStaff || !corpId) return;
    setLoading(true);

    const fetchData = async () => {
      const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;

      const targetClinic = staffOptions.find(s => s.value === targetStaff)?.clinic || '';
      const compareClinic = staffOptions.find(s => s.value === compareStaff)?.clinic || '';

      const rawSelect = 'year, month, segment, staff_name, clinic_name, kpi_name, value'

      // summarized_staff_kpi は既存カード用、flexible_kpis は予約率カード用
      const [
        targetRes,
        compRes,
        prevRes,
        lastYearRes,
        historyRes,
        targetRawRes,
        compRawRes,
        prevRawRes,
        lastYearRawRes,
        historyRawRes,
      ] = await Promise.all([
        supabase.from('summarized_staff_kpi').select('*').eq('corporation_id', corpId).eq('staff_name', targetStaff).eq('clinic_name', targetClinic).eq('year', selectedYear).eq('month', selectedMonth),
        supabase.from('summarized_staff_kpi').select('*').eq('corporation_id', corpId).eq('staff_name', compareStaff).eq('clinic_name', compareClinic).eq('year', selectedYear).eq('month', selectedMonth),
        supabase.from('summarized_staff_kpi').select('*').eq('corporation_id', corpId).eq('staff_name', targetStaff).eq('clinic_name', targetClinic).eq('year', prevYear).eq('month', prevMonth),
        supabase.from('summarized_staff_kpi').select('*').eq('corporation_id', corpId).eq('staff_name', targetStaff).eq('clinic_name', targetClinic).eq('year', selectedYear - 1).eq('month', selectedMonth),
        supabase.from('summarized_staff_kpi').select('*').eq('corporation_id', corpId).eq('staff_name', targetStaff).eq('clinic_name', targetClinic).eq('year', selectedYear).order('month', { ascending: true }),
        supabase.from('flexible_kpis').select(rawSelect).eq('corporation_id', corpId).eq('staff_name', targetStaff).eq('clinic_name', targetClinic).eq('segment', 'staff').eq('is_target', false).eq('year', selectedYear).eq('month', selectedMonth).eq('kpi_name', '予約率'),
        supabase.from('flexible_kpis').select(rawSelect).eq('corporation_id', corpId).eq('staff_name', compareStaff).eq('clinic_name', compareClinic).eq('segment', 'staff').eq('is_target', false).eq('year', selectedYear).eq('month', selectedMonth).eq('kpi_name', '予約率'),
        supabase.from('flexible_kpis').select(rawSelect).eq('corporation_id', corpId).eq('staff_name', targetStaff).eq('clinic_name', targetClinic).eq('segment', 'staff').eq('is_target', false).eq('year', prevYear).eq('month', prevMonth).eq('kpi_name', '予約率'),
        supabase.from('flexible_kpis').select(rawSelect).eq('corporation_id', corpId).eq('staff_name', targetStaff).eq('clinic_name', targetClinic).eq('segment', 'staff').eq('is_target', false).eq('year', selectedYear - 1).eq('month', selectedMonth).eq('kpi_name', '予約率'),
        supabase.from('flexible_kpis').select(rawSelect).eq('corporation_id', corpId).eq('staff_name', targetStaff).eq('clinic_name', targetClinic).eq('segment', 'staff').eq('is_target', false).eq('year', selectedYear).eq('kpi_name', '予約率')
      ]);

      setTargetData(targetRes.data || []);
      setCompData(compRes.data || []);
      setPrevData(prevRes.data || []);
      setLastYearData(lastYearRes.data || []);
      setHistoryData(historyRes.data || []);
      setTargetRawData(targetRawRes.data || []);
      setCompRawData(compRawRes.data || []);
      setPrevRawData(prevRawRes.data || []);
      setLastYearRawData(lastYearRawRes.data || []);
      setHistoryRawData(historyRawRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [targetStaff, compareStaff, selectedYear, selectedMonth, corpId, supabase, staffOptions]);

  const availableYears = useMemo(() =>
    [...new Set([...availablePeriods.map(p => p.year), selectedYear])].sort((a, b) => a - b),
    [availablePeriods, selectedYear]
  )

  const availableMonths = useMemo(() =>
    [...new Set([
      ...availablePeriods.filter(p => p.year === selectedYear).map(p => p.month),
      selectedMonth,
    ])].sort((a, b) => a - b),
    [availablePeriods, selectedYear, selectedMonth]
  )

  const handleYearChange = (year: number) => {
    setSelectedYear(year)
    const months = availablePeriods.filter(p => p.year === year).map(p => p.month).sort((a, b) => a - b)
    if (months.length > 0 && !months.includes(selectedMonth)) {
      setSelectedMonth(months[months.length - 1])
    }
  }

  const chartData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const row = historyData.find(h => h.month === m) || null;
      return {
        name: `${m}月`,
        売上: KpiEngine.calcFromSummarizedStaff(row, 'total_amount'),
        来院人数: KpiEngine.calcFromSummarizedStaff(row, 'patients_count'),
        次回予約取得率: KpiEngine.calcFromSummarizedStaff(row, 'next_reserve_rate'),
        キャンセル率: KpiEngine.calcFromSummarizedStaff(row, 'cancel_rate'),
        メンテナンス率: KpiEngine.calcFromSummarizedStaff(row, 'mente_rate'),
        離脱率: KpiEngine.calcFromSummarizedStaff(row, 'churn_patients_rate'),
      };
    });
  }, [historyData]);

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
              <Link href="/" prefetch={false} className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Clinic View 🏥</Link>
              <Link href="/report" prefetch={false} className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Report 📑</Link>
              {corpId === 'FWLRNER6' && (
                <Link href="/table_view" prefetch={false} className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Table View 📊</Link>
              )}
              <Link href="/admin" prefetch={false} className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Admin ⚙️</Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Period</label>
              <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl h-[42px] items-center">
                <select value={selectedYear} onChange={e => handleYearChange(Number(e.target.value))} className="bg-transparent border-none text-xs font-black px-3 focus:ring-0 outline-none cursor-pointer">
                  {availableYears.map(y => <option key={y} value={y}>{y}年</option>)}
                </select>
                <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent border-none text-xs font-black px-3 focus:ring-0 outline-none cursor-pointer">
                  {availableMonths.map(m => <option key={m} value={m}>{m}月</option>)}
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
                <Tooltip
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  formatter={(value: number, name: string) => formatChartTooltipValue(value, name)}
                />
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
          {DASHBOARD_TABS.find(t => t.id === activeTab)?.items.map((kpi, idx) => {
            const targetRow   = targetData[0]   || null;
            const prevRow     = prevData[0]      || null;
            const lastYearRow = lastYearData[0]  || null;
            const compRow     = compData[0]      || null;

            const val           = calcStaffCardValue(targetRow,   targetRawData,   kpi.id);
            const prevVal       = calcStaffCardValue(prevRow,     prevRawData,     kpi.id);
            const lastYearVal   = calcStaffCardValue(lastYearRow, lastYearRawData, kpi.id);
            const compStaffVal  = calcStaffCardValue(compRow,     compRawData,     kpi.id);
            const goal          = goals[kpi.label] || 0;

            const finalCompVal   = mode === 'single' ? lastYearVal : compStaffVal;
            const finalCompLabel = mode === 'single' ? '前年同月' : (staffOptions.find(s => s.value === compareStaff)?.label || '');

            const mom         = KpiEngine.calcRatio(val, prevVal);
            const achievement = KpiEngine.calcRatio(val, goal);
            const forecast    = calculateStaffForecast(historyData, historyRawData, kpi.id, selectedYear, selectedMonth);

            return (
              <KpiCard
                key={`${kpi.id}-${idx}`}
                kpiId={kpi.id}
                label={kpi.label}
                value={val}
                unit={kpi.unit}
                forecast={forecast}
                compVal={finalCompVal}
                achievement={achievement}
                compareClinic={finalCompLabel}
                isCountKpi={true}
                prevVal={prevVal}
                goalVal={goal}
                mom={mom}
                mode={mode}
                hideCompare={false}
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
