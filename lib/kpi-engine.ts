export const KPI_NAMES = [
  '保険治療', '自費治療', 'レセプト', '来院人数_既存患者', '来院人数_新規患者',
  '予約人数_既存患者', '予約人数_新規患者', '当日キャンセル数', '当日キャンセル人数',
  '無断キャンセル数', '無断キャンセル人数', '事前キャンセル数', '事前キャンセル人数',
  '次回予約取得数', '次回予約取得人数', '次回予約取得率', 'チェア稼働率'
];

// 💡 来院人数の内訳KPI名のリスト
const PATIENT_BREAKDOWN_KPIS = [
  '来院人数_初診/急患', '来院人数_枠外', '来院人数_治療1', '来院人数_治療2',
  '来院人数_imp', '来院人数_set', '来院人数_DH', '来院人数_DH2',
  '来院人数_矯正', '来院人数_カウンセリング', '来院人数_その他相談'
];

// 💡 売上として合算するKPI名のリスト（旧形式: Stats CSV）
const REVENUE_KPIS = ['保険治療', '自費治療'];

// 💡 新形式売上KPI (FWLRNER6 月計表CSV)
const INSURANCE_KPIS  = ['社会保険_金額', '国民健康保険_金額', '保険治療_金額'];
const PRIVATE_KPIS    = ['自費治療_金額', '雑収入_金額', '物販_金額'];
const SALES_REVENUE_KPIS = [...INSURANCE_KPIS, ...PRIVATE_KPIS];

export const KpiEngine = {
  sumValues: (data: any[], kpiNames: string[]) => {
    return data
      .filter(d => kpiNames.includes(d.kpi_name))
      .reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  },

  calc: (data: any[], kpiId: string, maintenanceKeys: string[] = []): number => {
    switch (kpiId) {
      case 'total_amount': { // 売上合計 (旧: 保険治療+自費治療 / 新: 社会保険_金額+国民健康保険_金額+自費治療_金額+雑収入_金額)
        return KpiEngine.sumValues(data, [...REVENUE_KPIS, ...SALES_REVENUE_KPIS]);
      }

      case 'avg_price_per_day': { // 1日平均単価 = 売上 / 稼働日数
        const sum_amount_day = KpiEngine.calc(data, 'total_amount');
        const day_num = KpiEngine.sumValues(data, ['診療日数', '稼働日数']);
        return day_num > 0 ? sum_amount_day / day_num : 0;
      }

      case 'insurance_amount': { // 保険売上 = 社会保険_金額 + 国民健康保険_金額
        return KpiEngine.sumValues(data, INSURANCE_KPIS);
      }

      case 'insurance_avg_price_per_day': { // 保険1日平均単価 = 保険売上 / 稼働日数
        const ins_amount = KpiEngine.calc(data, 'insurance_amount');
        const ins_days = KpiEngine.sumValues(data, ['診療日数', '稼働日数']);
        return ins_days > 0 ? ins_amount / ins_days : 0;
      }

      case 'private_amount': { // 自費売上 = 自費治療_金額 + 雑収入_金額
        return KpiEngine.sumValues(data, PRIVATE_KPIS);
      }

      case 'private_avg_price_per_day': { // 自費1日平均単価 = 自費売上 / 稼働日数
        const prv_amount = KpiEngine.calc(data, 'private_amount');
        const prv_days = KpiEngine.sumValues(data, ['診療日数', '稼働日数']);
        return prv_days > 0 ? prv_amount / prv_days : 0;
      }

      case 'recept_count': { // レセプト数 (旧: レセプト / 新: 社会保険_点数 + 国民健康保険_点数)
        const old_recept = KpiEngine.sumValues(data, ['レセプト']);
        const new_recept = KpiEngine.sumValues(data, ['社会保険_点数', '国民健康保険_点数']);
        return old_recept + new_recept;
      }

      case 'recept_price': { // レセプト単価 = 売上 / レセプト数
        const rec_rev = KpiEngine.calc(data, 'total_amount');
        const rec_num = KpiEngine.calc(data, 'recept_count');
        return rec_num > 0 ? rec_rev / rec_num : 0;
      }

      case 'avg_price': { // 平均単価 = 売上 / (来院人数_既存患者 + 来院人数_新規患者)
        const avg_rev = KpiEngine.calc(data, 'total_amount');
        const avg_pat = KpiEngine.sumValues(data, ['来院人数_既存患者', '来院人数_新規患者']);
        return avg_pat > 0 ? avg_rev / avg_pat : 0;
      }
      
      case 'reserved_count': // 予約数
        return KpiEngine.sumValues(data, ['予約人数_既存患者', '予約人数_新規患者']);

      case 'reserved_rate': // 予約率
        return KpiEngine.sumValues(data, ['予約率']);

      case 'patients_count': // 来院数
        const breakdownSum = KpiEngine.sumValues(data, PATIENT_BREAKDOWN_KPIS);
        if (breakdownSum > 0) return breakdownSum;
        const stdPatients = KpiEngine.sumValues(data, ['来院人数_既存患者', '来院人数_新規患者']);
        if (stdPatients > 0) return stdPatients;
        return KpiEngine.sumValues(data, ['来院患者数']);

      case 'visit_rate': // 来院率
        const visit_pat = KpiEngine.calc(data, 'patients_count');
        const res_pat = KpiEngine.calc(data, 'reserved_count');
        return res_pat > 0 ? (visit_pat / res_pat) * 100 : 0;

      case 'cancel_count': // キャンセル数
        return KpiEngine.sumValues(data, ['当日キャンセル数', '当日キャンセル人数', '無断キャンセル数', '無断キャンセル人数']);

      case 'cancel_rate': // キャンセル率
        const c_num = KpiEngine.calc(data, 'cancel_count');
        const res_c = KpiEngine.calc(data, 'reserved_count');
        return res_c > 0 ? (c_num / res_c) * 100 : 0;

      case 'today_cancel_count': // 当日キャンセル数
        return KpiEngine.sumValues(data, ['当日キャンセル数']);

      case 'today_cancel_rate': // 当日キャンセル率
        const tc_num = KpiEngine.calc(data, 'today_cancel_count');
        const tc_res_c = KpiEngine.calc(data, 'reserved_count');
        return tc_res_c > 0 ? (tc_num / tc_res_c) * 100 : 0;

      case 'noshow_cancel_count': // 無断キャンセル数
        return KpiEngine.sumValues(data, ['無断キャンセル数']);

      case 'noshow_cancel_rate': // 無断キャンセル率
        const ns_num = KpiEngine.calc(data, 'noshow_cancel_count');
        const ns_res_c = KpiEngine.calc(data, 'reserved_count');
        return ns_res_c > 0 ? (ns_num / ns_res_c) * 100 : 0;

      case 'prior_cancel_count': // 事前キャンセル数
        return KpiEngine.sumValues(data, ['事前キャンセル数']);

      case 'prior_cancel_rate': // 事前キャンセル率
        const pr_num = KpiEngine.calc(data, 'prior_cancel_count');
        const pr_res_c = KpiEngine.calc(data, 'reserved_count');
        return pr_res_c > 0 ? (pr_num / pr_res_c) * 100 : 0;

      case 'next_reserve_count': // 次回予約取得数
        return KpiEngine.sumValues(data, ['次回予約取得数', '次回予約取得人数']);

      case 'next_reserve_rate': // 次回予約取得率
        return KpiEngine.sumValues(data, ['次回予約取得率']);

      case 'chair_util_rate': // チェア稼働率
        return KpiEngine.sumValues(data, ['チェア稼働率']);

      case 'churn_patients_count': // 離脱数
        return KpiEngine.sumValues(data, ['離脱患者']);

      case 'churn_patients_rate': // 離脱率
        return KpiEngine.sumValues(data, ['離脱率']);

      case 'mente_count': {
        return KpiEngine.sumValues(data, ['メンテナンス数']);
      }

      case 'mente_rate': {
        const menteCount = KpiEngine.calc(data, 'mente_count');
        const totalPatients = KpiEngine.calc(data, 'patients_count');
        return totalPatients > 0 ? (menteCount / totalPatients) * 100 : 0;
      }

      case 'first_mente_count': {
        return KpiEngine.sumValues(data, ['初回メンテナンス数']);
      }

      case 'unreserved_count': {
        return KpiEngine.sumValues(data, ['未予約数']);
      }

      case 'unreserved_rate': {
        return KpiEngine.sumValues(data, ['未予約率']);
      }

      default:
        return KpiEngine.sumValues(data, [kpiId]);
    }
  },

  // summarized_clinic_kpi ビューの1行から KPI 値を取得する
  calcFromSummarized: (row: any, kpiId: string): number => {
    if (!row) return 0;
    const g = (col: string) => Number(row[col]) || 0;
    switch (kpiId) {
      case 'total_amount':              return g('total_amount');
      case 'avg_price_per_day':         return g('working_days') > 0 ? g('total_amount') / g('working_days') : 0;
      case 'insurance_amount':          return g('insurance_amount');
      case 'insurance_avg_price_per_day':
      case 'avg_insurance_price_per_day': return g('working_days') > 0 ? g('insurance_amount') / g('working_days') : 0;
      case 'private_amount':            return g('private_amount');
      case 'private_avg_price_per_day':
      case 'avg_private_price_per_day': return g('working_days') > 0 ? g('private_amount') / g('working_days') : 0;
      case 'recept_count':              return g('recept_count');
      case 'recept_price':              return g('recept_count') > 0 ? g('total_amount') / g('recept_count') : 0;
      case 'avg_price':                 return g('patients_count') > 0 ? g('total_amount') / g('patients_count') : 0;
      case 'patients_count':            return g('patients_count');
      case 'reserved_count':            return g('reserved_count');
      case 'reserved_rate':             return g('reserved_count') > 0 ? (g('patients_count') / g('reserved_count')) * 100 : 0;
      case 'visit_rate':                return g('reserved_count') > 0 ? (g('patients_count') / g('reserved_count')) * 100 : 0;
      case 'next_reserve_count':
      case 'today_reserve_count':
      case 'reserve_acquisition_count': return g('next_reserve_count');
      case 'next_reserve_rate':
      case 'today_reserve_rate':
      case 'reserve_acquisition_rate':  return g('next_reserve_rate');
      case 'cancel_count':              return g('today_cancel_count') + g('noshow_cancel_count');
      case 'cancel_rate': {
        const res = g('reserved_count');
        return res > 0 ? ((g('today_cancel_count') + g('noshow_cancel_count')) / res) * 100 : 0;
      }
      case 'today_cancel_count':        return g('today_cancel_count');
      case 'today_cancel_rate': {
        const res = g('reserved_count');
        return res > 0 ? (g('today_cancel_count') / res) * 100 : 0;
      }
      case 'noshow_cancel_count':       return g('noshow_cancel_count');
      case 'noshow_cancel_rate': {
        const res = g('reserved_count');
        return res > 0 ? (g('noshow_cancel_count') / res) * 100 : 0;
      }
      case 'prior_cancel_count':        return g('prior_cancel_count');
      case 'prior_cancel_rate': {
        const res = g('reserved_count');
        return res > 0 ? (g('prior_cancel_count') / res) * 100 : 0;
      }
      case 'churn_patients_rate':       return g('churn_patients_rate');
      case 'churn_patients_count':      return g('churn_patients_count');
      case 'chair_util_rate':           return g('chair_util_rate');
      case 'new_patients_count':        return g('new_patients_count');
      case 'mente_count':               return g('mente_count');
      case 'mente_rate':                return g('mente_rate');
      case 'first_mente_count':         return g('first_mente_count');
      case 'unreserved_count':          return g('unreserved_count');
      case 'unreserved_rate':           return g('unreserved_rate');
      default:                          return 0;
    }
  },

  // summarized_clinic_kpi の履歴行配列から着地予測を計算する
  calculateForecastFromSummarized: (rows: any[], kpiId: string, currentYear: number, currentMonth: number): number | null => {
    if (!rows || rows.length === 0) return null;
    const sorted = [...rows].sort((a, b) => (a.year - b.year) || (a.month - b.month));
    const past = sorted.filter(r => r.year < currentYear || (r.year === currentYear && r.month < currentMonth));
    if (past.length === 0) return null;
    const recent = past.slice(-3);
    const sum = recent.reduce((acc, r) => acc + KpiEngine.calcFromSummarized(r, kpiId), 0);
    return sum / recent.length;
  },

  // summarized_staff_kpi ビューの1行から KPI 値を取得する
  calcFromSummarizedStaff: (row: any, kpiId: string): number => {
    if (!row) return 0;
    const g = (col: string) => Number(row[col]) || 0;
    switch (kpiId) {
      case 'total_amount':                  return g('total_amount');
      case 'avg_price_per_day':             return g('working_days') > 0 ? g('total_amount') / g('working_days') : 0;
      case 'insurance_amount':              return g('insurance_amount');
      case 'insurance_avg_price_per_day':
      case 'avg_insurance_price_per_day':   return g('working_days') > 0 ? g('insurance_amount') / g('working_days') : 0;
      case 'private_amount':                return g('private_amount');
      case 'private_avg_price_per_day':
      case 'avg_private_price_per_day':     return g('working_days') > 0 ? g('private_amount') / g('working_days') : 0;
      case 'recept_count':                  return g('recept_count');
      case 'recept_price':                  return g('recept_price');
      case 'avg_price':                     return g('avg_price');
      case 'patients_count':                return g('patients_count');
      case 'new_patients_count':            return 0;
      case 'reserved_count':                return g('reserved_patients_count');
      case 'reserved_rate': {
        const res = g('reserved_patients_count');
        return res > 0 ? (g('patients_count') / res) * 100 : 0;
      }
      case 'visit_rate': {
        const res = g('reserved_patients_count');
        return res > 0 ? (g('patients_count') / res) * 100 : 0;
      }
      case 'next_reserve_count':
      case 'today_reserve_count':           return 0;
      case 'next_reserve_rate':
      case 'today_reserve_rate':            return g('reserved_rate');
      case 'cancel_count':                  return g('today_cancel_count');
      case 'cancel_rate': {
        const res = g('reserved_patients_count');
        return res > 0 ? (g('today_cancel_count') / res) * 100 : 0;
      }
      case 'today_cancel_count':            return g('today_cancel_count');
      case 'today_cancel_rate': {
        const res = g('reserved_patients_count');
        return res > 0 ? (g('today_cancel_count') / res) * 100 : 0;
      }
      case 'noshow_cancel_count':           return 0;
      case 'noshow_cancel_rate':            return 0;
      case 'prior_cancel_count':            return 0;
      case 'prior_cancel_rate':             return 0;
      case 'churn_patients_rate':           return g('churn_patients_rate');
      case 'churn_patients_count':          return g('churn_patients_count');
      case 'chair_util_rate':               return g('chair_util_rate');
      case 'mente_count':                   return 0;
      case 'mente_rate':                    return 0;
      default:                              return 0;
    }
  },

  // summarized_staff_kpi の履歴行配列から着地予測を計算する
  calculateForecastFromSummarizedStaff: (rows: any[], kpiId: string, currentYear: number, currentMonth: number): number | null => {
    if (!rows || rows.length === 0) return null;
    const sorted = [...rows].sort((a, b) => (a.year - b.year) || (a.month - b.month));
    const past = sorted.filter(r => r.year < currentYear || (r.year === currentYear && r.month < currentMonth));
    if (past.length === 0) return null;
    const recent = past.slice(-3);
    const sum = recent.reduce((acc, r) => acc + KpiEngine.calcFromSummarizedStaff(r, kpiId), 0);
    return sum / recent.length;
  },

  calcRatio: (val: number, base: number) => {
    return (base && base > 0) ? (val / base) * 100 : 0;
  },

  calculateForecast: (allData: any[], kpiId: string, currentYear: number, currentMonth: number, maintenanceKeys: string[] = []) => {
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
        value: KpiEngine.calc(monthlyMap.get(key), kpiId, maintenanceKeys)
      };
    }).sort((a, b) => (a.year - b.year) || (a.month - b.month));

    const pastData = history.filter(h => (h.year < currentYear) || (h.year === currentYear && h.month < currentMonth));
    if (pastData.length === 0) return null;

    const recent = pastData.slice(-3);
    const sum = recent.reduce((acc, curr) => acc + curr.value, 0);
    return sum / recent.length;
  }
};