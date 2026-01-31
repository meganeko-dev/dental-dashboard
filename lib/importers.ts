import { createClient } from '@supabase/supabase-js'
import Papa from 'papaparse'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 名前をクリーニングする補助関数
const cleanName = (name: string): string => {
  if (!name) return '';
  // 「_」が含まれている場合、それ以降の文字列を取得。含まれない場合はそのまま。
  const parts = name.split('_');
  return parts.length > 1 ? parts[1].trim() : name.trim();
};

export const DataImporter = {
  parseCSV: (file: File): Promise<any[]> => {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
      })
    })
  },

  /**
   * 実績データ (pivot) の変換
   */
  transformPivotData: (rawData: any[]) => {
    const results: any[] = []

    rawData.forEach(row => {
      // 医院名をクリーニング
      const clinicName = cleanName(row['医院名'])
      const kpiName = row['項目']
      const staffName = row['担当'] || '' 
      const segment = staffName ? 'person' : 'clinic'

      if (!clinicName || !kpiName) return 

      Object.keys(row).forEach(key => {
        const dateMatch = key.match(/(\d{4})年(\d{1,2})月/)
        if (dateMatch) {
          const year = parseInt(dateMatch[1])
          const month = parseInt(dateMatch[2])
          const val = parseFloat(String(row[key]).replace(/[%,]/g, ''))
          
          if (!isNaN(val)) {
            results.push({
              year, month, segment,
              clinic_name: clinicName,
              staff_name: staffName,
              kpi_name: kpiName,
              value: val,
              is_target: false
            })
          }
        }
      })
    })
    return results
  },

  /**
   * 売上データ (rese) の変換
   */
  transformRese: (rawData: any[]) => {
    const seen = new Map<string, any>();

    rawData.forEach(row => {
      const targetMonth = row['対象月'];
      // 医院名をクリーニング（CSVの列名に合わせて「医院」を参照）
      const clinicName = cleanName(row['医院']);
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
              year, month,
              segment: 'person',
              clinic_name: clinicName,
              staff_name: staffName,
              kpi_name: m.name,
              value: val,
              is_target: false
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
      const { error } = await supabase
        .from('flexible_kpis')
        .upsert(chunk, { 
          onConflict: 'year, month, segment, clinic_name, staff_name, kpi_name, is_target' 
        })
      
      if (error) {
        console.error('Upsert error:', error)
        throw error
      }
    }
    return true
  }
}