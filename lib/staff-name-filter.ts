// 予約システム由来のCSV/Excelで「スタッフ名」欄に現れる、実在スタッフではない値を除外するモジュール。
//
// 背景 (2026-07-20):
// - 予約システムは「予約枠」そのものを担当者として登録するため、スタッフ名欄に
//   'SP/チェック' '初診' '枠外急患' といった枠名が混入する
// - 月ごとのStats.csv では多くの医院でこれらが「〜担当）その他」に分類されるが、
//   803医院の'枠外急患'・920医院の'初診'は「〜担当）歯科医師」に入っており、
//   職種による除外だけでは取りこぼす。そのため名前による除外も併用する
// - 'DH8' 'D11' のような匿名コードは名寄せ不能なため対象外とする (Notion 5.2)
//
// 除外しないもの（実在スタッフのため）:
// - '梶' '戸羽' … 姓のみ表記だが実在の歯科医師
// - '小熊【ジュエリー】' … サフィックス付きだが実在の歯科衛生士

// 予約枠を表す固定値
const NON_STAFF_SLOT_NAMES = new Set([
  'SP/チェック',
  '初診',
  '枠外急患',
])

// 匿名コード (DH8 / DH10 / D11 など)
const ANONYMOUS_CODE_PATTERN = /^D[A-Z]*\d+$/

export const isNonStaffName = (name: string | null | undefined): boolean => {
  if (!name) return true
  const trimmed = String(name).trim()
  if (trimmed === '') return true
  if (NON_STAFF_SLOT_NAMES.has(trimmed)) return true
  if (ANONYMOUS_CODE_PATTERN.test(trimmed)) return true
  return false
}
