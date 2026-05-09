'use client'

import {
  ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts'

export type SeriesBar = {
  dataKey: string
  name?: string
  color: string
  stackId?: string
  yAxisId?: 'left' | 'right'
  barSize?: number
}

export type SeriesLine = {
  dataKey: string
  name?: string
  color: string
  yAxisId?: 'left' | 'right'
}

type ChartDatum = { name: string } & Record<string, number | string | null>

type Props = {
  title: string
  data: ChartDatum[]
  bars?: SeriesBar[]
  lines?: SeriesLine[]
  height?: number
  rateKeys?: string[]
  // 重要KPIなど枠線で強調したいチャート用
  highlight?: boolean
  badge?: string
  subtitle?: string
  // 棒グラフに値ラベルを表示する（積み上げの場合は各セグメント中央に表示）
  showBarLabels?: boolean
  // 折れ線グラフの各点に値ラベルを表示する
  showLineLabels?: boolean
}

export default function MonthlyTrendChart({
  title, data, bars = [], lines = [], height = 320, rateKeys = [],
  highlight = false, badge, subtitle, showBarLabels = false, showLineLabels = false,
}: Props) {
  // recharts の Tooltip Formatter 型は intersection 型のため厳密には適合しない。
  // 既存ダッシュボード（app/page.tsx）と同じく any を許容して null も実行時に弾く。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipFormatter = (value: any, name: any): [string, string] => {
    const label = String(name ?? '')
    if (value === null || value === undefined || value === '' || Array.isArray(value)) return ['—', label]
    const num = Number(value)
    if (!Number.isFinite(num)) return ['—', label]
    const formatted = num.toLocaleString('ja-JP', { maximumFractionDigits: 2 })
    return rateKeys.includes(label) ? [`${formatted}%`, label] : [formatted, label]
  }

  const containerClass = highlight
    ? 'bg-white p-6 md:p-8 rounded-xl border-2 border-rose-300 shadow-md ring-4 ring-rose-100'
    : 'bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm'

  return (
    <div className={containerClass}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">{title}</h3>
        {badge && (
          <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
            {badge}
          </span>
        )}
        {subtitle && <span className="text-xs font-bold text-slate-500">{subtitle}</span>}
      </div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 32, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="name"
              interval={0}
              angle={data.length > 12 ? -45 : 0}
              textAnchor={data.length > 12 ? 'end' : 'middle'}
              height={data.length > 12 ? 72 : 30}
              tickMargin={data.length > 12 ? 14 : 4}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fontWeight: 'bold', fill: '#94a3b8' }}
            />
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '16px',
                border: 'none',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              }}
              formatter={tooltipFormatter}
            />
            <Legend
              verticalAlign="top"
              height={36}
              wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}
            />
            {bars.map(b => (
              <Bar
                key={b.dataKey}
                yAxisId={b.yAxisId ?? 'left'}
                dataKey={b.dataKey}
                name={b.name ?? b.dataKey}
                fill={b.color}
                stackId={b.stackId}
                radius={0}
                barSize={b.barSize ?? 32}
              >
                {showBarLabels && (
                  <LabelList
                    dataKey={b.dataKey}
                    position="center"
                    style={{ fontSize: 10, fontWeight: 700, fill: '#fff' }}
                    formatter={(v: unknown) => {
                      if (v === null || v === undefined || v === '') return ''
                      const num = Number(v)
                      if (!Number.isFinite(num) || num === 0) return ''
                      return num.toLocaleString('ja-JP', { maximumFractionDigits: 0 })
                    }}
                  />
                )}
              </Bar>
            ))}
            {lines.map(l => (
              <Line
                key={l.dataKey}
                yAxisId={l.yAxisId ?? 'right'}
                type="linear"
                dataKey={l.dataKey}
                name={l.name ?? l.dataKey}
                stroke={l.color}
                strokeWidth={3}
                dot={{ r: 4, fill: l.color }}
                connectNulls={false}
              >
                {showLineLabels && (
                  <LabelList
                    dataKey={l.dataKey}
                    position="top"
                    offset={8}
                    style={{ fontSize: 10, fontWeight: 700, fill: l.color }}
                    formatter={(v: unknown) => {
                      if (v === null || v === undefined || v === '') return ''
                      const num = Number(v)
                      if (!Number.isFinite(num)) return ''
                      const isRate = rateKeys.includes(l.name ?? l.dataKey)
                      const formatted = num.toLocaleString('ja-JP', { maximumFractionDigits: isRate ? 1 : 0 })
                      return isRate ? `${formatted}%` : formatted
                    }}
                  />
                )}
              </Line>
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
