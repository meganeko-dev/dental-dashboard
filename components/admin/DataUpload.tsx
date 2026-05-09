// 'use client'
// import { useState } from 'react'
// import { DataImporter } from '@/lib/importers'
// import { createBrowserClient } from '@supabase/ssr'

// export function DataUpload({ corpId }: { corpId: string }) {
//   const [uploading, setUploading] = useState(false)
//   const [logs, setLogs] = useState<string[]>([])

//   const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev])

//   const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
//     const files = e.target.files
//     if (!files || files.length === 0) return

//     try {
//       setUploading(true)
//       addLog(`========== 合計 ${files.length} 件のファイル処理を開始 ==========`)

//       const supabase = createBrowserClient(
//         process.env.NEXT_PUBLIC_SUPABASE_URL!,
//         process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
//       );

//       // --- 🔍 認証セッションの強制チェック ---
//       const { data: { session }, error: sessionError } = await supabase.auth.getSession();
//       if (sessionError || !session) {
//         throw new Error("認証セッションが無効です。一度ログアウトし、再ログインしてください。");
//       }
//       const { data: profile } = await supabase
//         .from('profiles')
//         .select('corporation_id')
//         .eq('id', session.user.id)
//         .single();
      
//       addLog(`[認証確認] 通信中のユーザーID: ${session.user.id.substring(0, 8)}...`);
//       addLog(`[認証確認] 通信中の法人ID: ${profile?.corporation_id || '無し'}`);
//       // ----------------------------------------

//       // 💡 取得した全ファイルを順番に処理するループ
//       for (let i = 0; i < files.length; i++) {
//         const file = files[i]
//         addLog(`\n⏳ [${i + 1}/${files.length}] ${file.name} を処理中...`)

//         try {
//           // 1. ファイル名を正規化してパターンとIDを抽出
//           const fileName = file.name.normalize('NFC');
//           const nameParts = fileName.split("_");
//           let clinicId = "";
//           let filePattern = "";

//           if (fileName.includes("月ごとのStats")) {
//             clinicId = nameParts[0];
//             filePattern = "stats";
//           } else if (fileName.includes("医院状況")) {
//             clinicId = nameParts[0];
//             filePattern = "status";
//           } else if (fileName.includes("日別状況")) {
//             clinicId = nameParts[0].length === 4 && !isNaN(Number(nameParts[0])) ? nameParts[1] : nameParts[0];
//             filePattern = "stage";
//           } else {
//             throw new Error('未対応のファイル名です。「月ごとのStats」「医院状況」「日別状況」のいずれかが含まれている必要があります。');
//           }
          
//           addLog(`  -> 判定: パターン [${filePattern}] / 抽出クリニックID: [${clinicId}]`);
          
//           const { data: clinicData, error: clinicError } = await supabase
//             .from('clinics')
//             .select('name, corporation_id')
//             .eq('id', clinicId)
//             .single();

//           if (clinicError || !clinicData) {
//              throw new Error(`ID: ${clinicId} に合致する情報が「clinics」テーブルに見つかりません。`);
//           }

//           const clinicName = clinicData.name;
//           const targetCorpId = clinicData.corporation_id;
          
//           // セキュリティチェック
//           if (profile?.corporation_id !== targetCorpId) {
//             throw new Error(`権限エラー: このデータの法人(${targetCorpId})は、現在の通信アカウント(${profile?.corporation_id})と一致しません。`);
//           }

//           // 3. CSVを二次元配列としてパース
//           const rawData = await DataImporter.parseCSVAsArray(file)
//           if (rawData.length === 0) throw new Error('CSVファイルが空か、正しく読み込めませんでした。')
          
//           // 4. データ変換処理の実行 (💡 修正: clinicId を引数として追加)
//           let transformed: any[] = [];
//           if (filePattern === 'stats') {
//             transformed = DataImporter.transformStats(rawData, clinicName, targetCorpId, clinicId);
//           } else if (filePattern === 'status') {
//             transformed = DataImporter.transformStatus(rawData, clinicName, targetCorpId, clinicId);
//           } else if (filePattern === 'stage') {
//             transformed = DataImporter.transformStage(rawData, clinicName, targetCorpId, clinicId);
//           }

//           addLog(`  -> 変換完了: ${transformed.length} 件のレコードを作成。保存を開始します...`)

//           // 5. DBへ一括保存（Upsertを利用して上書き保存）
//           const chunkSize = 100;
//           for (let j = 0; j < transformed.length; j += chunkSize) {
//             const chunk = transformed.slice(j, j + chunkSize);
//             const { error: insertError } = await supabase.from('flexible_kpis').upsert(chunk, {
//               onConflict: 'corporation_id, clinic_name, staff_name, year, month, date, segment, kpi_name, is_target, treatment_type, staff_role'
//             });
            
//             if (insertError) {
//                 throw new Error(`保存エラー: ${insertError.message}`);
//             }
//           }
          
//           addLog(`✅ [${i + 1}/${files.length}] 成功: ${file.name} を保存しました！`)

//         } catch (fileErr: any) {
//           console.error(fileErr)
//           // エラーが起きても、次のファイルの処理へ進む
//           addLog(`❌ [${i + 1}/${files.length}] エラー (${file.name}): ${fileErr.message}`)
//         }
//       }

//       addLog(`========== すべての処理が終了しました ==========`)
//       alert('すべてのファイルの処理が完了しました。ログを確認してください。')

//     } catch (err: any) {
//       console.error(err)
//       addLog(`❌ 致命的なエラー: ${err.message}`)
//       alert(`エラーが発生しました。ログを確認してください。`)
//     } finally {
//       setUploading(false)
//       e.target.value = ''
//     }
//   }

//   return (
//     <div className="space-y-6">
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//         <UploadCard 
//           title="CSVファイルを一括アップロード" 
//           desc="複数のCSVファイルを選択して、一度にアップロードできます。" 
//           icon="📂" 
//           onChange={handleFileUpload}
//           disabled={uploading}
//         />
//         <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100 flex items-center gap-4 shadow-sm">
//           <div className="text-3xl">💡</div>
//           <div className="text-xs text-blue-700 leading-relaxed">
//             <p className="font-bold mb-1">複数ファイルの一括アップロード機能:</p>
//             <ul className="list-disc list-inside space-y-1">
//               <li>PC上で複数のファイルを選択（ShiftキーやCtrlキーを使用）するか、ドラッグ＆ドロップで一気に処理できます。</li>
//               <li>「月ごとのStats」「医院状況」「ステージ日別状況」が混ざっていても自動で判別します。</li>
//               <li>途中で1つのファイルがエラーになっても、他のファイルはそのまま処理が続行されます。</li>
//             </ul>
//           </div>
//         </div>
//       </div>

//       <div className="bg-slate-900 rounded-2xl p-6 font-mono text-xs text-blue-400 h-64 overflow-y-auto shadow-inner">
//         <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
//           <span className="text-slate-500 uppercase font-black">Process Logs</span>
//           {uploading && <span className="animate-pulse text-yellow-500">Processing...</span>}
//         </div>
//         {logs.length === 0 && <div className="text-slate-600 italic">待機中... CSVファイルを選択してください。複数選択可能です。</div>}
//         {logs.map((log, i) => <div key={i} className="mb-1 leading-relaxed whitespace-pre-wrap">{log}</div>)}
//       </div>
//     </div>
//   )
// }

// function UploadCard({ title, desc, icon, onChange, disabled }: any) {
//   return (
//     <div className="bg-white p-8 rounded-3xl border text-center space-y-4 shadow-sm">
//       <div className="text-5xl">{icon}</div>
//       <h3 className="font-black text-slate-800 uppercase tracking-tight">{title}</h3>
//       <p className="text-xs text-slate-400 font-medium h-10">{desc}</p>
//       <label className={`block cursor-pointer bg-slate-900 text-white py-3 rounded-xl text-xs font-black hover:bg-slate-800 transition-all ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
//         ファイルを選択
//         <input type="file" accept=".csv" multiple className="hidden" onChange={onChange} disabled={disabled} />
//       </label>
//     </div>
//   )
// }

'use client'
import { useState, useMemo } from 'react'
import { DataImporter } from '@/lib/importers'
import { createBrowserClient } from '@supabase/ssr'

export function DataUpload({ corpId }: { corpId: string }) {
  const [uploading, setUploading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  // 💡 コンポーネントのトップレベルで supabase クライアントを初期化し、使い回す
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), [])

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    try {
      setUploading(true)
      addLog(`========== 合計 ${files.length} 件のファイル処理を開始 ==========`)

      // --- 🔍 認証セッションの強制チェック ---
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("認証セッションが無効です。一度ログアウトし、再ログインしてください。");
      }
      
      addLog(`[デバッグ] セッションユーザーID: ${session.user.id}`);
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('corporation_id')
        .eq('id', session.user.id)
        .single();
      
      if (profileError) {
         addLog(`[警告] Profile取得エラー: ${profileError.message}`);
      }
      
      addLog(`[認証確認] 通信中のユーザーID: ${session.user.id.substring(0, 8)}...`);
      addLog(`[認証確認] 通信中の法人ID: ${profile?.corporation_id || '無し'} (Props corpId: ${corpId})`);
      // ----------------------------------------

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        addLog(`\n⏳ [${i + 1}/${files.length}] ${file.name} を処理中...`)

        try {
          const fileName = file.name.normalize('NFC');
          const fileBaseName = fileName.replace(/\.[^.]+$/, '').trim();
          const sheetImportMatch = fileBaseName.match(/^([^_]+)_(メンテナンス|離脱)(?:\s*\(\d+\))?$/);
          const nameParts = fileName.split("_");
          let clinicId = "";
          let filePattern = "";
          let sheetCorpId = "";

          // 年プレフィックス (2025_, 2026_ 等) を除去してから先頭の数字列を clinicId として取得
          const rawPart = nameParts[0].length === 4 && !isNaN(Number(nameParts[0])) ? nameParts[1] : nameParts[0];
          clinicId = rawPart.match(/^\d+/)?.[0] ?? rawPart;

          if (sheetImportMatch) {
            sheetCorpId = sheetImportMatch[1];
            filePattern = sheetImportMatch[2] === 'メンテナンス' ? 'sheet_maintenance' : 'sheet_churn';
            clinicId = "(CSV内の医院IDより取得)";
          } else if (fileName.includes("月ごとのStats")) {
            filePattern = "stats";
          } else if (fileName.includes("医院状況")) {
            filePattern = "status";
          } else if (fileName.includes("日別状況")) {
            filePattern = "stage";
          } else if (fileName.includes("患者リスト") || fileName.includes("患者一覧")) {
            filePattern = "patient_list";
          } else if (fileName.includes("全Ｄｒ日別")) {
            filePattern = "sales_clinic";
            clinicId = "(CSVより取得)";
          } else if (fileName.includes("月計表") && fileName.includes("総括")) {
            filePattern = "sales_staff";
            clinicId = "(CSVより取得)";
          } else if (fileName.includes("日計表") && fileName.includes("患者")) {
            filePattern = "sales_staff_daily";
            clinicId = "(CSVより取得)";
          } else if (fileName.includes("新心会") && fileName.includes("レセプト数")) {
            filePattern = "shinsinkai_recept";
            clinicId = "(CSVより取得)";
          } else if (fileName.includes("新心会") && fileName.includes("保険売上")) {
            filePattern = "shinsinkai_insurance";
            clinicId = "(CSVより取得)";
          } else if (fileName.includes("新心会") && fileName.includes("自費売上")) {
            filePattern = "shinsinkai_private";
            clinicId = "(CSVより取得)";
          } else {
            throw new Error('未対応のファイル名です。「法人ID_メンテナンス」「法人ID_離脱」「月ごとのStats」「医院状況」「日別状況」「患者リスト」「全Ｄｒ日別」「月計表（総括）」「日計表（患者…）」「新心会 - レセプト数/保険売上/自費売上」のいずれかが含まれている必要があります。');
          }

          addLog(`  -> 判定: パターン [${filePattern}] / 抽出クリニックID: [${clinicId}]`);

          // ── Google Sheets由来CSV: メンテナンス / 離脱 ─────────────────────
          if (filePattern === 'sheet_maintenance' || filePattern === 'sheet_churn') {
            if (!sheetCorpId) {
              throw new Error('ファイル名から法人IDを取得できませんでした。例: FWLRNER6_メンテナンス.csv');
            }
            if (profile?.corporation_id !== sheetCorpId) {
              throw new Error(`権限エラー: ファイル名の法人ID(${sheetCorpId})は、現在の通信アカウント(${profile?.corporation_id})と一致しません。`);
            }

            const rawData = await DataImporter.parseCSVAsArray(file);
            if (rawData.length < 2) throw new Error('CSVファイルが空か、正しく読み込めませんでした。');

            const { data: clinicRows, error: clinicRowsError } = await supabase
              .from('clinics')
              .select('id, name')
              .eq('corporation_id', sheetCorpId);

            if (clinicRowsError) {
              addLog(`[DBエラー詳細] Clinics取得失敗: ${clinicRowsError.message} (Code: ${clinicRowsError.code})`);
              throw new Error(`法人ID ${sheetCorpId} のクリニック一覧を取得できませんでした。`);
            }

            const clinicIdToName = new Map<string, string>(
              (clinicRows ?? []).map(c => [String(c.id), c.name])
            );

            const transformed = filePattern === 'sheet_maintenance'
              ? DataImporter.transformSheetMaintenance(rawData, sheetCorpId, clinicIdToName)
              : DataImporter.transformSheetChurn(rawData, sheetCorpId, clinicIdToName);

            addLog(`  -> 変換完了: ${transformed.length} 件のレコードを作成。保存を開始します...`);

            const chunkSize = 100;
            for (let j = 0; j < transformed.length; j += chunkSize) {
              const chunk = transformed.slice(j, j + chunkSize);
              const { error: insertError } = await supabase.from('flexible_kpis').upsert(chunk, {
                onConflict: 'corporation_id, clinic_name, staff_name, year, month, date, segment, kpi_name, is_target, treatment_type, staff_role'
              });
              if (insertError) {
                addLog(`[DBエラー詳細] Upsert失敗: ${insertError.message} (Code: ${insertError.code})`);
                throw new Error(`保存エラー: ${insertError.message}`);
              }
            }

            addLog(`✅ [${i + 1}/${files.length}] 成功: ${file.name} を保存しました！`);

          // ── FWLRNER6専用: 月計表ファイル処理 ──────────────────────────────
          } else if (filePattern === 'sales_clinic' || filePattern === 'sales_staff' || filePattern === 'sales_staff_daily') {
            if (profile?.corporation_id !== 'FWLRNER6') {
              throw new Error('このファイル形式（月計表/日計表）は対応していない法人アカウントです。');
            }

            const rawData = await DataImporter.parseCSVAsArraySJIS(file);
            if (rawData.length < 2) throw new Error('CSVファイルが空か、正しく読み込めませんでした。');

            // 診療所名 から短いクリニック名を抽出（例: "医療法人　藤美会　新美歯科" → "新美歯科"）
            const headerRow = rawData[0] ?? [];
            const clinicNameColIdx = headerRow.findIndex(h => h?.trim() === '診療所名');
            const clinicFullName = clinicNameColIdx >= 0 ? (rawData[1]?.[clinicNameColIdx]?.trim() ?? '') : '';
            const extractedClinicName = clinicFullName.split(/[\s　]+/).filter(Boolean).at(-1) ?? clinicFullName;

            const { data: salesClinicData, error: salesClinicError } = await supabase
              .from('clinics')
              .select('id, name, corporation_id')
              .eq('corporation_id', profile.corporation_id)
              .eq('name', extractedClinicName)
              .single();

            if (salesClinicError) {
              addLog(`[DBエラー詳細] Clinics取得失敗: ${salesClinicError.message} (Code: ${salesClinicError.code})`);
              throw new Error(`クリニック名 "${extractedClinicName}" に合致する情報が「clinics」テーブルに見つかりません。`);
            }

            const salesClinicName = salesClinicData.name;
            const salesClinicId   = String(salesClinicData.id);
            const salesCorpId     = salesClinicData.corporation_id;

            const transformed = filePattern === 'sales_clinic'
              ? DataImporter.transformSalesClinic(rawData, salesClinicName, salesCorpId, salesClinicId)
              : filePattern === 'sales_staff'
              ? DataImporter.transformSalesStaff(rawData, salesClinicName, salesCorpId, salesClinicId)
              : DataImporter.transformFujimikaiStaffDaily(rawData, salesClinicName, salesCorpId, salesClinicId);

            addLog(`  -> 変換完了: ${transformed.length} 件のレコードを作成。保存を開始します...`);

            const chunkSize = 100;
            for (let j = 0; j < transformed.length; j += chunkSize) {
              const chunk = transformed.slice(j, j + chunkSize);
              const { error: insertError } = await supabase.from('flexible_kpis').upsert(chunk, {
                onConflict: 'corporation_id, clinic_name, staff_name, year, month, date, segment, kpi_name, is_target, treatment_type, staff_role'
              });
              if (insertError) {
                addLog(`[DBエラー詳細] Upsert失敗: ${insertError.message} (Code: ${insertError.code})`);
                throw new Error(`保存エラー: ${insertError.message}`);
              }
            }

            addLog(`✅ [${i + 1}/${files.length}] 成功: ${file.name} を保存しました！`);

          // ── 患者リスト CSV 処理（個人情報保護のためサーバAPI経由でハッシュ化＋DELETE/INSERT）─
          } else if (filePattern === 'patient_list') {
            // 権限チェックはサーバ側で実施
            const formData = new FormData();
            formData.append('file', file);
            formData.append('clinicId', clinicId);

            addLog(`  -> 患者リスト: サーバAPIへ送信中（ハッシュ化＋DELETE/INSERT）...`);

            const apiRes = await fetch('/api/patient-list', {
              method: 'POST',
              body: formData,
            });
            const apiJson = await apiRes.json().catch(() => ({} as { error?: string; inserted?: number; deduplicated?: number }));
            if (!apiRes.ok) {
              throw new Error(`サーバAPIエラー: ${apiJson?.error ?? apiRes.statusText}`);
            }
            const dupNote = apiJson.deduplicated && apiJson.deduplicated > 0
              ? `（CSV内重複 ${apiJson.deduplicated} 件は後出を採用）`
              : '';
            addLog(`✅ [${i + 1}/${files.length}] 成功: ${file.name}（${apiJson.inserted}件のスナップショットを保存）${dupNote}`);

          // ── TN32FBH8専用: 新心会 売上CSV処理 ──────────────────────────────
          } else if (filePattern === 'shinsinkai_recept' || filePattern === 'shinsinkai_insurance' || filePattern === 'shinsinkai_private') {
            if (profile?.corporation_id !== 'TN32FBH8') {
              throw new Error('このファイル形式（新心会売上CSV）は対応していない法人アカウントです。');
            }

            const kpiType = filePattern === 'shinsinkai_recept' ? 'recept'
                          : filePattern === 'shinsinkai_insurance' ? 'insurance'
                          : 'private';

            const rawData = await DataImporter.parseCSVAsArray(file);
            if (rawData.length < 2) throw new Error('CSVファイルが空か、正しく読み込めませんでした。');

            const transformed = DataImporter.transformShinshinkai(rawData, 'TN32FBH8', kpiType);
            addLog(`  -> 変換完了: ${transformed.length} 件のレコードを作成。保存を開始します...`);

            const chunkSize = 100;
            for (let j = 0; j < transformed.length; j += chunkSize) {
              const chunk = transformed.slice(j, j + chunkSize);
              const { error: insertError } = await supabase.from('flexible_kpis').upsert(chunk, {
                onConflict: 'corporation_id, clinic_name, staff_name, year, month, date, segment, kpi_name, is_target, treatment_type, staff_role'
              });
              if (insertError) {
                addLog(`[DBエラー詳細] Upsert失敗: ${insertError.message} (Code: ${insertError.code})`);
                throw new Error(`保存エラー: ${insertError.message}`);
              }
            }

            addLog(`✅ [${i + 1}/${files.length}] 成功: ${file.name} を保存しました！`);

          // ── 通常ファイル処理 ────────────────────────────────────────────────
          } else {
            const { data: clinicData, error: clinicError } = await supabase
              .from('clinics')
              .select('name, corporation_id')
              .eq('id', clinicId)
              .single();

            if (clinicError) {
               addLog(`[DBエラー詳細] Clinics取得失敗: ${clinicError.message} (Code: ${clinicError.code})`);
               throw new Error(`ID: ${clinicId} に合致する情報が「clinics」テーブルに見つかりません。`);
            }
            if (!clinicData) {
               throw new Error(`ID: ${clinicId} のデータが空で返されました（RLSでブロックされている可能性があります）。`);
            }

            const clinicName = clinicData.name;
            const targetCorpId = clinicData.corporation_id;

            if (profile?.corporation_id !== targetCorpId) {
              throw new Error(`権限エラー: このデータの法人(${targetCorpId})は、現在の通信アカウント(${profile?.corporation_id})と一致しません。`);
            }

            const rawData = await DataImporter.parseCSVAsArray(file);
            if (rawData.length === 0) throw new Error('CSVファイルが空か、正しく読み込めませんでした。');

            let transformed: any[] = [];
            if (filePattern === 'stats') {
              transformed = DataImporter.transformStats(rawData, clinicName, targetCorpId, clinicId);
            } else if (filePattern === 'status') {
              transformed = DataImporter.transformStatus(rawData, clinicName, targetCorpId, clinicId);
            } else if (filePattern === 'stage') {
              transformed = DataImporter.transformStage(rawData, clinicName, targetCorpId, clinicId);
            }

            addLog(`  -> 変換完了: ${transformed.length} 件のレコードを作成。保存を開始します...`);

            const chunkSize = 100;
            for (let j = 0; j < transformed.length; j += chunkSize) {
              const chunk = transformed.slice(j, j + chunkSize);
              const { error: insertError } = await supabase.from('flexible_kpis').upsert(chunk, {
                onConflict: 'corporation_id, clinic_name, staff_name, year, month, date, segment, kpi_name, is_target, treatment_type, staff_role'
              });
              if (insertError) {
                addLog(`[DBエラー詳細] Upsert失敗: ${insertError.message} (Code: ${insertError.code})`);
                throw new Error(`保存エラー: ${insertError.message}`);
              }
            }

            addLog(`✅ [${i + 1}/${files.length}] 成功: ${file.name} を保存しました！`);
          }

        } catch (fileErr: any) {
          console.error(fileErr)
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
              <li>「法人ID_メンテナンス」「法人ID_離脱」「月ごとのStats」「医院状況」「ステージ日別状況」「患者リスト」が混ざっていても自動で判別します。</li>
              <li>「患者リスト」CSVはカルテ番号をサーバ側でハッシュ化し、ClinicIDごとに最新スナップショットのみ保持します（再アップで上書き）。</li>
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
