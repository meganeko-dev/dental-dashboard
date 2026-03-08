'use client'
import { useState } from 'react'
import { DataImporter } from '@/lib/importers'
import { createBrowserClient } from '@supabase/ssr'

export function DataUpload({ corpId }: { corpId: string }) {
  const [uploading, setUploading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    try {
      setUploading(true)
      addLog(`========== 合計 ${files.length} 件のファイル処理を開始 ==========`)

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // --- 🔍 認証セッションの強制チェック ---
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("認証セッションが無効です。一度ログアウトし、再ログインしてください。");
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('corporation_id')
        .eq('id', session.user.id)
        .single();
      
      addLog(`[認証確認] 通信中のユーザーID: ${session.user.id.substring(0, 8)}...`);
      addLog(`[認証確認] 通信中の法人ID: ${profile?.corporation_id || '無し'}`);
      // ----------------------------------------

      // 💡 取得した全ファイルを順番に処理するループ
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        addLog(`\n⏳ [${i + 1}/${files.length}] ${file.name} を処理中...`)

        try {
          // 1. ファイル名を正規化してパターンとIDを抽出
          const fileName = file.name.normalize('NFC');
          const nameParts = fileName.split("_");
          let clinicId = "";
          let filePattern = "";

          if (fileName.includes("月ごとのStats")) {
            clinicId = nameParts[0];
            filePattern = "stats";
          } else if (fileName.includes("医院状況")) {
            clinicId = nameParts[0];
            filePattern = "status";
          } else if (fileName.includes("日別状況")) {
            clinicId = nameParts[0].length === 4 && !isNaN(Number(nameParts[0])) ? nameParts[1] : nameParts[0];
            filePattern = "stage";
          } else {
            throw new Error('未対応のファイル名です。「月ごとのStats」「医院状況」「日別状況」のいずれかが含まれている必要があります。');
          }
          
          addLog(`  -> 判定: パターン [${filePattern}] / 抽出クリニックID: [${clinicId}]`);
          
          const { data: clinicData, error: clinicError } = await supabase
            .from('clinics')
            .select('name, corporation_id')
            .eq('id', clinicId)
            .single();

          if (clinicError || !clinicData) {
             throw new Error(`ID: ${clinicId} に合致する情報が「clinics」テーブルに見つかりません。`);
          }

          const clinicName = clinicData.name;
          const targetCorpId = clinicData.corporation_id;
          
          // セキュリティチェック
          if (profile?.corporation_id !== targetCorpId) {
            throw new Error(`権限エラー: このデータの法人(${targetCorpId})は、現在の通信アカウント(${profile?.corporation_id})と一致しません。`);
          }

          // 3. CSVを二次元配列としてパース
          const rawData = await DataImporter.parseCSVAsArray(file)
          if (rawData.length === 0) throw new Error('CSVファイルが空か、正しく読み込めませんでした。')
          
          // 4. データ変換処理の実行 (💡 修正: clinicId を引数として追加)
          let transformed: any[] = [];
          if (filePattern === 'stats') {
            transformed = DataImporter.transformStats(rawData, clinicName, targetCorpId, clinicId);
          } else if (filePattern === 'status') {
            transformed = DataImporter.transformStatus(rawData, clinicName, targetCorpId, clinicId);
          } else if (filePattern === 'stage') {
            transformed = DataImporter.transformStage(rawData, clinicName, targetCorpId, clinicId);
          }

          addLog(`  -> 変換完了: ${transformed.length} 件のレコードを作成。保存を開始します...`)

          // 5. DBへ一括保存（Upsertを利用して上書き保存）
          const chunkSize = 100;
          for (let j = 0; j < transformed.length; j += chunkSize) {
            const chunk = transformed.slice(j, j + chunkSize);
            const { error: insertError } = await supabase.from('flexible_kpis').upsert(chunk, {
              onConflict: 'corporation_id, clinic_name, staff_name, year, month, date, segment, kpi_name, is_target, treatment_type, staff_role'
            });
            
            if (insertError) {
                throw new Error(`保存エラー: ${insertError.message}`);
            }
          }
          
          addLog(`✅ [${i + 1}/${files.length}] 成功: ${file.name} を保存しました！`)

        } catch (fileErr: any) {
          console.error(fileErr)
          // エラーが起きても、次のファイルの処理へ進む
          addLog(`❌ [${i + 1}/${files.length}] エラー (${file.name}): ${fileErr.message}`)
        }
      }

      addLog(`========== すべての処理が終了しました ==========`)
      alert('すべてのファイルの処理が完了しました。ログを確認してください。')

    } catch (err: any) {
      console.error(err)
      addLog(`❌ 致命的なエラー: ${err.message}`)
      alert(`エラーが発生しました。ログを確認してください。`)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UploadCard 
          title="CSVファイルを一括アップロード" 
          desc="複数のCSVファイルを選択して、一度にアップロードできます。" 
          icon="📂" 
          onChange={handleFileUpload}
          disabled={uploading}
        />
        <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100 flex items-center gap-4 shadow-sm">
          <div className="text-3xl">💡</div>
          <div className="text-xs text-blue-700 leading-relaxed">
            <p className="font-bold mb-1">複数ファイルの一括アップロード機能:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>PC上で複数のファイルを選択（ShiftキーやCtrlキーを使用）するか、ドラッグ＆ドロップで一気に処理できます。</li>
              <li>「月ごとのStats」「医院状況」「ステージ日別状況」が混ざっていても自動で判別します。</li>
              <li>途中で1つのファイルがエラーになっても、他のファイルはそのまま処理が続行されます。</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl p-6 font-mono text-xs text-blue-400 h-64 overflow-y-auto shadow-inner">
        <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
          <span className="text-slate-500 uppercase font-black">Process Logs</span>
          {uploading && <span className="animate-pulse text-yellow-500">Processing...</span>}
        </div>
        {logs.length === 0 && <div className="text-slate-600 italic">待機中... CSVファイルを選択してください。複数選択可能です。</div>}
        {logs.map((log, i) => <div key={i} className="mb-1 leading-relaxed whitespace-pre-wrap">{log}</div>)}
      </div>
    </div>
  )
}

function UploadCard({ title, desc, icon, onChange, disabled }: any) {
  return (
    <div className="bg-white p-8 rounded-3xl border text-center space-y-4 shadow-sm">
      <div className="text-5xl">{icon}</div>
      <h3 className="font-black text-slate-800 uppercase tracking-tight">{title}</h3>
      <p className="text-xs text-slate-400 font-medium h-10">{desc}</p>
      <label className={`block cursor-pointer bg-slate-900 text-white py-3 rounded-xl text-xs font-black hover:bg-slate-800 transition-all ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        ファイルを選択
        <input type="file" accept=".csv" multiple className="hidden" onChange={onChange} disabled={disabled} />
      </label>
    </div>
  )
}