// 'use client'
// import React from 'react';
// import { KpiEngine } from '@/lib/kpi-engine';

// interface KpiCardProps {
//   label: string;
//   value: number;
//   unit: string;
//   forecast: number | null;
//   compVal: number;
//   achievement: number;
//   compareClinic: string;
//   isCountKpi: boolean;
//   prevVal: number;
//   goalVal: number;
//   mom: number;
//   mode?: 'single' | 'multi' | null;
// }

// export const KpiCard: React.FC<KpiCardProps> = ({
//   label, value, unit, forecast, compVal, achievement, 
//   compareClinic, isCountKpi, prevVal, goalVal, mom, mode
// }) => {
//   const vsCompRatio = KpiEngine.calcRatio(value || 0, compVal || 0);

//   // シングルモードでもスタッフ間比較を表示
//   const showCompare = mode === 'multi' || mode === 'single';

//   return (
//     <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex overflow-hidden hover:shadow-md transition-shadow">
//       {/* 左側：当月実績と着地予測 */}
//       <div className="w-[60%] p-6 flex flex-col justify-between border-r border-slate-100">
//         <div>
//           <div className="flex items-center gap-2 mb-2">
//             <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
//             {mom != null && mom !== 0 && (
//               <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${mom >= 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
//                 {mom >= 100 ? '↑' : '↓'} {(Math.abs(mom - 100)).toFixed(1)}%
//               </span>
//             )}
//           </div>
//           <div className="flex items-baseline gap-1">
//             <span className="text-3xl font-black tracking-tighter text-slate-900 italic">
//               {unit === '円' ? (value / 10000).toFixed(1) : (value || 0).toLocaleString()}
//             </span>
//             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{unit === '円' ? '万円' : unit}</span>
//           </div>
//         </div>

//         <div className="pt-4 border-t border-slate-50 mt-4">
//           <div className="flex justify-between items-center mb-1">
//             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">着地予測</span>
//             <span className="text-sm font-black text-slate-700 italic">
//               {/* forecastが0の場合でも表示する (nullチェックに変更) */}
//               {forecast !== null ? (unit === '円' ? (forecast / 10000).toFixed(1) + 'M' : forecast.toLocaleString()) : '-'}
//             </span>
//           </div>
//           <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
//             <div 
//               className="bg-slate-300 h-full" 
//               style={{ width: (forecast && forecast > 0) ? `${Math.min((value / forecast) * 100, 100)}%` : '0%' }}
//             />
//           </div>
//         </div>
//       </div>

//       {/* 右側：比較セクション */}
//       <div className="w-[40%] p-6 bg-slate-50/50 space-y-6">
//         {/* 比較対象（他院 or 他スタッフ） */}
//         {showCompare && (
//           <div>
//             <div className="flex justify-between items-end mb-1.5">
//               <span className="text-[10px] font-bold text-slate-500 uppercase leading-tight">
//                 vs {compareClinic || '比較対象'}
//               </span>
//               <span className={`text-[11px] font-black ${vsCompRatio >= 100 ? 'text-blue-600' : 'text-slate-500'}`}>
//                 {vsCompRatio != null ? vsCompRatio.toFixed(1) : '0.0'}%
//               </span>
//             </div>
//             <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mb-1.5">
//               <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(vsCompRatio || 0, 100)}%` }} />
//             </div>
//             <span className="text-xs font-bold text-slate-700">
//               {(compVal || 0).toLocaleString()}
//             </span>
//           </div>
//         )}

//         {/* 目標達成率または前月比 */}
//         <div>
//           <div className="flex justify-between items-end mb-1.5">
//             <span className="text-[10px] font-bold text-slate-500 uppercase">{isCountKpi ? '前月比' : '目標達成率'}</span>
//             <span className={`text-[11px] font-black ${achievement >= 100 ? 'text-emerald-600' : 'text-orange-600'}`}>
//               {achievement != null ? achievement.toFixed(1) : '0.0'}%
//             </span>
//           </div>
//           <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mb-1.5">
//             <div 
//               className={`h-full rounded-full ${achievement >= 100 ? 'bg-emerald-500' : 'bg-orange-500'}`}
//               style={{ width: `${Math.min(achievement || 0, 100)}%` }}
//             />
//           </div>
//           <span className="text-xs font-bold text-slate-700">
//             {isCountKpi ? (prevVal || 0).toLocaleString() : (goalVal || 0).toLocaleString()}
//           </span>
//         </div>
//       </div>
//     </div>
//   );
// };
'use client'
import React from 'react';
import { KpiEngine } from '@/lib/kpi-engine';

interface KpiCardProps {
  label: string;
  value: number;
  unit: string;
  forecast: number | null;
  compVal: number;
  achievement: number;
  compareClinic: string;
  isCountKpi: boolean;
  prevVal: number;
  goalVal: number;
  mom: number;
  mode?: 'single' | 'multi' | null;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label, value, unit, forecast, compVal, achievement, 
  compareClinic, isCountKpi, prevVal, goalVal, mom, mode
}) => {
  const vsCompRatio = KpiEngine.calcRatio(value || 0, compVal || 0);

  // シングルモードでもスタッフ間比較を表示
  const showCompare = mode === 'multi' || mode === 'single';

  // ■追加: 着地予測に対する進捗率の計算
  const forecastRatio = (forecast && forecast > 0) ? (value / forecast) * 100 : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex overflow-hidden hover:shadow-md transition-shadow">
      {/* 左側：当月実績と着地予測 */}
      <div className="w-[60%] p-6 flex flex-col justify-between border-r border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
            {mom != null && mom !== 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${mom >= 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                {mom >= 100 ? '↑' : '↓'} {(Math.abs(mom - 100)).toFixed(1)}%
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black tracking-tighter text-slate-900 italic">
              {unit === '円' ? (value / 10000).toFixed(1) : (value || 0).toLocaleString()}
            </span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{unit === '円' ? '万円' : unit}</span>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-50 mt-4">
          <div className="flex justify-between items-end mb-1">
            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">着地予測</span>
                {/* ■追加: 進捗率（Rate）の表示 */}
                {forecast !== null && forecast > 0 && (
                  <span className="text-[10px] font-black text-indigo-500 leading-none mt-0.5">
                    {forecastRatio.toFixed(1)}%
                  </span>
                )}
            </div>
            <span className="text-sm font-black text-slate-700 italic">
              {forecast !== null ? (unit === '円' ? (forecast / 10000).toFixed(1) + 'M' : forecast.toLocaleString()) : '-'}
            </span>
          </div>
          {/* ■変更: バーを少し太く(h-1.5)し、色を indigo-500 に変更 */}
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
              style={{ width: (forecast && forecast > 0) ? `${Math.min(forecastRatio, 100)}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {/* 右側：比較セクション */}
      <div className="w-[40%] p-6 bg-slate-50/50 space-y-6">
        {/* 比較対象（他院 or 他スタッフ） */}
        {showCompare && (
          <div>
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase leading-tight">
                vs {compareClinic || '比較対象'}
              </span>
              <span className={`text-[11px] font-black ${vsCompRatio >= 100 ? 'text-blue-600' : 'text-slate-500'}`}>
                {vsCompRatio != null ? vsCompRatio.toFixed(1) : '0.0'}%
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mb-1.5">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(vsCompRatio || 0, 100)}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-700">
              {(compVal || 0).toLocaleString()}
            </span>
          </div>
        )}

        {/* 目標達成率または前月比 */}
        <div>
          <div className="flex justify-between items-end mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase">{isCountKpi ? '前月比' : '目標達成率'}</span>
            <span className={`text-[11px] font-black ${achievement >= 100 ? 'text-emerald-600' : 'text-orange-600'}`}>
              {achievement != null ? achievement.toFixed(1) : '0.0'}%
            </span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mb-1.5">
            <div 
              className={`h-full rounded-full ${achievement >= 100 ? 'bg-emerald-500' : 'bg-orange-500'}`}
              style={{ width: `${Math.min(achievement || 0, 100)}%` }}
            />
          </div>
          <span className="text-xs font-bold text-slate-700">
            {isCountKpi ? (prevVal || 0).toLocaleString() : (goalVal || 0).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};