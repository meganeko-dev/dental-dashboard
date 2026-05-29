// ダッシュボード（クリニックビュー / スタッフビュー / レポート）のプルダウン・一覧から
// 非表示にしたいクリニックを定義するモジュール。
//
// 運用方針 (2026-05-26):
// - clinics テーブルから物理削除は行わない（過去データの参照や Admin の取込機能は維持）
// - 非表示はあくまで「ダッシュボード UI 上の表示抑止」であり、DB クエリ自体は実行される
// - 一旦ハードコードで管理。非表示要望が増えた場合は clinics テーブルに `is_disabled boolean`
//   列を追加して論理削除へ移行し、本ファイルは削除する想定

export type HiddenClinic = {
  corporation_id: string
  clinic_id: string
  clinic_name: string
}

export const HIDDEN_CLINICS: HiddenClinic[] = [
  { corporation_id: 'TN32FBH8', clinic_id: '846', clinic_name: 'あい歯科クリニック　田奈' },
  { corporation_id: 'TN32FBH8', clinic_id: '900', clinic_name: 'セレッソオーラルケアクリニック' },
  { corporation_id: '5UZSCSHH', clinic_id: '783', clinic_name: 'アバンダンスデンタル名古屋' },
]

export const isHiddenClinicById = (corpId: string, clinicId: string | number | null | undefined): boolean => {
  if (clinicId === null || clinicId === undefined) return false
  const id = String(clinicId)
  return HIDDEN_CLINICS.some(h => h.corporation_id === corpId && h.clinic_id === id)
}

// clinic_id を取得しないクエリ用 (例: unique_staff_options で clinic_name のみ持つケース)
export const isHiddenClinicByName = (corpId: string, clinicName: string | null | undefined): boolean => {
  if (!clinicName) return false
  return HIDDEN_CLINICS.some(h => h.corporation_id === corpId && h.clinic_name === clinicName)
}
