# 引き継ぎ書 — スプレッドシート → flexible_kpis 取り込み機能

作成日: 2026-04-19
対象法人: 新心会（corporation_id: `TN32FBH8`）

---

## 1. 目的

特定のスプレッドシート（シート「メンテナンス」「離脱」）から KPI 値を抽出し、Supabase の `flexible_kpis` テーブルへ upsert する仕組みを構築した。今後も継続的に同シートから取り込むこと、および他法人向けにも URL × `corporation_id` のマッピングを永続化して横展開できる設計にしている。

### 対象スプレッドシート
- URL: https://docs.google.com/spreadsheets/d/1DImIJaxeA0RdOpYIs5SbiNTxxXukjv5RjMB_tl6XlUw/
- spreadsheet_id: `1DImIJaxeA0RdOpYIs5SbiNTxxXukjv5RjMB_tl6XlUw`
- シート: `メンテナンス` / `離脱`

---

## 2. データベース側の追加

### 2-1. マッピングテーブル `kpi_sheet_sources`（新規作成・適用済み）

マイグレーション: `create_kpi_sheet_sources`（Supabase に適用済み）

```sql
CREATE TABLE IF NOT EXISTS public.kpi_sheet_sources (
  id              bigserial PRIMARY KEY,
  corporation_id  text NOT NULL UNIQUE,
  spreadsheet_id  text NOT NULL,
  spreadsheet_url text NOT NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

登録済み行:
| corporation_id | spreadsheet_id | notes |
|---|---|---|
| TN32FBH8 | 1DImIJaxeA0RdOpYIs5SbiNTxxXukjv5RjMB_tl6XlUw | 新心会様 KPI 管理シート（メンテナンス / 離脱） |

### 2-2. 取り込み先 `flexible_kpis`

一意キー（既存）:
`(corporation_id, clinic_name, staff_name, year, month, date, segment, kpi_name, is_target, treatment_type, staff_role)`

upsert は `ON CONFLICT ... DO UPDATE SET value=EXCLUDED.value, updated_at=now()` を使用。

---

## 3. 取り込みマッピング仕様

全行共通:
- `segment = 'clinic'`
- `staff_name = ''`
- `clinic_name` = `clinic_id`（A列）から `clinics` テーブル（もしくは事前作成の JSON）で逆引き
- `clinic_id` = A列の値
- `is_target = false`
- `date` = 該当年・月の 1 日（`YYYY-MM-01`）
- `treatment_type = ''`
- `staff_role = ''`
- `value` は数値。空欄は 0 として扱う

### 3-1. シート「メンテナンス」

- A列: 医院ID
- B列: 医院名
- C列: 項目 → `kpi_name` 変換
- D列以降: 月別の値（ヘッダから年月を推定）

変換マップ:
```
メンテ    → メンテナンス数
予約数    → 予約人数_既存患者
来院数    → 来院数
```

### 3-2. シート「離脱」

- A列: 医院ID
- B列: 医院名
- C列: 項目
- D列: ステータス（離脱数 / 未予約数 / 空）
- E列以降: 月別の値

(C, D) ペア → `kpi_name` 変換:
```
(患者数, '')      → 患者数
(メンテ, 離脱数)  → メンテナンス_離脱数
(メンテ, 未予約数) → メンテナンス_未予約数
(メンテ, '')      → SKIP（小計行のため）
(治療,   離脱数)  → 治療_離脱数
(治療,   未予約数) → 治療_未予約数
(治療,   '')      → SKIP（小計行のため）
```

`clinic_id` が空の行（合計行など38行）も SKIP。

---

## 4. 実装済みスクリプト

### 4-1. `scripts/read-sheet.mjs`（コミット済み: `f591e67`）

Google スプレッドシートを読み取る薄い CLI。Node 24 標準機能のみでゼロ依存（`crypto` / `fetch`）。GCP サービスアカウントの JWT を自前生成してアクセストークンを取得する。

### 4-2. `scripts/import-sheet-kpis.mjs`（未コミット）

取り込み本体。`kpi_sheet_sources` を参照し、メンテナンス/離脱 2 シートを読み取り → 変換 → `flexible_kpis` に upsert する。

実行方法:
```bash
node scripts/import-sheet-kpis.mjs [corporation_id] [--dry-run]
```

必要な環境変数:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`（**現在未設定。今後の定期実行のために設定が必要**）
- `GOOGLE_SA_KEY_PATH`（サービスアカウント鍵の JSON パス）

実装のポイント:
- PostgREST の `Prefer: resolution=merge-duplicates,return=minimal` で upsert
- 500 行単位でチャンク送信
- `corporation_id` 指定で単一法人、省略で登録全法人を処理

---

## 5. 今回の初期取り込み（2026-04-19 実施）

`SUPABASE_SERVICE_ROLE_KEY` が未配布だったため、初期投入は以下フローで実行した:

1. `read-sheet.mjs` で `/tmp/maint.json`, `/tmp/churn.json` を生成
2. `clinics` テーブルから `/tmp/clinics.json`（TN32FBH8 の 25 医院）を生成
3. `/tmp/transform.mjs` で変換 → `/tmp/rows.json`（1079 行）
4. `/tmp/gen-sql2.mjs` で 150 行ずつ / シングルクォートエスケープ付き SQL チャンクに分割（`u2-00.sql` 〜 `u2-07.sql` + 離脱分 `upsert-3.sql`）
5. Supabase MCP (`mcp__supabase__execute_sql`) 経由でチャンクを順次実行

最終 row 数（`SELECT kpi_name, count(*) … WHERE corporation_id='TN32FBH8' AND segment='clinic'`）:

| kpi_name | count |
|---|---:|
| メンテナンス数 | 270 |
| 来院数 | 270 |
| 予約人数_既存患者 | 456 ※既存 186 行 + 今回 270 行 |
| 患者数 | 53 |
| メンテナンス_離脱数 | 54 |
| メンテナンス_未予約数 | 54 |
| 治療_離脱数 | 54 |
| 治療_未予約数 | 54 |

予約人数_既存患者の既存行とは値が一致することを事前確認済み（例: clinic_id=857 の 2025/01 = 597）。上書きによるデータ損失なし。

---

## 6. 残タスク・引き継ぎ事項

### 優先度: 高
- [ ] **`SUPABASE_SERVICE_ROLE_KEY` を環境に配布**（Vercel 環境変数 / ローカル `.env.local` 等）
- [ ] **`scripts/import-sheet-kpis.mjs` のコミット**（`scripts/read-sheet.mjs` と同じパターン）

### 優先度: 中
- [ ] 定期実行スケジューラ（cron / GitHub Actions / Vercel Cron 等）の決定と設定
- [ ] 取り込みログをどこに残すか（`kpi_sheet_sources` に `last_imported_at`, `last_status` を追加？）
- [ ] エラー時通知（Slack / メール）

### 優先度: 低
- [ ] 他法人（新美会など）対応時は `kpi_sheet_sources` に INSERT し、同シート構造なら同スクリプトで処理可能
- [ ] シート構造が異なる法人向けにはマッパを分岐させる必要あり（現スクリプトはメンテナンス/離脱の 2 シート固定）

### クリーンアップ
- [ ] `/tmp` 下の作業ファイル削除
  - `/tmp/maint.json`, `/tmp/churn.json`, `/tmp/clinics.json`
  - `/tmp/rows.json`, `/tmp/rows-compact.json`
  - `/tmp/transform.mjs`, `/tmp/gen-sql.mjs`, `/tmp/gen-sql2.mjs`, `/tmp/gen-json.mjs`
  - `/tmp/u2-00.sql` 〜 `/tmp/u2-07.sql`, `/tmp/upsert-0.sql` 〜 `/tmp/upsert-3.sql`

---

## 7. 参考情報

### 今回判明した注意点
- DB の `clinic_name` は全角スペースを含む（例: `あい歯科クリニック　高尾`）が、シート上は半角/スペースなしの場合あり。**DB の表記を正とする**（`clinics` テーブルから逆引き）。
- シングルクォートを含む医院名（`恵比寿I's歯科・矯正歯科`, `八王子I'S歯科・矯正歯科` など）は SQL 生成時に `' → ''` エスケープ必須。
- 離脱シートの (C, D) = (メンテ, '') / (治療, '') 行は小計のため取り込まない。

### 関連ファイル
- `scripts/read-sheet.mjs`（コミット済）
- `scripts/import-sheet-kpis.mjs`（未コミット）
- Supabase マイグレーション: `create_kpi_sheet_sources`

---

## 8. 2026-04-20 追加実装・変更履歴

### 8-1. Admin データアップロードへのメンテナンス / 離脱 CSV 取り込み追加

Claude Code で実施していた Google Sheets → 変換 → Supabase 投入処理を、Admin 画面の「データアップロード」から CSV として実行できるようにした。

対象ファイル名:
- `<corporation_id>_メンテナンス.csv`
- `<corporation_id>_離脱.csv`
- ブラウザの重複ダウンロード名を考慮し、`<corporation_id>_離脱 (1).csv` のような suffix も許容

実装ファイル:
- `components/admin/DataUpload.tsx`
- `lib/importers.ts`

処理概要:
- ファイル名から `corporation_id` とシート種別を判定
- ログイン中ユーザーの `corporation_id` とファイル名の `corporation_id` が一致しない場合は投入を中断
- `clinics` テーブルから `id, name` を取得し、CSV 内の医院IDを正式な `clinic_name` に変換
- `flexible_kpis` に既存の複合キーで upsert

メンテナンスCSVのマッピング:
| CSV項目 | flexible_kpis.kpi_name |
|---|---|
| メンテ | メンテナンス数 |
| 予約数 | 予約人数_既存患者 |
| 来院数 | 来院数 |

離脱CSVのマッピング:
| CSV C列 | CSV D列 | flexible_kpis.kpi_name |
|---|---|---|
| 患者数 | 空 | 患者数 |
| メンテ | 離脱数 | メンテナンス_離脱数 |
| メンテ | 未予約数 | メンテナンス_未予約数 |
| 治療 | 離脱数 | 治療_離脱数 |
| 治療 | 未予約数 | 治療_未予約数 |

### 8-2. 月ごとのStats CSV の取り込み定義変更

対象ファイル:
- ファイル名に `月ごとのStats` を含むCSV
- 例: `847_市ヶ谷I'S歯科・矯正歯科_月ごとのStats（旧month）_20260401175001.csv`

変更内容:
- `初回メンテ移行数` を追加取得
- `初回メンテ移行数` は `kpi_name='初回メンテ移行数'` として保存
- `離脱率` はこれまで `value * 100` で保存していたが、今後はCSVの値をそのまま保存する
  - 例: `0.081` は `0.081` のままDB保存
  - 画面表示時は必要に応じて `%` 表示へ変換

注意:
- 上記変更に伴い、既存の `離脱率` を修正するには `月ごとのStats` CSV の再アップロードが必要。
- `月ごとのStatus` / `医院状況` ファイルではなく、再読み込み対象は `月ごとのStats` ファイル。

### 8-3. CLINIC Dashboard KPIカード定義変更

`メンテ・稼働・離脱` タブの表示順と計算定義を変更した。

表示順:
1. メンテナンス数
2. メンテナンス率
3. 初回メンテナンス数
4. 新患数
5. 未予約数
6. 未予約率
7. 離脱数
8. 離脱率
9. メンテ_離脱数
10. メンテ_離脱率

計算定義:
| KPIカード | 定義 |
|---|---|
| メンテナンス数 | `kpi_name='メンテナンス数' AND segment='clinic'` |
| メンテナンス率 | `メンテナンス数 / 来院数` |
| 初回メンテナンス数 | `kpi_name='初回メンテ移行数' AND segment='clinic'` |
| 新患数 | `kpi_name='予約人数_新規患者' AND segment='clinic'` |
| 未予約数 | `kpi_name='離脱患者' AND segment='clinic'` |
| 未予約率 | `kpi_name='離脱率' AND segment='clinic'` |
| 離脱数 | `メンテナンス_離脱数 + 治療_離脱数` |
| 離脱率 | `(メンテナンス_離脱数 + 治療_離脱数) / 患者数` |
| メンテ_離脱数 | `kpi_name='メンテナンス_離脱数' AND segment='clinic'` |
| メンテ_離脱率 | `(メンテナンス_離脱数 + メンテナンス_未予約数) / 患者数` |

実装方針:
- 既存の多くのKPIは `summarized_clinic_kpi` を利用。
- 上記のメンテ・離脱系KPIは `summarized_clinic_kpi` に列がない可能性があるため、`flexible_kpis` の生データを併用して計算。

### 8-4. 画面表示・UI修正

変更内容:
- CLINIC Dashboard / STAFF Dashboard のヘッダー Year / Month 初期値を、画面を開いた日のJST年月に変更
- DB上の最新年月で初期値を上書きする処理を削除
- 現在年月にデータが無い場合でも、Year / Month セレクトには現在年月を表示
- CLINIC Dashboard のクリニック選択順を `clinics.id` 昇順に変更
- STAFF Dashboard のスタッフ選択順も、所属クリニックの `clinics.id` 昇順を優先
- 複合グラフのTooltipで、`率` 系KPIには `%` を付与
- KPIカードの `1日平均単価` / `保険1日平均単価` / `自費1日平均単価` は整数表示に変更
- Admin の「マッピング」メニューの入力タイトルを `レセコン登録名` から `登録名` に変更

### 8-5. 売上テーブルビュー / スタッフ売上入力

藤美会 / 新美歯科向けの追加機能として以下が実装済み。

対象法人:
- `FWLRNER6`

追加ページ:
- `/table_view`
- メニュー表示名: 売上テーブルビュー
- `corpId === 'FWLRNER6'` のみ表示・アクセス許可

Admin 売上データ入力:
- 既存の「売上データ入力」メニュー内に `クリニック全体` / `スタッフ` タブを追加
- スタッフタブは `corpId === 'FWLRNER6'` のみ表示
- スタッフ売上の `kpi_name` は以下に統一
  - 保険: `保険治療_金額`
  - 自費: `自費治療_金額`
  - 物販: `物販_金額`

売上テーブルビュー集計:
| 行 | 保険 | 自費 | 物販 |
|---|---|---|---|
| クリニック全体 | `国民健康保険_金額 + 社会保険_金額` | `自費治療_金額` | `雑収入_金額` |
| Dr別 | `保険治療_金額` | `自費治療_金額` | `物販_金額` |

### 8-6. DB補正作業

要対応:
- `flexible_kpis.clinic_name` を `clinic_id` に対応する `clinics.name` で補正する。

ローカル `.env.local` には `SUPABASE_SERVICE_ROLE_KEY` がなく、anon key ではRLSにより `clinics` が0件しか見えなかったため、Codexからは補正未実行。

Supabase SQL Editor 等で以下を実行する:

```sql
SELECT count(*) AS update_target_count
FROM flexible_kpis fk
JOIN clinics c
  ON fk.clinic_id::text = c.id::text
WHERE fk.clinic_name IS DISTINCT FROM c.name;
```

```sql
UPDATE flexible_kpis fk
SET clinic_name = c.name
FROM clinics c
WHERE fk.clinic_id::text = c.id::text
  AND fk.clinic_name IS DISTINCT FROM c.name;
```

```sql
SELECT count(*) AS remaining_mismatch_count
FROM flexible_kpis fk
JOIN clinics c
  ON fk.clinic_id::text = c.id::text
WHERE fk.clinic_name IS DISTINCT FROM c.name;
```

`remaining_mismatch_count = 0` になれば補正完了。

### 8-7. 検証状況

実行済み:
- `npm run build`

結果:
- ビルド成功
- Next.js 16 の既存警告として `middleware` から `proxy` への移行警告あり

未解消:
- `npm run lint` は既存の `any` 型、hooks rule、未使用変数等で多数エラーがある状態。今回の作業ではlint全面修正は未対応。
