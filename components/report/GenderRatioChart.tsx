'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Datum = { name: string; value: number; color: string }

type Props = {
  data: { female: number; male: number; unset: number }
  title?: string
  height?: number
}

export default function GenderRatioChart({ data, title = '男女比', height = 320 }: Props) {
  const total = data.female + data.male + data.unset
  const series: Datum[] = [
    { name: '女性',   value: data.female, color: '#e57373' },
    { name: '男性',   value: data.male,   color: '#4185f4' },
    { name: '未設定', value: data.unset,  color: '#fbbc04' },
  ]

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">{title}</h3>
        <span className="text-xs font-bold text-slate-400 tabular-nums">合計 {total.toLocaleString('ja-JP')} 名</span>
      </div>
      {total === 0 ? (
        <div className="text-xs text-slate-400 py-12 text-center">
          患者リストデータが取り込まれていません。Adminから「患者リスト」CSVをアップロードしてください。
        </div>
      ) : (
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={series}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={110}
                paddingAngle={1}
                stroke="#fff"
                strokeWidth={2}
                labelLine={false}
                // recharts の Pie label 型は intersection 型のため厳密適合しない。既存ダッシュボードと同じく any を許容。
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label={(props: any) => {
                  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props
                  if (!percent || percent < 0.02) return null
                  const RAD = Math.PI / 180
                  const r = innerRadius + (outerRadius - innerRadius) / 2
                  const x = cx + r * Math.cos(-midAngle * RAD)
                  const y = cy + r * Math.sin(-midAngle * RAD)
                  return (
                    <text
                      x={x}
                      y={y}
                      fill="#fff"
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{ fontSize: 12, fontWeight: 700 }}
                    >
                      {(percent * 100).toFixed(1)}%
                    </text>
                  )
                }}
              >
                {series.map(d => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: '16px',
                  border: 'none',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                }}
                formatter={(v: unknown, name: unknown) => {
                  const num = Number(v)
                  const pct = total > 0 ? `${((num / total) * 100).toFixed(1)}%` : ''
                  return [`${num.toLocaleString('ja-JP')} 名 (${pct})`, String(name)]
                }}
              />
              <Legend
                verticalAlign="middle"
                align="right"
                layout="vertical"
                wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
