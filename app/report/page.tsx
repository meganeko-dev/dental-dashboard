'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import ReportHeader from '@/components/report/ReportHeader'
import SummaryTable from '@/components/report/SummaryTable'
import MonthlyTrendChart from '@/components/report/MonthlyTrendChart'
import GenderRatioChart from '@/components/report/GenderRatioChart'
import AgeDistributionChart, { AGE_BINS, type AgeBucket } from '@/components/report/AgeDistributionChart'
import {
  buildMonthlyReportRows,
  buildPastMonths,
  REPORT_FLEXIBLE_KPIS,
  type MonthlyReportRow,
} from '@/lib/report-kpi'

type ClinicOption = { id: string; name: string }
type StageBreakdownRow = {
  year: number
  month: number
  kpi_name: string
  value: number | null
}

const RANGE_MONTHS = 24
const STAGE_PREFIX = '来院人数_ステージ内訳_'

const getCurrentJstYearMonth = () => {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date())
  return {
    year: Number(parts.find(p => p.type === 'year')?.value),
    month: Number(parts.find(p => p.type === 'month')?.value),
  }
}

const formatYearMonth = (year: number, month: number) => `${year}/${month}`

type GenderCounts = { female: number; male: number; unset: number }
const EMPTY_GENDER: GenderCounts = { female: 0, male: 0, unset: 0 }
const EMPTY_AGE: AgeBucket[] = AGE_BINS.map(b => ({ label: b.label, count: 0 }))

const bucketAge = (rows: { age: number | null }[]): AgeBucket[] => {
  const counts = AGE_BINS.map(() => 0)
  for (const r of rows) {
    if (r.age === null) continue
    const idx = AGE_BINS.findIndex(b => r.age! >= b.min && r.age! <= b.max)
    if (idx >= 0) counts[idx] += 1
  }
  return AGE_BINS.map((b, i) => ({ label: b.label, count: counts[i] }))
}

const countGender = (rows: { gender: string | null }[]): GenderCounts => {
  const counts: GenderCounts = { female: 0, male: 0, unset: 0 }
  for (const r of rows) {
    const g = (r.gender ?? '').trim()
    if (g === '女性') counts.female++
    else if (g === '男性') counts.male++
    else counts.unset++
  }
  return counts
}

export default function ReportPage() {
  const router = useRouter()
  const { corpId, mode, loading: authLoading } = useAuth()

  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ),
    [],
  )

  const currentPeriod = useMemo(() => getCurrentJstYearMonth(), [])
  const months = useMemo(
    () => buildPastMonths(currentPeriod.year, currentPeriod.month, RANGE_MONTHS),
    [currentPeriod],
  )
  const startYear = months[0].year
  const endYear = months[months.length - 1].year

  const [corpName, setCorpName] = useState('')
  const [clinics, setClinics] = useState<ClinicOption[]>([])
  const [targetClinic, setTargetClinic] = useState('')
  const [summaryRows, setSummaryRows] = useState<any[]>([])
  const [flexRows, setFlexRows] = useState<any[]>([])
  const [genderCounts, setGenderCounts] = useState<GenderCounts>(EMPTY_GENDER)
  const [ageBuckets, setAgeBuckets] = useState<AgeBucket[]>(EMPTY_AGE)
  const [stageRows, setStageRows] = useState<StageBreakdownRow[]>([])
  const [maintenanceItems, setMaintenanceItems] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.refresh()
    window.location.href = '/login'
  }

  useEffect(() => {
    if (authLoading || !corpId) return

    const init = async () => {
      const [corpRes, clinicRes] = await Promise.all([
        supabase.from('corporations').select('name').eq('id', corpId).single(),
        supabase
          .from('clinics')
          .select('id, name')
          .eq('corporation_id', corpId)
          .order('id', { ascending: true }),
      ])

      if (corpRes.data) setCorpName(corpRes.data.name)

      const list = (clinicRes.data ?? [])
        .filter((c: ClinicOption) => !!c.name)
        .map((c: ClinicOption) => ({ id: String(c.id), name: c.name }))
      setClinics(list)
      if (list.length > 0) {
        setTargetClinic(prev => prev || list[0].name)
      } else {
        setLoading(false)
      }
    }

    init()
  }, [corpId, authLoading, supabase])

  const targetClinicId = useMemo(
    () => clinics.find(c => c.name === targetClinic)?.id ?? '',
    [clinics, targetClinic],
  )

  // summarized + flexible (24ヶ月分)
  useEffect(() => {
    if (!targetClinic || !corpId || authLoading) return
    setLoading(true)

    const fetchData = async () => {
      const [summaryRes, flexRes] = await Promise.all([
        supabase
          .from('summarized_clinic_kpi')
          .select('*')
          .eq('corporation_id', corpId)
          .eq('clinic_name', targetClinic)
          .gte('year', startYear)
          .lte('year', endYear)
          .order('year', { ascending: true })
          .order('month', { ascending: true }),
        supabase
          .from('flexible_kpis')
          .select('year, month, segment, kpi_name, value')
          .eq('corporation_id', corpId)
          .eq('clinic_name', targetClinic)
          .eq('segment', 'clinic')
          .eq('is_target', false)
          .gte('year', startYear)
          .lte('year', endYear)
          .in('kpi_name', REPORT_FLEXIBLE_KPIS as unknown as string[]),
      ])
      setSummaryRows(summaryRes.data ?? [])
      setFlexRows(flexRes.data ?? [])
      setLoading(false)
    }

    fetchData()
  }, [targetClinic, corpId, authLoading, supabase, startYear, endYear])

  // 来院人数_ステージ内訳_* + メンテナンス設定（メンテナンス推移グラフ用）
  useEffect(() => {
    if (!targetClinic || !corpId || authLoading) {
      setStageRows([])
      setMaintenanceItems(new Set())
      return
    }

    const fetchStage = async () => {
      const [stageRes, mapRes] = await Promise.all([
        supabase
          .from('flexible_kpis')
          .select('year, month, kpi_name, value')
          .eq('corporation_id', corpId)
          .eq('clinic_name', targetClinic)
          .eq('segment', 'clinic')
          .eq('is_target', false)
          .gte('year', startYear)
          .lte('year', endYear)
          .like('kpi_name', `${STAGE_PREFIX}%`),
        supabase
          .from('data_mappings')
          .select('value')
          .eq('corporation_id', corpId)
          .eq('mapping_type', 'maintenance')
          .eq('key', targetClinic),
      ])
      const rows: StageBreakdownRow[] = (stageRes.data ?? []).map((r: { year: number | string; month: number | string; kpi_name: string; value: number | string | null }) => ({
        year: Number(r.year),
        month: Number(r.month),
        kpi_name: String(r.kpi_name),
        value: r.value === null ? null : Number(r.value),
      }))
      setStageRows(rows)
      setMaintenanceItems(new Set((mapRes.data ?? []).map(r => String(r.value))))
    }

    fetchStage()
  }, [targetClinic, corpId, authLoading, supabase, startYear, endYear])

  // patient_snapshots（男女比 / 年齢構成）
  useEffect(() => {
    if (!targetClinicId || !corpId || authLoading) {
      setGenderCounts(EMPTY_GENDER)
      setAgeBuckets(EMPTY_AGE)
      return
    }

    const fetchPatientSnapshot = async () => {
      const { data, error } = await supabase
        .from('patient_snapshots')
        .select('gender, age')
        .eq('corporation_id', corpId)
        .eq('clinic_id', targetClinicId)
      if (error) {
        setGenderCounts(EMPTY_GENDER)
        setAgeBuckets(EMPTY_AGE)
        return
      }
      const rows = data ?? []
      setGenderCounts(countGender(rows))
      setAgeBuckets(bucketAge(rows))
    }

    fetchPatientSnapshot()
  }, [targetClinicId, corpId, authLoading, supabase])

  const monthlyRows: MonthlyReportRow[] = useMemo(
    () => buildMonthlyReportRows(summaryRows, flexRows, months),
    [summaryRows, flexRows, months],
  )

  // 来院ステージ内訳をメンテナンス設定で分類して月次集計
  // メンテ数 = data_mappings(maintenance) で指定された項目の合計、メンテ以外 = それ以外の合計
  const stageMaintenanceByMonth = useMemo(() => {
    const map = new Map<string, { mente: number; nonMente: number; hasData: boolean }>()
    for (const r of stageRows) {
      if (r.value === null || !Number.isFinite(r.value)) continue
      const key = `${r.year}-${r.month}`
      const item = r.kpi_name.replace(STAGE_PREFIX, '')
      const isMente = maintenanceItems.has(item)
      const cur = map.get(key) ?? { mente: 0, nonMente: 0, hasData: false }
      if (isMente) cur.mente += r.value
      else cur.nonMente += r.value
      cur.hasData = true
      map.set(key, cur)
    }
    return map
  }, [stageRows, maintenanceItems])

  const chartData = useMemo(
    () =>
      monthlyRows.map(r => {
        const stage = stageMaintenanceByMonth.get(`${r.year}-${r.month}`)
        return {
          name: formatYearMonth(r.year, r.month),
          メンテ数: stage?.hasData ? stage.mente : null,
          メンテ以外: stage?.hasData ? stage.nonMente : null,
          新規登録件数: r.app_registered_new,
          登録数: r.app_registered_existing,
          獲得率: r.acquisition_rate,
          キャンセル率: r.overall_cancel_rate,
          ウェブ新患: r.web_reserved_new,
          ウェブ再診: r.web_reserved_repeat,
        }
      }),
    [monthlyRows, stageMaintenanceByMonth],
  )

  if (authLoading) {
    return (
      <div className="p-10 text-slate-400 font-black uppercase italic animate-pulse">
        Authenticating...
      </div>
    )
  }
  if (!corpId) {
    return (
      <div className="p-10 text-red-500 font-bold">
        Access Denied: No Corporation ID found.
      </div>
    )
  }
  if (loading && summaryRows.length === 0 && flexRows.length === 0 && clinics.length === 0) {
    return (
      <div className="p-10 text-slate-400 font-black uppercase italic animate-pulse">
        Loading Report...
      </div>
    )
  }

  const showTableView = corpId === 'FWLRNER6'
  const rangeLabel = `${formatYearMonth(months[0].year, months[0].month)} 〜 ${formatYearMonth(currentPeriod.year, currentPeriod.month)}`
  const clinicNames = clinics.map(c => c.name)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8 font-sans relative">
      <button
        onClick={handleLogout}
        className="fixed top-4 right-4 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-full text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-all shadow-sm z-50 cursor-pointer"
      >
        ログアウト 🚪
      </button>

      <div className="max-w-7xl mx-auto space-y-8">
        <ReportHeader
          corpName={corpName}
          corpId={corpId}
          mode={mode}
          showTableView={showTableView}
          clinics={clinicNames}
          targetClinic={targetClinic}
          setTargetClinic={setTargetClinic}
          rangeLabel={rangeLabel}
        />

        <SummaryTable rows={monthlyRows} rangeLabel={rangeLabel} />

        <MonthlyTrendChart
          title="メンテナンス推移（月次）"
          data={chartData}
          bars={[
            { dataKey: 'メンテ以外', color: '#4185f4', stackId: 'mente', yAxisId: 'left' },
            { dataKey: 'メンテ数',   color: '#fb923c', stackId: 'mente', yAxisId: 'left' },
          ]}
          showBarLabels
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <GenderRatioChart data={genderCounts} />
          <AgeDistributionChart data={ageBuckets} />
        </div>

        <MonthlyTrendChart
          title="アプリ登録者数（月次）"
          data={chartData}
          bars={[
            { dataKey: '登録数',       color: '#4185f4', stackId: 'app', yAxisId: 'left' },
            { dataKey: '新規登録件数', color: '#ea4335', stackId: 'app', yAxisId: 'left' },
          ]}
          showBarLabels
        />

        <MonthlyTrendChart
          title="獲得率とキャンセル率（月次）"
          data={chartData}
          lines={[
            { dataKey: '獲得率',     color: '#4185f4', yAxisId: 'left' },
            { dataKey: 'キャンセル率', color: '#ea4335', yAxisId: 'right' },
          ]}
          rateKeys={['獲得率', 'キャンセル率']}
          showLineLabels
        />

        <MonthlyTrendChart
          title="ウェブ新患/再診（月次）"
          data={chartData}
          lines={[
            { dataKey: 'ウェブ新患', color: '#4185f4', yAxisId: 'left' },
            { dataKey: 'ウェブ再診', color: '#ea4335', yAxisId: 'left' },
          ]}
          showLineLabels
        />
      </div>
    </div>
  )
}
