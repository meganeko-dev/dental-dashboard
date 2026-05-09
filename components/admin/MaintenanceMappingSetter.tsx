'use client'
import { useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const STAGE_PREFIX = '来院人数_ステージ内訳_'

type MappingRow = {
  id: string
  key: string   // クリニック名
  value: string // ステージ内訳項目名（プレフィックス除去済み）
}

type StageOption = {
  clinicName: string
  itemName: string // プレフィックス除去後の表示名
}

export function MaintenanceMappingSetter({ corpId }: { corpId: string }) {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  )

  const [stageOptions, setStageOptions] = useState<StageOption[]>([])
  const [mappings, setMappings] = useState<MappingRow[]>([])
  const [selectedClinic, setSelectedClinic] = useState('')
  const [selectedItem, setSelectedItem] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    const [stageRes, mapRes] = await Promise.all([
      supabase
        .from('flexible_kpis_stage_breakdown_distinct')
        .select('clinic_name, kpi_name')
        .eq('corporation_id', corpId)
        .order('clinic_name', { ascending: true }),
      supabase
        .from('data_mappings')
        .select('id, key, value')
        .eq('corporation_id', corpId)
        .eq('mapping_type', 'maintenance')
        .order('key', { ascending: true }),
    ])

    const opts: StageOption[] = (stageRes.data ?? []).map(r => ({
      clinicName: r.clinic_name as string,
      itemName: String(r.kpi_name).replace(STAGE_PREFIX, ''),
    }))
    setStageOptions(opts)
    setMappings((mapRes.data ?? []) as MappingRow[])
    setLoading(false)
  }

  useEffect(() => {
    if (!corpId) return
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corpId])

  const clinics = useMemo(() => {
    return Array.from(new Set(stageOptions.map(o => o.clinicName))).sort()
  }, [stageOptions])

  const itemsForClinic = useMemo(() => {
    if (!selectedClinic) return []
    return Array.from(
      new Set(stageOptions.filter(o => o.clinicName === selectedClinic).map(o => o.itemName)),
    ).sort()
  }, [stageOptions, selectedClinic])

  // 既に登録済みの組合せは選択肢から除外
  const availableItemsForClinic = useMemo(() => {
    const taken = new Set(
      mappings.filter(m => m.key === selectedClinic).map(m => m.value),
    )
    return itemsForClinic.filter(i => !taken.has(i))
  }, [itemsForClinic, mappings, selectedClinic])

  // クリニック切替時に選択中の項目をリセット
  useEffect(() => {
    if (!availableItemsForClinic.includes(selectedItem)) setSelectedItem('')
  }, [availableItemsForClinic, selectedItem])

  const canSubmit = !!selectedClinic && !!selectedItem && !saving

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const { error } = await supabase.from('data_mappings').insert([
        {
          corporation_id: corpId,
          mapping_type: 'maintenance',
          key: selectedClinic,
          value: selectedItem,
        },
      ])
      if (error) throw error
      setSelectedItem('')
      await fetchAll()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      alert(`登録に失敗しました: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この設定を削除しますか？')) return
    const { error } = await supabase.from('data_mappings').delete().eq('id', id)
    if (error) {
      alert(`削除に失敗しました: ${error.message}`)
      return
    }
    await fetchAll()
  }

  if (loading) {
    return (
      <div className="p-8 text-slate-400 animate-pulse font-bold">Loading Settings...</div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 入力フォーム */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-5">
        <div className="space-y-1">
          <h3 className="text-lg font-black text-slate-800 uppercase italic">メンテナンス設定</h3>
          <p className="text-xs text-slate-400 font-bold">
            「日別状況」CSV のステージ内訳のうち、どれを「メンテナンス治療」として集計するかをクリニック単位で設定します。
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:items-end">
          <div className="flex-1">
            <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
              クリニック
            </label>
            <select
              value={selectedClinic}
              onChange={e => setSelectedClinic(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— クリニックを選択 —</option>
              {clinics.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
              ステージ内訳の項目
            </label>
            <select
              value={selectedItem}
              onChange={e => setSelectedItem(e.target.value)}
              disabled={!selectedClinic}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">
                {selectedClinic ? '— 項目を選択 —' : 'クリニックを先に選んでください'}
              </option>
              {availableItemsForClinic.map(i => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-slate-900 text-white px-8 py-2.5 rounded-lg text-sm font-black hover:bg-slate-800 transition-all shadow disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            {saving ? '登録中...' : '設定'}
          </button>
        </div>

        {clinics.length === 0 && (
          <div className="text-xs text-slate-400 italic font-bold p-4 bg-slate-50 rounded-xl">
            「来院人数_ステージ内訳_*」のデータがまだ登録されていません。先に「日別状況」CSVをアップロードしてください。
          </div>
        )}
        {selectedClinic && availableItemsForClinic.length === 0 && itemsForClinic.length > 0 && (
          <div className="text-xs text-slate-400 italic font-bold">
            このクリニックの全項目は登録済みです。
          </div>
        )}
      </div>

      {/* 登録済み一覧 */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-baseline gap-3">
          <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">
            登録済みのメンテナンス設定
          </h4>
          <span className="text-xs font-bold text-slate-400">{mappings.length} 件</span>
        </div>
        {mappings.length === 0 ? (
          <div className="p-8 text-center text-xs font-bold text-slate-400 italic">
            まだ登録がありません。
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-widest">
              <tr className="text-left border-b border-slate-200">
                <th className="px-6 py-3">クリニック</th>
                <th className="px-6 py-3">ステージ内訳項目</th>
                <th className="px-6 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mappings.map(m => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 font-bold text-slate-700">{m.key}</td>
                  <td className="px-6 py-3 text-slate-600">{m.value}</td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-slate-400 text-xs font-black hover:text-red-500 transition-colors cursor-pointer"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
