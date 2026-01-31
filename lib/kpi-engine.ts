// src/lib/kpi-engine.ts

export const KPI_NAMES = [
  '保険点数売上', '自費売上', '自費売上（税込・入金）', '来院患者数',
  '新患数', '新規患者数', '予約取得率', '当日キャンセル率', '離脱率',
  'ユニット稼働率', '予約取得患者', '初回メンテ移行数', '保険売上'
];

export const KpiEngine = {
  sumValues: (data: any[], kpiNames: string[]) => {
    return data
      .filter(d => kpiNames.includes(d.kpi_name))
      .reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  },

  calc: (data: any[], kpiId: string): number => {
    switch (kpiId) {
      case 'revenue': // 売上
        // DBにある売上関連の名称をすべて網羅
        return KpiEngine.sumValues(data, ['保険点数売上', '自費売上', '自費売上（税込・入金）', '保険売上']);

      case 'recept_unit_price':
          // 売上 / レセプト数 (レセプト数がDBにない場合は0を返す)
          const r_rev = KpiEngine.calc(data, 'revenue');
          const r_num = KpiEngine.sumValues(data, ['レセプト数']);
          return r_num > 0 ? r_rev / r_num : 0;
      case 'average_unit_price':
          // 売上 / 来院数
          const a_rev = KpiEngine.calc(data, 'revenue');
          const a_pts = KpiEngine.sumValues(data, ['来院患者数']);
          return a_pts > 0 ? a_rev / a_pts : 0;
      
      case 'unit_price': // レセプト平均単価
        const rev = KpiEngine.calc(data, 'revenue');
        const pts = KpiEngine.sumValues(data, ['来院患者数']);
        return pts > 0 ? rev / pts : 0;
      
      case 'patients': // 来院患者数
        return KpiEngine.sumValues(data, ['来院患者数']);
      
      case 'new_patients': // 新規患者数
        return KpiEngine.sumValues(data, ['新患数', '新規患者数']);
      
      case 'cancel_rate': // キャンセル率（もしDBに「キャンセル率」という名前がない場合は「当日キャンセル率」を代替表示）
        const cRate = KpiEngine.sumValues(data, ['キャンセル率']);
        return cRate > 0 ? cRate : KpiEngine.sumValues(data, ['当日キャンセル率']);
      
      case 'today_cancel_rate': // 当日キャンセル率
        return KpiEngine.sumValues(data, ['当日キャンセル率']);
      
      case 'reserve_rate': // 予約取得率 (settingsのID: reserve_rate と DBの 予約取得率 を紐付け)
        return KpiEngine.sumValues(data, ['予約取得率']);
      
      default:
        // IDがDBの日本語名と直接一致する場合
        return KpiEngine.sumValues(data, [kpiId]);
    }
  },

  calcRatio: (val: number, base: number) => {
    return (base && base > 0) ? (val / base) * 100 : 0;
  },

  calculateForecast: (allData: any[], kpiId: string, currentYear: number, currentMonth: number) => {
    if (!allData || allData.length === 0) return null;
    
    const monthlyMap = new Map();
    allData.forEach(d => {
      const key = `${d.year}-${d.month}`;
      if (!monthlyMap.has(key)) monthlyMap.set(key, []);
      monthlyMap.get(key).push(d);
    });

    const history = Array.from(monthlyMap.keys()).map(key => {
      const [y, m] = key.split('-').map(Number);
      return { 
        x: y * 12 + m, 
        y: KpiEngine.calc(monthlyMap.get(key), kpiId), 
        isPast: (y < currentYear || (y === currentYear && m < currentMonth)) 
      };
    }).filter(d => d.isPast && d.y > 0);
    
    if (history.length < 2) return null; // 2ヶ月分以上あれば平均を出す
    return history.slice(-3).reduce((s, d) => s + d.y, 0) / history.slice(-3).length;
  }
};