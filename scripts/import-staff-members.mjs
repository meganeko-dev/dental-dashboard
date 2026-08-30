#!/usr/bin/env node
// メンバーリスト（スタッフ一覧）CSV を staff_members へ取り込むための SQL を生成する。
//
// 使い方:
//   # Step 1: CSV に出てくる所属クリニック名を一覧する（--clinics 無しで実行）
//   node scripts/import-staff-members.mjs <csv> --corporation TN32FBH8
//
//   # Step 2: クリニック定義を渡して SQL を生成
//   node scripts/import-staff-members.mjs <csv> --corporation TN32FBH8 \
//     --clinics /path/to/clinics.json --out /path/to/import.sql
//
// オプション:
//   --corporation <id>   法人 ID（必須）
//   --clinics <path>     クリニック定義 JSON。省略すると Step 1 モード
//   --out <path>         生成 SQL の出力先。省略すると標準出力
//   --profile <name>     列マッピングのプロファイル名。省略時は法人 ID から自動選択
//   --allow-unresolved   クリニック名が解決できない行があっても SQL を生成する（既定は中断）
//
// clinics.json の形式（Supabase から取得して渡す。詳細は
// .claude/skills/member-list-import/SKILL.md を参照）:
//   {
//     "corporation_id": "TN32FBH8",
//     "clinics": [{ "id": "764", "name": "久喜歯科・矯正歯科" }, ...],
//     "clinic_name_mappings": [{ "key": "川口", "value": "川口歯科・矯正歯科" }, ...]
//   }
//
// 設計メモ:
//   - staff_members は 1行 = 1人 × 1所属クリニック。部署1 が primary、部署2 以降は support
//   - 書き込みは DELETE→INSERT ではなく UPSERT。staff_members.id が保たれるので
//     staff_name_aliases から張った確定リンクが再取込で壊れない
//   - プロファイルに無い CSV 列は捨てずに extra_info(JSONB) へ格納する

import { readFileSync, writeFileSync } from 'node:fs'

// ---- 列マッピングのプロファイル ----
// 法人ごとに CSV のフォーマットが違うため、ここに追加していく。
const PROFILES = {
  shinshinkai: {
    label: '新心会',
    corporations: ['TN32FBH8'],
    employeeNo: '社員番号',
    sei: '姓',
    mei: '名',
    seiMei: null,              // フルネーム列なし → 姓 + 半角スペース + 名 で生成
    role: '職種',
    hiredOn: '入社年月日',
    leftOn: null,
    // 先頭が主所属(primary)、2つ目以降が応援先(support)
    clinicColumns: ['部署1 部署', '部署2 部署', '部署3 部署'],
  },
}

// プロファイルが無い法人向けのフォールバック。よくある列名を総当たりで探す。
const GENERIC_CANDIDATES = {
  employeeNo: ['社員番号', '職員番号', 'スタッフID', 'ID'],
  sei:        ['姓', '苗字', '氏'],
  mei:        ['名', '名前(名)'],
  seiMei:     ['氏名', '氏名(フルネーム)', 'スタッフ名', '名前', 'フルネーム'],
  role:       ['職種', '役職', 'role'],
  hiredOn:    ['入社年月日', '入社日', '雇用開始日'],
  leftOn:     ['退職年月日', '退職日', '雇用終了日'],
}
const GENERIC_CLINIC_CANDIDATES = ['所属', '所属クリニック', '医院', 'クリニック', '部署', '院']

// ---- CLI ----
const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : null
}
const has = (name) => args.includes(`--${name}`)

const csvPath        = args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'))
const corporationId  = flag('corporation')
const clinicsPath    = flag('clinics')
const outPath        = flag('out')
const profileName    = flag('profile')
const allowUnresolved = has('allow-unresolved')

const die = (msg) => { console.error(`[error] ${msg}`); process.exit(2) }

if (!csvPath)       die('CSV ファイルのパスを指定してください')
if (!corporationId) die('--corporation <法人ID> は必須です')

// ---- CSV パーサ（RFC4180 準拠の最小実装。BOM / CRLF / 引用符内の改行に対応）----
const parseCsv = (text) => {
  const src = text.replace(/^﻿/, '')
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (ch === '\r') { /* CRLF の CR は読み飛ばす */ }
    else field += ch
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

// ---- 正規化 ----
// DB 側の生成カラム lower(translate(normalize(x, NFKC), ' 　・.,', '')) と一致させる
const normText = (s) =>
  (s ?? '').normalize('NFKC').replace(/[\s　]/g, '').replace(/[・.,]/g, '').toLowerCase()

// クリニック名照合用。上記に加えて各種アポストロフィを ' に統一する
// （DB 側に I'S と I’S が混在しているため）
const normClinic = (s) => normText(s).replace(/[’‘'`´]/g, "'")

const parseDate = (s) => {
  const v = (s ?? '').trim()
  if (!v) return null
  const m = v.match(/^(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/)
  if (!m) return null
  return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
}

// ---- プロファイル選択 ----
const pickProfile = (headers) => {
  if (profileName) {
    const p = PROFILES[profileName]
    if (!p) die(`プロファイル '${profileName}' が見つかりません（定義済み: ${Object.keys(PROFILES).join(', ')}）`)
    return p
  }
  const byCorp = Object.values(PROFILES).find(p => p.corporations?.includes(corporationId))
  if (byCorp) return byCorp

  // フォールバック: ヘッダ名から推測する
  const find = (cands) => cands.find(c => headers.includes(c)) ?? null
  const clinicColumns = headers.filter(h => GENERIC_CLINIC_CANDIDATES.some(c => h.includes(c)))
  const guessed = {
    label: `(自動推定 / ${corporationId})`,
    employeeNo: find(GENERIC_CANDIDATES.employeeNo),
    sei:        find(GENERIC_CANDIDATES.sei),
    mei:        find(GENERIC_CANDIDATES.mei),
    seiMei:     find(GENERIC_CANDIDATES.seiMei),
    role:       find(GENERIC_CANDIDATES.role),
    hiredOn:    find(GENERIC_CANDIDATES.hiredOn),
    leftOn:     find(GENERIC_CANDIDATES.leftOn),
    clinicColumns,
  }
  if (!guessed.sei && !guessed.seiMei) {
    die(`氏名の列を特定できません。ヘッダ: ${headers.join(' | ')}\n` +
        `PROFILES に ${corporationId} 用の定義を追加してください（scripts/import-staff-members.mjs 冒頭）`)
  }
  return guessed
}

// ---- 読み込み ----
let rows
try { rows = parseCsv(readFileSync(csvPath, 'utf8')) }
catch (e) { die(`CSV を読めません: ${csvPath}\n${e.message}`) }
if (rows.length < 2) die('CSV にデータ行がありません')

const headers = rows[0].map(h => h.trim())
const records = rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])))
const profile = pickProfile(headers)

console.error(`[info] CSV        : ${csvPath}`)
console.error(`[info] 法人        : ${corporationId}`)
console.error(`[info] プロファイル: ${profile.label}`)
console.error(`[info] データ行数  : ${records.length}`)
console.error(`[info] 所属クリニック列: ${profile.clinicColumns.join(' , ') || '(なし)'}`)

// プロファイルが使っていない列は extra_info へ回す
const consumed = new Set([
  profile.employeeNo, profile.sei, profile.mei, profile.seiMei,
  profile.role, profile.hiredOn, profile.leftOn, ...profile.clinicColumns,
].filter(Boolean))
const extraColumns = headers.filter(h => h && !consumed.has(h))
if (extraColumns.length) console.error(`[info] extra_info へ格納: ${extraColumns.join(' , ')}`)

// ---- Step 1: クリニック定義が無ければ部署名を一覧して終了 ----
const deptNames = new Map()   // 原文 -> 出現回数
for (const rec of records) {
  for (const col of profile.clinicColumns) {
    const v = (rec[col] ?? '').trim()
    if (v) deptNames.set(v, (deptNames.get(v) ?? 0) + 1)
  }
}

if (!clinicsPath) {
  console.error('')
  console.error('[step1] CSV に出てくる所属クリニック名は以下のとおりです。')
  console.error('[step1] これを解決するための clinics.json を用意して --clinics で渡してください。')
  console.error('')
  const out = [...deptNames.entries()].sort((a, b) => b[1] - a[1])
  for (const [name, n] of out) console.log(`${n}\t${name}\t${normClinic(name)}`)
  console.error('')
  console.error(`[step1] 計 ${out.length} 種類`)
  process.exit(0)
}

// ---- クリニック名の解決 ----
let clinicDef
try { clinicDef = JSON.parse(readFileSync(clinicsPath, 'utf8')) }
catch (e) { die(`clinics.json を読めません: ${clinicsPath}\n${e.message}`) }

if (clinicDef.corporation_id && clinicDef.corporation_id !== corporationId) {
  die(`clinics.json の corporation_id (${clinicDef.corporation_id}) が --corporation (${corporationId}) と一致しません`)
}
const clinics = clinicDef.clinics ?? []
if (!clinics.length) die('clinics.json に clinics が入っていません')

const byNorm = new Map()
for (const c of clinics) {
  const k = normClinic(c.name)
  if (!byNorm.has(k)) byNorm.set(k, [])
  byNorm.get(k).push(c)
}
const aliasToName = new Map()
for (const m of clinicDef.clinic_name_mappings ?? []) aliasToName.set(normClinic(m.key), m.value)

// 解決の優先順: ① 正規化完全一致 ② 既存の clinic_name_mapping ③ 前方一致（候補が1件のときのみ）
const resolveClinic = (raw) => {
  const key = normClinic(raw)

  const exact = byNorm.get(key)
  if (exact?.length === 1) return { clinic: exact[0], how: '正規化一致' }
  if (exact?.length > 1)   return { error: `DB 側に同名クリニックが複数: ${exact.map(c => c.id).join(', ')}` }

  const mapped = aliasToName.get(key)
  if (mapped) {
    const hit = byNorm.get(normClinic(mapped))
    if (hit?.length === 1) return { clinic: hit[0], how: `clinic_name_mapping 経由 (${mapped})` }
  }

  const partial = clinics.filter(c => {
    const k = normClinic(c.name)
    return k.startsWith(key) || key.startsWith(k)
  })
  if (partial.length === 1) return { clinic: partial[0], how: '前方一致' }
  if (partial.length > 1)   return { error: `前方一致の候補が複数: ${partial.map(c => c.name).join(' / ')}` }

  return { error: '一致するクリニックなし' }
}

const resolution = new Map()
for (const name of deptNames.keys()) resolution.set(name, resolveClinic(name))

console.error('')
console.error('[clinic] 所属クリニック名の解決結果')
for (const [name, r] of [...resolution.entries()].sort()) {
  if (r.clinic) console.error(`  OK   ${name}  ->  ${r.clinic.id} ${r.clinic.name}  [${r.how}]`)
  else          console.error(`  NG   ${name}  ->  ${r.error}`)
}
const unresolved = [...resolution.entries()].filter(([, r]) => !r.clinic)
if (unresolved.length) {
  console.error('')
  console.error(`[clinic] ${unresolved.length} 件のクリニック名が解決できませんでした。`)
  console.error('[clinic] clinics.json の clinic_name_mappings に対応を追加するか、')
  console.error('[clinic] 意図的に無視する場合は --allow-unresolved を付けてください。')
  if (!allowUnresolved) process.exit(1)
}

// ---- 行の組み立て ----
const sqlStr = (v) => v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`

const staffRows = []
const skipped = []
for (const [i, rec] of records.entries()) {
  const sei = profile.sei ? (rec[profile.sei] || null) : null
  const mei = profile.mei ? (rec[profile.mei] || null) : null
  // 素案どおり: フルネーム列があればそれを優先し、無ければ姓+半角スペース+名で生成
  let seiMei = profile.seiMei ? (rec[profile.seiMei] || '') : ''
  if (!seiMei) seiMei = [sei, mei].filter(Boolean).join(' ')
  if (!seiMei) { skipped.push({ line: i + 2, reason: '氏名が空' }); continue }

  const extra = {}
  for (const col of extraColumns) if (rec[col]) extra[col] = rec[col]

  const depts = profile.clinicColumns.map(c => (rec[c] ?? '').trim()).filter(Boolean)
  if (!depts.length) { skipped.push({ line: i + 2, reason: `所属クリニックが空 (${seiMei})` }); continue }

  // 部署1/2/3 が同じクリニックに解決されることがある（表記違いなど）。
  // UPSERT は同一ステートメント内で同じ行を二度更新できないため、ここで重複を落とす。
  // 先に現れたほう（= 部署1 = primary）を優先する。
  const seenClinics = new Set()
  for (const [order, dept] of depts.entries()) {
    const r = resolution.get(dept)
    if (!r?.clinic) { skipped.push({ line: i + 2, reason: `クリニック未解決: ${dept} (${seiMei})` }); continue }
    if (seenClinics.has(r.clinic.id)) {
      skipped.push({ line: i + 2, reason: `所属クリニック重複のため無視: ${dept} -> ${r.clinic.id} (${seiMei})` })
      continue
    }
    seenClinics.add(r.clinic.id)
    staffRows.push({
      clinic_id: r.clinic.id,
      employee_no: profile.employeeNo ? (rec[profile.employeeNo] || null) : null,
      affiliation: order === 0 ? 'primary' : 'support',
      sei, mei, sei_mei: seiMei,
      role: profile.role ? (rec[profile.role] || null) : null,
      hired_on: profile.hiredOn ? parseDate(rec[profile.hiredOn]) : null,
      left_on:  profile.leftOn  ? parseDate(rec[profile.leftOn])  : null,
      extra_info: extra,
    })
  }
}

console.error('')
console.error(`[build] staff_members に投入する行数: ${staffRows.length}`)
console.error(`[build]   うち primary: ${staffRows.filter(r => r.affiliation === 'primary').length}`)
console.error(`[build]   うち support: ${staffRows.filter(r => r.affiliation === 'support').length}`)
if (skipped.length) {
  console.error(`[build] スキップ ${skipped.length} 件:`)
  for (const s of skipped) console.error(`  line ${s.line}: ${s.reason}`)
}
if (!staffRows.length) die('投入する行がありません')

// 別人同士でもキーが衝突していないか最終確認（社員番号の重複、社員番号なしの同姓同名など）
const seenKeys = new Map()
const dupKeys = []
for (const r of staffRows) {
  const key = `${r.clinic_id}\u0000${r.employee_no ?? normText(r.sei_mei)}`
  if (seenKeys.has(key)) dupKeys.push(`${r.clinic_id} / ${r.employee_no ?? r.sei_mei}: ${seenKeys.get(key)} と ${r.sei_mei}`)
  else seenKeys.set(key, r.sei_mei)
}
if (dupKeys.length) {
  console.error('')
  console.error('[error] 同一クリニック内でキーが重複しています。このまま流すと UPSERT が失敗します:')
  for (const d of dupKeys) console.error(`  ${d}`)
  console.error('[error] CSV の社員番号を確認するか、社員番号の無い法人では氏名の重複を解消してください。')
  process.exit(1)
}

// ---- SQL 生成 ----
const values = staffRows.map(r => '  (' + [
  sqlStr(corporationId), sqlStr(r.clinic_id), sqlStr(r.employee_no), sqlStr(r.affiliation),
  sqlStr(r.sei), sqlStr(r.mei), sqlStr(r.sei_mei), sqlStr(r.role),
  r.hired_on ? `${sqlStr(r.hired_on)}::date` : 'NULL',
  r.left_on  ? `${sqlStr(r.left_on)}::date`  : 'NULL',
  `${sqlStr(JSON.stringify(r.extra_info))}::jsonb`,
].join(', ') + ')').join(',\n')

const sql = `-- scripts/import-staff-members.mjs が生成
-- 生成日時 : ${new Date().toISOString()}
-- 入力CSV  : ${csvPath}
-- 法人      : ${corporationId}
-- 行数      : ${staffRows.length}
--
-- DELETE→INSERT ではなく UPSERT。staff_members.id が保たれるため、
-- staff_name_aliases から張った確定リンクが再取込で壊れない。

BEGIN;

INSERT INTO public.staff_members
  (corporation_id, clinic_id, employee_no, affiliation, sei, mei, sei_mei, role, hired_on, left_on, extra_info)
VALUES
${values}
ON CONFLICT (corporation_id, clinic_id, COALESCE(employee_no, sei_mei_norm))
DO UPDATE SET
  affiliation = EXCLUDED.affiliation,
  sei         = EXCLUDED.sei,
  mei         = EXCLUDED.mei,
  sei_mei     = EXCLUDED.sei_mei,
  role        = EXCLUDED.role,
  hired_on    = EXCLUDED.hired_on,
  left_on     = EXCLUDED.left_on,
  extra_info  = EXCLUDED.extra_info,
  updated_at  = now();

-- 取込後の確認
SELECT clinic_id, affiliation, count(*)
FROM public.staff_members
WHERE corporation_id = ${sqlStr(corporationId)}
GROUP BY 1, 2 ORDER BY 1, 2;

COMMIT;
`

if (outPath) { writeFileSync(outPath, sql, 'utf8'); console.error(`\n[done] SQL を書き出しました: ${outPath}`) }
else console.log(sql)
