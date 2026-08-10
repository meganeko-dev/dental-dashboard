// クリニックダッシュボードの「比較（Versus）」表示を法人単位で制御するモジュール。
//
// 運用方針 (2026-07-20):
// - 複数医院を持つ法人は既定で「他クリニックとのVersus比較」を表示する
// - ただし法人によっては医院間比較を望まないため、その場合は単独医院法人と同じ
//   「過去対比（前年同月）」へフォールバックさせる
// - 対象クリニックの選択自体は残す（比較対象のプルダウンのみ落とす）
// - 一旦ハードコードで管理。要望が増えた場合は corporations テーブルに
//   `versus_enabled boolean` 列を追加して DB 管理へ移行し、本ファイルは削除する想定

// Versus比較を無効化する法人ID
// - 5UZSCSHH (築明会): 新美歯科と同じ過去対比表示へ統一 (Notion P0-2)
const VERSUS_DISABLED_CORPS: string[] = ['5UZSCSHH']

export const isVersusDisabled = (corpId: string | null | undefined): boolean => {
  if (!corpId) return false
  return VERSUS_DISABLED_CORPS.includes(corpId)
}

// 過去対比（前年同月）表示にするか否か。
// mode==='single' の単独医院法人は元々過去対比のため、それに合流させる。
export const usePastComparison = (
  corpId: string | null | undefined,
  mode: 'single' | 'multi' | null | undefined
): boolean => {
  return mode === 'single' || isVersusDisabled(corpId)
}
