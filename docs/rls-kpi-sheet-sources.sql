-- kpi_sheet_sources の RLS 有効化ポリシー
-- 適用先: Supabase project sbplclvfgrnykojxgvzh (dental-kpi-dashboard)
-- マイグレーション名案: enable_rls_kpi_sheet_sources
--
-- 前提:
--   - このテーブルを読むのは scripts/import-sheet-kpis.mjs のみで、
--     service_role キー（RLS をバイパス）を使用する → 取り込みは影響を受けない
--   - app / lib / components からの参照は無し（ブラウザは触らない）
--   ⇒ anon には一切許可せず、authenticated には自法人の行の読み取りのみ許可する

BEGIN;

ALTER TABLE public.kpi_sheet_sources ENABLE ROW LEVEL SECURITY;

-- 自法人の行のみ SELECT 可（将来 admin 画面から参照する場合に備える）
-- 既存テーブル（data_mappings 等）と同じ profiles 経由の判定パターン
DROP POLICY IF EXISTS kpi_sheet_sources_select_own_corp ON public.kpi_sheet_sources;
CREATE POLICY kpi_sheet_sources_select_own_corp
  ON public.kpi_sheet_sources
  FOR SELECT
  TO authenticated
  USING (
    corporation_id IN (
      SELECT p.corporation_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- INSERT / UPDATE / DELETE のポリシーは意図的に作らない。
-- 書き込みは service_role（取り込みスクリプト）と Supabase ダッシュボードのみに限定する。
-- anon ロールにはポリシーが 1 つも無いため、全操作が拒否される。

COMMIT;
