'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useState, useEffect, useMemo } from 'react'
import KpiCard from '@/components/dashboard/KpiCard'
import { KpiEngine } from '@/lib/kpi-engine'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useAuth } from '@/context/AuthContext'
import { isHiddenClinicById } from '@/lib/hidden-clinics'
import { buildMonthRange } from '@/lib/report-kpi'

// 複合グラフの表示期間の起点 (2026-06-17 設定: 2025/1 固定)
const CHART_START_YEAR = 2025
const CHART_START_MONTH = 1

const DASHBOARD_TABS = [
  {
    id: 'profitability',
    label: '収益性',
    items: [
      { id: 'total_amount', label: '売上', unit: '円' },
      { id: 'avg_price_per_day', label: '1日平均単価', unit: '円' },
      { id: 'insurance_amount', label: '保険売上', unit: '円' },
      { id: 'insurance_avg_price_per_day', label: '保険1日平均単価', unit: '円' },
      { id: 'private_amount', label: '自費売上', unit: '円' },
      { id: 'private_avg_price_per_day', label: '自費1日平均単価', unit: '円' },
      { id: 'recept_price', label: 'レセプト単価', unit: '円/点' },
      { id: 'recept_count', label: 'レセプト数', unit: '件' },
      { id: 'avg_price', label: '平均単価', unit: '円' },
      { id: 'private_rate', label: '自費率', unit: '%' },
    ]
  },
  {
    id: 'booking',
    label: '予約精度',
    items: [
      { id: 'reserved_count', label: '予約数', unit: '名' },
      { id: 'patients_count', label: '来院数', unit: '名' },
      { id: 'visit_rate', label: '来院率', unit: '%' },
      { id: 'new_patients_count', label: '新患数', unit: '件' },
      { id: 'new_patient_rate', label: '新患率', unit: '%' },
      // 集計定義未定 (2026-05-28): 計算ロジック決定後に対応
      { id: 'first_mente_transition_rate', label: '新患メンテ移行率', unit: '%' },
      { id: 'today_reserve_count', label: '当日予約取得数', unit: '件' },
      { id: 'today_reserve_rate', label: '当日予約取得率', unit: '%' },
      { id: 'reserve_acquisition_count', label: '予約取得数', unit: '件' },
      { id: 'reserve_acquisition_rate', label: '予約取得率', unit: '%' },
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
      { id: 'first_mente_count', label: '初回メンテナンス数', unit: '件'},
      // 集計定義未定 (2026-05-28)
      { id: 'maintenance_ratio', label: 'メンテナンス割合', unit: '%' },
      { id: 'unreserved_count', label: '未予約数', unit: '名' },
      { id: 'unreserved_rate', label: '未予約率', unit: '%' },
      { id: 'new_patient_unreserved_count', label: '新患未予約数', unit: '名' },
      { id: 'new_patient_unreserved_rate', label: '新患未予約率', unit: '%' },
      { id: 'churn_patients_count', label: '離脱数', unit: '名' },
      { id: 'churn_patients_rate', label: '離脱率', unit: '%' },
      { id: 'maintenance_churn_count', label: 'メンテ離脱数', unit: '名' },
      { id: 'maintenance_churn_rate', label: 'メンテ離脱率', unit: '%' },
      // { id: 'chair_util_rate', label: 'チェア稼働率', unit: '%' },
    ]
  }
]

const CLINIC_RAW_KPIS = [
  'メンテナンス数',
  '来院数',
  '初回メンテ移行数',
  '予約人数_新規患者',
  '離脱患者',
  '離脱率',
  'メンテナンス_離脱数',
  '治療_離脱数',
  '患者数',
  'メンテナンス_未予約数',
  '予約率',
  // 2026-05-28 追加: 新患数 / 新患率 を 来院人数_新規患者 ベースに切替
  '来院人数_新規患者',
  '来院人数_既存患者',
  // 2026-05-28 追加: 新患未予約数 / 新患未予約率 用
  '新患未予約数',
  // 2026-06-17 追加: 収益性タブの自費率カード用 (TN32FBH8専用 CSV 由来)
  '自費率',
]

const RAW_CLINIC_KPI_IDS = new Set([
  'mente_count',
  'mente_rate',
  'first_mente_count',
  'new_patients_count',
  'new_patient_rate',
  'new_patient_unreserved_count',
  'new_patient_unreserved_rate',
  'unreserved_count',
  'unreserved_rate',
  'churn_patients_count',
  'churn_patients_rate',
  'maintenance_churn_count',
  'maintenance_churn_rate',
  'reserved_rate',
  'private_rate',
])

const RATE_KEYS = new Set([
  '次回予約取得率',
  'キャンセル率',
  'メンテナンス率',
  '未予約率',
  '離脱率',
])

type ClinicOption = { id: string; name: string }

const sumRawKpi = (rows: any[], kpiName: string) =>
  rows
    .filter(row => row.segment === 'clinic' && row.kpi_name === kpiName)
    .reduce((sum, row) => sum + (Number(row.value) || 0), 0)

const toPercentValue = (value: number) => {
  if (!Number.isFinite(value)) return 0
  return Math.abs(value) <= 1 ? value * 100 : value
}

const calcClinicRawKpi = (rows: any[], kpiId: string) => {
  const maintenanceCount = sumRawKpi(rows, 'メンテナンス数')
  const visitCount = sumRawKpi(rows, '来院数')
  const patientCount = sumRawKpi(rows, '患者数')
  const maintenanceChurn = sumRawKpi(rows, 'メンテナンス_離脱数')
  const treatmentChurn = sumRawKpi(rows, '治療_離脱数')

  switch (kpiId) {
    case 'mente_count':
      return maintenanceCount
    case 'mente_rate':
      return visitCount > 0 ? (maintenanceCount / visitCount) * 100 : 0
    case 'first_mente_count':
      return sumRawKpi(rows, '初回メンテ移行数')
    case 'new_patients_count':
      // 2026-05-28 仕様: flexible_kpis '来院人数_新規患者' を集計
      return sumRawKpi(rows, '来院人数_新規患者')
    case 'new_patient_rate': {
      // 2026-05-28 仕様: 来院人数_新規患者 / 来院人数_既存患者 × 100
      const newVisits = sumRawKpi(rows, '来院人数_新規患者')
      const existingVisits = sumRawKpi(rows, '来院人数_既存患者')
      return existingVisits > 0 ? (newVisits / existingVisits) * 100 : 0
    }
    case 'new_patient_unreserved_count':
      // 2026-05-28 仕様: flexible_kpis '新患未予約数' を集計 ({法人ID}_新患.csv 由来)
      return sumRawKpi(rows, '新患未予約数')
    case 'new_patient_unreserved_rate': {
      // 2026-05-28 仕様: 新患未予約数 / 来院人数_新規患者 × 100
      const unreservedNew = sumRawKpi(rows, '新患未予約数')
      const newVisits = sumRawKpi(rows, '来院人数_新規患者')
      return newVisits > 0 ? (unreservedNew / newVisits) * 100 : 0
    }
    case 'unreserved_count':
      return sumRawKpi(rows, '離脱患者')
    case 'unreserved_rate':
      return toPercentValue(sumRawKpi(rows, '離脱率'))
    case 'churn_patients_count':
      return maintenanceChurn + treatmentChurn
    case 'churn_patients_rate':
      return patientCount > 0 ? ((maintenanceChurn + treatmentChurn) / patientCount) * 100 : 0
    case 'maintenance_churn_count':
      return maintenanceChurn
    case 'maintenance_churn_rate': {
      const maintenanceUnreserved = sumRawKpi(rows, 'メンテナンス_未予約数')
      return patientCount > 0 ? ((maintenanceChurn + maintenanceUnreserved) / patientCount) * 100 : 0
    }
    case 'reserved_rate':
      return toPercentValue(sumRawKpi(rows, '予約率'))
    case 'private_rate':
      return sumRawKpi(rows, '自費率')
    default:
      return 0
  }
}

const calcClinicCardValue = (summaryRow: any, rawRows: any[], kpiId: string) =>
  RAW_CLINIC_KPI_IDS.has(kpiId)
    ? calcClinicRawKpi(rawRows, kpiId)
    : KpiEngine.calcFromSummarized(summaryRow, kpiId)

const calculateClinicForecast = (summaryRows: any[], rawRows: any[], kpiId: string, currentYear: number, currentMonth: number) => {
  if (!RAW_CLINIC_KPI_IDS.has(kpiId)) {
    return KpiEngine.calculateForecastFromSummarized(summaryRows, kpiId, currentYear, currentMonth)
  }

  // rawRows を (year, month) でグルーピングしてから各月の値を算出。
  // 2026-06-17 仕様変更で historyRawData が複数年に渡るようになったため、月のみのフィルタは不適切。
  const ymKeys = new Set<string>(rawRows.map(r => `${r.year}-${r.month}`))
  const monthlyRows = [...ymKeys].map(key => {
    const [y, m] = key.split('-').map(Number)
    const rows = rawRows.filter(r => Number(r.year) === y && Number(r.month) === m)
    return { year: y, month: m, value: calcClinicRawKpi(rows, kpiId) }
  }).sort((a, b) => (a.year - b.year) || (a.month - b.month))

  const past = monthlyRows.filter(row => row.year < currentYear || (row.year === currentYear && row.month < currentMonth))
  const values = past.filter(row => row.value > 0).slice(-3)
  if (values.length === 0) return null
  return values.reduce((sum, row) => sum + row.value, 0) / values.length
}

const formatChartTooltipValue = (value: number, name: string) => {
  const formatted = Number(value).toLocaleString('ja-JP', { maximumFractionDigits: 2 })
  return RATE_KEYS.has(name) ? `${formatted}%` : formatted
}

// 初期表示の年月: JST 当日の1ヶ月前 (例: 2026/6 表示中 → 2026/5)
const getCurrentJstPeriod = () => {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date())

  const year = Number(parts.find(part => part.type === 'year')?.value)
  const month = Number(parts.find(part => part.type === 'month')?.value)
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

function SelectBox({ label, value, onChange, options, highlight }: any) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
      <select 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className={`border-none rounded-2xl px-4 py-2.5 h-[42px] text-xs font-black outline-none cursor-pointer shadow-sm transition-all min-w-[200px] ${highlight ? 'bg-sky-100 text-black' : 'bg-slate-100 text-slate-700'}`}
      >
        {options.map((name: string) => (
          <option key={name} value={name} className="text-slate-800">{name}</option>
        ))}
      </select>
    </div>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const { corpId, mode, loading: authLoading } = useAuth()
  const currentPeriod = useMemo(() => getCurrentJstPeriod(), [])
  
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), [])

  const [corpName, setCorpName] = useState('')
  const [clinics, setClinics] = useState<string[]>([])
  const [targetClinic, setTargetClinic] = useState('')
  const [compareClinic, setCompareClinic] = useState('')
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
      const { data: corpData } = await supabase
        .from('corporations')
        .select('name')
        .eq('id', corpId)
        .single();
      
      if (corpData) setCorpName(corpData.name);

      const { data: clinicRes } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('corporation_id', corpId)
        .order('id', { ascending: true })

      const names = (clinicRes ?? [])
        .filter((clinic: ClinicOption) => !isHiddenClinicById(corpId, clinic.id))
        .map((clinic: ClinicOption) => clinic.name)
        .filter(Boolean)
      setClinics(names)

      if (names.length > 0) {
        setTargetClinic(names[0])
        setCompareClinic(names[1] || names[0])
      } else {
        setLoading(false)
      }

      const { data: periodData } = await supabase
        .from('summarized_clinic_kpi')
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
    }
    init()
  }, [corpId, authLoading, supabase])

  useEffect(() => {
    if (!targetClinic || !corpId || authLoading) return
    setLoading(true)

    const fetchData = async () => {
      const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;

      const rawSelect = 'year, month, segment, kpi_name, value'

      // summarized_clinic_kpi は既存カード用、flexible_kpis はメンテ・離脱系の追加定義用
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
        supabase.from('summarized_clinic_kpi').select('*').eq('corporation_id', corpId).eq('clinic_name', targetClinic).eq('year', selectedYear).eq('month', selectedMonth),
        supabase.from('summarized_clinic_kpi').select('*').eq('corporation_id', corpId).eq('clinic_name', compareClinic).eq('year', selectedYear).eq('month', selectedMonth),
        supabase.from('summarized_clinic_kpi').select('*').eq('corporation_id', corpId).eq('clinic_name', targetClinic).eq('year', prevYear).eq('month', prevMonth),
        supabase.from('summarized_clinic_kpi').select('*').eq('corporation_id', corpId).eq('clinic_name', targetClinic).eq('year', selectedYear - 1).eq('month', selectedMonth),
        supabase.from('summarized_clinic_kpi').select('*').eq('corporation_id', corpId).eq('clinic_name', targetClinic).gte('year', CHART_START_YEAR).order('year', { ascending: true }).order('month', { ascending: true }),
        supabase.from('flexible_kpis').select(rawSelect).eq('corporation_id', corpId).eq('clinic_name', targetClinic).eq('segment', 'clinic').eq('is_target', false).eq('year', selectedYear).eq('month', selectedMonth).in('kpi_name', CLINIC_RAW_KPIS),
        supabase.from('flexible_kpis').select(rawSelect).eq('corporation_id', corpId).eq('clinic_name', compareClinic).eq('segment', 'clinic').eq('is_target', false).eq('year', selectedYear).eq('month', selectedMonth).in('kpi_name', CLINIC_RAW_KPIS),
        supabase.from('flexible_kpis').select(rawSelect).eq('corporation_id', corpId).eq('clinic_name', targetClinic).eq('segment', 'clinic').eq('is_target', false).eq('year', prevYear).eq('month', prevMonth).in('kpi_name', CLINIC_RAW_KPIS),
        supabase.from('flexible_kpis').select(rawSelect).eq('corporation_id', corpId).eq('clinic_name', targetClinic).eq('segment', 'clinic').eq('is_target', false).eq('year', selectedYear - 1).eq('month', selectedMonth).in('kpi_name', CLINIC_RAW_KPIS),
        supabase.from('flexible_kpis').select(rawSelect).eq('corporation_id', corpId).eq('clinic_name', targetClinic).eq('segment', 'clinic').eq('is_target', false).gte('year', CHART_START_YEAR).in('kpi_name', CLINIC_RAW_KPIS)
      ])

      setTargetData(targetRes.data || [])
      setCompData(compRes.data || [])
      setPrevData(prevRes.data || [])
      setLastYearData(lastYearRes.data || [])
      setHistoryData(historyRes.data || [])
      setTargetRawData(targetRawRes.data || [])
      setCompRawData(compRawRes.data || [])
      setPrevRawData(prevRawRes.data || [])
      setLastYearRawData(lastYearRawRes.data || [])
      setHistoryRawData(historyRawRes.data || [])
      setLoading(false)
    }
    fetchData()
  }, [targetClinic, compareClinic, selectedYear, selectedMonth, corpId, authLoading, supabase])

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
    const months = buildMonthRange(CHART_START_YEAR, CHART_START_MONTH, currentPeriod.year, currentPeriod.month);
    return months.map(({ year, month }) => {
      const row = historyData.find(h => Number(h.year) === year && Number(h.month) === month) || null;
      const rawForMonth = historyRawData.filter(raw => Number(raw.year) === year && Number(raw.month) === month);
      return {
        name: `${year}/${month}`,
        売上: KpiEngine.calcFromSummarized(row, 'total_amount'),
        来院人数: KpiEngine.calcFromSummarized(row, 'patients_count'),
        次回予約取得率: KpiEngine.calcFromSummarized(row, 'next_reserve_rate'),
        キャンセル率: KpiEngine.calcFromSummarized(row, 'cancel_rate'),
        メンテナンス率: calcClinicRawKpi(rawForMonth, 'mente_rate'),
        未予約率: calcClinicRawKpi(rawForMonth, 'unreserved_rate'),
      };
    });
  }, [historyData, historyRawData, currentPeriod]);

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
              <p className="text-xs font-bold text-slate-400 tracking-widest uppercase italic">
                {corpName || `Corp ID: ${corpId}`}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/staff" prefetch={false} className="bg-blue-100 hover:bg-blue-200 text-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Staff View 👤</Link>
              {corpId === 'TN32FBH8' && (
                <Link href="/report" prefetch={false} className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Report 📑</Link>
              )}
              {corpId === 'FWLRNER6' && (
                <Link href="/table_view" prefetch={false} className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Table View 📊</Link>
              )}
              <Link href="/admin" prefetch={false} className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center">Admin ⚙️</Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-end">
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
            {mode === 'multi' && (
              <>
                <SelectBox label="対象クリニック" value={targetClinic} onChange={setTargetClinic} options={clinics} highlight />
                <SelectBox label="比較対象" value={compareClinic} onChange={setCompareClinic} options={clinics} />
              </>
            )}
          </div>
        </header>

        {/* チャート */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold', fill: '#94a3b8'}} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />

              {/* <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} /> */}
              <Tooltip
                contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                formatter={(value, name) => {
                  const v = typeof value === 'number' ? value : Number(value) || 0;
                  return formatChartTooltipValue(v, String(name ?? ''));
                }}
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
                  <Line yAxisId="right" type="linear" dataKey="未予約率" stroke="#fbbc04" strokeWidth={3} dot={{r: 4, fill: '#fbbc04'}} />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* タブ */}
        <div className="flex gap-2 p-1 bg-slate-200/50 rounded-2xl w-fit">
          {DASHBOARD_TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{tab.label}</button>
          ))}
        </div>

        {/* KPIカード一覧 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {DASHBOARD_TABS.find(t => t.id === activeTab)?.items.map(kpi => {
            const targetRow   = targetData[0]   || null;
            const prevRow     = prevData[0]      || null;
            const lastYearRow = lastYearData[0]  || null;
            const compRow     = compData[0]      || null;

            const val          = calcClinicCardValue(targetRow,   targetRawData,   kpi.id);
            const prevVal      = calcClinicCardValue(prevRow,     prevRawData,     kpi.id);
            const lastYearVal  = calcClinicCardValue(lastYearRow, lastYearRawData, kpi.id);
            const compClinicVal = calcClinicCardValue(compRow,    compRawData,     kpi.id);
            const goal = goals[kpi.label] || 0;

            const finalCompVal   = mode === 'single' ? lastYearVal : compClinicVal;
            const finalCompLabel = mode === 'single' ? '前年同月' : compareClinic;

            const mom         = KpiEngine.calcRatio(val, prevVal);
            const achievement = KpiEngine.calcRatio(val, goal);

            const forecast = calculateClinicForecast(historyData, historyRawData, kpi.id, selectedYear, selectedMonth);

            return (
              <KpiCard
                key={kpi.label}
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
