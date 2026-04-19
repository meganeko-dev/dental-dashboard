'use client'
import { useState, useEffect, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const CLINIC_INSURANCE_KPIS = ['国民健康保険_金額', '社会保険_金額']
const CLINIC_PRIVATE_KPI    = '自費治療_金額'
const CLINIC_PRODUCT_KPI    = '雑収入_金額'

const STAFF_INSURANCE_KPI = '保険治療_金額'
const STAFF_PRIVATE_KPI   = '自費治療_金額'
const STAFF_PRODUCT_KPI   = '物販_金額'

const SUB_CATEGORIES: { key: 'insurance' | 'private' | 'product'; label: string; color: string }[] = [
  { key: 'insurance', label: '保険', color: 'text-blue-600' },
  { key: 'private',   label: '自費', color: 'text-emerald-600' },
  { key: 'product',   label: '物販', color: 'text-orange-600' },
]

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

type RowData = {
  name: string
  isClinicTotal: boolean
  byMonth: { [month: number]: { insurance: number; private: number; product: number } }
}

export function RevenueTableView({ corpId }: { corpId: string }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const now = new Date()
  const [year, setYear]       = useState(now.getFullYear())
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([])
  const [clinicName, setClinicName] = useState<string>('')
  const [rawRows, setRawRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: clinicData } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('corporation_id', corpId)
      if (clinicData && clinicData.length > 0) {
        setClinics(clinicData)
        setClinicName(clinicData[0].name)
      }
    }
    init()
  }, [corpId])

  useEffect(() => {
    if (!clinicName) return
    const fetchData = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('flexible_kpis')
        .select('segment, staff_name, kpi_name, value, month')
        .eq('corporation_id', corpId)
        .eq('clinic_name', clinicName)
        .eq('year', year)
        .eq('is_target', false)
        .in('kpi_name', [
          ...CLINIC_INSURANCE_KPIS,
          CLINIC_PRIVATE_KPI,
          CLINIC_PRODUCT_KPI,
          STAFF_INSURANCE_KPI,
          STAFF_PRIVATE_KPI,
          STAFF_PRODUCT_KPI,
        ])
      setRawRows(data ?? [])
      setLoading(false)
    }
    fetchData()
  }, [corpId, clinicName, year])

  const rows: RowData[] = useMemo(() => {
    const emptyMonthMap = () => {
      const m: RowData['byMonth'] = {}
      for (const mo of MONTHS) m[mo] = { insurance: 0, private: 0, product: 0 }
      return m
    }

    const clinicRow: RowData = { name: 'クリニック全体', isClinicTotal: true, byMonth: emptyMonthMap() }
    const staffMap = new Map<string, RowData>()

    for (const r of rawRows) {
      const v = Number(r.value) || 0
      const month = Number(r.month)
      if (!MONTHS.includes(month)) continue

      if (r.segment === 'clinic') {
        if (CLINIC_INSURANCE_KPIS.includes(r.kpi_name))      clinicRow.byMonth[month].insurance += v
        else if (r.kpi_name === CLINIC_PRIVATE_KPI)          clinicRow.byMonth[month].private   += v
        else if (r.kpi_name === CLINIC_PRODUCT_KPI)          clinicRow.byMonth[month].product   += v
      } else if (r.segment === 'staff') {
        const staffName = r.staff_name || '(未設定)'
        if (!staffMap.has(staffName)) {
          staffMap.set(staffName, { name: staffName, isClinicTotal: false, byMonth: emptyMonthMap() })
        }
        const row = staffMap.get(staffName)!
        if (r.kpi_name === STAFF_INSURANCE_KPI)      row.byMonth[month].insurance += v
        else if (r.kpi_name === STAFF_PRIVATE_KPI)   row.byMonth[month].private   += v
        else if (r.kpi_name === STAFF_PRODUCT_KPI)   row.byMonth[month].product   += v
      }
    }

    return [clinicRow, ...Array.from(staffMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ja'))]
  }, [rawRows])

  const yen = (n: number) => n === 0 ? '-' : Math.round(n).toLocaleString()

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl border shadow-sm p-6 flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">対象年</label>
          <input
            type="number"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="bg-slate-50 border-none rounded-2xl px-4 py-2.5 text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none w-32"
          />
        </div>
        {clinics.length > 1 && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">クリニック</label>
            <select
              value={clinicName}
              onChange={e => setClinicName(e.target.value)}
              className="bg-slate-50 border-none rounded-2xl px-4 py-2.5 text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
            >
              {clinics.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-slate-400 animate-pulse font-bold">Loading...</div>
      ) : (
        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase sticky top-0">
                <tr>
                  <th className="px-2 py-2.5 text-left sticky left-0 bg-slate-50 z-10 min-w-[96px]">担当</th>
                  <th className="px-1.5 py-2.5 text-left min-w-[36px]">区分</th>
                  {MONTHS.map(m => (
                    <th key={m} className="px-1.5 py-2.5 text-right min-w-[72px]">{m}月</th>
                  ))}
                  <th className="px-2 py-2.5 text-right min-w-[84px] bg-slate-100">合計</th>
                </tr>
              </thead>
              <tbody className="divide-y border-t">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="p-10 text-center text-slate-400 font-bold italic">データがありません</td>
                  </tr>
                ) : (
                  rows.flatMap((row, rowIdx) => (
                    SUB_CATEGORIES.map((sub, subIdx) => {
                      const monthValues = MONTHS.map(m => row.byMonth[m][sub.key])
                      const total = monthValues.reduce((acc, v) => acc + v, 0)
                      return (
                        <tr
                          key={`${row.name}-${sub.key}`}
                          className={`${row.isClinicTotal ? 'bg-amber-50/30' : rowIdx % 2 === 0 ? '' : 'bg-slate-50/30'} hover:bg-blue-50/50 transition-colors`}
                        >
                          {subIdx === 0 && (
                            <td
                              rowSpan={3}
                              className={`px-2 py-2 font-black text-slate-800 sticky left-0 z-10 border-r ${row.isClinicTotal ? 'bg-amber-50' : 'bg-white'}`}
                            >
                              {row.name}
                            </td>
                          )}
                          <td className={`px-1.5 py-2 font-black ${sub.color}`}>{sub.label}</td>
                          {monthValues.map((v, i) => (
                            <td key={i} className={`px-1.5 py-2 text-right font-bold tabular-nums ${v === 0 ? 'text-slate-300' : 'text-slate-700'}`}>
                              {yen(v)}
                            </td>
                          ))}
                          <td className={`px-2 py-2 text-right font-black tabular-nums bg-slate-100 ${total === 0 ? 'text-slate-400' : 'text-slate-900'}`}>
                            {yen(total)}
                          </td>
                        </tr>
                      )
                    })
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
