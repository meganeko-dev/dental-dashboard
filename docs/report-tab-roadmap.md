# レポートタブ 残実装ロードマップ

Notion 仕様 (page id: `7c7ed474-8514-4538-8d37-71976ebc9cba`) §5-1〜§5-10 をベースに、2026-05-06 のクライアント追加要望（Notion 仕様 §5-1 を一部上書き）を反映した管理ドキュメント。

## 現在の表示構成（2026-05-06 時点）

クライアント要望に従い、レポートタブは以下7ブロック:

- サマリー表（10行 / 過去24ヶ月 / "YYYY/M" 表示 / 横スクロール）
- メンテナンス推移（月次）— 積み上げ棒、実数ラベル付
- 男女比（ドーナツ）— `patient_snapshots`
- 年齢構成（横棒）— `patient_snapshots`
- アプリ登録者数（積み上げ棒、実数ラベル）— `flexible_kpis`「アプリ登録件数 / アプリ登録累計」
- 獲得率とキャンセル率（折れ線2本）— `flexible_kpis`「次回予約取得率 / キャンセル率_全体」
- ウェブ新患/再診（折れ線2本）— `flexible_kpis`「ウェブ予約_新患 / ウェブ予約_再診」

24ヶ月レンジは「ダッシュボードを開いた日のJST年月から過去24ヶ月（含む現在月）」で動的決定。

## 撤去済（2026-05-06 のクライアント要望反映）

- 来院数（月次推移）
- ユニーク来院・予約取得（月次推移）
- キャンセル状況（月次推移）
- 事前キャンセル（月次推移、重要KPIハイライト含む）
- 初回メンテ移行（月次）
- 離脱状況（月次）
- サマリー表の以下の行: 事前キャンセル数 / 事前キャンセル率 / 無断キャンセル数 / 新患数 / 初回メンテ移行数 / メンテナンス数 / メンテナンス率
- ReportHeader の Year セレクタ（24ヶ月固定のため不要）

## 完了済（2026-05-06）

### E-1〜E-5 全グラフ実装完了

| ID | グラフ | データソース | 実装 |
|---|---|---|---|
| E-1 | 男女比（ドーナツ） | `patient_snapshots.gender` | `components/report/GenderRatioChart.tsx` |
| E-2 | 年齢構成（横棒） | `patient_snapshots.age` をビニング | `components/report/AgeDistributionChart.tsx` |
| E-3 | アプリ登録者数（積み上げ棒+ラベル） | `flexible_kpis`「アプリ登録件数」「アプリ登録累計」 | 既存 `MonthlyTrendChart` で描画 |
| E-4 | 獲得率/キャンセル率（折れ線） | `flexible_kpis`「次回予約取得率」「キャンセル率_全体」 | 既存 `MonthlyTrendChart` で描画 |
| E-5 | ウェブ新患/再診（折れ線） | `flexible_kpis`「ウェブ予約_新患」「ウェブ予約_再診」 | 既存 `MonthlyTrendChart` で描画 |

### データ取り込み基盤

- **Supabase マイグレーション**: `create_patient_snapshots` / `patient_snapshots_write_policies`
  - PK = (corporation_id, clinic_id, patient_hash)
  - RLS: 自法人配下の SELECT/INSERT/DELETE のみ許可
- **環境変数 `KARTE_HASH_SECRET`**: サーバー側のみ使用。`.env.local` に追加済み（Vercel デプロイ時にも追加要）
- **`lib/server/patient-hash.ts`**: `SHA-256(corp:clinic:karte:SECRET)` のhex を返す
- **`lib/importers.ts: transformPatientList`**: 患者リストCSVを行単位の `PatientListInputRow[]` に変換（カルテ番号は生値、API側でハッシュ化）
- **`app/api/patient-list/route.ts`**: サーバーサイド API ルート。multipart/form-data で受領 → ハッシュ化 → `(corp_id, clinic_id)` の DELETE → INSERT（常に最新スナップショットのみ保持）
- **`components/admin/DataUpload.tsx`**: ファイル名に「患者リスト」/「患者一覧」を含む CSV を自動判別し、APIへ送信
- **`lib/importers.ts: transformStage` 拡張**: 日別状況CSV の以下を新たに取り込み
  - `myDental(アプリ) 登録件数 / 累計` → `アプリ登録件数 / アプリ登録累計`
  - `ウェブ予約 新患 / 再診` → `ウェブ予約_新患 / ウェブ予約_再診`
  - `キャンセル率` 全体列 → `キャンセル率_全体`

## 完了済（2026-05-07）

### 来院ステージ内訳の動的取り込み

- **`lib/importers.ts: transformStage` 拡張**: 日別状況CSV の「来院(人) > ステージ内訳」の全小項目を動的に `flexible_kpis` に取り込み
  - kpi_name フォーマット: `来院人数_ステージ内訳_<小項目名>`
  - 例: `来院人数_ステージ内訳_初診/急患` / `来院人数_ステージ内訳_DH` / `来院人数_ステージ内訳_矯正`
  - 項目名・項目数はクリニックごとに異なるため動的にカラム検出（forward-fill 済みの大項目「来院(人)」+ 中項目「ステージ内訳」+ 小項目名で判定）
  - 既存の合計列「来院(人)」（中項目=空、小項目=空）は引き続き Stats CSV を正ソースとし、本ファイルからは取得しない
  - クライアント要望: 取得した小項目のうち1つ以上を「メンテナンス」治療として定義し集計する Phase4 マッピングの**元データ**となる
  - ⚠ サマリーシートの「来院(人)」は患者IDでユニーク処理されているため、ステージ内訳の合計とは一致しない（仕様）

## 完了済（2026-05-09）

### Phase 4: メンテナンス設定（クリニック単位マッピング）

- **Supabase マイグレーション**: `create_flexible_kpis_stage_breakdown_distinct_view`
  - View: `public.flexible_kpis_stage_breakdown_distinct(corporation_id, clinic_name, kpi_name)`
  - `kpi_name LIKE '来院人数_ステージ内訳_%'` の DISTINCT を返す
  - `security_invoker = true` で呼び出し元の RLS を継承
  - flexible_kpis (3500行+) を直接 distinct すると 1000 行制限に当たるため view 経由で取得
- **`components/admin/MaintenanceMappingSetter.tsx`**: 新規追加
  - 上部: クリニック プルダウン + ステージ内訳項目 プルダウン + 「設定」ボタン
  - 項目プルダウンは選択中クリニックの実データに基づいて動的フィルタ。プレフィックス `来院人数_ステージ内訳_` は表示時に除去
  - 既登録の組合せはプルダウンから自動的に除外
  - 下部: `data_mappings(mapping_type='maintenance')` の一覧、各行に「削除」ボタン
- **`data_mappings` 利用ルール (mapping_type='maintenance')**
  - `mapping_type`: `maintenance`
  - `key`: クリニック名（`flexible_kpis.clinic_name` と同形）
  - `value`: ステージ内訳の項目名（プレフィックス `来院人数_ステージ内訳_` を除去した部分のみ。例: `初診/急患` / `DH`）
- **`app/admin/page.tsx`**: サイドバーに「🦷 メンテナンス設定」メニューを追加（全法人で利用可）
- **`app/report/page.tsx`**: メンテナンス推移チャートのデータソースを刷新
  - 旧: `flexible_kpis` の `来院数` / `メンテナンス数`（=`{法人ID}_メンテナンス.csv` 由来。手動Sheets準備が必要）
  - 新: `flexible_kpis` の `来院人数_ステージ内訳_*`（日別状況CSV 由来）+ `data_mappings(maintenance)` で分類
    - メンテ数 = マッピングされた項目の合計
    - メンテ以外 = それ以外の項目の合計
  - `lib/report-kpi.ts` の `mente_count` / `non_mente_count` フィールドはサマリー表で使われていないので未変更（互換維持）

### メンテ以外の計算定義 改定（同日内）

- **理由**: ステージ内訳は1来院複数ステージ重複カウント、合計列「来院(人)」は患者IDユニーク値で、両者は一致しない。「メンテ以外」の単純合算は重複カウントを含むため実態とズレるためクライアント要望で改定
- **`lib/importers.ts: transformStage`**: 「来院(人)」合計列（中項目=空、小項目=空）を新たに `kpi_name='来院人数_ステージ内訳用'` として `flexible_kpis` に保存
- **`app/report/page.tsx`**: メンテ以外 = `来院人数_ステージ内訳用` − メンテ数 へ変更（負値は 0 にクランプ）。来院人数_ステージ内訳用 が無い月はメンテ以外を null
- ⚠ 既に取り込み済みの日別状況CSV には `来院人数_ステージ内訳用` が含まれないため、対象クリニックのCSVを再アップロード必要

---

## 旧 Notion ロードマップ（§5-1 のチャート定義に基づく未実装、参考用）

### A. ⑥ 新患（月次推移）— Phase 2/3
- 棒：新患数（予約） / 新患数（来院） / 折れ線：新患来院率
- ⚠ 2026-05-06 のクライアント要望でレポートタブからは撤去済。Clinic Dashboard 側の優先指標としては存続予定。

### B. ⑦ 新患継続率 — Phase 3
- ⚠ 同上。Clinic Dashboard で扱う想定。

### C. ⑪ 未予約状況（月次） — Phase 3
- ⚠ 同上。

### D. ⑫ チェア稼働率（新定義） — Phase 5
- 折れ線：稼働率 = 平均来院数 ÷ (チェア台数 × 1日あたり想定上限)
- 必要対応: `clinics.chair_count` 追加 / `data_mappings('chair_util_capacity')` 追加 / Admin UI で編集可能に
- レポートタブからは撤去済だが、Clinic Dashboard で保留中

### E. ⑬ アプリ・ウェブ予約（旧Notion定義）
- 上記 E-3 / E-5 で吸収。

### F. ⑧ メンテナンス v2 — Phase 4 ✅ **2026-05-09 完了**
- ~~Admin マッピングタブに「メンテナンス」追加~~ → `MaintenanceMappingSetter.tsx` で実装
- ~~`data_mappings('is_maintenance')` `('maintenance_priority')` を保存~~ → `data_mappings('maintenance')` で実装（key=clinic_name, value=item）
- ~~1来院複数ステージ対応（優先順位の高いラベル1件のみカウント）~~ → 今回の集計仕様は単純合算（複数項目を「メンテナンス」として登録可能）
- ~~保存前プレビュー機能~~ → 入力UIをシンプル化（プルダウン + 「設定」ボタン + 即時一覧反映）

## 受け入れ基準（仕様 5-10）
- スプレッドシート「サマリー」シートと値が ±1 以内で一致
- メンテマッピング保存後にメンテ推移チャートが即時更新される
- 患者リスト CSV 取込後 DB に生のカルテ番号が存在しない（SQL 確認）
- 新心会 / 藤美会 / 新美会 で動作確認
