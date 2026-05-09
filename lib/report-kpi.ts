// レポートタブ用の月次集計ヘルパ。
// summarized_clinic_kpi（既存集計ビュー）と flexible_kpis（kpi_name 縦持ち）から
// 1年×12ヶ月分の MonthlyReportRow を組み立てる。
// 既存 app/page.tsx の calcClinicRawKpi 系の定義に揃えて、Clinic Dashboard と数値整合させる。

export type SummaryRow = Record<string, unknown>

export type FlexibleRow = {
  year: number | string
  month: number | string
  segment: string
  kpi_name: string
  value: number | string | null
}

export type MonthlyReportRow = {
  year: number
  month: number
  hasData: boolean

  // summarized_clinic_kpi 由来
  working_days: number | null
  patients_count_total: number | null
  reserved_count: number | null
  today_cancel_count: number | null
  today_cancel_rate: number | null
  prior_cancel_count: number | null
  prior_cancel_rate: number | null
  noshow_cancel_count: number | null

  // flexible_kpis 由来
  visits_unique: number | null
  patients_count_avg: number | null
  new_patients_count: number | null
  unreserved_count: number | null
  unreserved_rate: number | null
  first_mente_count: number | null
  mente_count: number | null
  reserved_rate: number | null

  // flexible_kpis 由来 (2026-05-06 追加)
  app_registered_new: number | null      // アプリ登録件数（当月）
  app_registered_total: number | null    // アプリ登録累計
  app_registered_existing: number | null // 登録数 = 累計 − 当月
  web_reserved_new: number | null        // ウェブ予約_新患
  web_reserved_repeat: number | null     // ウェブ予約_再診
  acquisition_rate: number | null        // 当日次回予約獲得率
  overall_cancel_rate: number | null     // キャンセル率_全体

  // チャート用派生値
  mente_rate: number | null
  non_mente_count: number | null
  maintenance_churn_count: number | null
  treatment_churn_count: number | null
  churn_patients_count: number | null
  churn_patients_rate: number | null
  first_mente_rate: number | null
}

export const REPORT_FLEXIBLE_KPIS = [
  '来院数',
  '診療日数',
  '稼働日数',
  'メンテナンス数',
  '初回メンテ移行数',
  '予約人数_新規患者',
  '離脱患者',
  '離脱率',
  'メンテナンス_離脱数',
  '治療_離脱数',
  '患者数',
  '予約率',
  // 2026-05-06 追加: レポートタブ拡張用
  'アプリ登録件数',
  'アプリ登録累計',
  'ウェブ予約_新患',
  'ウェブ予約_再診',
  '次回予約取得率',
  'キャンセル率_全体',
] as const

// 既存 app/page.tsx と同じ補正ロジック：0〜1 の値はパーセント表記に揃える
export const toPercentValue = (value: number) => {
  if (!Number.isFinite(value)) return 0
  return Math.abs(value) <= 1 ? value * 100 : value
}

const sumKpi = (rows: FlexibleRow[], kpiName: string) =>
  rows
    .filter(r => r.segment === 'clinic' && r.kpi_name === kpiName)
    .reduce((sum, r) => sum + (Number(r.value) || 0), 0)

export function buildMonthlyReportRow(
  year: number,
  month: number,
  summaryRow: SummaryRow | null,
  flexRows: FlexibleRow[]
): MonthlyReportRow {
  const hasSummary = !!summaryRow
  const hasFlex = flexRows.length > 0

  const sg = (col: string) => Number(summaryRow?.[col]) || 0

  const visits = sumKpi(flexRows, '来院数')
  const flexWorkingDays = sumKpi(flexRows, '診療日数') + sumKpi(flexRows, '稼働日数')
  const menteCount = sumKpi(flexRows, 'メンテナンス数')
  const firstMenteCount = sumKpi(flexRows, '初回メンテ移行数')
  const newPatients = sumKpi(flexRows, '予約人数_新規患者')
  const unreserved = sumKpi(flexRows, '離脱患者')
  const unreservedRateRaw = sumKpi(flexRows, '離脱率')
  const menteChurn = sumKpi(flexRows, 'メンテナンス_離脱数')
  const treatChurn = sumKpi(flexRows, '治療_離脱数')
  const totalPatients = sumKpi(flexRows, '患者数')
  const reservedRateRaw = sumKpi(flexRows, '予約率')
  // 2026-05-06 追加 KPI（日別状況CSV由来）
  const appRegisteredNew = sumKpi(flexRows, 'アプリ登録件数')
  const appRegisteredTotal = sumKpi(flexRows, 'アプリ登録累計')
  const webReservedNew = sumKpi(flexRows, 'ウェブ予約_新患')
  const webReservedRepeat = sumKpi(flexRows, 'ウェブ予約_再診')
  const acquisitionRateRaw = sumKpi(flexRows, '次回予約取得率')
  const overallCancelRateRaw = sumKpi(flexRows, 'キャンセル率_全体')
  const hasAppKpi = flexRows.some(r => r.kpi_name === 'アプリ登録件数' || r.kpi_name === 'アプリ登録累計')
  const hasWebKpi = flexRows.some(r => r.kpi_name === 'ウェブ予約_新患' || r.kpi_name === 'ウェブ予約_再診')
  const hasAcqKpi = flexRows.some(r => r.kpi_name === '次回予約取得率')
  const hasCancelKpi = flexRows.some(r => r.kpi_name === 'キャンセル率_全体')

  const workingDays = hasSummary ? sg('working_days') : flexWorkingDays
  const patientsTotal = sg('patients_count')
  const reserved = sg('reserved_count')
  const todayCancel = sg('today_cancel_count')
  const priorCancel = sg('prior_cancel_count')
  const noshowCancel = sg('noshow_cancel_count')

  const todayCancelRate = reserved > 0 ? (todayCancel / reserved) * 100 : null
  const priorCancelRate = reserved > 0 ? (priorCancel / reserved) * 100 : null
  const menteRate = visits > 0 ? (menteCount / visits) * 100 : null
  const churnTotal = menteChurn + treatChurn
  const churnRate = totalPatients > 0 ? (churnTotal / totalPatients) * 100 : null
  const patientsAvg = workingDays > 0 ? visits / workingDays : null
  // 初回メンテ移行率: 新患来院数の集計 KPI が現状未取り込みのため、暫定で予約人数_新規患者を分母に使う
  const firstMenteRate = newPatients > 0 ? (firstMenteCount / newPatients) * 100 : null

  return {
    year,
    month,
    hasData: hasSummary || hasFlex,

    working_days: hasSummary ? workingDays : null,
    patients_count_total: hasSummary ? patientsTotal : null,
    reserved_count: hasSummary ? reserved : null,
    today_cancel_count: hasSummary ? todayCancel : null,
    today_cancel_rate: hasSummary ? todayCancelRate : null,
    prior_cancel_count: hasSummary ? priorCancel : null,
    prior_cancel_rate: hasSummary ? priorCancelRate : null,
    noshow_cancel_count: hasSummary ? noshowCancel : null,

    visits_unique: hasFlex ? visits : null,
    patients_count_avg: hasFlex && workingDays > 0 ? patientsAvg : null,
    new_patients_count: hasFlex ? newPatients : null,
    unreserved_count: hasFlex ? unreserved : null,
    unreserved_rate: hasFlex ? toPercentValue(unreservedRateRaw) : null,
    first_mente_count: hasFlex ? firstMenteCount : null,
    mente_count: hasFlex ? menteCount : null,
    reserved_rate: hasFlex ? toPercentValue(reservedRateRaw) : null,

    app_registered_new: hasAppKpi ? appRegisteredNew : null,
    app_registered_total: hasAppKpi ? appRegisteredTotal : null,
    app_registered_existing: hasAppKpi ? Math.max(appRegisteredTotal - appRegisteredNew, 0) : null,
    web_reserved_new: hasWebKpi ? webReservedNew : null,
    web_reserved_repeat: hasWebKpi ? webReservedRepeat : null,
    acquisition_rate: hasAcqKpi ? toPercentValue(acquisitionRateRaw) : null,
    overall_cancel_rate: hasCancelKpi ? toPercentValue(overallCancelRateRaw) : null,

    mente_rate: hasFlex && visits > 0 ? menteRate : null,
    non_mente_count: hasFlex && visits > 0 ? Math.max(visits - menteCount, 0) : null,
    maintenance_churn_count: hasFlex ? menteChurn : null,
    treatment_churn_count: hasFlex ? treatChurn : null,
    churn_patients_count: hasFlex ? churnTotal : null,
    churn_patients_rate: hasFlex && totalPatients > 0 ? churnRate : null,
    first_mente_rate: hasFlex && newPatients > 0 ? firstMenteRate : null,
  }
}

export function buildMonthlyReportRows(
  summaryRows: SummaryRow[],
  flexRows: FlexibleRow[],
  months: { year: number; month: number }[],
): MonthlyReportRow[] {
  return months.map(({ year, month }) => {
    const summary =
      summaryRows.find(
        r => Number((r as Record<string, unknown>).year) === year && Number((r as Record<string, unknown>).month) === month,
      ) ?? null
    const flex = flexRows.filter(r => Number(r.year) === year && Number(r.month) === month)
    return buildMonthlyReportRow(year, month, summary, flex)
  })
}

// 現在JSTの年月から指定月数ぶん遡った {year, month}[] を昇順で返す（含む現在月）
export function buildPastMonths(
  currentYear: number,
  currentMonth: number,
  count: number,
): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = []
  for (let i = count - 1; i >= 0; i--) {
    // i ヶ月前を計算
    const totalMonth = currentYear * 12 + (currentMonth - 1) - i
    const y = Math.floor(totalMonth / 12)
    const m = (totalMonth % 12) + 1
    result.push({ year: y, month: m })
  }
  return result
}
