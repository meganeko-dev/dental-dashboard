// 'use client'
// import { useState, useEffect } from 'react'
// import { createClient } from '@supabase/supabase-js'

// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
// )

// export function GoalSetter({ corpId }: { corpId: string }) {
//   // 法人によってKPI項目を変える場合はここで分岐可能
//   // 現状は共通
//   const targetKPIs = ["メンテナンス移行率", "キャンセル率", "予約取得率", "離脱率", "当日キャンセル率"];
  
//   const [goals, setGoals] = useState<Record<string, number>>({})
//   const [editing, setEditing] = useState<Record<string, number>>({})
  
//   const fetchGoals = async () => {
//     if (!corpId) return

//     // corpId で絞り込んで取得
//     const { data } = await supabase
//       .from('data_mappings')
//       .select('key, value')
//       .eq('mapping_type', 'kpi_goal')
//       .eq('corporation_id', corpId)
    
//     const formatted: Record<string, number> = {}
//     data?.forEach(d => {
//       formatted[d.key] = Number(d.value)
//     })
//     setGoals(formatted)
//   }

//   useEffect(() => { fetchGoals() }, [corpId])
  
//   const save = async () => {
//     if (!corpId) return

//     const updates = targetKPIs.map(kpi => ({
//       corporation_id: corpId,
//       mapping_type: 'kpi_goal',
//       key: kpi,
//       value: String(editing[kpi] ?? goals[kpi] ?? 0)
//     }))

//     const { error } = await supabase
//       .from('data_mappings')
//       .upsert(updates, { onConflict: 'corporation_id, mapping_type, key' })

//     if (error) {
//       alert('エラーが発生しました: ' + error.message)
//     } else {
//       alert('目標値を保存しました')
//       fetchGoals()
//       setEditing({})
//     }
//   }

//   return (
//     <div className="space-y-6 animate-in fade-in">
//       <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
//         <table className="w-full text-left text-sm">
//           <thead className="bg-slate-50 border-b text-[10px] text-slate-400 font-black uppercase">
//             <tr><th className="p-5">KPI項目</th><th className="p-5 text-right">目標値 (%)</th></tr>
//           </thead>
//           <tbody className="divide-y">
//             {targetKPIs.map(kpi => (
//               <tr key={kpi} className="hover:bg-slate-50 transition-colors">
//                 <td className="p-5 font-bold text-slate-700">{kpi}</td>
//                 <td className="p-5 text-right">
//                   <input 
//                     type="number" 
//                     value={editing[kpi] ?? goals[kpi] ?? 0} 
//                     onChange={e => setEditing({...editing, [kpi]: parseFloat(e.target.value)})} 
//                     className="border rounded-lg px-3 py-2 text-sm w-28 text-right font-black focus:ring-2 focus:ring-blue-600 outline-none shadow-sm transition-all"
//                   />
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>
//       <div className="flex justify-end">
//         <button onClick={save} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-95">
//           変更を保存
//         </button>
//       </div>
//     </div>
//   )
// }

'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function GoalSetter({ corpId }: { corpId: string }) {
  const targetKPIs = ["メンテナンス移行率", "キャンセル率", "予約取得率", "離脱率", "当日キャンセル率"];
  
  const [goals, setGoals] = useState<Record<string, number>>({})
  const [editing, setEditing] = useState<Record<string, number>>({})
  
  const fetchGoals = async () => {
    if (!corpId) return

    // corpId で絞り込んで取得
    const { data } = await supabase
      .from('data_mappings')
      .select('key, value')
      .eq('mapping_type', 'kpi_goal')
      .eq('corporation_id', corpId)
    
    const formatted: Record<string, number> = {}
    data?.forEach(d => {
      formatted[d.key] = Number(d.value)
    })
    setGoals(formatted)
  }

  useEffect(() => { fetchGoals() }, [corpId])
  
  const save = async () => {
    if (!corpId) return

    const updates = targetKPIs.map(kpi => ({
      corporation_id: corpId,
      mapping_type: 'kpi_goal',
      key: kpi,
      value: String(editing[kpi] ?? goals[kpi] ?? 0)
    }))

    const { error } = await supabase
      .from('data_mappings')
      .upsert(updates, { onConflict: 'corporation_id, mapping_type, key' })

    if (error) {
      alert('エラーが発生しました: ' + error.message)
    } else {
      alert('目標値を保存しました')
      fetchGoals()
      setEditing({})
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b text-[10px] text-slate-400 font-black uppercase">
            <tr><th className="p-5">KPI項目</th><th className="p-5 text-right">目標値 (%)</th></tr>
          </thead>
          <tbody className="divide-y">
            {targetKPIs.map(kpi => (
              <tr key={kpi} className="hover:bg-slate-50 transition-colors">
                <td className="p-5 font-bold text-slate-700">{kpi}</td>
                <td className="p-5 text-right">
                  <input 
                    type="number" 
                    value={editing[kpi] ?? goals[kpi] ?? 0} 
                    onChange={e => setEditing({...editing, [kpi]: parseFloat(e.target.value)})} 
                    className="border rounded-lg px-3 py-2 text-sm w-28 text-right font-black focus:ring-2 focus:ring-blue-600 outline-none shadow-sm transition-all"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <button onClick={save} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-95">
          変更を保存
        </button>
      </div>
    </div>
  )
}