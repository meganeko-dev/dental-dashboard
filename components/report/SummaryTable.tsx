'use client'

import type { MonthlyReportRow } from '@/lib/report-kpi'

type FormatType = 'int' | 'float1' | 'percent'

type RowDef = {
  id: keyof MonthlyReportRow
  label: string
  unit: string
  format: FormatType
}

// クライアント要望 (2026-05-13) に合わせた表示順・項目構成。
// 「予約取得数 / 予約取得率」を撤去し、「当日予約取得数 / 当日予約取得率」を追加。
// 当日予約取得数 = 来院数(ユニーク) − 未予約患者数 / 当日予約取得率 = 当日予約取得数 / 来院数(ユニーク)
const SUMMARY_ROWS: RowDef[] = [
  { id: 'working_days',         label: '診療日数',           unit: '日', format: 'int' },
  { id: 'patients_count_total', label: '総来院患者数(延べ)', unit: '名', format: 'int' },
  { id: 'patients_count_avg',   label: '平均来院数',         unit: '名', format: 'float1' },
  { id: 'visits_unique',        label: '来院数(ユニーク)',   unit: '名', format: 'int' },
  { id: 'today_reserve_count',  label: '当日予約取得数',     unit: '件', format: 'int' },
  { id: 'unreserved_count',     label: '未予約患者数',       unit: '名', format: 'int' },
  { id: 'today_reserve_rate',   label: '当日予約取得率',     unit: '%',  format: 'percent' },
  { id: 'unreserved_rate',      label: '未予約率',           unit: '%',  format: 'percent' },
  { id: 'today_cancel_count',   label: '当日キャンセル数',   unit: '件', format: 'int' },
  { id: 'today_cancel_rate',    label: '当日キャンセル率',   unit: '%',  format: 'percent' },
]

const fmt = (value: number | null, format: FormatType): string => {
  if (value === null || !Number.isFinite(value)) return '—'
  switch (format) {
    case 'percent':
      return `${Number(value).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}%`
    case 'float1':
      return Number(value).toLocaleString('ja-JP', { maximumFractionDigits: 1 })
    case 'int':
    default:
      return Number(value).toLocaleString('ja-JP', { maximumFractionDigits: 0 })
  }
}

type Props = {
  rows: MonthlyReportRow[]
  rangeLabel: string
}

export default function SummaryTable({ rows, rangeLabel }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-baseline gap-4">
        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">サマリー</h3>
        <span className="text-xs font-bold text-slate-400">{rangeLabel}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-widest">
            <tr>
              <th className="text-left px-4 py-3 min-w-[180px] whitespace-nowrap sticky left-0 bg-slate-50 z-20 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)]">KPI</th>
              {rows.map(r => (
                <th key={`${r.year}-${r.month}`} className="text-right px-3 py-3 min-w-[72px] whitespace-nowrap">
                  {r.year}/{r.month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SUMMARY_ROWS.map((row, idx) => {
              const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
              return (
                <tr key={row.id} className={rowBg}>
                  <td className={`text-left px-4 py-2.5 font-black text-slate-700 whitespace-nowrap sticky left-0 z-10 ${rowBg} shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)]`}>
                    {row.label}
                    <span className="text-slate-400 font-bold ml-1">({row.unit})</span>
                  </td>
                  {rows.map(monthRow => (
                    <td
                      key={`${monthRow.year}-${monthRow.month}`}
                      className="text-right px-3 py-2.5 tabular-nums text-slate-800 whitespace-nowrap"
                    >
                      {fmt(monthRow[row.id] as number | null, row.format)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
