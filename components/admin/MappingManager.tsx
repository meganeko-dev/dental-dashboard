// 'use client'
// import { useState, useEffect } from 'react'
// import { createClient } from '@supabase/supabase-js'

// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
// )

// export function MappingManager({ corpId }: { corpId: string }) {
//   const [tab, setTab] = useState<'clinic' | 'staff'>('clinic')

//   return (
//     <div className="space-y-6">
//       <div className="flex gap-4 border-b border-slate-200">
//         <button onClick={() => setTab('clinic')} className={`pb-3 text-sm font-bold transition-all px-4 ${tab === 'clinic' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>医院名</button>
//         <button onClick={() => setTab('staff')} className={`pb-3 text-sm font-bold transition-all px-4 ${tab === 'staff' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>役職</button>
//       </div>
//       {tab === 'clinic' ? <ClinicMappingSection corpId={corpId} /> : <StaffMappingSection corpId={corpId} />}
//     </div>
//   )
// }

// function ClinicMappingSection({ corpId }: { corpId: string }) {
//   const [mappings, setMappings] = useState<any[]>([])
//   const [key, setKey] = useState(''); const [val, setVal] = useState('')
//   const [editingId, setEditingId] = useState<string | null>(null); const [editValue, setEditValue] = useState('')

//   const fetch = async () => {
//     if (!corpId) return
//     const { data } = await supabase
//       .from('data_mappings')
//       .select('*')
//       .eq('mapping_type', 'clinic_name_mapping')
//       .eq('corporation_id', corpId)
//       .order('value')
//     setMappings(data || [])
//   }
//   useEffect(() => { fetch() }, [corpId])

//   const add = async () => {
//     if (!key || !val || !corpId) return
//     const { error } = await supabase.from('data_mappings').insert([{ 
//       key, 
//       value: val, 
//       mapping_type: 'clinic_name_mapping',
//       corporation_id: corpId
//     }])
//     if (error) { alert('このKeyは既に登録されています。入力をクリアします。'); setKey(''); setVal(''); }
//     else { setKey(''); setVal(''); fetch(); }
//   }

//   return (
//     <div className="space-y-4 animate-in fade-in">
//       <div className="bg-white p-6 rounded-2xl border shadow-sm flex gap-4 items-end">
//         <div className="flex-1"><label className="text-[10px] font-black text-slate-400 uppercase block mb-1">レセコン登録名</label><input value={key} onChange={e => setKey(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="東京" /></div>
//         <div className="flex-1"><label className="text-[10px] font-black text-slate-400 uppercase block mb-1">正式名称</label><input value={val} onChange={e => setVal(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="東京歯科" /></div>
//         <button onClick={add} className="bg-slate-800 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-black cursor-pointer">追加</button>
//       </div>
//       <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
//         <table className="w-full text-sm">
//           <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase"><tr className="text-left border-b"><th className="p-4">Key</th><th className="p-4">Value</th><th className="p-4 text-right">操作</th></tr></thead>
//           <tbody className="divide-y">
//             {mappings.map(m => (
//               <tr key={m.id} className="hover:bg-slate-50 transition-colors">
//                 <td className="p-4 font-bold text-slate-600">{m.key}</td>
//                 <td className="p-4">{editingId === m.id ? <input value={editValue} onChange={e => setEditValue(e.target.value)} className="border p-1 w-full rounded focus:ring-2 focus:ring-blue-500 outline-none" /> : m.value}</td>
//                 <td className="p-4 text-right flex justify-end gap-4 font-bold text-xs">
//                   {editingId === m.id ? 
//                     <button onClick={async () => { await supabase.from('data_mappings').update({ value: editValue }).eq('id', m.id); setEditingId(null); fetch(); }} className="text-blue-600">保存</button> : 
//                     <button onClick={() => { setEditingId(m.id); setEditValue(m.value); }} className="text-slate-400 hover:text-blue-600">編集</button>
//                   }
//                   <button onClick={async () => { if(confirm('削除しますか？')) { await supabase.from('data_mappings').delete().eq('id', m.id); fetch(); } }} className="text-slate-400 hover:text-red-500">削除</button>
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   )
// }

// function StaffMappingSection({ corpId }: { corpId: string }) {
//   const [unmapped, setUnmapped] = useState<string[]>([]); const [mappings, setMappings] = useState<any[]>([])
  
//   const fetch = async () => {
//     if (!corpId) return
//     const { data: staff } = await supabase.from('flexible_kpis').select('staff_name').not('staff_name', 'eq', '').eq('corporation_id', corpId)
//     const unique = Array.from(new Set(staff?.map(s => s.staff_name))).filter(Boolean) as string[]
    
//     const { data: mapped } = await supabase
//       .from('data_mappings')
//       .select('*')
//       .eq('mapping_type', 'staff_role_mapping')
//       .eq('corporation_id', corpId)
    
//     setMappings(mapped || [])
//     setUnmapped(unique.filter(s => !mapped?.map(m => m.key).includes(s)))
//   }
//   useEffect(() => { fetch() }, [corpId])
  
//   const addRole = async (name: string, role: string) => {
//     if (!corpId) return
//     await supabase.from('data_mappings').insert([{ 
//       key: name, 
//       value: role, 
//       mapping_type: 'staff_role_mapping',
//       corporation_id: corpId
//     }])
//     fetch()
//   }

//   return (
//     <div className="space-y-6">
//       {unmapped.length > 0 && (
//         <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 grid grid-cols-2 gap-4">
//           {unmapped.map(name => (
//             <div key={name} className="bg-white p-4 rounded-xl flex justify-between items-center shadow-sm border"><span className="font-bold text-sm text-slate-700">{name}</span><div className="flex gap-2">
//               <button onClick={() => addRole(name, 'dr')} className="text-[10px] px-4 py-1.5 bg-blue-100 text-blue-600 rounded font-black hover:bg-blue-600 hover:text-white transition-all">DR</button>
//               <button onClick={() => addRole(name, 'dh')} className="text-[10px] px-4 py-1.5 bg-emerald-100 text-emerald-600 rounded font-black hover:bg-emerald-600 hover:text-white transition-all">DH</button>
//             </div></div>
//           ))}
//         </div>
//       )}
//       <div className="bg-white rounded-2xl border shadow-sm overflow-hidden"><table className="w-full text-sm"><thead className="bg-slate-50 text-[10px] font-black uppercase border-b"><tr><th className="p-4 text-left">スタッフ名</th><th className="p-4 text-left">役職</th><th className="p-4 text-right">操作</th></tr></thead><tbody className="divide-y">{mappings.map(m => (<tr key={m.id} className="hover:bg-slate-50"><td className="p-4 font-bold text-slate-600">{m.key}</td><td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${m.value === 'dr' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>{m.value}</span></td><td className="p-4 text-right"><button onClick={async () => { if(confirm('削除しますか？')) { await supabase.from('data_mappings').delete().eq('id', m.id); fetch(); } }} className="text-slate-400 text-xs font-bold hover:text-red-500">削除</button></td></tr>))}</tbody></table></div>
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

export function MappingManager({ corpId }: { corpId: string }) {
  const [tab, setTab] = useState<'clinic' | 'staff'>('clinic')

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-slate-200">
        <button onClick={() => setTab('clinic')} className={`pb-3 text-sm font-bold transition-all px-4 ${tab === 'clinic' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>医院名</button>
        <button onClick={() => setTab('staff')} className={`pb-3 text-sm font-bold transition-all px-4 ${tab === 'staff' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>役職</button>
      </div>
      {tab === 'clinic' ? <ClinicMappingSection corpId={corpId} /> : <StaffMappingSection corpId={corpId} />}
    </div>
  )
}

function ClinicMappingSection({ corpId }: { corpId: string }) {
  const [mappings, setMappings] = useState<any[]>([])
  const [key, setKey] = useState(''); const [val, setVal] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null); const [editValue, setEditValue] = useState('')

  const fetch = async () => {
    if (!corpId) return
    const { data } = await supabase
      .from('data_mappings')
      .select('*')
      .eq('mapping_type', 'clinic_name_mapping')
      .eq('corporation_id', corpId)
      .order('value')
    setMappings(data || [])
  }
  useEffect(() => { fetch() }, [corpId])

  const add = async () => {
    if (!key || !val || !corpId) return
    const { error } = await supabase.from('data_mappings').insert([{ 
      key, 
      value: val, 
      mapping_type: 'clinic_name_mapping',
      corporation_id: corpId
    }])
    if (error) { alert('このKeyは既に登録されています。入力をクリアします。'); setKey(''); setVal(''); }
    else { setKey(''); setVal(''); fetch(); }
  }

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="bg-white p-6 rounded-2xl border shadow-sm flex gap-4 items-end">
        <div className="flex-1"><label className="text-[10px] font-black text-slate-400 uppercase block mb-1">レセコン登録名</label><input value={key} onChange={e => setKey(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="東京" /></div>
        <div className="flex-1"><label className="text-[10px] font-black text-slate-400 uppercase block mb-1">正式名称</label><input value={val} onChange={e => setVal(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="東京歯科" /></div>
        <button onClick={add} className="bg-slate-800 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-black cursor-pointer">追加</button>
      </div>
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase"><tr className="text-left border-b"><th className="p-4">Key</th><th className="p-4">Value</th><th className="p-4 text-right">操作</th></tr></thead>
          <tbody className="divide-y">
            {mappings.map(m => (
              <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-bold text-slate-600">{m.key}</td>
                <td className="p-4">{editingId === m.id ? <input value={editValue} onChange={e => setEditValue(e.target.value)} className="border p-1 w-full rounded focus:ring-2 focus:ring-blue-500 outline-none" /> : m.value}</td>
                <td className="p-4 text-right flex justify-end gap-4 font-bold text-xs">
                  {editingId === m.id ? 
                    <button onClick={async () => { await supabase.from('data_mappings').update({ value: editValue }).eq('id', m.id); setEditingId(null); fetch(); }} className="text-blue-600">保存</button> : 
                    <button onClick={() => { setEditingId(m.id); setEditValue(m.value); }} className="text-slate-400 hover:text-blue-600">編集</button>
                  }
                  <button onClick={async () => { if(confirm('削除しますか？')) { await supabase.from('data_mappings').delete().eq('id', m.id); fetch(); } }} className="text-slate-400 hover:text-red-500">削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StaffMappingSection({ corpId }: { corpId: string }) {
  const [unmapped, setUnmapped] = useState<string[]>([]); const [mappings, setMappings] = useState<any[]>([])
  
  const fetch = async () => {
    if (!corpId) return
    const { data: staff } = await supabase.from('flexible_kpis').select('staff_name').not('staff_name', 'eq', '').eq('corporation_id', corpId)
    const unique = Array.from(new Set(staff?.map(s => s.staff_name))).filter(Boolean) as string[]
    
    const { data: mapped } = await supabase
      .from('data_mappings')
      .select('*')
      .eq('mapping_type', 'staff_role_mapping')
      .eq('corporation_id', corpId)
    
    setMappings(mapped || [])
    setUnmapped(unique.filter(s => !mapped?.map(m => m.key).includes(s)))
  }
  useEffect(() => { fetch() }, [corpId])
  
  const addRole = async (name: string, role: string) => {
    if (!corpId) return
    await supabase.from('data_mappings').insert([{ 
      key: name, 
      value: role, 
      mapping_type: 'staff_role_mapping',
      corporation_id: corpId
    }])
    fetch()
  }

  return (
    <div className="space-y-6">
      {unmapped.length > 0 && (
        <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 grid grid-cols-2 gap-4">
          {unmapped.map(name => (
            <div key={name} className="bg-white p-4 rounded-xl flex justify-between items-center shadow-sm border"><span className="font-bold text-sm text-slate-700">{name}</span><div className="flex gap-2">
              <button onClick={() => addRole(name, 'dr')} className="text-[10px] px-4 py-1.5 bg-blue-100 text-blue-600 rounded font-black hover:bg-blue-600 hover:text-white transition-all">DR</button>
              <button onClick={() => addRole(name, 'dh')} className="text-[10px] px-4 py-1.5 bg-emerald-100 text-emerald-600 rounded font-black hover:bg-emerald-600 hover:text-white transition-all">DH</button>
            </div></div>
          ))}
        </div>
      )}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden"><table className="w-full text-sm"><thead className="bg-slate-50 text-[10px] font-black uppercase border-b"><tr><th className="p-4 text-left">スタッフ名</th><th className="p-4 text-left">役職</th><th className="p-4 text-right">操作</th></tr></thead><tbody className="divide-y">{mappings.map(m => (<tr key={m.id} className="hover:bg-slate-50"><td className="p-4 font-bold text-slate-600">{m.key}</td><td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${m.value === 'dr' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>{m.value}</span></td><td className="p-4 text-right"><button onClick={async () => { if(confirm('削除しますか？')) { await supabase.from('data_mappings').delete().eq('id', m.id); fetch(); } }} className="text-slate-400 text-xs font-bold hover:text-red-500">削除</button></td></tr>))}</tbody></table></div>
    </div>
  )
}