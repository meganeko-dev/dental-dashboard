'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function GoalSetter({ goals, onUpdate }: any) {
  const targetKPIs = ["メンテナンス移行率", "キャンセル率", "予約取得率", "離脱率", "当日キャンセル率"];
  const [editing, setEditing] = useState<Record<string, number>>({});
  
  const save = async () => {
    const updates = targetKPIs.map(kpi => ({
      year: 0, month: 0, segment: 'clinic', clinic_name: 'GLOBAL', staff_name: '',
      is_target: true, kpi_name: kpi,
      value: editing[kpi] ?? goals.find((g:any) => g.kpi_name === kpi)?.value ?? 0
    }));
    await supabase.from('flexible_kpis').upsert(updates, { onConflict: 'year,month,segment,clinic_name,staff_name,kpi_name,is_target' });
    alert('目標値を保存しました'); 
    if (onUpdate) onUpdate();
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b text-[10px] text-slate-400 font-black uppercase"><tr><th className="p-5">KPI項目</th><th className="p-5 text-right">目標値 (%)</th></tr></thead>
          <tbody className="divide-y">
            {targetKPIs.map(kpi => (
              <tr key={kpi} className="hover:bg-slate-50 transition-colors">
                <td className="p-5 font-bold text-slate-700">{kpi}</td>
                <td className="p-5 text-right"><input type="number" defaultValue={goals.find((g:any) => g.kpi_name === kpi)?.value || 0} onChange={e => setEditing({...editing, [kpi]: parseFloat(e.target.value)})} className="border rounded-lg px-3 py-2 text-sm w-28 text-right font-black focus:ring-2 focus:ring-blue-600 outline-none shadow-sm" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end"><button onClick={save} className="bg-blue-600 text-white px-10 py-3 rounded-2xl text-xs font-black shadow-lg hover:bg-blue-700 transition-all">目標を保存</button></div>
    </div>
  );
}