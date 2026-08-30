-- メンバーリスト（スタッフマスタ）+ 名寄せ辞書
-- 適用先: Supabase project sbplclvfgrnykojxgvzh (dental-kpi-dashboard)
-- マイグレーション名: create_staff_members_and_aliases
-- ロールバック: docs/migrations/2026-08-31_staff_members_down.sql
--
-- 設計方針（2026-08-31 協議）:
--   - staff_members は 1行 = 1人 × 1所属クリニック。応援先は行を増やして表現する
--     （単一クリニック法人なら 1人1行になるだけで、余計な構造を持たない）
--   - 既存テーブルには一切変更を加えない純粋な追加。NG が出たら down SQL で DROP すれば元に戻る
--   - flexible_kpis への staff_id 付与は今回スコープ外

-- ============================================================
-- ① staff_members : スタッフマスタ
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corporation_id  text NOT NULL,
  clinic_id       text NOT NULL,

  employee_no     text,                       -- 社員番号。法人によっては無い
  affiliation     text NOT NULL DEFAULT 'primary'
                    CHECK (affiliation IN ('primary','support')),

  sei             text,                       -- 姓。取り込みデータに無ければ NULL
  mei             text,                       -- 名。取り込みデータに無ければ NULL
  sei_mei         text NOT NULL,              -- フルネーム。無い場合は姓+半角スペース+名
  -- 照合用の正規化名。NFKC + 空白/中黒/句読点の除去 + 小文字化
  sei_mei_norm    text GENERATED ALWAYS AS (
                    lower(translate(normalize(sei_mei, NFKC), ' 　・.,', ''))
                  ) STORED,

  role            text,                       -- 歯科医師 / 歯科衛生士 / 受付 など
  hired_on        date,
  left_on         date,

  extra_info      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT staff_members_clinic_fkey
    FOREIGN KEY (corporation_id, clinic_id)
    REFERENCES public.clinics (corporation_id, id)
);

-- 一意制約: 社員番号があればそれで、無ければ正規化フルネームで一意にする。
-- （UNIQUE 制約だと NULL 同士が別物扱いになり重複登録できてしまうため式インデックスを使う）
CREATE UNIQUE INDEX IF NOT EXISTS staff_members_uniq
  ON public.staff_members (corporation_id, clinic_id, COALESCE(employee_no, sei_mei_norm));

CREATE INDEX IF NOT EXISTS staff_members_corp_clinic_idx
  ON public.staff_members (corporation_id, clinic_id);
CREATE INDEX IF NOT EXISTS staff_members_norm_idx
  ON public.staff_members (corporation_id, sei_mei_norm);
CREATE INDEX IF NOT EXISTS staff_members_role_idx
  ON public.staff_members (corporation_id, clinic_id, role);

DROP TRIGGER IF EXISTS staff_members_set_updated_at ON public.staff_members;
CREATE TRIGGER staff_members_set_updated_at
  BEFORE UPDATE ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.staff_members IS
  'スタッフマスタ。1行 = 1人 × 1所属クリニック。応援先は affiliation=support の行として持つ。取込は法人単位の DELETE→INSERT。';

-- ============================================================
-- ② staff_name_aliases : 名寄せ辞書
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff_name_aliases (
  id              bigserial PRIMARY KEY,
  corporation_id  text NOT NULL,
  clinic_id       text,                       -- NULL = 法人共通のエイリアス
  raw_name        text NOT NULL,              -- CSV の原文そのまま
  -- 照合キー。NFKC + 空白/中黒/句読点の除去 + 小文字化（敬称・DH の除去はスクリプト側）
  raw_name_norm   text GENERATED ALWAYS AS (
                    lower(translate(normalize(raw_name, NFKC), ' 　・.,', ''))
                  ) STORED,
  staff_role      text,                       -- CSV 側の職種
  staff_id        uuid REFERENCES public.staff_members (id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('confirmed','pending','non_staff')),
  source          text,                       -- 由来 CSV / シート名
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT staff_name_aliases_clinic_fkey
    FOREIGN KEY (corporation_id, clinic_id)
    REFERENCES public.clinics (corporation_id, id),
  -- confirmed なら解決先が必須。non_staff / pending は staff_id NULL 可
  CONSTRAINT staff_name_aliases_confirmed_needs_staff
    CHECK (status <> 'confirmed' OR staff_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_name_aliases_uniq
  ON public.staff_name_aliases (corporation_id, COALESCE(clinic_id, ''), raw_name_norm);

CREATE INDEX IF NOT EXISTS staff_name_aliases_status_idx
  ON public.staff_name_aliases (corporation_id, status);
CREATE INDEX IF NOT EXISTS staff_name_aliases_staff_idx
  ON public.staff_name_aliases (staff_id);

DROP TRIGGER IF EXISTS staff_name_aliases_set_updated_at ON public.staff_name_aliases;
CREATE TRIGGER staff_name_aliases_set_updated_at
  BEFORE UPDATE ON public.staff_name_aliases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.staff_name_aliases IS
  'CSV に現れるスタッフ名の原文 → staff_members の対応表。status: confirmed=確定 / pending=未解決 / non_staff=枠名など個人でないもの。clinic_id NULL は法人共通。';

-- ============================================================
-- ③ RLS
-- ============================================================
ALTER TABLE public.staff_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_name_aliases ENABLE ROW LEVEL SECURITY;

-- 参照は自法人のみ。書き込みは service_role（取込スクリプト）に限定するためポリシーを作らない。
CREATE POLICY staff_members_select_own_corp
  ON public.staff_members FOR SELECT TO authenticated
  USING (corporation_id IN (SELECT p.corporation_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY staff_name_aliases_select_own_corp
  ON public.staff_name_aliases FOR SELECT TO authenticated
  USING (corporation_id IN (SELECT p.corporation_id FROM public.profiles p WHERE p.id = auth.uid()));

-- ============================================================
-- ④ スタッフ削除時にエイリアスを未解決へ戻す
--    FK の ON DELETE SET NULL で staff_id が外れたとき、status='confirmed' のままだと
--    CHECK 制約違反で削除自体が失敗するため、BEFORE UPDATE で pending に落とす。
--    （マイグレーション名: staff_alias_revert_to_pending_on_staff_delete）
-- ============================================================
CREATE OR REPLACE FUNCTION public.staff_alias_revert_to_pending()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.staff_id IS NULL AND OLD.staff_id IS NOT NULL AND NEW.status = 'confirmed' THEN
    NEW.status := 'pending';
    NEW.note := coalesce(NEW.note || ' / ', '') || '解決先スタッフが削除されたため pending に戻した';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_name_aliases_revert_pending ON public.staff_name_aliases;
CREATE TRIGGER staff_name_aliases_revert_pending
  BEFORE UPDATE ON public.staff_name_aliases
  FOR EACH ROW EXECUTE FUNCTION public.staff_alias_revert_to_pending();
