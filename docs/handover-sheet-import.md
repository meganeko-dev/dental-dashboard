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
