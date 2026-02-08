// 'use client'
// import { useState, useEffect } from 'react'
// import { createClient } from '@supabase/supabase-js'
// import { KPI_NAMES } from '@/lib/kpi-engine'

// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
// )

// interface DataEditorProps {
//   corpId: string;
//   mode: 'single' | 'multi' | null;
// }

// export function DataEditor({ corpId, mode }: DataEditorProps) {
//   const [tab, setTab] = useState<'clinic' | 'person'>('clinic')
//   const [clinics, setClinics] = useState<string[]>([])
//   const [allStaffData, setAllStaffData] = useState<{clinic_name: string, staff_name: string}[]>([])
//   const [filteredStaffs, setFilteredStaffs] = useState<string[]>([])
//   const [filter, setFilter] = useState({ clinic: '', year: 2025, staff: '' })
//   const [dataGrid, setDataGrid] = useState<Record<string, Record<number, any>>>({})
//   const [editingKey, setEditingKey] = useState<string | null>(null)
//   const [loading, setLoading] = useState(false)
//   const [hasSearched, setHasSearched] = useState(false)

//   // 1. マスタデータ取得
//   useEffect(() => {
//     const fetchMasters = async () => {
//       // 医院リスト取得
//       const { data: cData } = await supabase
//         .from('unique_clinic_options')
//         .select('clinic_name')
//         .eq('corporation_id', corpId)
      
//       let sortedClinics: string[] = []
//       if (cData) {
//         sortedClinics = Array.from(new Set(cData.map(d => d.clinic_name)))
//           .filter(c => c && c !== 'All')
//           .sort((a, b) => a.localeCompare(b, 'ja'));
//         setClinics(sortedClinics)

//         // シングルモードなら自動的に医院を選択状態にする
//         if (mode === 'single' && sortedClinics.length > 0) {
//           setFilter(prev => ({ ...prev, clinic: sortedClinics[0] }))
//         }
//       }

//       // スタッフリスト取得
//       const { data: sData } = await supabase
//         .from('unique_staff_options')
//         .select('clinic_name, staff_name')
//         .eq('corporation_id', corpId)
      
//       if (sData) setAllStaffData(sData)
//     }
//     fetchMasters()
//   }, [corpId, mode])
  
//   // 2. スタッフリストのフィルタリング
//   useEffect(() => {
//     // 医院が選択されていない（かつシングルモードで自動選択もされていない）場合はスタッフを空に
//     if (!filter.clinic) {
//       setFilteredStaffs([])
//       if (mode !== 'single') setFilter(prev => ({ ...prev, staff: '' }))
//     } else {
//       // 選択された医院（シングルモードなら自動選択された医院）のスタッフを抽出
//       const available = allStaffData
//         .filter(p => p.clinic_name === filter.clinic)
//         .map(p => p.staff_name)
//         .filter((val, idx, self) => self.indexOf(val) === idx)
//         .sort((a, b) => a.localeCompare(b, 'ja'));
//       setFilteredStaffs(available)
//     }
//     setHasSearched(false)
//   }, [filter.clinic, allStaffData, mode])

//   const handleSearch = async () => {
//     if (!filter.clinic) { alert("医院データが見つかりません"); return; }
//     setLoading(true);
    
//     let query = supabase.from('flexible_kpis').select('*')
//       .eq('corporation_id', corpId) // 法人ID指定
//       .eq('clinic_name', filter.clinic)
//       .eq('year', filter.year)
//       .eq('segment', tab)
//       .eq('is_target', false)
//       .in('kpi_name', KPI_NAMES);

//     if (tab === 'person' && filter.staff) query = query.eq('staff_name', filter.staff);

//     const { data } = await query;
//     const grid: Record<string, Record<number, any>> = {};
//     KPI_NAMES.forEach(name => { grid[name] = {} });
//     data?.forEach(item => { if (grid[item.kpi_name]) grid[item.kpi_name][item.month] = item; });
    
//     setDataGrid(grid);
//     setHasSearched(true);
//     setLoading(false);
//   }

//   const saveRow = async (kpiName: string) => {
//     const row = dataGrid[kpiName];
//     const updates = Object.values(row).filter(item => item.id);
//     for (const item of updates) {
//       await supabase.from('flexible_kpis').update({ value: item.value }).eq('id', item.id);
//     }
//     setEditingKey(null);
//     alert(`${kpiName} を保存しました`);
//   }

//   return (
//     <div className="space-y-6 animate-in fade-in">
//       {/* タブ切り替え */}
//       <div className="flex gap-4 border-b border-slate-200">
//         <button onClick={() => {setTab('clinic'); setHasSearched(false);}} className={`pb-3 text-sm font-bold px-6 transition-all ${tab === 'clinic' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>医院全体</button>
//         <button onClick={() => {setTab('person'); setHasSearched(false);}} className={`pb-3 text-sm font-bold px-6 transition-all ${tab === 'person' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>個人別</button>
//       </div>

//       <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-wrap gap-4 items-end">
//         {/* multiモードの時だけ医院選択を表示（singleの場合は非表示だが、useEffectで自動選択されている） */}
//         {mode === 'multi' && (
//           <div className="w-48">
//             <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">医院</label>
//             <select value={filter.clinic} onChange={e => setFilter({...filter, clinic: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
//               <option value="">医院を選択</option>
//               {clinics.map(c => <option key={c} value={c}>{c}</option>)}
//             </select>
//           </div>
//         )}
        
//         {/* 個人タブの場合はスタッフ選択を表示 */}
//         {tab === 'person' && (
//           <div className="w-48">
//             <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">担当者 (Dr/DH)</label>
//             <select value={filter.staff} onChange={e => setFilter({...filter, staff: e.target.value})} className="w-full border rounded-lg p-2 text-sm outline-none cursor-pointer disabled:bg-gray-50" disabled={!filter.clinic}>
//               <option value="">全てのスタッフ ({filteredStaffs.length}名)</option>
//               {filteredStaffs.map(s => <option key={s} value={s}>{s}</option>)}
//             </select>
//           </div>
//         )}

//         <div className="w-24">
//           <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">対象年</label>
//           <input type="number" value={filter.year} onChange={e => setFilter({...filter, year: Number(e.target.value)})} className="w-full border rounded-lg p-2 text-sm" />
//         </div>

//         <button 
//           onClick={handleSearch} 
//           disabled={loading || !filter.clinic}
//           className={`bg-slate-800 text-white px-10 py-2 rounded-lg font-bold text-sm transition-all shadow-md active:scale-95 ${loading || !filter.clinic ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black cursor-pointer'}`}
//         >
//           {loading ? '検索中...' : '検索'}
//         </button>
//       </div>

//       <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto min-h-[400px]">
//         {!hasSearched ? (
//           <div className="p-20 text-center text-slate-400 italic font-bold">条件を選択して「検索」をクリックしてください</div>
//         ) : (
//           <table className="w-full text-[12px]">
//             <thead className="bg-slate-50 border-b">
//               <tr className="text-left text-slate-400 font-black uppercase">
//                 <th className="p-3 sticky left-0 bg-slate-50 border-r min-w-[150px] z-10 text-slate-900">項目 (KPI)</th>
//                 {Array.from({ length: 12 }, (_, i) => <th key={i} className="p-3 text-center w-24">{i + 1}月</th>)}
//                 <th className="p-3 text-right">操作</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-slate-100">
//               {KPI_NAMES.map(kpiName => {
//                 const isEditing = editingKey === kpiName
//                 return (
//                   <tr key={kpiName} className="hover:bg-slate-50 group transition-colors">
//                     <td className="p-3 font-bold text-slate-700 sticky left-0 bg-white border-r shadow-[2px_0_5px_rgba(0,0,0,0.02)] group-hover:bg-slate-50">{kpiName}</td>
//                     {Array.from({ length: 12 }, (_, i) => {
//                       const month = i + 1; const item = dataGrid[kpiName]?.[month]
//                       return (
//                         <td key={i} className="p-2">
//                           {item ? (
//                             isEditing ? (
//                               <input type="number" value={item.value} onChange={e => {
//                                 const newData = { ...dataGrid }; newData[kpiName][month].value = parseFloat(e.target.value) || 0;
//                                 setDataGrid(newData);
//                               }} className="w-full border border-blue-400 p-1 text-right rounded font-mono outline-none focus:ring-2 focus:ring-blue-200" />
//                             ) : (
//                               <div className="text-right font-mono text-slate-600">{Math.round(item.value).toLocaleString()}</div>
//                             )
//                           ) : ( <div className="text-center text-slate-200">-</div> )}
//                         </td>
//                       )
//                     })}
//                     <td className="p-3 text-right">
//                       {isEditing ? (
//                         <button onClick={() => saveRow(kpiName)} className="text-blue-600 font-bold hover:underline cursor-pointer">保存</button>
//                       ) : (
//                         <button onClick={() => setEditingKey(kpiName)} className="text-slate-300 group-hover:text-slate-800 font-bold cursor-pointer transition-colors">編集</button>
//                       )}
//                     </td>
//                   </tr>
//                 )
//               })}
//             </tbody>
//           </table>
//         )}
//       </div>
//     </div>
//   )
// }

'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { KPI_NAMES } from '@/lib/kpi-engine'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface DataEditorProps {
  corpId: string;
  mode: 'single' | 'multi' | null;
}

export function DataEditor({ corpId, mode }: DataEditorProps) {
  const [tab, setTab] = useState<'clinic' | 'person'>('clinic')
  const [clinics, setClinics] = useState<string[]>([])
  const [allStaffData, setAllStaffData] = useState<{clinic_name: string, staff_name: string}[]>([])
  const [filteredStaffs, setFilteredStaffs] = useState<string[]>([])
  const [filter, setFilter] = useState({ clinic: '', year: 2025, staff: '' })
  const [dataGrid, setDataGrid] = useState<Record<string, Record<number, any>>>({})
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // 1. マスタデータ取得
  useEffect(() => {
    const fetchMasters = async () => {
      // 医院リスト取得
      const { data: cData } = await supabase
        .from('unique_clinic_options')
        .select('clinic_name')
        .eq('corporation_id', corpId)
      
      let sortedClinics: string[] = []
      if (cData) {
        sortedClinics = Array.from(new Set(cData.map(d => d.clinic_name)))
          .filter(c => c && c !== 'All')
          .sort((a, b) => a.localeCompare(b, 'ja'));
        setClinics(sortedClinics)

        // シングルモードなら自動的に医院を選択状態にする
        if (mode === 'single' && sortedClinics.length > 0) {
          setFilter(prev => ({ ...prev, clinic: sortedClinics[0] }))
        }
      }

      // スタッフリスト取得
      const { data: sData } = await supabase
        .from('unique_staff_options')
        .select('clinic_name, staff_name')
        .eq('corporation_id', corpId)
      
      if (sData) setAllStaffData(sData)
    }
    fetchMasters()
  }, [corpId, mode])
  
  // 2. スタッフリストのフィルタリング
  useEffect(() => {
    if (!filter.clinic) {
      setFilteredStaffs([])
      if (mode !== 'single') setFilter(prev => ({ ...prev, staff: '' }))
    } else {
      const available = allStaffData
        .filter(p => p.clinic_name === filter.clinic)
        .map(p => p.staff_name)
        .filter((val, idx, self) => self.indexOf(val) === idx)
        .sort((a, b) => a.localeCompare(b, 'ja'));
      setFilteredStaffs(available)
    }
    setHasSearched(false)
  }, [filter.clinic, allStaffData, mode])

  const handleSearch = async () => {
    if (!filter.clinic) { alert("医院データが見つかりません"); return; }
    setLoading(true);
    
    let query = supabase.from('flexible_kpis').select('*')
      .eq('corporation_id', corpId) // 法人ID指定
      .eq('clinic_name', filter.clinic)
      .eq('year', filter.year)
      .eq('segment', tab)
      .eq('is_target', false)
      .in('kpi_name', KPI_NAMES);

    if (tab === 'person' && filter.staff) query = query.eq('staff_name', filter.staff);

    const { data } = await query;
    const grid: Record<string, Record<number, any>> = {};
    KPI_NAMES.forEach(name => { grid[name] = {} });
    data?.forEach(item => { if (grid[item.kpi_name]) grid[item.kpi_name][item.month] = item; });
    
    setDataGrid(grid);
    setHasSearched(true);
    setLoading(false);
  }

  const saveRow = async (kpiName: string) => {
    const row = dataGrid[kpiName];
    const updates = Object.values(row).filter(item => item.id);
    for (const item of updates) {
      await supabase.from('flexible_kpis').update({ value: item.value }).eq('id', item.id);
    }
    setEditingKey(null);
    alert(`${kpiName} を保存しました`);
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex gap-4 border-b border-slate-200">
        <button onClick={() => {setTab('clinic'); setHasSearched(false);}} className={`pb-3 text-sm font-bold px-6 transition-all ${tab === 'clinic' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>医院全体</button>
        <button onClick={() => {setTab('person'); setHasSearched(false);}} className={`pb-3 text-sm font-bold px-6 transition-all ${tab === 'person' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>個人別</button>
      </div>

      <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-wrap gap-4 items-end">
        {/* multiモードの時だけ医院選択を表示（singleの場合はuseEffectで自動選択） */}
        {mode === 'multi' && (
          <div className="w-48">
            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">医院</label>
            <select value={filter.clinic} onChange={e => setFilter({...filter, clinic: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
              <option value="">医院を選択</option>
              {clinics.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        
        {tab === 'person' && (
          <div className="w-48">
            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">担当者 (Dr/DH)</label>
            <select value={filter.staff} onChange={e => setFilter({...filter, staff: e.target.value})} className="w-full border rounded-lg p-2 text-sm outline-none cursor-pointer disabled:bg-gray-50" disabled={!filter.clinic}>
              <option value="">全てのスタッフ ({filteredStaffs.length}名)</option>
              {filteredStaffs.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div className="w-24">
          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">対象年</label>
          <input type="number" value={filter.year} onChange={e => setFilter({...filter, year: Number(e.target.value)})} className="w-full border rounded-lg p-2 text-sm" />
        </div>

        <button 
          onClick={handleSearch} 
          disabled={loading || !filter.clinic}
          className={`bg-slate-800 text-white px-10 py-2 rounded-lg font-bold text-sm transition-all shadow-md active:scale-95 ${loading || !filter.clinic ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black cursor-pointer'}`}
        >
          {loading ? '検索中...' : '検索'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto min-h-[400px]">
        {!hasSearched ? (
          <div className="p-20 text-center text-slate-400 italic font-bold">条件を選択して「検索」をクリックしてください</div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 border-b">
              <tr className="text-left text-slate-400 font-black uppercase">
                <th className="p-3 sticky left-0 bg-slate-50 border-r min-w-[150px] z-10 text-slate-900">項目 (KPI)</th>
                {Array.from({ length: 12 }, (_, i) => <th key={i} className="p-3 text-center w-24">{i + 1}月</th>)}
                <th className="p-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {KPI_NAMES.map(kpiName => {
                const isEditing = editingKey === kpiName
                return (
                  <tr key={kpiName} className="hover:bg-slate-50 group transition-colors">
                    <td className="p-3 font-bold text-slate-700 sticky left-0 bg-white border-r shadow-[2px_0_5px_rgba(0,0,0,0.02)] group-hover:bg-slate-50">{kpiName}</td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = i + 1; const item = dataGrid[kpiName]?.[month]
                      return (
                        <td key={i} className="p-2">
                          {item ? (
                            isEditing ? (
                              <input type="number" value={item.value} onChange={e => {
                                const newData = { ...dataGrid }; newData[kpiName][month].value = parseFloat(e.target.value) || 0;
                                setDataGrid(newData);
                              }} className="w-full border border-blue-400 p-1 text-right rounded font-mono outline-none focus:ring-2 focus:ring-blue-200" />
                            ) : (
                              <div className="text-right font-mono text-slate-600">{Math.round(item.value).toLocaleString()}</div>
                            )
                          ) : ( <div className="text-center text-slate-200">-</div> )}
                        </td>
                      )
                    })}
                    <td className="p-3 text-right">
                      {isEditing ? (
                        <button onClick={() => saveRow(kpiName)} className="text-blue-600 font-bold hover:underline cursor-pointer">保存</button>
                      ) : (
                        <button onClick={() => setEditingKey(kpiName)} className="text-slate-300 group-hover:text-slate-800 font-bold cursor-pointer transition-colors">編集</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}