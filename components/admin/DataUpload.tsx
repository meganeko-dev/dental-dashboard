'use client'
import { useState } from 'react'
import { DataImporter } from '@/lib/importers'

export function DataUpload() {
  const [uploading, setUploading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      addLog(`${file.name} を読み込み中...`)

      // 1. CSVをパース
      const rawData = await DataImporter.parseCSV(file)
      if (rawData.length === 0) {
        throw new Error('CSVファイルが空か、正しく読み込めませんでした。')
      }
      
      addLog(`${rawData.length} 行を検出。解析を開始します。`)

      // 2. CSVのヘッダー（最初の行のキー）を確認してデータ種別を自動判定
      const firstRowKeys = Object.keys(rawData[0])
      let transformed;
      
      // 「レセコン登録氏名」という列があればレセコンデータ（売上）と判断
      if (firstRowKeys.includes('レセコン登録氏名')) {
        addLog('判定: ヘッダー項目から「レセコンデータ（売上）」と判断しました');
        transformed = DataImporter.transformRese(rawData)
      } 
      // 「医院名」と「項目」があれば実績データ（pivot）と判断
      else if (firstRowKeys.includes('医院名') && firstRowKeys.includes('項目')) {
        addLog('判定: ヘッダー項目から「ジニーデータ（KPI実績）」と判断しました');
        transformed = DataImporter.transformPivotData(rawData)
      } 
      else {
        throw new Error('対応していないCSV形式です。ヘッダー（項目名）を確認してください。')
      }

      addLog(`解析完了: ${transformed.length} 件のデータを作成しました。`)

      // 3. DBへ保存
      await DataImporter.saveToDb(transformed)
      addLog(`成功: 全てのデータをデータベースに保存しました。`)
      alert('アップロードが完了しました')

    } catch (err: any) {
      console.error(err)
      addLog(`エラー: ${err.message}`)
      alert(`エラー: ${err.message}`)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UploadCard 
          title="CSVファイルをアップロード" 
          desc="レセコンから抽出したCSV、もしくはジニーから抽出したCSVをアップロードしてください。" 
          icon="📂" 
          onChange={handleFileUpload}
          disabled={uploading}
        />
        <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100 flex items-center gap-4 shadow-sm">
          <div className="text-3xl">💡</div>
          <div className="text-xs text-blue-700 leading-relaxed">
            <p className="font-bold mb-1">判別基準:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>「レセコン登録氏名」を含む → 売上として処理</li>
              <li>「医院名」「項目」を含む → 実績として処理</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ログ表示エリア */}
      <div className="bg-slate-900 rounded-2xl p-6 font-mono text-xs text-blue-400 h-64 overflow-y-auto shadow-inner">
        <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
          <span className="text-slate-500 uppercase font-black">Process Logs</span>
          {uploading && <span className="animate-pulse text-yellow-500">Processing...</span>}
        </div>
        {logs.length === 0 && <div className="text-slate-600 italic">待機中... CSVファイルをアップロードしてください。</div>}
        {logs.map((log, i) => <div key={i} className="mb-1 leading-relaxed">{log}</div>)}
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
        <input type="file" accept=".csv" className="hidden" onChange={onChange} disabled={disabled} />
      </label>
    </div>
  )
}