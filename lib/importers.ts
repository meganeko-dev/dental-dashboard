// import { createClient } from '@supabase/supabase-js'
// import Papa from 'papaparse'

// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
// )

// // 名前をクリーニングする補助関数
// const cleanName = (name: string): string => {
//   if (!name) return '';
//   // 「_」が含まれている場合、それ以降の文字列を取得。含まれない場合はそのまま。
//   const parts = name.split('_');
//   return parts.length > 1 ? parts[1].trim() : name.trim();
// };

// export const DataImporter = {
//   // ==========================================
//   // 既存のメソッド（オブジェクト配列としてのパース）
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
//         const dateMatch = key.match(/(\\d{4})年(\\d{1,2})月/);
//         if (dateMatch) {
//           const year = parseInt(dateMatch[1]);
//           const month = parseInt(dateMatch[2]);
          
//           let valStr = String(row[key]).replace(/[%,]/g, '');
//           const val = parseFloat(valStr);

//           if (!isNaN(val)) {
//             results.push({
//               year, month,
//               segment,
//               clinic_name: clinicName,
//               staff_name: staffName,
//               kpi_name: kpiName,
//               value: val,
//               is_target: false
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

//       const dateMatch = targetMonth.match(/(\\d{4})年(\\d{1,2})月/);
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
//               year, month,
//               segment: 'person',
//               clinic_name: clinicName,
//               staff_name: staffName,
//               kpi_name: m.name,
//               value: val,
//               is_target: false
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
//       if (error) {
//         console.error('Error in saveToDb:', error)
//         throw error
//       }
//     }
//   },

//   // ==========================================
//   // 今回追加したメソッド（二次元配列パースと3種の変換）
//   // ==========================================
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

//   transformStats: (data: string[][], clinicName: string, corpId: string): any[] => {
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
//           clinic_name: clinicName,
//           staff_name: s_name,
//           year: year,
//           month: month,
//           segment: segment,
//           kpi_name: item,
//           value: value,
//           is_target: false,
//           treatment_type: t_type,
//           staff_role: s_role,
//           date: null
//         });
//       }
//     }
//     return results;
//   },

//   transformStatus: (data: string[][], clinicName: string, corpId: string): any[] => {
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
//           clinic_name: clinicName,
//           staff_name: "",
//           year: year,
//           month: month,
//           segment: 'clinic',
//           kpi_name: targetKpis[idx],
//           value: value,
//           is_target: false,
//           treatment_type: null,
//           staff_role: null,
//           date: null
//         });
//       });
//     }
//     return results;
//   },

//   transformStage: (data: string[][], clinicName: string, corpId: string): any[] => {
//     const colMapping: Record<number, { name: string, type: string | null }> = {
//       1: { name: '予約人数_既存患者', type: null },
//       2: { name: '予約人数_新規患者', type: null },
//       3: { name: '来院人数_既存患者', type: null },
//       4: { name: '来院人数_既存患者', type: '初診/急患' },
//       5: { name: '来院人数_既存患者', type: '枠外' },
//       6: { name: '来院人数_既存患者', type: '治療' },
//       7: { name: '来院人数_既存患者', type: 'imp' },
//       8: { name: '来院人数_既存患者', type: 'set' },
//       9: { name: '来院人数_既存患者', type: 'DH' },
//       10: { name: '来院人数_既存患者', type: 'DH2' },
//       11: { name: '来院人数_既存患者', type: '矯正' },
//       12: { name: '来院人数_新規患者', type: null },
//       13: { name: '次回予約取得人数', type: null },
//       14: { name: '次回予約取得率', type: null },
//       15: { name: 'アプリ登録人数', type: null },
//       16: { name: 'アプリ登録累計人数', type: null },
//       20: { name: 'Web予約人数_新患', type: null },
//       21: { name: 'Web予約人数_既存', type: null },
//       22: { name: '事前キャンセル人数', type: null },
//       31: { name: '当日キャンセル人数', type: null },
//       40: { name: '無断キャンセル人数', type: null },
//       49: { name: 'キャンセル率', type: null }
//     };

//     const results = [];
    
//     for (let i = 0; i < data.length; i++) {
//       const row = data[i];
//       const ymStr = row[0];
      
//       if (!ymStr || !/^\d{4}\/\d{2}$/.test(ymStr)) continue;
      
//       const parts = ymStr.split('/');
//       const year = parseInt(parts[0], 10);
//       const month = parseInt(parts[1], 10);
      
//       for (const [colIndexStr, meta] of Object.entries(colMapping)) {
//         const colIndex = parseInt(colIndexStr, 10);
//         let valStr = row[colIndex];
//         if (!valStr || valStr.trim() === '' || valStr.trim() === '-') continue;
        
//         valStr = valStr.replace('%', '').replace(/,/g, '');
//         const value = parseFloat(valStr);
//         if (isNaN(value)) continue;
        
//         results.push({
//           corporation_id: corpId,
//           clinic_name: clinicName,
//           staff_name: "",
//           year: year,
//           month: month,
//           segment: 'clinic',
//           kpi_name: meta.name,
//           value: value,
//           is_target: false,
//           treatment_type: meta.type,
//           staff_role: null,
//           date: null
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

  // ==========================================
  // 新しいメソッド（引数に clinicId を追加）
  // ==========================================
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
          clinic_id: clinicId, // 💡 追加
          clinic_name: clinicName,
          staff_name: s_name,
          year: year,
          month: month,
          segment: segment,
          kpi_name: item,
          value: value,
          is_target: false,
          treatment_type: t_type,
          staff_role: s_role,
          date: null
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
          clinic_id: clinicId, // 💡 追加
          clinic_name: clinicName,
          staff_name: "",
          year: year,
          month: month,
          segment: 'clinic',
          kpi_name: targetKpis[idx],
          value: value,
          is_target: false,
          treatment_type: null,
          staff_role: null,
          date: null
        });
      });
    }
    return results;
  },

  transformStage: (data: string[][], clinicName: string, corpId: string, clinicId: string): any[] => {
    const colMapping: Record<number, { name: string, type: string | null }> = {
      1: { name: '予約人数_既存患者', type: null },
      2: { name: '予約人数_新規患者', type: null },
      3: { name: '来院人数_既存患者', type: null },
      4: { name: '来院人数_既存患者', type: '初診/急患' },
      5: { name: '来院人数_既存患者', type: '枠外' },
      6: { name: '来院人数_既存患者', type: '治療' },
      7: { name: '来院人数_既存患者', type: 'imp' },
      8: { name: '来院人数_既存患者', type: 'set' },
      9: { name: '来院人数_既存患者', type: 'DH' },
      10: { name: '来院人数_既存患者', type: 'DH2' },
      11: { name: '来院人数_既存患者', type: '矯正' },
      12: { name: '来院人数_新規患者', type: null },
      13: { name: '次回予約取得数', type: null },
      14: { name: '次回予約取得率', type: null },
      15: { name: 'アプリ登録数', type: null },
      16: { name: 'アプリ登録累計数', type: null },
      20: { name: 'Web予約人数_新患', type: null },
      21: { name: 'Web予約人数_既存', type: null },
      22: { name: '事前キャンセル数', type: null },
      31: { name: '当日キャンセル数', type: null },
      40: { name: '無断キャンセル数', type: null },
      49: { name: 'キャンセル率', type: null }
    };

    const results = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const ymStr = row[0];
      
      if (!ymStr || !/^\d{4}\/\d{2}$/.test(ymStr)) continue;
      
      const parts = ymStr.split('/');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      
      for (const [colIndexStr, meta] of Object.entries(colMapping)) {
        const colIndex = parseInt(colIndexStr, 10);
        let valStr = row[colIndex];
        if (!valStr || valStr.trim() === '' || valStr.trim() === '-') continue;
        
        valStr = valStr.replace('%', '').replace(/,/g, '');
        const value = parseFloat(valStr);
        if (isNaN(value)) continue;
        
        results.push({
          corporation_id: corpId,
          clinic_id: clinicId, // 💡 追加
          clinic_name: clinicName,
          staff_name: "",
          year: year,
          month: month,
          segment: 'clinic',
          kpi_name: meta.name,
          value: value,
          is_target: false,
          treatment_type: meta.type,
          staff_role: null,
          date: null
        });
      }
    }
    return results;
  }
}