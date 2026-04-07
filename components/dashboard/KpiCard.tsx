'use client'
import React from 'react';
import { KpiEngine } from '@/lib/kpi-engine';

interface KpiCardProps {
  kpiId?: string;
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
  hideCompare?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({
  kpiId, label, value, unit, forecast, compVal, achievement, 
  compareClinic, isCountKpi, prevVal, goalVal, mom, mode, hideCompare
}) => {
  const vsCompRatio = KpiEngine.calcRatio(value || 0, compVal || 0);
  const showCompare = !hideCompare; 

  // 💡 売上、1日平均単価、およびその内訳（保険・自費）の場合は、左下に「目標達成率」を表示
  const targetBasedKpis = [
    'total_amount', 
    'avg_price_per_day', 
    'insurance_amount',
    'insurance_avg_price_per_day',
    'private_amount',
    'private_avg_price_per_day'
  ];
  const showTargetOnLeft = kpiId ? targetBasedKpis.includes(kpiId) : false;
  
  const leftBottomLabel = showTargetOnLeft ? "目標達成率" : "着地予測";
  
  // 💡 修正箇所: 着地予測の場合は forecast に対する value の割合を計算するように修正
  const leftBottomRatio = showTargetOnLeft 
    ? KpiEngine.calcRatio(value, goalVal) 
    : (forecast && forecast > 0 ? (value / forecast) * 100 : 0);
    
  const leftBottomValue = showTargetOnLeft ? goalVal : forecast;

  const formatValue = (num: number | null | undefined) => {
    if (num == null) return '0';
    return num.toLocaleString('ja-JP', { maximumFractionDigits: 2 });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex overflow-hidden hover:shadow-md transition-shadow">
      {/* 左側：当月実績と着地予測/目標 */}
      <div className="w-[60%] p-6 flex flex-col justify-between border-r border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
            {mom != null && mom !== 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${mom >= 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                {mom >= 100 ? '↑' : '↓'} {formatValue(Math.abs(mom - 100))}%
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black tracking-tighter text-slate-900 italic">
              {formatValue(value)}
            </span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{unit}</span>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-50 mt-4">
          <div className="flex justify-between items-end mb-1">
            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{leftBottomLabel}</span>
                {leftBottomRatio > 0 && (
                  <span className="text-[10px] font-black text-indigo-500 leading-none mt-0.5">
                    {formatValue(leftBottomRatio)}%
                  </span>
                )}
            </div>
            <span className="text-sm font-black text-slate-700 italic">
              {leftBottomValue !== null ? formatValue(leftBottomValue) : '-'}
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(leftBottomRatio, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 右側：比較セクション */}
      <div className="w-[40%] p-6 bg-slate-50/50 flex flex-col justify-between space-y-6">
        {showCompare ? (
          <div>
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase leading-tight">
                vs {compareClinic || '比較対象'}
              </span>
              <span className={`text-[11px] font-black ${vsCompRatio >= 100 ? 'text-blue-600' : 'text-slate-500'}`}>
                {formatValue(vsCompRatio)}%
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mb-1.5">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(vsCompRatio || 0, 100)}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-700">
              {formatValue(compVal)}
            </span>
          </div>
        ) : (
          <div className="min-h-[48px] w-full border-b border-dashed border-slate-200/50 pb-2 flex items-end opacity-0"></div>
        )}

        {/* 右下：前月比 */}
        <div>
          <div className="flex justify-between items-end mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">前月比</span>
            <span className={`text-[11px] font-black ${ mom >= 100 ? 'text-emerald-600' : 'text-orange-600'}`}>
              {formatValue(mom)}%
            </span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mb-1.5">
            <div 
              className={`h-full rounded-full ${ mom >= 100 ? 'bg-emerald-500' : 'bg-orange-500'}`}
              style={{ width: `${Math.min(mom || 0, 100)}%` }}
            />
          </div>
          <span className="text-xs font-bold text-slate-700">
            {formatValue(prevVal)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default KpiCard;