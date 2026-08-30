---
name: member-list-import
description: 法人のメンバーリスト（スタッフ一覧）CSV を staff_members テーブルへ取り込む。新しい法人のスタッフ名簿を渡された、既存法人の名簿を更新したい、スタッフ名の表記ゆれ(名寄せ)を解決したい、staff_name_aliases の pending を確定したい、といったときに使う。
---

# メンバーリスト取り込み

法人ごとにフォーマットの違うスタッフ名簿（CSV / xlsx）を `staff_members` に取り込み、
KPI データ側のスタッフ名表記と紐付ける（名寄せ）ための手順。

**この作業は稀にしか発生せず、毎回ユーザーとの協議が必要。勝手に本番へ投入しない。**

## 前提となるテーブル

| テーブル | 役割 |
|---|---|
| `staff_members` | スタッフマスタ。**1行 = 1人 × 1所属クリニック**。応援先は `affiliation='support'` の行として増やす |
| `staff_name_aliases` | CSV に出てくる名前の原文 → `staff_members.id` の対応表。`status` は `confirmed` / `pending` / `non_staff` |

スキーマの全文と設計意図: `docs/migrations/2026-08-31_staff_members_up.sql`

重要な性質:
- 取込は **UPSERT**（DELETE→INSERT ではない）。`staff_members.id` が保たれるので、
  確定済みのエイリアスが再取込で壊れない
- 一意キーは `(corporation_id, clinic_id, COALESCE(employee_no, sei_mei_norm))`。
  社員番号があればそれで、無ければ正規化フルネームで一意にする
- `clinic_id` は `clinics(corporation_id, id)` への外部キー。存在しない院は DB が弾く
- 書き込みポリシーは無い（参照のみ）。投入は service_role か MCP 経由で行う

## 手順

### 1. CSV の構造を確認し、ユーザーと列マッピングを合意する

`scripts/import-staff-members.mjs` 冒頭の `PROFILES` に法人ごとの列定義がある。
未登録の法人なら、ヘッダを見てユーザーに以下を確認してからプロファイルを追加する。

- 姓 / 名 / フルネームはどの列か（フルネーム列があればそれを優先し、無ければ姓+半角スペース+名で生成）
- 社員番号に相当する列はあるか（**無い場合は氏名が一意キーになる**ので、同姓同名が居ないか要確認）
- 所属クリニックはどの列か。**複数列ある場合、先頭が主所属 (primary)、2列目以降が応援先 (support)**
- 職種 / 入社日 / 退職日の列
- プロファイルに載せなかった列は `extra_info` (JSONB) に自動で入る。捨てられはしない

### 2. 所属クリニック名を一覧する

```bash
node scripts/import-staff-members.mjs <csv|xlsx> --corporation <法人ID>
```

`--clinics` を省くと、入力に出てくるクリニック名と正規化キーだけを出力して終わる。

xlsx は依存ライブラリ無しで直接読める（CSV 変換は不要）。複数シートがある場合は既定で
全シートを縦に連結する（2枚目以降のヘッダ行は捨てる）。`--sheet <名前>` で1枚に絞れる。

### 3. クリニック定義 JSON を DB から作る

Supabase MCP で以下を実行し、結果を JSON ファイルに保存する（**毎回取り直す。古いダンプを使い回さない**）。

```sql
select jsonb_build_object(
  'corporation_id', '<法人ID>',
  'clinics', (select jsonb_agg(jsonb_build_object('id',id,'name',name) order by id)
              from clinics where corporation_id='<法人ID>'),
  'clinic_name_mappings', (select jsonb_agg(jsonb_build_object('key',key,'value',value) order by key)
              from data_mappings where corporation_id='<法人ID>' and mapping_type='clinic_name_mapping')
)::text;
```

クリニック名の解決は ① 正規化完全一致 → ② 既存の `clinic_name_mapping` → ③ 前方一致（候補1件のみ）の順。
全角/半角、`Ｉ’ｓ` と `I'S` の差、`・` の有無は正規化で吸収される。

### 4. SQL を生成する

```bash
node scripts/import-staff-members.mjs <csv> --corporation <法人ID> \
  --clinics <clinics.json> --out <出力先.sql>
```

解決できないクリニック名が1つでもあれば **exit 1 で止まる**。握りつぶさず、
`clinic_name_mappings` に対応を足すかユーザーに確認すること
（意図的に無視するときだけ `--allow-unresolved`）。

出力レポートの primary / support 件数がユーザーの想定と合うか必ず突き合わせる。

### 5. 投入前にユーザーへ内容を提示して承認を得る

**架空データ・テストデータを本番に投入しない。** サンプルとして渡された名簿は
検証だけして ROLLBACK する。投入するのは実名簿だと確認できたときのみ。

検証は MCP で `BEGIN; ... ROLLBACK;` に包んで実行する。同じ INSERT を2回流して
行数が増えないこと（UPSERT のべき等性）と `id` が保たれることを確認するとよい。

### 6. 名寄せ（staff_name_aliases）

KPI 側の表記は `flexible_kpis.staff_name` にあり、`staff_role` 列（歯科医師 / 歯科衛生士 / 受付）が
100% 埋まっている。照合キーは **(clinic_id, staff_role, 姓)**。

自動確定できるもの:
- 敬称: `佐藤院長` `上里先生` → 敬称を外す。`先生`/`院長`/`Dr` が付くのは歯科医師のみ
- 職種プレフィックス/サフィックス: `DH小林悠` `上野DH` → `DH` は歯科衛生士
- 記号・絵文字: `中島先生🍐` `丹沢①`
- **異体字**: `澤/沢` `檜/桧` `雜/雑` `髙/高` `﨑/崎` `邊邉/辺` `齋齊/斉` `濵/浜` `栁/柳` `瀨/瀬` `眞/真`
  を同一視する。新心会では丹澤/丹沢・檜山/桧山・雜敷/雑敷 の揺れが実在した

人の判断が必要なもの（`pending` に積んでユーザーと協議する）:
- 同一クリニック・同一職種に同姓が複数いる場合
- 連番表記 `丹沢①` `丹沢②` がそれぞれ誰か
- カタカナ表記 `イシカワ`、あだ名 `ほっちDH`
- 1欄に2人入っているペア表記: `窪田_DH(柳瀬_Dr2)` `濱本・三ヶ尻`（築明会に多い）

個人ではない枠名は `status='non_staff'` で登録する（`初診/急患` `フリー` `SPSR` `SP.抜糸/チェック` など)。
`clinic_id` を NULL にすると法人共通で効く。
なお `lib/staff-name-filter.ts` に同種の除外リストがハードコードされているので、
将来的にはそちらをこのテーブルに寄せる。

## 実績（新心会 TN32FBH8 / 2026-08-31）

初回取込の結果。次回以降の目安として残す。

| | |
|---|---|
| 名簿 | 348名（新心会シート233 / HACHIシート115）→ `staff_members` **370行**（primary 321 / support 49、22クリニック） |
| クリニック名解決 | 31種中27種。未解決4種29名分は取込対象外とした（`あい歯科クリニック上溝` `進心会管理部` `目黒駅前セントラル歯科` `医療法人社団　新心会　事務局`） |
| 名寄せ | KPI側の表記323件 → confirmed 175 (54%) / pending 125 (39%) / non_staff 23 (7%) |

取込前の一致率は13%（`docs/name-analysis/新心会_名前リスト.csv`）だった。

pending の主な内訳と、次に効きそうな手:
- **名簿に無い医院**: `ららぽーと富士見I'S` `きんしちょう駅前歯科` `八王子みなみ野I'S` `目黒I'S` `大森マチノマ歯科`。
  名簿がグループ全体をカバーしていない。クライアントに追加提供を依頼するのが最短
- **応援先が名簿に未反映**: 同一人物が KPI 上は別院で稼働しているが、名簿の部署1/2/3 にその院が無い。
  例: `町田　宏樹` `青山　晟也` `菅原　優花` `戸津　直哉` は名簿では久喜(764)だが KPI はさいたま(763)
- **表記の揺れ**: `熊谷　裕菜`(KPI) と `熊谷 祐菜`(名簿)、`神谷　駿太郎`(KPI) と `神谷 駿太朗`(名簿) など、
  どちらかが誤記。異体字テーブルでは吸収できないので個別確認が要る

## ロールバック

### データだけ戻す

再取込は UPSERT なので、正しい CSV で流し直せば直る。投入前の状態を残したいときは先にエクスポートする。

```sql
select * from staff_members     where corporation_id = '<法人ID>';
select * from staff_name_aliases where corporation_id = '<法人ID>';
```

特定法人の行を消す場合（エイリアスは自動で `pending` に戻る）:

```sql
delete from staff_members where corporation_id = '<法人ID>';
```

### テーブルごと戻す

クライアントから設計 NG が出た場合。up は既存テーブルに一切変更を加えていない純粋な追加なので、
DROP すれば適用前の状態に完全に戻る（`flexible_kpis` などは無傷）。

```
docs/migrations/2026-08-31_staff_members_down.sql
```

## 注意

- `staff_members` / `staff_name_aliases` への書き込みポリシーは無い。アプリからは参照のみ
- 退職者を消すと、その人を指す `confirmed` なエイリアスはトリガで `pending` に戻る（削除は失敗しない）
- 生成 SQL・クリニック定義 JSON は作業用ファイル。リポジトリにコミットしない
- **名簿は実在スタッフの個人情報**。作業用ファイルをリポジトリや外部サービスへ出さない
- Excel は整数を `25.0` のように書き出すことがある。社員番号がこの形で入るためスクリプト側で
  小数部を落としている（HACHI シートで実際に発生した）
