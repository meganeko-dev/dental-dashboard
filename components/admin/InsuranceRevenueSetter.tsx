// 'use client'
// import { useState, useEffect } from 'react'
// import { createBrowserClient } from '@supabase/ssr'

// export function InsuranceRevenueSetter({ corpId, mode }: { corpId: string, mode: 'single' | 'multi' }) {
//   const supabase = createBrowserClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
//   )

//   const [clinics, setClinics] = useState<{id: string, name: string}[]>([])
//   const [history, setHistory] = useState<any[]>([])
//   const [loading, setLoading] = useState(true)
//   const [saving, setSaving] = useState(false)

//   // フォームState
//   const [date, setDate] = useState(new Date().toISOString().split('T')[0])
//   const [targetClinicId, setTargetClinicId] = useState('')
//   const [amount, setAmount] = useState<number | ''>('')
//   const [editingId, setEditingId] = useState<string | null>(null)

//   useEffect(() => {
//     async function init() {
//       // クリニックリストの取得
//       const { data: clinicData } = await supabase
//         .from('clinics')
//         .select('id, name')
//         .eq('corporation_id', corpId)
      
//       if (clinicData) {
//         setClinics(clinicData)
//         if (clinicData.length > 0) setTargetClinicId(clinicData[0].id)
//       }
//       fetchHistory()
//     }
//     init()
//   }, [corpId, supabase])

//   const fetchHistory = async () => {
//     const { data } = await supabase
//       .from('flexible_kpis')
//       .select('*')
//       .eq('corporation_id', corpId)
//       .eq('kpi_name', '保険治療')
//       .order('date', { ascending: true })
    
//     setHistory(data || [])
//     setLoading(false)
//   }

//   const handleSave = async () => {
//     if (amount === '' || !date) return alert('日付と金額を入力してください。')
//     if (mode === 'multi' && !targetClinicId) return alert('クリニックを選択してください。')

//     setSaving(true)
//     const selectedClinic = clinics.find(c => c.id === targetClinicId)
//     const d = new Date(date)

//     const payload = {
//       corporation_id: corpId,
//       clinic_id: mode === 'multi' ? targetClinicId : (clinics[0]?.id || null),
//       clinic_name: mode === 'multi' ? selectedClinic?.name : (clinics[0]?.name || ''),
//       staff_name: '',
//       year: d.getFullYear(),
//       month: d.getMonth() + 1,
//       date: date,
//       segment: 'clinic',
//       kpi_name: '保険治療',
//       value: amount,
//       is_target: false
//     }

//     try {
//       if (editingId) {
//         await supabase.from('flexible_kpis').update(payload).eq('id', editingId)
//       } else {
//         await supabase.from('flexible_kpis').insert([payload])
//       }
      
//       setAmount('')
//       setEditingId(null)
//       fetchHistory()
//       alert('保存しました。')
//     } catch (err: any) {
//       alert('エラーが発生しました: ' + err.message)
//     } finally {
//       setSaving(false)
//     }
//   }

//   const handleEdit = (item: any) => {
//     setEditingId(item.id)
//     setDate(item.date)
//     setTargetClinicId(item.clinic_id)
//     setAmount(item.value)
//     window.scrollTo({ top: 0, behavior: 'smooth' })
//   }

//   const handleDelete = async (id: string) => {
//     if (!confirm('このデータを削除しますか？')) return
//     await supabase.from('flexible_kpis').delete().eq('id', id)
//     fetchHistory()
//   }

//   if (loading) return <div className="p-8 text-slate-400 animate-pulse font-bold">Loading...</div>

//   return (
//     <div className="space-y-8 animate-in fade-in duration-500">
//       {/* 入力フォームカード */}
//       <div className="bg-white rounded-3xl border shadow-sm p-8 space-y-6">
//         <div className="space-y-1 border-b pb-4">
//           <h3 className="text-lg font-black text-slate-800 uppercase italic">保険治療金額 入力</h3>
//           <p className="text-xs text-slate-400 font-bold">レセコンの保険点数合計（円）を日別に入力してください。</p>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//           <div className="flex flex-col gap-2">
//             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">診療日</label>
//             <input 
//               type="date" 
//               value={date}
//               onChange={e => setDate(e.target.value)}
//               className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none"
//             />
//           </div>

//           {mode === 'multi' && (
//             <div className="flex flex-col gap-2">
//               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">対象クリニック</label>
//               <select 
//                 value={targetClinicId}
//                 onChange={e => setTargetClinicId(e.target.value)}
//                 className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
//               >
//                 {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
//               </select>
//             </div>
//           )}

//           <div className="flex flex-col gap-2">
//             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">保険治療売上金額（円）</label>
//             <input 
//               type="number" 
//               placeholder="150000"
//               value={amount}
//               onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
//               className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none"
//             />
//           </div>
//         </div>

//         <div className="pt-4 flex justify-end gap-3">
//           {editingId && (
//             <button onClick={() => {setEditingId(null); setAmount('');}} className="px-6 py-3 rounded-xl text-xs font-black text-slate-400 hover:bg-slate-100 transition-all">キャンセル</button>
//           )}
//           <button 
//             onClick={handleSave}
//             disabled={saving}
//             className="bg-blue-600 text-white px-10 py-3 rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50"
//           >
//             {saving ? '保存中...' : editingId ? '変更を保存 💾' : 'データを登録 ✨'}
//           </button>
//         </div>
//       </div>

//       {/* 履歴一覧カード */}
//       <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
//         <div className="p-6 border-b bg-slate-50/50">
//           <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight">登録済みデータ（日付順）</h3>
//         </div>
//         <div className="overflow-x-auto">
//           <table className="w-full text-left text-xs">
//             <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase">
//               <tr>
//                 <th className="p-5">日付</th>
//                 {mode === 'multi' && <th className="p-5">クリニック</th>}
//                 <th className="p-5 text-right">金額</th>
//                 <th className="p-5 text-center">操作</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y border-t">
//               {history.length === 0 ? (
//                 <tr><td colSpan={5} className="p-10 text-center text-slate-400 font-bold italic">データがありません</td></tr>
//               ) : (
//                 history.map(item => (
//                   <tr key={item.id} className="hover:bg-slate-50 transition-colors">
//                     <td className="p-5 font-black text-slate-600">{item.date}</td>
//                     {mode === 'multi' && <td className="p-5 font-bold text-slate-500">{item.clinic_name}</td>}
//                     <td className="p-5 text-right font-black text-slate-900">{Number(item.value).toLocaleString()} 円</td>
//                     <td className="p-5">
//                       <div className="flex justify-center gap-2">
//                         <button onClick={() => handleEdit(item)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all" title="編集">📝</button>
//                         <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-all" title="削除">🗑️</button>
//                       </div>
//                     </td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     </div>
//   )
// }

'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export function InsuranceRevenueSetter({ corpId, mode }: { corpId: string, mode: 'single' | 'multi' }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [clinics, setClinics] = useState<{id: string, name: string}[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // フォームState
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [targetClinicId, setTargetClinicId] = useState('')
  const [amount, setAmount] = useState<number | ''>('')
  const [editingId, setEditingId] = useState<string | null>(null)

  // 💡 検索用State
  const [searchStartDate, setSearchStartDate] = useState('')
  const [searchEndDate, setSearchEndDate] = useState('')

  useEffect(() => {
    async function init() {
      const { data: clinicData } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('corporation_id', corpId)
      
      if (clinicData) {
        setClinics(clinicData)
        if (clinicData.length > 0) setTargetClinicId(clinicData[0].id)
      }
      fetchHistory()
    }
    init()
  }, [corpId, supabase])

  // 💡 検索条件を考慮するように fetchHistory を修正
  const fetchHistory = async () => {
    let query = supabase
      .from('flexible_kpis')
      .select('*')
      .eq('corporation_id', corpId)
      .eq('kpi_name', '保険治療')
      .not('date', 'is', null)

    if (searchStartDate) {
      query = query.gte('date', searchStartDate)
    }
    if (searchEndDate) {
      query = query.lte('date', searchEndDate)
    }

    const { data } = await query.order('date', { ascending: true })
    
    setHistory(data || [])
    setLoading(false)
  }

  const handleSave = async () => {
    if (amount === '' || !date) return alert('日付と金額を入力してください。')
    if (mode === 'multi' && !targetClinicId) return alert('クリニックを選択してください。')

    setSaving(true)
    const selectedClinic = clinics.find(c => c.id === targetClinicId)
    const d = new Date(date)

    const payload = {
      corporation_id: corpId,
      clinic_id: mode === 'multi' ? targetClinicId : (clinics[0]?.id || null),
      clinic_name: mode === 'multi' ? selectedClinic?.name : (clinics[0]?.name || ''),
      staff_name: '',
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      date: date,
      segment: 'clinic',
      kpi_name: '保険治療',
      value: amount,
      is_target: false
    }

    try {
      if (editingId) {
        await supabase.from('flexible_kpis').update(payload).eq('id', editingId)
      } else {
        await supabase.from('flexible_kpis').insert([payload])
      }
      
      setAmount('')
      setEditingId(null)
      fetchHistory()
      alert('保存しました。')
    } catch (err: any) {
      alert('エラーが発生しました: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (item: any) => {
    setEditingId(item.id)
    setDate(item.date)
    setTargetClinicId(item.clinic_id)
    setAmount(item.value)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このデータを削除しますか？')) return
    await supabase.from('flexible_kpis').delete().eq('id', id)
    fetchHistory()
  }

  const handleClearSearch = () => {
    setSearchStartDate('')
    setSearchEndDate('')
    // State更新は非同期なので、空文字を直接使って再取得
    setTimeout(() => fetchHistory(), 0)
  }

  if (loading) return <div className="p-8 text-slate-400 animate-pulse font-bold">Loading...</div>

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl border shadow-sm p-8 space-y-6">
        <div className="space-y-1 border-b pb-4">
          <h3 className="text-lg font-black text-slate-800 uppercase italic">保険治療金額 入力</h3>
          <p className="text-xs text-slate-400 font-bold">レセコンの保険点数合計（円）を日別に入力してください。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">診療日</label>
            <input 
              type="date" 
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

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

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">保険治療金額（円）</label>
            <input 
              type="number" 
              placeholder="150000"
              value={amount}
              onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-3">
          {editingId && (
            <button onClick={() => {setEditingId(null); setAmount('');}} className="px-6 py-3 rounded-xl text-xs font-black text-slate-400 hover:bg-slate-100 transition-all">キャンセル</button>
          )}
          <button 
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-10 py-3 rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50"
          >
            {saving ? '保存中...' : editingId ? '変更を保存 💾' : 'データを登録 ✨'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        {/* 💡 ヘッダーに検索UIを追加 */}
        <div className="p-6 border-b bg-slate-50/50 flex flex-wrap justify-between items-center gap-4">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight">登録済みデータ（日付順）</h3>
          
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
              onClick={fetchHistory}
              className="bg-slate-800 text-white px-4 py-1.5 rounded-xl text-[10px] font-black hover:bg-slate-700 transition-all"
            >
              検索
            </button>
            {(searchStartDate || searchEndDate) && (
              <button 
                onClick={handleClearSearch}
                className="text-slate-400 hover:text-slate-600 text-[10px] font-bold ml-1"
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
                <th className="p-5">日付</th>
                {mode === 'multi' && <th className="p-5">クリニック</th>}
                <th className="p-5 text-right">金額</th>
                <th className="p-5 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y border-t">
              {history.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-slate-400 font-bold italic">データがありません</td></tr>
              ) : (
                history.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-5 font-black text-slate-600">{item.date}</td>
                    {mode === 'multi' && <td className="p-5 font-bold text-slate-500">{item.clinic_name}</td>}
                    <td className="p-5 text-right font-black text-slate-900">{Number(item.value).toLocaleString()} 円</td>
                    <td className="p-5 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleEdit(item)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all">📝</button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-all">🗑️</button>
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