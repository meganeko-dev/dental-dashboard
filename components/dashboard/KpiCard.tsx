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
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label, value, unit, forecast, compVal, achievement, 
  compareClinic, isCountKpi, prevVal, goalVal, mom
}) => {
  // 比率計算（KpiEngine側でガードされていますが、ここでも安全に処理）
  const vsCompRatio = KpiEngine.calcRatio(value || 0, compVal || 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex overflow-hidden hover:shadow-md transition-shadow">
      {/* 左側：当月実績と着地予測 */}
      <div className="w-[60%] p-6 flex flex-col justify-between border-r border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
            {/* mom（前月比）の安全表示 */}
            {mom != null && mom !== 0 && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${mom >= 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                {mom >= 100 ? '↑' : '↓'} {Math.abs(mom - 100).toFixed(1)}%
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-900">
              {value != null ? Math.round(value).toLocaleString() : '0'}
            </span>
            <span className="text-sm font-bold text-slate-400">{unit}</span>
          </div>
        </div>

        <div>
          <span className="text-[10px] font-black text-slate-300 uppercase block mb-1">今月末着地予測</span>
          <span className="text-2xl font-black text-blue-600">
            {forecast != null ? Math.round(forecast).toLocaleString() : '-'}
            <span className="text-xs ml-1 font-bold">{unit}</span>
          </span>
        </div>
      </div>

      {/* 右側：比較・目標ゲージ */}
      <div className="w-[40%] bg-slate-50/50 p-5 flex flex-col justify-center space-y-6">
        {/* 比較院との対比 */}
        <div>
          <div className="flex justify-between items-end mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase truncate pr-1">比較: {compareClinic}</span>
            <span className="text-[11px] font-black text-blue-600">
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

        {/* 目標達成率または前月比 */}
        <div>
          <div className="flex justify-between items-end mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase">{isCountKpi ? '前月比' : '目標達成率'}</span>
            <span className={`text-[11px] font-black ${achievement >= 100 ? 'text-emerald-600' : 'text-orange-600'}`}>
              {/* 修正箇所：achievementがnull/undefinedでないことを確認してからtoFixedを呼ぶ */}
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