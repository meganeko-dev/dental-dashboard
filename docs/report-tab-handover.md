# レポートタブ 開発引き継ぎドキュメント

**最終更新**: 2026-05-06
**対象範囲**: `app/report/*` `components/report/*` `lib/report-kpi.ts` `lib/server/patient-hash.ts` `lib/importers.ts`（追加分のみ）`components/admin/DataUpload.tsx`（追加分のみ）`app/api/patient-list/*` および関連 Supabase スキーマ。
**関連 Notion**: ページ ID `7c7ed474-8514-4538-8d37-71976ebc9cba`（レポートタブ要件 §1〜§5-10）。
**既存ドキュメント**: `docs/report-tab-roadmap.md`（フェーズ別ロードマップ）。本ドキュメントはそれに重複しない実装状況の集約。

---

## 1. 最終的な画面構成（2026-05-06 時点）

レポートタブは **過去24ヶ月** を対象とした単院・時系列ビュー。`/report` で表示。

| # | ブロック | 形式 | コンポーネント | データソース |
|---|---|---|---|---|
| 1 | サマリー表 | 10行 × 24列（KPI×月） | `components/report/SummaryTable.tsx` | `summarized_clinic_kpi` ＋ `flexible_kpis` |
| 2 | メンテナンス推移 | 積み上げ棒（実数ラベル付） | `components/report/MonthlyTrendChart.tsx` | `flexible_kpis`「来院人数_ステージ内訳_*」 + `data_mappings(maintenance)`（2026-05-09 切替） |
| 3 | 男女比 | ドーナツ（%表示） | `components/report/GenderRatioChart.tsx` | `patient_snapshots.gender` |
| 4 | 年齢構成 | 横棒（9区分） | `components/report/AgeDistributionChart.tsx` | `patient_snapshots.age` |
| 5 | アプリ登録者数 | 積み上げ棒（実数ラベル付） | `MonthlyTrendChart.tsx` | `flexible_kpis`「アプリ登録件数」「アプリ登録累計」 |
| 6 | 獲得率とキャンセル率 | 折れ線2本 | `MonthlyTrendChart.tsx` | `flexible_kpis`「次回予約取得率」「キャンセル率_全体」 |
| 7 | ウェブ新患/再診 | 折れ線2本 | `MonthlyTrendChart.tsx` | `flexible_kpis`「ウェブ予約_新患」「ウェブ予約_再診」 |

**ヘッダー部** (`components/report/ReportHeader.tsx`):
- 法人名 / 対象期間ラベル（例: `2024/6 〜 2026/5（過去24ヶ月）`）
- マルチクリニック法人のみクリニックセレクタ表示
- 既存の Year セレクタは廃止（24ヶ月自動）

**期間表示**: 一貫して `YYYY/M` 形式（例 `2026/1`）。サマリー表ヘッダー / チャート x軸が同じ。x軸ラベル数が12を超える場合は45°回転。

---

## 2. データフロー早見表

### 2-1. CSV → DB

| CSV 種別 | importer | 書き出し先 | 取り込まれる kpi_name / カラム |
|---|---|---|---|
| 月ごとのStats | `transformStats` | `summarized_clinic_kpi` | working_days, patients_count, reserved_count, today_cancel_count, prior_cancel_count, noshow_cancel_count 他 |
| 医院状況 | `transformStatus` | `flexible_kpis` | (既存) |
| 日別状況 | `transformStage` | `flexible_kpis` | 既存: 予約人数_既存患者 / 予約人数_新規患者 / 次回予約取得数 / 次回予約取得率 / 事前キャンセル数 / 無断キャンセル数<br>2026-05-06 追加: アプリ登録件数 / アプリ登録累計 / ウェブ予約_新患 / ウェブ予約_再診 / キャンセル率_全体<br>**2026-05-07 追加**: `来院人数_ステージ内訳_<小項目名>`（来院(人)>ステージ内訳の各小項目を動的に取り込む。項目名・項目数はクリニックごとに異なる） |
| `{法人ID}_メンテナンス.csv` | `transformSheetMaintenance` | `flexible_kpis` | メンテナンス数, 来院数, 予約人数_既存患者 |
| `{法人ID}_離脱.csv` | `transformSheetChurn` | `flexible_kpis` | 患者数, メンテナンス_離脱数, メンテナンス_未予約数, 治療_離脱数, 治療_未予約数 |
| **患者リスト**（今回新設） | `transformPatientList` + API | `patient_snapshots` | カルテ番号(→hash) / 性別 / 年齢 / 来院状況 / メンテ状況 / Dr / DH / その他Notion 5-4の全フィールド |

### 2-2. DB → 画面（チャート別の参照経路）

```
[① サマリー表]
  summarized_clinic_kpi (working_days, patients_count, reserved_count, today_cancel_*) ──┐
                                                                                          ├→ buildMonthlyReportRow ─→ SummaryTable
  flexible_kpis (来院数, 診療日数, 予約率, 離脱率 ほか) ────────────────────────────────┘

[② メンテナンス推移] (2026-05-09 切替)
  flexible_kpis (kpi_name LIKE '来院人数_ステージ内訳_%') ──┐
                                                              ├→ stageMaintenanceByMonth → chartData{メンテ数, メンテ以外}
  data_mappings (mapping_type='maintenance', key=clinic_name) ┘   メンテ数=マッピング項目の合計、メンテ以外=それ以外の合計

[③ 男女比]
  patient_snapshots.gender ─→ countGender() in app/report/page.tsx ─→ GenderRatioChart

[④ 年齢構成]
  patient_snapshots.age ─→ bucketAge() in app/report/page.tsx ─→ AgeDistributionChart (9 buckets)

[⑤ アプリ登録者数]
  flexible_kpis ('アプリ登録件数', 'アプリ登録累計')
    ─→ buildMonthlyReportRow.{app_registered_new, app_registered_total, app_registered_existing}
    ─→ chartData (登録数=累計-当月, 新規登録件数=当月)

[⑥ 獲得率/キャンセル率]
  flexible_kpis ('次回予約取得率', 'キャンセル率_全体') ─→ {acquisition_rate, overall_cancel_rate} ─→ 折れ線

[⑦ ウェブ新患/再診]
  flexible_kpis ('ウェブ予約_新患', 'ウェブ予約_再診') ─→ {web_reserved_new, web_reserved_repeat} ─→ 折れ線
```

---

## 3. Supabase 関連

### 3-1. テーブル

| テーブル | 状態 | RLS | 備考 |
|---|---|---|---|
| `patient_snapshots` | **新規（2026-05-06作成）** | 有効 | PK = (corporation_id, clinic_id, patient_hash) |
| `flexible_kpis` | 既存。新 `kpi_name` を保存可能 | 有効 | スキーマ変更なし、追加 kpi 名のみ |
| `summarized_clinic_kpi` | 既存、変更なし | 有効 | |
| `flexible_kpis_stage_breakdown_distinct` | **新規VIEW（2026-05-09作成）** | invoker | flexible_kpis の `来院人数_ステージ内訳_%` の DISTINCT(corporation_id, clinic_name, kpi_name) を返す。Admin メンテナンス設定UIで選択肢取得に利用（distinct 生クエリの 1000 行制限回避） |
| `kpi_sheet_sources` | 既存、**RLS 無効**（advisor 警告） | **無効** | ⚠ 別途修正要（後述） |

### 3-2. 適用済みマイグレーション
1. `create_patient_snapshots` — テーブル本体 + SELECT ポリシー
2. `patient_snapshots_write_policies` — 自法人配下に INSERT / DELETE のポリシー追加

### 3-3. patient_snapshots スキーマ要点
- **PK**: `(corporation_id, clinic_id, patient_hash)` — clinic_id 単位で **DELETE → INSERT** で常に最新スナップショットだけ保持する運用
- **patient_hash**: `SHA-256(corp_id:clinic_id:カルテ番号:KARTE_HASH_SECRET)` の hex
- **インデックス**: `(corp_id, clinic_id)` / `(corp_id, clinic_id, gender)` / `(corp_id, clinic_id, age)`
- **カラム**: Notion 5-4 のフルセット（visit_status, maintenance_status, dr_name, dh_name, gender, age, tags, first_visit_date, last_visit_date, next_reserve_date, maintenance_count, visit_count, cancel_count, prior_cancel_count, churn_flag 他）
- **RLS ポリシー**: `corporation_id IN (SELECT corporation_id FROM profiles WHERE id = auth.uid())` で SELECT/INSERT/DELETE。UPDATE は未許可（運用上 DELETE/INSERT のみ）

### 3-4. ⚠ Advisor 警告（未対応）
`public.kpi_sheet_sources` が RLS 無効のまま全公開。今回のスコープ外だが、別タスクで以下を実施推奨:
```sql
ALTER TABLE public.kpi_sheet_sources ENABLE ROW LEVEL SECURITY;
-- 続けて authenticated ユーザーが SELECT 可能などのポリシーを追加（無いと完全閉塞する）
```

---

## 4. 環境変数

| 変数 | 用途 | 場所 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | 既存 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon Key | 既存 |
| **`KARTE_HASH_SECRET`** | カルテ番号 SHA-256 ハッシュ用シークレット。**サーバー専用**、`NEXT_PUBLIC_` を付けない | `.env.local` 追加済み（96 hex chars） |

### KARTE_HASH_SECRET の重要事項
- **本番（Vercel）に手動で同名の環境変数を追加する必要がある**（同じ値、または異なる値で運用 — どちらかは以下を参照）
- **値を変えると過去のハッシュ値と不整合**になり、再アップロード必須
- **漏洩時はローテート + 全患者リスト再アップロード**

---

## 5. 主要コードのファイル一覧

### 5-1. 新規作成
- `app/report/page.tsx` — レポートページ本体（24ヶ月レンジ、7ブロック描画）
- `app/api/patient-list/route.ts` — 患者リスト CSV のサーバ取り込み API
- `components/report/ReportHeader.tsx` — ヘッダー（クリニック・期間表示）
- `components/report/SummaryTable.tsx` — サマリー表（KPI × 月）
- `components/report/MonthlyTrendChart.tsx` — 月次推移 汎用チャート（棒+線、`showBarLabels` オプション）
- `components/report/GenderRatioChart.tsx` — 男女比ドーナツ（%表示）
- `components/report/AgeDistributionChart.tsx` — 年齢構成 横棒（`AGE_BINS` 定数 export）
- `lib/report-kpi.ts` — `MonthlyReportRow` 型 / `buildMonthlyReportRow(s)` / `buildPastMonths` / `REPORT_FLEXIBLE_KPIS`
- `lib/server/patient-hash.ts` — `hashKarteNumber()`（Node.js 限定、`runtime = 'nodejs'`）

### 5-2. 既存ファイルへの追加
- `lib/importers.ts`
  - `transformPatientList` 関数（行→`PatientListInputRow[]`、ハッシュ化はしない）
  - `PatientListInputRow` 型 export
  - `transformStage` 拡張 (2026-05-06): `アプリ登録件数 / アプリ登録累計 / ウェブ予約_新患 / ウェブ予約_再診 / キャンセル率_全体`
  - `transformStage` 拡張 (2026-05-07): 来院(人)>ステージ内訳の各小項目を `来院人数_ステージ内訳_<小項目名>` として動的取り込み（Phase4 メンテナンスマッピングの元データ）
- `components/admin/DataUpload.tsx`
  - filePattern 判定に `'患者リスト'` / `'患者一覧'` 分岐追加
  - `'patient_list'` の場合は `multipart/form-data` で `/api/patient-list` に送信
- `app/{admin,staff,table_view,page}.tsx` — ナビゲーションリンクに `/report` を追加（過去セッション）

### 5-3. ドキュメント
- `docs/report-tab-roadmap.md` — フェーズ別ロードマップ＋撤去項目／追加項目／旧Notion保留項目
- `docs/report-tab-handover.md` — 本ドキュメント

---

## 6. 主要な仕様判断と理由

### 6-1. 24ヶ月レンジは動的決定
- ダッシュボードを開いた瞬間の JST 年月（`Asia/Tokyo` の `Intl.DateTimeFormat`）を起点に、現在月含む過去24ヶ月を `buildPastMonths()` で生成
- ユーザーは年セレクタで切替不要（要望 2026-05-06）
- supabase クエリは `gte('year', startYear).lte('year', endYear)` で年範囲取得 → JS 側で `buildMonthlyReportRows(months)` が `(year, month)` ペアで月単位フィルタ

### 6-2. カルテ番号はサーバ側ハッシュ化
- ブラウザに `KARTE_HASH_SECRET` を出すと意味がないので、Next.js App Router の API ルート (`app/api/patient-list/route.ts`) で完結
- API ルートは `runtime = 'nodejs'` 指定（`node:crypto` 利用のため Edge は不可）
- 認証は `@supabase/ssr` の `createServerClient` ＋ Cookie で確立、`profiles.corporation_id` と `clinics.corporation_id` を必ず照合

### 6-3. patient_snapshots は DELETE → INSERT
- ユーザー要件「ClinicIDごとに常に最後にアップロードされたデータのみを保持」を実現
- API で `(corporation_id, clinic_id)` の既存行を全削除 → 新CSV全行を 500件チャンクで INSERT
- **CSV内重複は `Map<patient_hash, SnapshotRow>` で後出勝ち**（重複行があっても PK 衝突しない）。DataUpload UI に重複件数を表示

### 6-4. アプリ登録者数の「登録数」算出
- 仕様: `登録数 = 累計 − 当月` で過去登録分を表現
- 実装: `buildMonthlyReportRow` で `app_registered_existing = max(累計 - 当月, 0)`
- ⚠ CSV 上は `myDental(アプリ) 登録件数 / 累計` の **合計行は `-`**（平均で計算しないため）。importer は `-` を null として skip。月別行のみ取り込み

### 6-5. 「メンテ以外」の実体
- DB に直接の値はなし。`buildMonthlyReportRow` で `Math.max(visits − menteCount, 0)` で算出
- `visits` は `flexible_kpis.kpi_name = '来院数'`（`{法人ID}_メンテナンス.csv` 由来）
- `menteCount` は `flexible_kpis.kpi_name = 'メンテナンス数'`（同上）
- ❗ **`{法人ID}_メンテナンス.csv` をアップロードしていないクリニックでは何も表示されない**（あるあるなので最初に確認するポイント）

---

## 7. 動作確認手順

### 7-1. 既存データで動かす
1. `.env.local` に `KARTE_HASH_SECRET` がある状態で `npm run dev`
2. `/report` を開く
3. クリニックを選択（マルチクリニック法人の場合）
4. メンテナンス推移チャート → 既存データで描画されるはず

### 7-2. 新KPI を入れる（日別状況CSV）
1. Admin > データアップロードで `{年}_{clinic_id}_ステージ日別状況.csv` を **再アップロード**
2. 既に取り込んだ過去ファイルも再アップで OK（既存の `flexible_kpis` upsert キーで上書きされ、新 kpi_name 行が追加される）
3. レポートタブで「アプリ登録者数」「獲得率/キャンセル率」「ウェブ新患/再診」が表示

### 7-3. 患者リスト CSV を入れる
1. Admin > データアップロードでファイル名に「患者リスト」または「患者一覧」を含む CSV をアップ
   - 例: `866_十条I_S歯科・矯正歯科_患者リスト_20260501105323.csv`
2. ログに `✅ 成功: ...（N件のスナップショットを保存）（CSV内重複 X 件は後出を採用）` と出れば OK
3. レポートタブの「男女比」「年齢構成」が表示

### 7-4. SQL で生のカルテ番号が無いことを確認
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'patient_snapshots' AND column_name LIKE '%karte%';
-- 結果: 0 件（patient_hash のみ存在）
```

---

## 8. 既知の未解決・注意点

| # | 内容 | 対応方針 |
|---|---|---|
| 8-1 | `kpi_sheet_sources` の RLS が無効（advisor 警告） | 別タスク。本タブとは独立 |
| 8-2 | 既存 TS エラー（`app/page.tsx`, `app/staff/page.tsx`, `MappingManager.tsx`, `AuthContext.tsx`） | 本タブ着手時から存在、本作業範囲外 |
| 8-3 | Vercel 本番デプロイ時に `KARTE_HASH_SECRET` の手動追加が必要 | デプロイ手順書に追記推奨 |
| 8-4 | 過去にアップ済みの日別状況CSVは新KPI を含まない | 該当法人のCSVを再アップロードで補完 |
| 8-5 | `patient_snapshots` は **月次スナップショットを保持しない**（最新のみ） | クライアント要望どおり。Notion 5-4 の元案（月次保持）からは変更 |
| 8-6 | 男女比 / 年齢構成は **過去推移なし**（最新スナップショットだけ） | 同上、過去推移は要件外 |
| 8-7 | Notion §5-1 の旧チャート定義（来院数推移 / ユニーク来院 / キャンセル状況 / 事前キャンセル / 初回メンテ移行 / 離脱状況）は **撤去済** | 2026-05-06 のクライアント要望反映済み |
| 8-8 | 旧 Notion 5-2 メンテナンスマッピング (Phase 4) / 5-7 チェア稼働率 (Phase 5) は **未着手** | `docs/report-tab-roadmap.md` §F 参照 |

---

## 9. ロードマップ（次に着手しうる項目）

`docs/report-tab-roadmap.md` の「旧 Notion ロードマップ」セクションも参照。

- **Phase 4（旧F）**: Admin マッピング画面に「メンテナンス」タブ追加 — 院ごとに `is_maintenance` ラベル設定可能に。`data_mappings` に `mapping_type='is_maintenance'` `'maintenance_priority'` を保存
- **Phase 5（旧D）**: `clinics.chair_count` 列追加＋ `data_mappings('chair_util_capacity')` ＋ Admin UI でチェア稼働率（新定義）を Clinic Dashboard に再導入
- **継続率 / 未予約状況** など Notion §5-1 の ⑥⑦⑪ は **レポートタブからは撤去**したものの、Clinic Dashboard 側で扱う想定。設計はまだ無い

---

## 10. 検証コマンド早見表

```bash
# TypeScript 全体チェック（既存の他ファイルエラーは無視可）
npx tsc --noEmit

# レポート関連だけ抜き出し
npx tsc --noEmit 2>&1 | grep -iE "report|api/patient|patient-hash" || echo "OK"

# テーブル定義確認（Supabase MCP 経由）
# → mcp__supabase__list_tables / list_migrations を使う
```

---

## 11. 連絡用メモ

- **本作業のレビューア向け**: §6（仕様判断）と §8（注意点）を先に読むと早い
- **次のセッションを始めるClaude向け**: 本ドキュメント＋ `docs/report-tab-roadmap.md` ＋ `~/.claude/.../memory/MEMORY.md` を読めば全体像が掴める。Notion ページは `mcp__notion__API-get-block-children` で `block_id=7c7ed474851445388d3771976ebc9cba` にアクセス（出力大きいのでページネーション必要）
