'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export function MaintenanceSetter({ corpId }: { corpId: string }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  const [availableItems, setAvailableItems] = useState<string[]>([]) // 💡 DBから取得した項目
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      // 1. 💡 DBに存在する「来院人数_」系のKPIを動的に取得する
      const { data: kpiData } = await supabase
        .from('flexible_kpis')
        .select('kpi_name')
        .eq('corporation_id', corpId)
        .like('kpi_name', '来院人数_%')

      // 「既存患者」「新規患者」を除外し、重複を排除してクリーンアップ
      const items = Array.from(new Set(
        (kpiData || [])
          .map(d => d.kpi_name.replace('来院人数_', ''))
          .filter(name => name !== '既存患者' && name !== '新規患者')
      )).sort();

      setAvailableItems(items);

      // 2. 現在の設定（true/false）を読み込む
      const { data: mappingData } = await supabase
        .from('data_mappings')
        .select('key, value')
        .eq('corporation_id', corpId)
        .eq('mapping_type', 'is_maintenance')
      
      const initialFlags: Record<string, boolean> = {}
      items.forEach(item => { initialFlags[item] = false })
      mappingData?.forEach(d => {
        if (items.includes(d.key)) {
          initialFlags[d.key] = d.value === 'true'
        }
      })
      
      setFlags(initialFlags)
      setLoading(false)
    }
    load()
  }, [corpId, supabase])

  const handleSave = async () => {
    setSaving(true)
    try {
      // 💡 表示されている（DBに存在する）全項目分を保存
      const updates = availableItems.map(item => ({
        corporation_id: corpId,
        mapping_type: 'is_maintenance',
        key: item,
        value: flags[item] ? 'true' : 'false'
      }))

      const { error } = await supabase
        .from('data_mappings')
        .upsert(updates, { 
          onConflict: 'corporation_id, mapping_type, key' 
        })

      if (error) throw error
      alert('メンテナンス定義を更新しました。')
    } catch (err: any) {
      console.error(err)
      alert('保存に失敗しました: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-slate-400 animate-pulse font-bold">Loading Settings...</div>

  return (
    <div className="bg-white rounded-3xl border shadow-sm overflow-hidden p-8 space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h3 className="text-lg font-black text-slate-800 uppercase italic">メンテナンス項目の定義</h3>
          <p className="text-xs text-slate-400 font-bold">
            DBに登録されている来院目的から、どれを「メンテナンス」として集計するか選択してください。
          </p>
        </div>
        <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
          Dynamic Items Mode
        </div>
      </div>

      {availableItems.length === 0 ? (
        <div className="p-10 text-center border-2 border-dashed rounded-3xl text-slate-400 font-bold italic">
          「来院人数」の内訳データがまだ登録されていません。先にCSVをアップロードしてください。
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {availableItems.map(item => (
            <label 
              key={item} 
              className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                flags[item] 
                  ? 'border-blue-600 bg-blue-50 shadow-sm' 
                  : 'border-slate-100 hover:border-slate-200 text-slate-400'
              }`}
            >
              <input 
                type="checkbox" 
                className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={!!flags[item]}
                onChange={e => setFlags({...flags, [item]: e.target.checked})}
              />
              <span className={`text-sm font-black ${flags[item] ? 'text-slate-800' : 'text-slate-400'}`}>
                {item}
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="pt-6 border-t flex justify-between items-center">
        <p className="text-[10px] text-slate-400 font-bold italic">
          * CSVに存在する「来院人数_◯◯」の項目がここに自動で表示されます。
        </p>
        <button 
          onClick={handleSave}
          disabled={saving || availableItems.length === 0}
          className="bg-slate-900 text-white px-10 py-3 rounded-xl text-xs font-black hover:bg-slate-800 transition-all shadow-lg disabled:opacity-50 active:scale-95"
        >
          {saving ? '更新中...' : '設定を反映させる ✨'}
        </button>
      </div>
    </div>
  )
}