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
  buildMonthRange,
  REPORT_FLEXIBLE_KPIS,
  type MonthlyReportRow,
} from '@/lib/report-kpi'
import { isHiddenClinicById } from '@/lib/hidden-clinics'

type ClinicOption = { id: string; name: string }
type StageBreakdownRow = {
  year: number
  month: number
  kpi_name: string
  value: number | null
}

// レポート表示期間の起点 (2026-06-17 設定: 2025/1 固定)
const REPORT_START_YEAR = 2025
const REPORT_START_MONTH = 1
const STAGE_PREFIX = '来院人数_ステージ内訳_'
// 日別状況CSV の「来院(人)」合計列。患者IDユニーク値で、メンテ以外 = この値 − メンテ数 に使用
const STAGE_VISIT_TOTAL_KPI = '来院人数_ステージ内訳用'

// 初期表示の年月: JST 当日の1ヶ月前 (例: 2026/6 表示中 → 2026/5)
const getCurrentJstYearMonth = () => {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date())
  const year = Number(parts.find(p => p.type === 'year')?.value)
  const month = Number(parts.find(p => p.type === 'month')?.value)
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

const formatYearMonth = (year: number, month: number) => `${year}/${month}`

type GenderCounts = { female: number; male: number; unset: number }
const EMPTY_GENDER: GenderCounts = { female: 0, male: 0, unset: 0 }
const EMPTY_AGE: AgeBucket[] = AGE_BINS.map(b => ({ label: b.label, count: 0 }))

// v_patient_demographics_summary view の1行から age バケット配列を作る
// AGE_BINS と完全に同順で並ぶように DB 列を列挙する
type DemographicsRow = {
  male_count: number | null
  female_count: number | null
  unset_count: number | null
  age_0_12: number | null
  age_13_19: number | null
  age_20_29: number | null
  age_30_39: number | null
  age_40_49: number | null
  age_50_59: number | null
  age_60_69: number | null
  age_70_79: number | null
  age_80_plus: number | null
}
const AGE_COLUMNS: (keyof DemographicsRow)[] = [
  'age_0_12', 'age_13_19', 'age_20_29', 'age_30_39', 'age_40_49',
  'age_50_59', 'age_60_69', 'age_70_79', 'age_80_plus',
]
const toAgeBuckets = (row: DemographicsRow | null): AgeBucket[] =>
  AGE_BINS.map((b, i) => ({
    label: b.label,
    count: row ? Number(row[AGE_COLUMNS[i]] ?? 0) : 0,
  }))
const toGenderCounts = (row: DemographicsRow | null): GenderCounts => ({
  female: row ? Number(row.female_count ?? 0) : 0,
  male:   row ? Number(row.male_count   ?? 0) : 0,
  unset:  row ? Number(row.unset_count  ?? 0) : 0,
})

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
    () => buildMonthRange(REPORT_START_YEAR, REPORT_START_MONTH, currentPeriod.year, currentPeriod.month),
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
        .filter((c: ClinicOption) => !isHiddenClinicById(corpId, c.id))
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
          // '来院人数_ステージ内訳_*' (各ステージ) と '来院人数_ステージ内訳用' (来院合計) を両方取得
          .like('kpi_name', '来院人数_ステージ内訳%'),
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
      // 集計済み view から (corporation_id, clinic_id) で 1 行取得。
      // フィルタ (last_visit_date >= 2025-01-01) はview側で適用済み。
      const { data, error } = await supabase
        .from('v_patient_demographics_summary')
        .select('male_count, female_count, unset_count, age_0_12, age_13_19, age_20_29, age_30_39, age_40_49, age_50_59, age_60_69, age_70_79, age_80_plus')
        .eq('corporation_id', corpId)
        .eq('clinic_id', targetClinicId)
        .maybeSingle()
      if (error) {
        console.error('[ReportPage] v_patient_demographics_summary fetch failed:', error)
        setGenderCounts(EMPTY_GENDER)
        setAgeBuckets(EMPTY_AGE)
        return
      }
      const row = (data ?? null) as DemographicsRow | null
      setGenderCounts(toGenderCounts(row))
      setAgeBuckets(toAgeBuckets(row))
    }

    fetchPatientSnapshot()
  }, [targetClinicId, corpId, authLoading, supabase])

  const monthlyRows: MonthlyReportRow[] = useMemo(
    () => buildMonthlyReportRows(summaryRows, flexRows, months),
    [summaryRows, flexRows, months],
  )

  // 来院ステージ内訳をメンテナンス設定で分類して月次集計
  //   メンテ数    = data_mappings(maintenance) で指定された項目（来院人数_ステージ内訳_*）の合計
  //   メンテ以外  = 来院人数_ステージ内訳用（来院(人)合計）− メンテ数
  // 来院人数_ステージ内訳用 が存在しない月は メンテ以外 を null とする
  const stageMaintenanceByMonth = useMemo(() => {
    const map = new Map<
      string,
      { mente: number; visitTotal: number | null; hasMenteData: boolean }
    >()
    for (const r of stageRows) {
      if (r.value === null || !Number.isFinite(r.value)) continue
      const key = `${r.year}-${r.month}`
      const cur = map.get(key) ?? { mente: 0, visitTotal: null, hasMenteData: false }
      if (r.kpi_name === STAGE_VISIT_TOTAL_KPI) {
        cur.visitTotal = (cur.visitTotal ?? 0) + r.value
      } else if (r.kpi_name.startsWith(STAGE_PREFIX)) {
        const item = r.kpi_name.replace(STAGE_PREFIX, '')
        if (maintenanceItems.has(item)) {
          cur.mente += r.value
          cur.hasMenteData = true
        }
      }
      map.set(key, cur)
    }
    return map
  }, [stageRows, maintenanceItems])

  const chartData = useMemo(
    () =>
      monthlyRows.map(r => {
        const stage = stageMaintenanceByMonth.get(`${r.year}-${r.month}`)
        // メンテ数: マッピング項目の合計（マッピングが空でも0を返す）
        // メンテ以外: 来院人数_ステージ内訳用 − メンテ数（合計値が無ければ null）
        const menteValue = stage?.hasMenteData ? stage.mente : null
        const nonMenteValue =
          stage?.visitTotal !== null && stage?.visitTotal !== undefined
            ? Math.max(stage.visitTotal - (stage.mente ?? 0), 0)
            : null
        return {
          name: formatYearMonth(r.year, r.month),
          メンテ数: menteValue,
          メンテ以外: nonMenteValue,
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
