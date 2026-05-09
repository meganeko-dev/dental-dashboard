'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'

export const AGE_BINS = [
  { label: '12歳以下',     min: 0,  max: 12 },
  { label: '13歳〜19歳',   min: 13, max: 19 },
  { label: '20代',         min: 20, max: 29 },
  { label: '30代',         min: 30, max: 39 },
  { label: '40代',         min: 40, max: 49 },
  { label: '50代',         min: 50, max: 59 },
  { label: '60代',         min: 60, max: 69 },
  { label: '70代',         min: 70, max: 79 },
  { label: '80歳以上',     min: 80, max: 200 },
] as const

export type AgeBucket = { label: string; count: number }

type Props = {
  data: AgeBucket[]
  title?: string
  height?: number
}

export default function AgeDistributionChart({ data, title = '年齢構成', height = 360 }: Props) {
  const total = data.reduce((s, d) => s + d.count, 0)

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
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 32, bottom: 8, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={92}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fontWeight: 'bold', fill: '#475569' }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '16px',
                  border: 'none',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                }}
                formatter={(v: unknown) => [`${Number(v).toLocaleString('ja-JP')} 名`, '人数']}
              />
              <Bar dataKey="count" fill="#1e3a8a" radius={[0, 6, 6, 0]} barSize={22}>
                <LabelList
                  dataKey="count"
                  position="right"
                  style={{ fontSize: 11, fontWeight: 700, fill: '#1e3a8a' }}
                  formatter={(v: unknown) => {
                    const n = Number(v)
                    return Number.isFinite(n) && n > 0 ? n.toLocaleString('ja-JP') : ''
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
