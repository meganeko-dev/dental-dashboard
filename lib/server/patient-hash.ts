import { createHash } from 'node:crypto'

// SHA-256(corporation_id:clinic_id:カルテ番号:KARTE_HASH_SECRET) の hex を返す。
// SECRET が漏洩した場合はローテートし、患者リスト CSV を全件再アップロード必須。
export function hashKarteNumber(
  corporationId: string,
  clinicId: string,
  karteNumber: string,
): string {
  const secret = process.env.KARTE_HASH_SECRET
  if (!secret) {
    throw new Error('KARTE_HASH_SECRET is not set on the server. Add it to .env.local / Vercel env.')
  }
  return createHash('sha256')
    .update(`${corporationId}:${clinicId}:${karteNumber}:${secret}`)
    .digest('hex')
}
