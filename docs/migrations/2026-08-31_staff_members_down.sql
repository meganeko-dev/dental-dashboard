-- ロールバック: 2026-08-31_staff_members_up.sql を取り消す
--
-- 安全性:
--   up は既存テーブルに一切変更を加えていない純粋な追加のため、
--   この DROP で適用前の状態に完全に戻る。flexible_kpis / clinics / patient_snapshots 等は無傷。
--
-- 注意:
--   staff_members / staff_name_aliases に投入済みのデータは失われる。
--   残したい場合は先にエクスポートすること（バックアップ用 SELECT は
--   .claude/skills/member-list-import/SKILL.md の「ロールバック」節を参照）。

BEGIN;

DROP TABLE IF EXISTS public.staff_name_aliases;  -- staff_members を参照しているので先に落とす
DROP TABLE IF EXISTS public.staff_members;
DROP FUNCTION IF EXISTS public.staff_alias_revert_to_pending();

COMMIT;
