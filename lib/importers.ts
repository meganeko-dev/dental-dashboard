// import { createClient } from '@supabase/supabase-js'
// import Papa from 'papaparse'

// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
// )

// // 💡 半角カタカナを全角に変換する補助関数（ステージ内訳用）
// const toFullWidthKatakana = (str: string): string => {
//   if (!str) return "";
//   const kanaMap: Record<string, string> = {
//     'ｶﾞ': 'ガ', 'ｷﾞ': 'ギ', 'ｸﾞ': 'グ', 'ｹﾞ': 'ゲ', 'ｺﾞ': 'ゴ',
//     'ｻﾞ': 'ザ', 'ｼﾞ': 'ジ', 'ｽﾞ': 'ズ', 'ｾﾞ': 'ゼ', 'ｿﾞ': 'ゾ',
//     'ﾀﾞ': 'ダ', 'ﾁﾞ': 'ヂ', 'ﾂﾞ': 'ヅ', 'ﾃﾞ': 'デ', 'ﾄﾞ': 'ド',
//     'ﾊﾞ': 'バ', 'ﾋﾞ': 'ビ', 'ﾌﾞ': 'ブ', 'ﾍﾞ': 'ベ', 'ﾎﾞ': 'ボ',
//     'ﾊﾟ': 'パ', 'ﾋﾟ': 'ピ', 'ﾌﾟ': 'プ', 'ﾍﾟ': 'ペ', 'ﾎﾟ': 'ポ',
//     'ｳﾞ': 'ヴ', 'ﾜﾞ': 'ヷ', 'ｦﾞ': 'ヺ',
//     'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
//     'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
//     'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
//     'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
//     'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
//     'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
//     'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
//     'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
//     'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
//     'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
//     'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
//     'ｯ': 'ッ', 'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ',
//     'ｰ': 'ー', '｡': '。', '､': '、', '･': '・', 'ﾞ': '゛', 'ﾟ': '゜'
//   };
//   const sortedKeys = Object.keys(kanaMap).sort((a, b) => b.length - a.length);
//   const reg = new RegExp(sortedKeys.join('|'), 'g');
//   return str.replace(reg, (match) => kanaMap[match]);
// };

// // 名前をクリーニングする補助関数
// const cleanName = (name: string): string => {
//   if (!name) return '';
//   const parts = name.split('_');
//   return parts.length > 1 ? parts[1].trim() : name.trim();
// };

// export const DataImporter = {
//   // ==========================================
//   // 既存のメソッド (parseCSV, transformPivotData, transformSalesData, saveToDb, parseCSVAsArray)
//   // ==========================================
//   parseCSV: (file: File): Promise<any[]> => {
//     return new Promise((resolve) => {
//       Papa.parse(file, {
//         header: true,
//         skipEmptyLines: true,
//         complete: (results) => resolve(results.data),
//       })
//     })
//   },

//   transformPivotData: (rawData: any[]) => {
//     const results: any[] = []
//     rawData.forEach(row => {
//       const clinicName = cleanName(row['医院名'])
//       const kpiName = row['項目']
//       const staffName = row['担当'] || '' 
//       const segment = staffName ? 'person' : 'clinic'
//       if (!clinicName || !kpiName) return 
//       Object.keys(row).forEach(key => {
//         const dateMatch = key.match(/(\d{4})年(\d{1,2})月/);
//         if (dateMatch) {
//           const year = parseInt(dateMatch[1]);
//           const month = parseInt(dateMatch[2]);
//           let valStr = String(row[key]).replace(/[%,]/g, '');
//           const val = parseFloat(valStr);
//           if (!isNaN(val)) {
//             results.push({
//               year, month, segment, clinic_name: clinicName, staff_name: staffName, kpi_name: kpiName, value: val, is_target: false
//             });
//           }
//         }
//       });
//     });
//     return results;
//   },

//   transformSalesData: (rawData: any[]) => {
//     const seen = new Map<string, any>();
//     rawData.forEach(row => {
//       const targetMonth = row['対象年月'];
//       const clinicName = cleanName(row['医院名']);
//       const staffName = row['レセコン登録氏名'];
//       if (!targetMonth || !clinicName) return;
//       const dateMatch = targetMonth.match(/(\d{4})年(\d{1,2})月/);
//       if (!dateMatch) return;
//       const year = parseInt(dateMatch[1]);
//       const month = parseInt(dateMatch[2]);
//       const metrics = [
//         { key: '保険点数売上', name: '保険点数売上' },
//         { key: '自費売上（税込・入金）', name: '自費売上' }
//       ];
//       metrics.forEach(m => {
//         const val = parseFloat(String(row[m.key]).replace(/[%,]/g, ''));
//         if (!isNaN(val)) {
//           const key = `${year}-${month}-person-${clinicName}-${staffName}-${m.name}-false`;
//           if (!seen.has(key)) {
//             seen.set(key, {
//               year, month, segment: 'person', clinic_name: clinicName, staff_name: staffName, kpi_name: m.name, value: val, is_target: false
//             });
//           }
//         }
//       });
//     });
//     return Array.from(seen.values());
//   },

//   saveToDb: async (data: any[]) => {
//     const chunkSize = 500
//     for (let i = 0; i < data.length; i += chunkSize) {
//       const chunk = data.slice(i, i + chunkSize)
//       const { error } = await supabase.from('flexible_kpis').insert(chunk)
//       if (error) throw error
//     }
//   },

//   parseCSVAsArray: (file: File): Promise<string[][]> => {
//     return new Promise((resolve, reject) => {
//       Papa.parse(file, {
//         header: false,
//         skipEmptyLines: true,
//         complete: (results) => resolve(results.data as string[][]),
//         error: (error) => reject(error),
//       })
//     })
//   },

//   transformStats: (data: string[][], clinicName: string, corpId: string, clinicId: string): any[] => {
//     const headers = data[0];
//     const results = [];
    
//     for (let i = 1; i < data.length; i++) {
//       const row = data[i];
//       const cat1 = row[0];
//       const cat2 = row[1];
//       const item = row[2];
      
//       if (!cat1) continue;
      
//       let segment = null;
//       let t_type = null;
//       let s_role = null;
//       let s_name = "";
      
//       if (cat1 === 'clinic') {
//         segment = 'clinic';
//       } else if (cat1.startsWith('基本診療') || cat1.startsWith('予約診療')) {
//         segment = 'person';
//         t_type = cat1.startsWith('基本診療') ? '基本診療' : '予約診療';
//         s_role = cat1.includes('）') ? cat1.split('）')[1] : null;
//         s_name = cat2 || "";
//       } else {
//         continue;
//       }
      
//       for (let j = 3; j < headers.length; j++) {
//         const yearMonth = headers[j];
//         const valStr = row[j];
//         if (!valStr || valStr.trim() === '') continue;
        
//         const value = parseFloat(valStr.replace(/,/g, ''));
//         if (isNaN(value)) continue;
        
//         const year = parseInt(yearMonth.substring(0, 4), 10);
//         const month = parseInt(yearMonth.substring(4, 6), 10);
        
//         results.push({
//           corporation_id: corpId,
//           clinic_id: clinicId,
//           clinic_name: clinicName,
//           staff_name: s_name,
//           year: year,
//           month: month,
//           date: `${year}-${String(month).padStart(2, '0')}-01`,
//           segment: segment,
//           kpi_name: item,
//           value: value,
//           is_target: false,
//           treatment_type: t_type,
//           staff_role: s_role,
//         });
//       }
//     }
//     return results;
//   },

//   transformStatus: (data: string[][], clinicName: string, corpId: string, clinicId: string): any[] => {
//     const headers = data[0];
//     const targetKpis = ['診療日数', '合計診療時間(H)'];
//     const targetIndices = targetKpis.map(kpi => headers.indexOf(kpi));
//     const ymIndex = headers.indexOf('年月');
    
//     const results = [];
    
//     for (let i = 1; i < data.length; i++) {
//       const row = data[i];
//       const ymStr = row[ymIndex];
//       if (!ymStr) continue;
      
//       const year = parseInt(ymStr.substring(0, 4), 10);
//       const month = parseInt(ymStr.substring(4, 6), 10);
      
//       targetIndices.forEach((colIndex, idx) => {
//         if (colIndex === -1) return;
//         const valStr = row[colIndex];
//         if (!valStr || valStr.trim() === '') return;
        
//         const value = parseFloat(valStr.replace(/,/g, ''));
//         if (isNaN(value)) return;
        
//         results.push({
//           corporation_id: corpId,
//           clinic_id: clinicId,
//           clinic_name: clinicName,
//           staff_name: "",
//           year: year,
//           month: month,
//           date: `${year}-${String(month).padStart(2, '0')}-01`,
//           segment: 'clinic',
//           kpi_name: targetKpis[idx],
//           value: value,
//           is_target: false,
//           treatment_type: null,
//           staff_role: null,
//         });
//       });
//     }
//     return results;
//   },

//   // 💡 刷新された transformStage メソッド（segmentをclinicに固定）
//   transformStage: (data: string[][], clinicName: string, corpId: string, clinicId: string): any[] => {
//     if (data.length < 4) return [];

//     const row1 = data[1] || []; // 大項目
//     const row2 = data[2] || []; // 中項目
//     const row3 = data[3] || []; // 小項目

//     const columnMapping: Record<number, string> = {};

//     let currentMajor = "";
//     let currentMiddle = "";

//     // 1. ヘッダー行を走査して各カラムのKPI名を動的に決定する
//     for (let j = 1; j < row1.length; j++) {
//       const r1 = row1[j] ? row1[j].trim() : "";
//       const r2 = row2[j] ? row2[j].trim() : "";
//       const r3 = row3[j] ? row3[j].trim() : "";

//       // 大項目が新しく出現したら更新。中項目はリセット。
//       if (r1 !== "" && r1 !== "-") {
//         currentMajor = r1;
//         currentMiddle = ""; 
//       }
//       // 中項目が新しく出現したら更新。
//       if (r2 !== "" && r2 !== "-") {
//         currentMiddle = r2;
//       }
      
//       const major = currentMajor;
//       const middle = currentMiddle;
//       const minor = r3;

//       let kpiName = "";

//       // 柔軟なマッピングルールの適用
//       if (major === "予約(人)") {
//         if (middle === "") kpiName = "予約人数_既存患者";
//         else if (middle === "新患") kpiName = "予約人数_新規患者";
//       } else if (major === "来院(人)") {
//         if (middle === "") kpiName = "来院人数_既存患者";
//         else if (middle === "新患") kpiName = "来院人数_新規患者";
//         else if (middle === "ステージ内訳") {
//           kpiName = `来院人数_${toFullWidthKatakana(minor)}`;
//         }
//       } else if (middle === "当日次回予約獲得") {
//         if (minor === "人数") kpiName = "次回予約取得数";
//         else if (minor === "獲得率") kpiName = "次回予約取得率";
//       } else if (major === "ウェブ予約") {
//         if (middle === "新患") kpiName = "Web予約人数_新患";
//         else if (middle === "再診") kpiName = "Web予約人数_既存";
//       } else if (major === "事前キャンセル(人)" && middle === "") {
//         kpiName = "事前キャンセル数";
//       } else if (major === "当日キャンセル(人)" && middle === "") {
//         kpiName = "当日キャンセル数";
//       } else if (major === "無断キャンセル(人)" && middle === "") {
//         kpiName = "無断キャンセル数";
//       } else if (major === "キャンセル率" && middle === "") {
//         kpiName = "キャンセル率";
//       }

//       if (kpiName) {
//         columnMapping[j] = kpiName;
//       }
//     }

//     const results = [];
//     // 2. データ行を処理 (5行目以降)
//     for (let i = 4; i < data.length; i++) {
//       const row = data[i];
//       if (!row || row.length < 2) continue;
//       const firstCell = row[0] ? row[0].trim() : "";
      
//       if (firstCell === "合計" || firstCell === "月" || firstCell === "" || !firstCell) continue;

//       let year, month;
//       if (/^\d{4}\/\d{2}$/.test(firstCell)) {
//         const parts = firstCell.split('/');
//         year = parseInt(parts[0], 10);
//         month = parseInt(parts[1], 10);
//       } else {
//         continue;
//       }

//       const common = {
//         corporation_id: corpId,
//         clinic_id: clinicId,
//         clinic_name: clinicName,
//         staff_name: "", // 💡 医院全体データのため空文字に固定
//         year: year,
//         month: month,
//         date: `${year}-${String(month).padStart(2, '0')}-01`,
//         is_target: false,
//         segment: 'clinic', // 💡 全て clinic に固定
//         staff_role: null,
//         treatment_type: null
//       };

//       for (const [colIdxStr, kpiName] of Object.entries(columnMapping)) {
//         const colIdx = parseInt(colIdxStr);
//         let valStr = row[colIdx];
//         if (!valStr || valStr.trim() === "" || valStr.trim() === "-") continue;
        
//         const value = parseFloat(valStr.replace(/,/g, '').replace('%', ''));
//         if (isNaN(value)) continue;

//         results.push({
//           ...common,
//           kpi_name: kpiName,
//           value: value
//         });
//       }
//     }
//     return results;
//   }
// }

import { createClient } from '@supabase/supabase-js'
import Papa from 'papaparse'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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

  saveToDb: async (data: any[]) => {
    const chunkSize = 500
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize)
      const { error } = await supabase.from('flexible_kpis').insert(chunk)
      if (error) throw error
    }
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

  transformStats: (data: string[][], clinicName: string, corpId: string, clinicId: string): any[] => {
    const headers = data[0];
    const results = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const cat1 = row[0];
      const cat2 = row[1];
      const item = row[2];
      
      if (!cat1) continue;
      
      let segment = null;
      let t_type = null;
      let s_role = null;
      let s_name = "";
      
      if (cat1 === 'clinic') {
        segment = 'clinic';
      } else if (cat1.startsWith('基本診療') || cat1.startsWith('予約診療')) {
        segment = 'person';
        t_type = cat1.startsWith('基本診療') ? '基本診療' : '予約診療';
        s_role = cat1.includes('）') ? cat1.split('）')[1] : null;
        s_name = cat2 || "";
      } else {
        continue;
      }
      
      for (let j = 3; j < headers.length; j++) {
        const yearMonth = headers[j];
        const valStr = row[j];
        if (!valStr || valStr.trim() === '') continue;
        
        const value = parseFloat(valStr.replace(/,/g, ''));
        if (isNaN(value)) continue;
        
        const year = parseInt(yearMonth.substring(0, 4), 10);
        const month = parseInt(yearMonth.substring(4, 6), 10);
        
        results.push({
          corporation_id: corpId,
          clinic_id: clinicId,
          clinic_name: clinicName,
          staff_name: s_name,
          year: year,
          month: month,
          date: `${year}-${String(month).padStart(2, '0')}-01`,
          segment: segment,
          kpi_name: item,
          value: value,
          is_target: false,
          treatment_type: t_type,
          staff_role: s_role,
        });
      }
    }
    return results;
  },

  transformStatus: (data: string[][], clinicName: string, corpId: string, clinicId: string): any[] => {
    const headers = data[0];
    const targetKpis = ['診療日数', '合計診療時間(H)'];
    const targetIndices = targetKpis.map(kpi => headers.indexOf(kpi));
    const ymIndex = headers.indexOf('年月');
    
    const results = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const ymStr = row[ymIndex];
      if (!ymStr) continue;
      
      const year = parseInt(ymStr.substring(0, 4), 10);
      const month = parseInt(ymStr.substring(4, 6), 10);
      
      targetIndices.forEach((colIndex, idx) => {
        if (colIndex === -1) return;
        const valStr = row[colIndex];
        if (!valStr || valStr.trim() === '') return;
        
        const value = parseFloat(valStr.replace(/,/g, ''));
        if (isNaN(value)) return;
        
        results.push({
          corporation_id: corpId,
          clinic_id: clinicId,
          clinic_name: clinicName,
          staff_name: "",
          year: year,
          month: month,
          date: `${year}-${String(month).padStart(2, '0')}-01`,
          segment: 'clinic',
          kpi_name: targetKpis[idx],
          value: value,
          is_target: false,
          treatment_type: null,
          staff_role: null,
        });
      });
    }
    return results;
  },

  // 💡 修正された transformStage
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

      // 💡 判定ロジックの修正：中項目（当日次回予約獲得）を優先判定する
      if (middle === "当日次回予約獲得") {
        if (minor === "人数") kpiName = "次回予約取得数";
        else if (minor === "獲得率") kpiName = "次回予約取得率";
      } else if (major === "予約(人)") {
        if (middle === "") kpiName = "予約人数_既存患者";
        else if (middle === "新患") kpiName = "予約人数_新規患者";
      } else if (major === "来院(人)") {
        if (middle === "") kpiName = "来院人数_既存患者";
        else if (middle === "新患") kpiName = "来院人数_新規患者";
        else if (middle === "ステージ内訳") {
          kpiName = `来院人数_${toFullWidthKatakana(minor)}`;
        }
      } else if (major === "ウェブ予約") {
        if (middle === "新患") kpiName = "Web予約人数_新患";
        else if (middle === "再診") kpiName = "Web予約人数_既存";
      } else if (major === "事前キャンセル(人)" && middle === "") {
        kpiName = "事前キャンセル数";
      } else if (major === "当日キャンセル(人)" && middle === "") {
        kpiName = "当日キャンセル数";
      } else if (major === "無断キャンセル(人)" && middle === "") {
        kpiName = "無断キャンセル数";
      } else if (major === "キャンセル率" && middle === "") {
        kpiName = "キャンセル率";
      }

      if (kpiName) columnMapping[j] = kpiName;
    }

    const results = [];
    for (let i = 4; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;
      const firstCell = row[0] ? row[0].trim() : "";
      
      if (firstCell === "合計" || firstCell === "月" || firstCell === "" || !firstCell) continue;

      let year, month;
      if (/^\d{4}\/\d{2}$/.test(firstCell)) {
        const parts = firstCell.split('/');
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
      } else {
        continue;
      }

      const common = {
        corporation_id: corpId,
        clinic_id: clinicId,
        clinic_name: clinicName,
        staff_name: "", 
        year: year,
        month: month,
        date: `${year}-${String(month).padStart(2, '0')}-01`,
        is_target: false,
        segment: 'clinic', 
        staff_role: null,
        treatment_type: null
      };

      for (const [colIdxStr, kpiName] of Object.entries(columnMapping)) {
        const colIdx = parseInt(colIdxStr);
        let valStr = row[colIdx];
        if (!valStr || valStr.trim() === "" || valStr.trim() === "-") continue;
        
        const value = parseFloat(valStr.replace(/,/g, '').replace('%', ''));
        if (isNaN(value)) continue;

        results.push({
          ...common,
          kpi_name: kpiName,
          value: value
        });
      }
    }
    return results;
  }
}