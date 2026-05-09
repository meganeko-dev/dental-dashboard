import Papa from 'papaparse'

// 💡 半角カタカナを全角に変換する補助関数
const toFullWidthKatakana = (str: string): string => {
  if (!str) return "";
  const kanaMap: Record<string, string> = {
    'ｶﾞ': 'ガ', 'ｷﾞ': 'ギ', 'ｸﾞ': 'グ', 'ｹﾞ': 'ゲ', 'ｺﾞ': 'ゴ',
    'ｻﾞ': 'ザ', 'ｼﾞ': 'ジ', 'ｽﾞ': 'ズ', 'ｾﾞ': 'ゼ', 'ｿﾞ': 'ゾ',
    'ﾀﾞ': 'ダ', 'ﾁﾞ': 'ヂ', 'ﾂﾞ': 'ヅ', 'ﾃﾞ': 'デ', 'ﾄﾞ': 'ド',
    'ﾊﾞ': 'バ', 'ﾋﾞ': 'ビ', 'ﾌﾞ': 'ブ', 'ﾍﾞ': 'ベ', 'ﾎﾞ': 'ボ',
    'ﾊﾟ': 'パ', 'ﾋﾟ': 'ピ', 'ﾌﾟ': 'プ', 'ﾍﾟ': 'ペ', 'ﾎﾟ': 'ポ',
    'ｳﾞ': 'ヴ', 'ﾜﾞ': 'ヷ', 'ｦﾞ': 'ヺ',
    'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
    'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
    'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
    'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
    'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
    'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
    'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
    'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
    'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
    'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
    'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
    'ｯ': 'ッ', 'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ',
    'ｰ': 'ー', '｡': '。', '､': '、', '･': '・', 'ﾞ': '゛', 'ﾟ': '゜'
  };
  const sortedKeys = Object.keys(kanaMap).sort((a, b) => b.length - a.length);
  const reg = new RegExp(sortedKeys.join('|'), 'g');
  return str.replace(reg, (match) => kanaMap[match]);
};

// 名前をクリーニングする補助関数
const cleanName = (name: string): string => {
  if (!name) return '';
  const parts = name.split('_');
  return parts.length > 1 ? parts[1].trim() : name.trim();
};

const parseSheetNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).replace(/,/g, '').trim();
  if (normalized === '') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseSheetYearMonth = (value: string | null | undefined): { year: number; month: number } | null => {
  const normalized = String(value ?? '').trim();
  const slashMatch = normalized.match(/^(\d{4})[\/\-](\d{1,2})/);
  if (slashMatch) return { year: Number(slashMatch[1]), month: Number(slashMatch[2]) };

  const japaneseMatch = normalized.match(/^(\d{4})年\s*(\d{1,2})月/);
  if (japaneseMatch) return { year: Number(japaneseMatch[1]), month: Number(japaneseMatch[2]) };

  const compactMatch = normalized.match(/^(\d{4})(\d{2})$/);
  if (compactMatch) return { year: Number(compactMatch[1]), month: Number(compactMatch[2]) };

  return null;
};

const monthFirstDate = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, '0')}-01`;

const getClinicNameFromMap = (clinicIdToName: Map<string, string>, clinicId: string): string | null => {
  return clinicIdToName.get(clinicId) ?? clinicIdToName.get(String(Number(clinicId))) ?? null;
};

export const DataImporter = {
  // ==========================================
  // 既存のメソッド
  // ==========================================
  parseCSV: (file: File): Promise<any[]> => {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
      })
    })
  },

  transformPivotData: (rawData: any[]) => {
    const results: any[] = []
    rawData.forEach(row => {
      const clinicName = cleanName(row['医院名'])
      const kpiName = row['項目']
      const staffName = row['担当'] || '' 
      const segment = staffName ? 'person' : 'clinic'
      if (!clinicName || !kpiName) return 
      Object.keys(row).forEach(key => {
        const dateMatch = key.match(/(\d{4})年(\d{1,2})月/);
        if (dateMatch) {
          const year = parseInt(dateMatch[1]);
          const month = parseInt(dateMatch[2]);
          let valStr = String(row[key]).replace(/[%,]/g, '');
          const val = parseFloat(valStr);
          if (!isNaN(val)) {
            results.push({
              year, month, segment, clinic_name: clinicName, staff_name: staffName, kpi_name: kpiName, value: val, is_target: false
            });
          }
        }
      });
    });
    return results;
  },

  transformSalesData: (rawData: any[]) => {
    const seen = new Map<string, any>();
    rawData.forEach(row => {
      const targetMonth = row['対象年月'];
      const clinicName = cleanName(row['医院名']);
      const staffName = row['レセコン登録氏名'];
      if (!targetMonth || !clinicName) return;
      const dateMatch = targetMonth.match(/(\d{4})年(\d{1,2})月/);
      if (!dateMatch) return;
      const year = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      const metrics = [
        { key: '保険点数売上', name: '保険点数売上' },
        { key: '自費売上（税込・入金）', name: '自費売上' }
      ];
      metrics.forEach(m => {
        const val = parseFloat(String(row[m.key]).replace(/[%,]/g, ''));
        if (!isNaN(val)) {
          const key = `${year}-${month}-person-${clinicName}-${staffName}-${m.name}-false`;
          if (!seen.has(key)) {
            seen.set(key, {
              year, month, segment: 'person', clinic_name: clinicName, staff_name: staffName, kpi_name: m.name, value: val, is_target: false
            });
          }
        }
      });
    });
    return Array.from(seen.values());
  },

  parseCSVAsArray: (file: File): Promise<string[][]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data as string[][]),
        error: (error) => reject(error),
      })
    })
  },

  parseCSVAsArraySJIS: (file: File): Promise<string[][]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        encoding: 'Shift_JIS',
        complete: (results) => resolve(results.data as string[][]),
        error: (error) => reject(error),
      })
    })
  },

  // Google Sheets由来CSV: シート「メンテナンス」
  // A列: 医院ID / B列: 医院名 / C列: 項目 / D列以降: 年月別の値
  transformSheetMaintenance: (
    data: string[][],
    corpId: string,
    clinicIdToName: Map<string, string>
  ): any[] => {
    if (data.length < 2) return [];

    const headers = data[0];
    const ymCols = headers.slice(3).map(parseSheetYearMonth);
    const results: any[] = [];
    const kpiMap: Record<string, string> = {
      'メンテ': 'メンテナンス数',
      '予約数': '予約人数_既存患者',
      '来院数': '来院数',
    };

    for (const row of data.slice(1)) {
      const clinicId = String(row[0] ?? '').trim();
      if (!clinicId) continue;

      const sourceItem = String(row[2] ?? '').trim();
      const kpiName = kpiMap[sourceItem];
      if (!kpiName) continue;

      const clinicName = getClinicNameFromMap(clinicIdToName, clinicId);
      if (!clinicName) continue;

      for (let i = 0; i < ymCols.length; i++) {
        const ym = ymCols[i];
        if (!ym) continue;

        const value = parseSheetNumber(row[i + 3]);
        if (value === null) continue;

        results.push({
          corporation_id: corpId,
          clinic_id: clinicId,
          clinic_name: clinicName,
          staff_name: '',
          year: ym.year,
          month: ym.month,
          date: monthFirstDate(ym.year, ym.month),
          segment: 'clinic',
          kpi_name: kpiName,
          value,
          is_target: false,
          treatment_type: '',
          staff_role: '',
        });
      }
    }

    return results;
  },

  // Google Sheets由来CSV: シート「離脱」
  // A列: 医院ID / B列: 医院名 / C列: 項目 / D列: ステータス / E列以降: 年月別の値
  transformSheetChurn: (
    data: string[][],
    corpId: string,
    clinicIdToName: Map<string, string>
  ): any[] => {
    if (data.length < 2) return [];

    const headers = data[0];
    const ymCols = headers.slice(4).map(parseSheetYearMonth);
    const results: any[] = [];
    const getKpiName = (category: string, status: string): string | null => {
      if (category === '患者数' && status === '') return '患者数';
      if (category === 'メンテ' && status === '離脱数') return 'メンテナンス_離脱数';
      if (category === 'メンテ' && status === '未予約数') return 'メンテナンス_未予約数';
      if (category === '治療' && status === '離脱数') return '治療_離脱数';
      if (category === '治療' && status === '未予約数') return '治療_未予約数';
      return null;
    };

    for (const row of data.slice(1)) {
      const clinicId = String(row[0] ?? '').trim();
      if (!clinicId) continue;

      const category = String(row[2] ?? '').trim();
      const status = String(row[3] ?? '').trim();
      const kpiName = getKpiName(category, status);
      if (!kpiName) continue;

      const clinicName = getClinicNameFromMap(clinicIdToName, clinicId);
      if (!clinicName) continue;

      for (let i = 0; i < ymCols.length; i++) {
        const ym = ymCols[i];
        if (!ym) continue;

        const value = parseSheetNumber(row[i + 4]);
        if (value === null) continue;

        results.push({
          corporation_id: corpId,
          clinic_id: clinicId,
          clinic_name: clinicName,
          staff_name: '',
          year: ym.year,
          month: ym.month,
          date: monthFirstDate(ym.year, ym.month),
          segment: 'clinic',
          kpi_name: kpiName,
          value,
          is_target: false,
          treatment_type: '',
          staff_role: '',
        });
      }
    }

    return results;
  },

  transformStats: (data: string[][], clinicName: string, corpId: string, clinicId: string): any[] => {
    const headers = data[0];
    const results: any[] = [];

    // clinic,all 行から取得するKPIのホワイトリスト
    // 「率」系は Stats 内で 0-1 形式のため ×100 して % に変換する
    const CLINIC_KPI_MAP: Record<string, { kpi_name: string; multiply100: boolean }> = {
      '診療日数':       { kpi_name: '診療日数',         multiply100: false },
      '来院患者数':     { kpi_name: '来院患者数',        multiply100: false },
      '継続患者':       { kpi_name: '来院人数_既存患者', multiply100: false },
      '新患数':         { kpi_name: '来院人数_新規患者', multiply100: false },
      '初回メンテ移行数': { kpi_name: '初回メンテ移行数', multiply100: false },
      '当日キャンセル数': { kpi_name: '当日キャンセル数',  multiply100: false },
      '離脱患者':       { kpi_name: '離脱患者',          multiply100: false },
      '離脱率':         { kpi_name: '離脱率',            multiply100: false },
      'ユニット稼働率': { kpi_name: 'チェア稼働率',       multiply100: true  },
    };

    // stage 行から取得するステージ名 → kpi_name マッピング
    // 「初診」はkpi-engineの PATIENT_BREAKDOWN_KPIS に合わせ「初診/急患」とする
    const STAGE_VISIT_MAP: Record<string, string> = {
      '初診':     '来院人数_初診/急患',
      '枠外':     '来院人数_枠外',
      '治療1':    '来院人数_治療1',
      '治療2':    '来院人数_治療2',
      'imp':      '来院人数_imp',
      'set':      '来院人数_set',
      'DH':       '来院人数_DH',
      'DH2':      '来院人数_DH2',
      '矯正':     '来院人数_矯正',
      'その他相談': '来院人数_その他相談',
      // 'なし'・'訪問' は集計対象外
    };

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const cat1 = row[0]?.trim();
      const cat2 = row[1]?.trim();
      const item = row[2]?.trim();

      if (!cat1 || !item) continue;

      let kpi_name: string | null = null;
      let multiply100 = false;

      if (cat1 === 'clinic' && cat2 === 'all') {
        const mapping = CLINIC_KPI_MAP[item];
        if (!mapping) continue;
        kpi_name = mapping.kpi_name;
        multiply100 = mapping.multiply100;
      } else if (cat1 === 'stage' && item === '来院患者数') {
        const mapped = STAGE_VISIT_MAP[cat2 || ''];
        if (!mapped) continue;
        kpi_name = mapped;
      } else {
        continue;
      }

      for (let j = 3; j < headers.length; j++) {
        const yearMonth = headers[j]?.trim();
        const valStr = row[j];
        if (!yearMonth || !valStr || valStr.trim() === '') continue;
        if (!/^\d{6}$/.test(yearMonth)) continue;

        let value = parseFloat(valStr.replace(/,/g, ''));
        if (isNaN(value)) continue;
        if (multiply100) value = parseFloat((value * 100).toFixed(4));

        const year = parseInt(yearMonth.substring(0, 4), 10);
        const month = parseInt(yearMonth.substring(4, 6), 10);

        results.push({
          corporation_id: corpId,
          clinic_id: clinicId,
          clinic_name: clinicName,
          staff_name: '',
          year,
          month,
          date: `${year}-${String(month).padStart(2, '0')}-01`,
          segment: 'clinic',
          kpi_name,
          value,
          is_target: false,
          treatment_type: '',
          staff_role: '',
        });
      }
    }
    return results;
  },

  transformStatus: (data: string[][], clinicName: string, corpId: string, clinicId: string): any[] => {
    const headers = data[0];
    // 診療日数は医院状況では暦日数ベースになるケースがあるため Stats を正とし、ここでは除外
    // 合計診療時間(H) のみ取得（Stats の合計診療時間は分単位のため、時間単位はこちらが唯一のソース）
    const TARGET_KPI = '合計診療時間(H)';
    const ymIndex = headers.indexOf('年月');
    const kpiIndex = headers.indexOf(TARGET_KPI);

    if (ymIndex === -1 || kpiIndex === -1) return [];

    const results: any[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const ymStr = row[ymIndex]?.trim();
      if (!ymStr || !/^\d{6}$/.test(ymStr)) continue;

      const year = parseInt(ymStr.substring(0, 4), 10);
      const month = parseInt(ymStr.substring(4, 6), 10);

      const valStr = row[kpiIndex];
      if (!valStr || valStr.trim() === '') continue;

      const value = parseFloat(valStr.replace(/,/g, ''));
      if (isNaN(value)) continue;

      results.push({
        corporation_id: corpId,
        clinic_id: clinicId,
        clinic_name: clinicName,
        staff_name: '',
        year,
        month,
        date: `${year}-${String(month).padStart(2, '0')}-01`,
        segment: 'clinic',
        kpi_name: TARGET_KPI,
        value,
        is_target: false,
        treatment_type: '',
        staff_role: '',
      });
    }
    return results;
  },

  // FWLRNER6専用: 月計表（全Ｄｒ日別）= クリニック日別売上
  transformSalesClinic: (data: string[][], clinicName: string, corpId: string, clinicId: string): any[] => {
    if (data.length < 2) return [];
    const headers = data[0].map(h => h?.trim() ?? '');
    const idx = (name: string) => headers.indexOf(name);

    const dateIdx        = idx('対象日付');
    const shahoCashIdx   = idx('社保現金入金額');
    const shahoPaxIdx    = idx('社保患者数');
    const shahoTenIdx    = idx('社保点数');
    const kohoCashIdx    = idx('国保現金入金額');
    const kohoPaxIdx     = idx('国保患者数');
    const kohoTenIdx     = idx('国保点数');
    const jifeeCashIdx   = idx('自費現金入金額');
    const jifeeCardIdx   = idx('自費カード入金額');
    const jifeePaxIdx    = idx('自費人数');
    const zasshuCashIdx  = idx('雑収現金入金額');
    const zasshuPaxIdx   = idx('雑収人数');
    const kodoDaysIdx    = idx('稼働日数');

    if (dateIdx === -1) return [];

    const results: any[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const dateStr = row[dateIdx]?.trim();
      if (!dateStr || !/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) continue;

      const n = (colIdx: number) => {
        if (colIdx === -1) return 0;
        const v = parseFloat(String(row[colIdx] ?? '').replace(/,/g, ''));
        return isNaN(v) ? 0 : v;
      };

      const shahoCash  = n(shahoCashIdx);
      const shahoPax   = n(shahoPaxIdx);
      const shahoTen   = n(shahoTenIdx);
      const kohoCash   = n(kohoCashIdx);
      const kohoPax    = n(kohoPaxIdx);
      const kohoTen    = n(kohoTenIdx);
      const jifeeKingaku = n(jifeeCashIdx) + n(jifeeCardIdx);
      const jifeePax   = n(jifeePaxIdx);
      const zasshuCash = n(zasshuCashIdx);
      const zasshuPax  = n(zasshuPaxIdx);

      // 全値が0の行（休診日等）はスキップ
      if ([shahoCash, shahoPax, kohoCash, kohoPax, jifeeKingaku, jifeePax, zasshuCash, zasshuPax].every(v => v === 0)) continue;

      const date = dateStr.replace(/\//g, '-');
      const [yearStr, monthStr] = dateStr.split('/');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      const common = {
        corporation_id: corpId, clinic_id: clinicId, clinic_name: clinicName,
        staff_name: '', year, month, date, is_target: false,
        segment: 'clinic', staff_role: '', treatment_type: '',
      };

      [
        { kpi_name: '社会保険_金額',     value: shahoTen * 10 },
        { kpi_name: '社会保険_点数',     value: shahoTen },
        { kpi_name: '国民健康保険_金額', value: kohoTen * 10 },
        { kpi_name: '国民健康保険_点数', value: kohoTen },
        { kpi_name: '自費治療_金額',     value: jifeeKingaku },
        { kpi_name: '雑収入_金額',       value: zasshuCash },
        { kpi_name: '社会保険_人数',     value: shahoPax },
        { kpi_name: '国民健康保険_人数', value: kohoPax },
        { kpi_name: '自費治療_人数',     value: jifeePax },
        { kpi_name: '雑収入_人数',       value: zasshuPax },
        { kpi_name: '稼働日数',          value: n(kodoDaysIdx) },
      ].forEach(kpi => results.push({ ...common, ...kpi }));
    }
    return results;
  },

  // FWLRNER6専用: 月計表（総括）= 担当者別月次売上
  transformSalesStaff: (data: string[][], clinicName: string, corpId: string, clinicId: string): any[] => {
    if (data.length < 2) return [];
    const headers = data[0].map(h => h?.trim() ?? '');
    const idx = (name: string) => headers.indexOf(name);

    const dateIdx        = idx('対象日付');
    const lastNameIdx    = idx('医師氏名（姓）');
    const firstNameIdx   = idx('医師氏名（名）');
    const shahoCashIdx   = idx('社保現金入金額');
    const shahoPaxIdx    = idx('社保患者数');
    const shahoTenIdx    = idx('社保点数');
    const kohoCashIdx    = idx('国保現金入金額');
    const kohoPaxIdx     = idx('国保患者数');
    const kohoTenIdx     = idx('国保点数');
    const jifeeCashIdx   = idx('自費現金入金額');
    const jifeeCardIdx   = idx('自費カード入金額');
    const jifeePaxIdx    = idx('自費人数');
    const zasshuCashIdx  = idx('雑収現金入金額');
    const zasshuPaxIdx   = idx('雑収人数');
    const kodoDaysIdx    = idx('稼働日数');

    if (dateIdx === -1 || lastNameIdx === -1) return [];

    const results: any[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const dateStr = row[dateIdx]?.trim();
      if (!dateStr || !/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) continue;

      const lastName  = row[lastNameIdx]?.trim() ?? '';
      const firstName = row[firstNameIdx]?.trim() ?? '';
      const staffName = [lastName, firstName].filter(Boolean).join(' ');
      if (!staffName) continue;

      const n = (colIdx: number) => {
        if (colIdx === -1) return 0;
        const v = parseFloat(String(row[colIdx] ?? '').replace(/,/g, ''));
        return isNaN(v) ? 0 : v;
      };

      const date = dateStr.replace(/\//g, '-');
      const [yearStr, monthStr] = dateStr.split('/');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      const common = {
        corporation_id: corpId, clinic_id: clinicId, clinic_name: clinicName,
        staff_name: staffName, year, month, date, is_target: false,
        segment: 'staff', staff_role: '', treatment_type: '',
      };

      [
        { kpi_name: '社会保険_金額',     value: n(shahoTenIdx) * 10 },
        { kpi_name: '社会保険_点数',     value: n(shahoTenIdx) },
        { kpi_name: '国民健康保険_金額', value: n(kohoTenIdx) * 10 },
        { kpi_name: '国民健康保険_点数', value: n(kohoTenIdx) },
        { kpi_name: '自費治療_金額',     value: n(jifeeCashIdx) + n(jifeeCardIdx) },
        { kpi_name: '雑収入_金額',       value: n(zasshuCashIdx) },
        { kpi_name: '社会保険_人数',     value: n(shahoPaxIdx) },
        { kpi_name: '国民健康保険_人数', value: n(kohoPaxIdx) },
        { kpi_name: '自費治療_人数',     value: n(jifeePaxIdx) },
        { kpi_name: '雑収入_人数',       value: n(zasshuPaxIdx) },
        { kpi_name: '稼働日数',          value: n(kodoDaysIdx) },
      ].forEach(kpi => results.push({ ...common, ...kpi }));
    }
    return results;
  },

  // FWLRNER6専用: 日計表（患者№順）= 担当者別日別売上（患者単位の明細行を集計）
  // 保険種別 → kpi_name マッピング:
  //   '雑収' → 物販_金額
  //   '自費' → 自費治療_金額
  //   その他 → 保険治療_金額
  // value = 現金入金額 + カード入金額
  // 医師氏名（姓/名）が空白の行はスキップ（出金行等）
  transformFujimikaiStaffDaily: (
    data: string[][],
    clinicName: string,
    corpId: string,
    clinicId: string
  ): any[] => {
    if (data.length < 2) return [];
    const headers = data[0].map(h => h?.trim() ?? '');
    const idx = (name: string) => headers.indexOf(name);

    const dateIdx      = idx('日付');
    const hokenIdx     = idx('保険種別');
    const lastNameIdx  = idx('医師氏名（姓）');
    const firstNameIdx = idx('医師氏名（名）');
    const cashIdx      = idx('現金入金額');
    const cardIdx      = idx('カード入金額');

    if (dateIdx === -1 || hokenIdx === -1 || lastNameIdx === -1) return [];

    const n = (row: string[], colIdx: number): number => {
      if (colIdx === -1) return 0;
      const v = parseFloat(String(row[colIdx] ?? '').replace(/,/g, ''));
      return isNaN(v) ? 0 : v;
    };

    // 姓 + 名 を氏名に正規化（全角空白→半角、連続空白→単一）
    const normalizeStaffName = (last: string, first: string): string | null => {
      const combined = `${last ?? ''} ${first ?? ''}`
        .replace(/\u3000/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!combined) return null;
      const parts = combined.split(' ').filter(Boolean);
      if (parts.length !== 2) return null; // 姓のみ/名のみ/3分割以上は不正
      return parts.join(' ');
    };

    // 日付正規化: "2026/ 2/ 2" のような空白入りにも対応
    const parseDate = (raw: string): { year: number; month: number; date: string } | null => {
      if (!raw) return null;
      const cleaned = raw.replace(/\s+/g, '');
      const m = cleaned.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
      if (!m) return null;
      const year  = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      const day   = parseInt(m[3], 10);
      if (!year || !month || !day) return null;
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { year, month, date };
    };

    // 集計マップ: key = date|staffName|kpiName
    const agg = new Map<string, {
      date: string; year: number; month: number;
      staffName: string; kpiName: string; value: number;
    }>();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const dateParsed = parseDate(row[dateIdx]?.trim() ?? '');
      if (!dateParsed) continue;

      const staffName = normalizeStaffName(
        row[lastNameIdx] ?? '',
        firstNameIdx !== -1 ? (row[firstNameIdx] ?? '') : ''
      );
      if (!staffName) continue;

      const hoken = (row[hokenIdx] ?? '').trim();
      const kpiName =
        hoken === '雑収' ? '物販_金額' :
        hoken === '自費' ? '自費治療_金額' :
        '保険治療_金額';

      const value = n(row, cashIdx) + n(row, cardIdx);

      const key = `${dateParsed.date}|${staffName}|${kpiName}`;
      const existing = agg.get(key);
      if (existing) {
        existing.value += value;
      } else {
        agg.set(key, {
          date:  dateParsed.date,
          year:  dateParsed.year,
          month: dateParsed.month,
          staffName, kpiName, value,
        });
      }
    }

    const results: any[] = [];
    for (const r of agg.values()) {
      results.push({
        corporation_id: corpId,
        clinic_id:      clinicId,
        clinic_name:    clinicName,
        staff_name:     r.staffName,
        year:           r.year,
        month:          r.month,
        date:           r.date,
        segment:        'staff',
        kpi_name:       r.kpiName,
        value:          r.value,
        is_target:      false,
        treatment_type: '',
        staff_role:     '',
      });
    }
    return results;
  },

  // TN32FBH8専用: 新心会 売上CSV（レセプト数 / 保険売上 / 自費売上）
  // フォーマット: 法人名, 医院ID, 医院名, 202501, 202502, ...
  // 保険売上・自費売上は千円単位のため × 1000 して円に変換
  transformShinshinkai: (
    data: string[][],
    corpId: string,
    kpiType: 'recept' | 'insurance' | 'private'
  ): any[] => {
    if (data.length < 2) return [];

    const KPI_NAME_MAP = {
      recept:    'レセプト',
      insurance: '社会保険_金額',
      private:   '自費治療_金額',
    };
    const MULTIPLY_MAP = {
      recept:    1,
      insurance: 1000,
      private:   1000,
    };

    const kpiName = KPI_NAME_MAP[kpiType];
    const multiply = MULTIPLY_MAP[kpiType];
    const headers = data[0];
    const results: any[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const clinicId   = row[1]?.trim() ?? '';
      const clinicName = row[2]?.trim() ?? '';
      if (!clinicName) continue;

      for (let j = 3; j < headers.length; j++) {
        const ym = headers[j]?.trim();
        if (!ym || !/^\d{6}$/.test(ym)) continue;

        const valStr = (row[j] ?? '').replace(/,/g, '').trim();
        if (valStr === '') continue;
        const val = parseFloat(valStr);
        if (isNaN(val)) continue;

        const year  = parseInt(ym.substring(0, 4), 10);
        const month = parseInt(ym.substring(4, 6), 10);

        results.push({
          corporation_id: corpId,
          clinic_id:      clinicId,
          clinic_name:    clinicName,
          staff_name:     '',
          year,
          month,
          date:           `${year}-${String(month).padStart(2, '0')}-01`,
          segment:        'clinic',
          kpi_name:       kpiName,
          value:          val * multiply,
          is_target:      false,
          treatment_type: '',
          staff_role:     '',
        });
      }
    }
    return results;
  },

  // ステージ日別状況の変換
  // 取得対象: 予約数・新患予約数・事前/無断キャンセル数・次回予約取得数/率
  //          来院(人) 合計列 (kpi_name = "来院人数_ステージ内訳用")
  //              → 患者IDユニーク値。レポートタブのメンテナンス推移で「メンテ以外 = 来院人数_ステージ内訳用 − メンテ数」の計算に使用
  //          来院(人)>ステージ内訳の各小項目 (kpi_name = "来院人数_ステージ内訳_<小項目名>")
  // 除外(Stats が正ソース): 来院人数_* (ステージ内訳プレフィックス無し) / 当日キャンセル数
  // 除外(engine が計算): キャンセル率
  // ※「率」はこのファイル内では "89.45%" のように % 表記 → % を除去してそのまま格納
  // ※ 来院ステージ内訳の項目名・項目数はクリニックごとに異なる（動的取り込み）
  transformStage: (data: string[][], clinicName: string, corpId: string, clinicId: string): any[] => {
    if (data.length < 4) return [];

    const row1 = data[1] || []; // 大項目
    const row2 = data[2] || []; // 中項目
    const row3 = data[3] || []; // 小項目

    const columnMapping: Record<number, string> = {};
    let currentMajor = "";
    let currentMiddle = "";

    for (let j = 1; j < row1.length; j++) {
      const r1 = row1[j] ? row1[j].trim() : "";
      const r2 = row2[j] ? row2[j].trim() : "";
      const r3 = row3[j] ? row3[j].trim() : "";

      if (r1 !== "" && r1 !== "-") {
        currentMajor = r1;
        currentMiddle = "";
      }
      if (r2 !== "" && r2 !== "-") {
        currentMiddle = r2;
      }

      const major = currentMajor;
      const middle = currentMiddle;
      const minor = r3;

      let kpiName = "";

      if (middle === "当日次回予約獲得") {
        // 次回予約取得数・率はこのファイルでのみ取得可能
        if (minor === "人数") kpiName = "次回予約取得数";
        else if (minor === "獲得率") kpiName = "次回予約取得率";
      } else if (major === "予約(人)") {
        // col 2: middle="" → 既存患者の予約数
        // col 3: middle="新患" → 新患の予約数
        if (middle === "" && minor === "") kpiName = "予約人数_既存患者";
        else if (middle === "新患") kpiName = "予約人数_新規患者";
      } else if (major === "事前キャンセル(人)" && middle === "" && minor === "") {
        // 事前キャンセルはこのファイルでのみ取得可能
        kpiName = "事前キャンセル数";
      } else if (major === "無断キャンセル(人)" && middle === "" && minor === "") {
        // 無断キャンセルはこのファイルでのみ取得可能
        kpiName = "無断キャンセル数";
      } else if (major === "myDental(アプリ)") {
        // myDental アプリ登録件数・累計（レポートタブ「アプリ登録者数」用）
        if (middle === "登録件数") kpiName = "アプリ登録件数";
        else if (middle === "累計") kpiName = "アプリ登録累計";
      } else if (major === "ウェブ予約") {
        // ウェブ予約 新患/再診（レポートタブ「ウェブ新患/再診」用）
        if (middle === "新患") kpiName = "ウェブ予約_新患";
        else if (middle === "再診") kpiName = "ウェブ予約_再診";
      } else if (major === "キャンセル率" && middle === "" && minor === "") {
        // キャンセル率 全体（レポートタブ「獲得率とキャンセル率」用）
        kpiName = "キャンセル率_全体";
      } else if (major === "来院(人)" && middle === "ステージ内訳" && minor !== "" && minor !== "-") {
        // 来院ステージ内訳: 各小項目をクリニック別の動的KPIとして取り込む
        // 項目名・項目数はクリニックごとに異なる。Phase4 メンテナンスマッピングの元データ
        kpiName = `来院人数_ステージ内訳_${minor}`;
      } else if (major === "来院(人)" && middle === "" && minor === "") {
        // 来院(人) 合計列（患者IDユニーク値）。
        // Stats CSV の '来院患者数' とは別軸として、レポートタブのメンテナンス推移計算用に
        // '来院人数_ステージ内訳用' として保存（メンテ以外 = この値 − メンテ数）。
        kpiName = "来院人数_ステージ内訳用";
      }
      // 除外: 当日キャンセル(人) → Stats の transformStats で取得
      // 除外: 事前/当日/無断キャンセル / キャンセル率 のステージ内訳 → 現時点では不要

      if (kpiName) columnMapping[j] = kpiName;
    }

    const results: any[] = [];

    for (let i = 4; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;
      const firstCell = row[0] ? row[0].trim() : "";

      // 合計行・ヘッダー行・空行はスキップ
      if (!firstCell || firstCell === "合計" || firstCell === "月") continue;
      if (!/^\d{4}\/\d{2}$/.test(firstCell)) continue;

      const [yearStr, monthStr] = firstCell.split('/');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      const common = {
        corporation_id: corpId,
        clinic_id: clinicId,
        clinic_name: clinicName,
        staff_name: '',
        year,
        month,
        date: `${year}-${String(month).padStart(2, '0')}-01`,
        is_target: false,
        segment: 'clinic',
        staff_role: '',
        treatment_type: '',
      };

      for (const [colIdxStr, kpiName] of Object.entries(columnMapping)) {
        const colIdx = parseInt(colIdxStr);
        let valStr = row[colIdx];
        if (!valStr || valStr.trim() === "" || valStr.trim() === "-") continue;

        // % 表記の率はそのまま数値に変換（例: "89.45%" → 89.45）
        const value = parseFloat(valStr.replace(/,/g, '').replace('%', ''));
        if (isNaN(value)) continue;

        results.push({ ...common, kpi_name: kpiName, value });
      }
    }
    return results;
  },

  // 患者リスト CSV → patient_snapshots レコードへの変換。
  // カルテ番号はここでは未ハッシュ。サーバ API ルート側でハッシュ化する想定。
  // 入力 data[0] = ヘッダー、data[1..] = 1行=1患者。先頭列は通し番号 (空)。
  transformPatientList: (data: string[][]): PatientListInputRow[] => {
    if (data.length < 2) return [];

    const header = data[0] ?? [];
    const idx = (label: string) => header.findIndex(c => (c ?? '').trim() === label);

    const colKarte    = idx('カルテ番号');
    const colVisit    = idx('来院状況');
    const colMain     = idx('メンテ状況');
    const colDr       = idx('Dr');
    const colDh       = idx('DH');
    const colGender   = idx('性別');
    const colAge      = idx('年齢');
    const colTags     = idx('タグ');
    const colFirstDate  = idx('初回来院日');
    const colFirstYm    = idx('初回来院月');
    const colLastDate   = idx('前回来院日');
    const colLastTreat  = idx('前回診療内容');
    const colLastStage  = idx('前回ステージ');
    const colLastHand   = idx('前回担当');
    const colNextDate   = idx('次回予約日');
    const colNextTreat  = idx('次回診療内容');
    const colNextStage  = idx('次回ステージ');
    const colNextHand   = idx('次回担当');
    const colMainStart  = idx('メンテ開始日');
    const colLastMain   = idx('直近メンテ日');
    const colMainCount  = idx('メンテ回数');
    const colVisitCount = idx('来院回数');
    const colCancelCnt  = idx('キャンセル回数');
    const colPriorCC    = idx('事前キャンセル回数');
    const colClosed     = idx('終診');
    const colVisitRes   = idx('前回来院結果');
    const colChurnDdl   = idx('離脱限界日');
    const colChurnFlag  = idx('離脱フラグ');

    if (colKarte < 0) return [];

    const cleanText = (v: string | undefined): string | null => {
      const t = (v ?? '').trim();
      return t === '' ? null : t;
    };
    const toInt = (v: string | undefined): number | null => {
      const t = (v ?? '').trim().replace(/,/g, '');
      if (t === '') return null;
      const n = parseInt(t, 10);
      return Number.isFinite(n) ? n : null;
    };
    const toDate = (v: string | undefined): string | null => {
      const t = (v ?? '').trim();
      // 受け入れる形式: YYYY-MM-DD / YYYY/MM/DD
      const m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (!m) return null;
      const yyyy = m[1];
      const mm = m[2].padStart(2, '0');
      const dd = m[3].padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const out: PatientListInputRow[] = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;
      const karte = (row[colKarte] ?? '').trim();
      if (!karte) continue;
      out.push({
        karte_number: karte,
        visit_status: cleanText(row[colVisit]),
        maintenance_status: cleanText(row[colMain]),
        dr_name: cleanText(row[colDr]),
        dh_name: cleanText(row[colDh]),
        gender: cleanText(row[colGender]),
        age: toInt(row[colAge]),
        tags: cleanText(row[colTags]),
        first_visit_date: toDate(row[colFirstDate]),
        first_visit_yyyymm: cleanText(row[colFirstYm]),
        last_visit_date: toDate(row[colLastDate]),
        last_treatment: cleanText(row[colLastTreat]),
        last_stage: cleanText(row[colLastStage]),
        last_handler: cleanText(row[colLastHand]),
        next_reserve_date: toDate(row[colNextDate]),
        next_treatment: cleanText(row[colNextTreat]),
        next_stage: cleanText(row[colNextStage]),
        next_handler: cleanText(row[colNextHand]),
        maintenance_start_date: toDate(row[colMainStart]),
        last_maintenance_date: toDate(row[colLastMain]),
        maintenance_count: toInt(row[colMainCount]),
        visit_count: toInt(row[colVisitCount]),
        cancel_count: toInt(row[colCancelCnt]),
        prior_cancel_count: toInt(row[colPriorCC]),
        closed_flag: cleanText(row[colClosed]),
        last_visit_result: cleanText(row[colVisitRes]),
        churn_deadline: toDate(row[colChurnDdl]),
        churn_flag: cleanText(row[colChurnFlag]),
      });
    }
    return out;
  },
}

// 患者リスト CSV のパース結果（カルテ番号は生値のまま、API ルートでハッシュ化される）。
export type PatientListInputRow = {
  karte_number: string;
  visit_status: string | null;
  maintenance_status: string | null;
  dr_name: string | null;
  dh_name: string | null;
  gender: string | null;
  age: number | null;
  tags: string | null;
  first_visit_date: string | null;
  first_visit_yyyymm: string | null;
  last_visit_date: string | null;
  last_treatment: string | null;
  last_stage: string | null;
  last_handler: string | null;
  next_reserve_date: string | null;
  next_treatment: string | null;
  next_stage: string | null;
  next_handler: string | null;
  maintenance_start_date: string | null;
  last_maintenance_date: string | null;
  maintenance_count: number | null;
  visit_count: number | null;
  cancel_count: number | null;
  prior_cancel_count: number | null;
  closed_flag: string | null;
  last_visit_result: string | null;
  churn_deadline: string | null;
  churn_flag: string | null;
};
