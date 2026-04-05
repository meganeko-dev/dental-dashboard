'use client'
import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

// 治療内容 → kpi_name / treatment_type のマッピング（FWLRNER6と一致させる）
const TREATMENT_OPTIONS = [
  { label: '保険',   kpiName: '社会保険_金額', treatmentType: '' },
  { label: '自費',   kpiName: '自費治療_金額', treatmentType: '' },
  { label: '物販',   kpiName: '雑収入_金額',   treatmentType: '物販' },
  { label: 'その他', kpiName: '雑収入_金額',   treatmentType: 'その他' },
] as const

type TreatmentLabel = typeof TREATMENT_OPTIONS[number]['label']

const ALL_KPI_NAMES = [...new Set(TREATMENT_OPTIONS.map(t => t.kpiName))]

export function InsuranceRevenueSetter({ corpId, mode }: { corpId: string, mode: 'single' | 'multi' | null }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const now = new Date()
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // フォームState
  const [year, setYear]               = useState(now.getFullYear())
  const [month, setMonth]             = useState(now.getMonth() + 1)
  const [day, setDay]                 = useState<number | ''>('')
  const [targetClinicId, setTargetClinicId] = useState('')
  const [treatment, setTreatment]     = useState<TreatmentLabel>('保険')
  const [value, setValue]             = useState<number | ''>('')
  const [editingId, setEditingId]     = useState<string | null>(null)

  // 検索State
  const [searchStartDate, setSearchStartDate] = useState('')
  const [searchEndDate, setSearchEndDate]     = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: clinicData } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('corporation_id', corpId)
      if (clinicData && clinicData.length > 0) {
        setClinics(clinicData)
        setTargetClinicId(clinicData[0].id)
      }
    }
    init()
  }, [corpId])

  const fetchHistory = useCallback(async (start = searchStartDate, end = searchEndDate) => {
    let query = supabase
      .from('flexible_kpis')
      .select('*')
      .eq('corporation_id', corpId)
      .in('kpi_name', ALL_KPI_NAMES)
      .eq('segment', 'clinic')
      .eq('staff_name', '')

    if (start) query = query.gte('date', start)
    if (end)   query = query.lte('date', end)

    const { data } = await query.order('date', { ascending: false }).limit(200)
    setHistory(data || [])
    setLoading(false)
  }, [corpId, searchStartDate, searchEndDate])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const getTreatmentLabel = (item: any): TreatmentLabel => {
    const opt = TREATMENT_OPTIONS.find(
      t => t.kpiName === item.kpi_name && t.treatmentType === (item.treatment_type ?? '')
    )
    return (opt?.label ?? item.kpi_name) as TreatmentLabel
  }

  const resetForm = () => {
    setValue('')
    setDay('')
    setEditingId(null)
  }

  const handleSave = async () => {
    if (value === '') return alert('金額を入力してください。')
    if (mode === 'multi' && !targetClinicId) return alert('クリニックを選択してください。')

    const actualDay = day === '' ? 1 : day
    const dateStr   = `${year}-${String(month).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`
    const option    = TREATMENT_OPTIONS.find(t => t.label === treatment)!
    const clinic    = mode === 'multi' ? clinics.find(c => c.id === targetClinicId) : clinics[0]

    const payload = {
      corporation_id:  corpId,
      clinic_id:       clinic?.id ?? '',
      clinic_name:     clinic?.name ?? '',
      staff_name:      '',
      year,
      month,
      date:            dateStr,
      segment:         'clinic',
      kpi_name:        option.kpiName,
      treatment_type:  option.treatmentType,
      staff_role:      '',
      value,
      is_target:       false,
    }

    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase.from('flexible_kpis').update(payload).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('flexible_kpis').upsert([payload], {
          onConflict: 'corporation_id, clinic_name, staff_name, year, month, date, segment, kpi_name, is_target, treatment_type, staff_role'
        })
        if (error) throw error
      }
      resetForm()
      fetchHistory()
      alert('保存しました。')
    } catch (err: any) {
      alert('エラーが発生しました: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (item: any) => {
    const parts = (item.date as string).split('-')
    setEditingId(item.id)
    setYear(item.year)
    setMonth(item.month)
    setDay(parseInt(parts[2], 10))
    if (mode === 'multi') setTargetClinicId(item.clinic_id)
    setTreatment(getTreatmentLabel(item))
    setValue(item.value)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このデータを削除しますか？')) return
    await supabase.from('flexible_kpis').delete().eq('id', id)
    fetchHistory()
  }

  if (loading) return <div className="p-8 text-slate-400 animate-pulse font-bold">Loading...</div>

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* 入力フォーム */}
      <div className="bg-white rounded-3xl border shadow-sm p-8 space-y-6">
        <div className="space-y-1 border-b pb-4">
          <h3 className="text-lg font-black text-slate-800 uppercase italic">売上データ 入力</h3>
          <p className="text-xs text-slate-400 font-bold">対象期間・クリニック・治療内容を選択して金額を入力してください。</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 対象年 */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">対象年</label>
            <input
              type="number"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* 対象月 */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">対象月</label>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
          </div>

          {/* 対象日（任意、未入力で1） */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">対象日 <span className="text-slate-300 normal-case font-medium">（任意 / 未入力→1日）</span></label>
            <input
              type="number"
              min={1}
              max={31}
              placeholder="1"
              value={day}
              onChange={e => setDay(e.target.value === '' ? '' : Number(e.target.value))}
              className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* 治療内容 */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">治療内容</label>
            <select
              value={treatment}
              onChange={e => setTreatment(e.target.value as TreatmentLabel)}
              className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
            >
              {TREATMENT_OPTIONS.map(t => (
                <option key={t.label} value={t.label}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 対象クリニック（マルチのみ） */}
          {mode === 'multi' && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">対象クリニック</label>
              <select
                value={targetClinicId}
                onChange={e => setTargetClinicId(e.target.value)}
                className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* 金額 */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">金額（円）</label>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={value}
              onChange={e => setValue(e.target.value === '' ? '' : Number(e.target.value))}
              className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-3">
          {editingId && (
            <button onClick={resetForm} className="px-6 py-3 rounded-xl text-xs font-black text-slate-400 hover:bg-slate-100 transition-all">
              キャンセル
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-10 py-3 rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50"
          >
            {saving ? '保存中...' : editingId ? '変更を保存 💾' : 'データを登録'}
          </button>
        </div>
      </div>

      {/* 登録済みデータ一覧 */}
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-slate-50/50 flex flex-wrap justify-between items-center gap-4">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight">登録済みデータ（最新200件）</h3>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={searchStartDate}
              onChange={e => setSearchStartDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-bold focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <span className="text-slate-400 text-xs">〜</span>
            <input
              type="date"
              value={searchEndDate}
              onChange={e => setSearchEndDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-bold focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <button
              onClick={() => fetchHistory()}
              className="bg-slate-800 text-white px-4 py-1.5 rounded-xl text-[10px] font-black hover:bg-slate-700 transition-all"
            >
              検索
            </button>
            {(searchStartDate || searchEndDate) && (
              <button
                onClick={() => { setSearchStartDate(''); setSearchEndDate(''); fetchHistory('', '') }}
                className="text-slate-400 hover:text-slate-600 text-[10px] font-bold"
              >
                クリア
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase">
              <tr>
                <th className="p-4">日付</th>
                {mode === 'multi' && <th className="p-4">クリニック</th>}
                <th className="p-4">治療内容</th>
                <th className="p-4 text-right">金額</th>
                <th className="p-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y border-t">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400 font-bold italic">データがありません</td>
                </tr>
              ) : (
                history.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-black text-slate-600">{item.date}</td>
                    {mode === 'multi' && <td className="p-4 font-bold text-slate-500">{item.clinic_name}</td>}
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        getTreatmentLabel(item) === '保険'   ? 'bg-blue-50 text-blue-600' :
                        getTreatmentLabel(item) === '自費'   ? 'bg-emerald-50 text-emerald-600' :
                        getTreatmentLabel(item) === '物販'   ? 'bg-orange-50 text-orange-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {getTreatmentLabel(item)}
                      </span>
                    </td>
                    <td className="p-4 text-right font-black text-slate-900">
                      {Number(item.value).toLocaleString()} 円
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleEdit(item)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all" title="編集">📝</button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-all" title="削除">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
