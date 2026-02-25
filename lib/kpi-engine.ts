export const KPI_NAMES = [
  '保険治療', '自費治療', 'レセプト', '来院人数_既存患者', '来院人数_新規患者',
  '予約人数_既存患者', '予約人数_新規患者', '当日キャンセル数', '当日キャンセル人数',
  '無断キャンセル数', '無断キャンセル人数', '事前キャンセル数', '事前キャンセル人数',
  '次回予約取得数', '次回予約取得人数', '次回予約取得率', 'チェア稼働率'
];

export const KpiEngine = {
  sumValues: (data: any[], kpiNames: string[]) => {
    return data
      .filter(d => kpiNames.includes(d.kpi_name))
      .reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  },

  calc: (data: any[], kpiId: string): number => {
    switch (kpiId) {
      case 'total_amount': // 売上
        return KpiEngine.sumValues(data, ['保険治療', '自費治療']);
      
      case 'avg_price_per_day': // 1日あたりの平均単価
        const sum_amount = KpiEngine.sumValues(data, ['保険治療', '自費治療']);
        const day_num = KpiEngine.sumValues(data, ['診察日数']);
        return day_num > 0 ? sum_amount / day_num : 0;

      case 'recept_price': // レセプト単価
        const rec_rev = KpiEngine.sumValues(data, ['保険治療', '自費治療']);
        const rec_num = KpiEngine.sumValues(data, ['レセプト']);
        return rec_num > 0 ? rec_rev / rec_num : 0;

      case 'recept_count': // レセプト数
        const rec_total = KpiEngine.sumValues(data, ['レセプト']);
        return KpiEngine.sumValues(data, ['レセプト']);
      
      case 'avg_price': // 平均単価(来院数)
        const avg_rev = KpiEngine.sumValues(data, ['保険治療', '自費治療']);
        const avg_pat = KpiEngine.sumValues(data, ['来院人数_既存患者', '来院人数_新規患者']);
        return avg_pat > 0 ? avg_rev / avg_pat : 0;
      
      ////////////////////////////////////////////////////////////////
      case 'reserved_count': // 予約数
      return KpiEngine.sumValues(data, ['予約人数_既存患者', '予約人数_新規患者']);

      case 'patients_count': // 来院数
        return KpiEngine.sumValues(data, ['来院人数_既存患者', '来院人数_新規患者']);

      case 'visit_rate': // 来院率
        const visit_pat = KpiEngine.sumValues(data, ['来院人数_既存患者', '来院人数_新規患者']);
        const res_pat = KpiEngine.sumValues(data, ['予約人数_既存患者', '予約人数_新規患者']);
        return res_pat > 0 ? (visit_pat / res_pat) * 100 : 0;

      case 'cancel_count': // キャンセル数
        const c_count = KpiEngine.sumValues(data, ['当日キャンセル数', '当日キャンセル人数', '無断キャンセル数', '無断キャンセル人数']);
        return KpiEngine.sumValues(data, ['当日キャンセル数', '当日キャンセル人数', '無断キャンセル数', '無断キャンセル人数']);

      case 'cancel_rate': // キャンセル率
        const c_num = KpiEngine.sumValues(data, ['当日キャンセル数', '当日キャンセル人数', '無断キャンセル数', '無断キャンセル人数']);
        const res_c = KpiEngine.sumValues(data, ['予約人数_既存患者', '予約人数_新規患者']);
        return res_c > 0 ? (c_num / res_c) * 100 : 0;

      case 'today_cancel_count': // 当日キャンセル数
        const tc_count = KpiEngine.sumValues(data, ['当日キャンセル数', '当日キャンセル人数']);
        return KpiEngine.sumValues(data, ['当日キャンセル数', '当日キャンセル人数']);

      case 'today_cancel_rate': // 当日キャンセル率
        const tc_num = KpiEngine.sumValues(data, ['当日キャンセル数', '当日キャンセル人数']);
        const res_tc = KpiEngine.sumValues(data, ['予約人数_既存患者', '予約人数_新規患者']);
        return res_tc > 0 ? (tc_num / res_tc) * 100 : 0;

      case 'noshow_cancel_count': // 無断キャンセル数
        const ns_count = KpiEngine.sumValues(data, ['無断キャンセル数', '無断キャンセル人数']);
        return KpiEngine.sumValues(data, ['無断キャンセル数', '無断キャンセル人数']);

      case 'noshow_cancel_rate': // 無断キャンセル率
        const ns_num = KpiEngine.sumValues(data, ['無断キャンセル数', '無断キャンセル人数']);
        const res_ns = KpiEngine.sumValues(data, ['予約人数_既存患者', '予約人数_新規患者']);
        return res_ns > 0 ? (ns_num / res_ns) * 100 : 0;

      case 'prior_cancel_count': // 事前キャンセル数
        const pc_count = KpiEngine.sumValues(data, ['事前キャンセル数', '事前キャンセル人数']);
        return KpiEngine.sumValues(data, ['事前キャンセル数', '事前キャンセル人数']);

      case 'prior_cancel_rate': // 事前キャンセル率
        const pc_num = KpiEngine.sumValues(data, ['事前キャンセル数', '事前キャンセル人数']);
        const res_pc = KpiEngine.sumValues(data, ['予約人数_既存患者', '予約人数_新規患者']);
        return res_pc > 0 ? (pc_num / res_pc) * 100 : 0;

      case 'next_reserve_count': // 次回予約取得数
        return KpiEngine.sumValues(data, ['次回予約取得数', '次回予約取得人数']);

      case 'next_reserve_rate': // 次回予約取得率
        return KpiEngine.sumValues(data, ['次回予約取得率']);

      ////////////////////////////////////////////////////////////////
      case 'chair_util_rate': // チェア稼働率
        return KpiEngine.sumValues(data, ['チェア稼働率']);

      case 'churn_patients_count': // 離脱数
        return KpiEngine.sumValues(data, ['離脱患者']);

      case 'churn_patients_rate': // 離脱率
        return KpiEngine.sumValues(data, ['離脱率']);

      case 'mente_count': // メンテナンス数
        return KpiEngine.sumValues(data, ['メンテナンス数']);

      case 'mente_rate': // メンテナンス率
        return KpiEngine.sumValues(data, ['メンテナンス率']);

      default:
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
      const [y, m] = key.split('-');
      return {
        year: parseInt(y),
        month: parseInt(m),
        value: KpiEngine.calc(monthlyMap.get(key), kpiId)
      };
    }).sort((a, b) => (a.year - b.year) || (a.month - b.month));

    const pastData = history.filter(h => (h.year < currentYear) || (h.year === currentYear && h.month < currentMonth));
    if (pastData.length === 0) return null;

    const recent = pastData.slice(-3);
    const sum = recent.reduce((acc, curr) => acc + curr.value, 0);
    return sum / recent.length;
  }
};