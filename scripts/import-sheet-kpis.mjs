#!/usr/bin/env node
// Google スプレッドシートの "メンテナンス" / "離脱" シートを読み取り
// flexible_kpis テーブルへ upsert する取り込みスクリプト。
//
// 使い方:
//   node scripts/import-sheet-kpis.mjs              # kpi_sheet_sources 全法人を取り込み
//   node scripts/import-sheet-kpis.mjs TN32FBH8     # 特定法人のみ取り込み
//   node scripts/import-sheet-kpis.mjs --dry-run    # DBに書き込まず件数のみ表示
//
// 必須環境変数:
//   SUPABASE_URL                 例: https://xxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    service_role キー（RLS 回避・書き込み権限あり）
//   GOOGLE_SA_KEY_PATH           GCP サービスアカウント JSON（省略時 ~/.gcp/keys/claude-sheets-sa.json）
//
// 取り込み元:
//   kpi_sheet_sources テーブルに登録された corporation_id × spreadsheet_id から取得

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { createSign } from 'node:crypto'
import { resolve } from 'node:path'

// ---- 設定 ----
const SHEET_MAINTENANCE = 'メンテナンス'
const SHEET_CHURN       = '離脱'

const SUPABASE_URL  = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const GCP_KEY_PATH  = process.env.GOOGLE_SA_KEY_PATH
  ?? resolve(homedir(), '.gcp/keys/claude-sheets-sa.json')

const UPSERT_CHUNK = 500

// ---- CLI 引数 ----
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const targetCorp = args.find(a => !a.startsWith('--'))

if (!SUPABASE_URL)  { console.error('[error] SUPABASE_URL が未設定');  process.exit(2) }
if (!SERVICE_ROLE && !dryRun) { console.error('[error] SUPABASE_SERVICE_ROLE_KEY が未設定（--dry-run なら不要）'); process.exit(2) }

// ---- Google Sheets 認証 ----
let sa
try {
  sa = JSON.parse(readFileSync(GCP_KEY_PATH, 'utf8'))
} catch (e) {
  console.error(`[error] サービスアカウントキーを読めません: ${GCP_KEY_PATH}`)
  console.error(e.message)
  process.exit(1)
}

const base64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

let cachedToken = null
let cachedTokenExp = 0
const getAccessToken = async () => {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && now < cachedTokenExp - 60) return cachedToken

  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const segments = [base64url(JSON.stringify(header)), base64url(JSON.stringify(claims))]
  const signer = createSign('RSA-SHA256')
  signer.update(segments.join('.'))
  signer.end()
  const sig = signer.sign(sa.private_key)
  const jwt = segments.concat(base64url(sig)).join('.')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`token request failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  cachedToken = json.access_token
  cachedTokenExp = now + (json.expires_in ?? 3600)
  return cachedToken
}

const readSheetRange = async (spreadsheetId, range) => {
  const token = await getAccessToken()
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?majorDimension=ROWS`
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  const text = await res.text()
  if (!res.ok) throw new Error(`sheets api failed: ${res.status} ${text}`)
  return JSON.parse(text).values ?? []
}

// ---- Supabase REST ヘルパ ----
const supaFetch = async (path, init = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE,
      authorization: `Bearer ${SERVICE_ROLE}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`supabase ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

// ---- 値パース ----
const parseNum = (s) => {
  if (s === null || s === undefined || s === '') return null
  const n = Number(String(s).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}
const parseYm = (s) => {
  const m = String(s ?? '').match(/^(\d{4})[\/\-](\d{1,2})/)
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]) }
}
const monthFirstDate = (year, month) =>
  `${year}-${String(month).padStart(2, '0')}-01`

// ---- メンテナンスシート変換 ----
// C列: メンテ | 予約数 | 来院数
const MAINTENANCE_KPI_MAP = {
  'メンテ':   'メンテナンス数',
  '予約数':   '予約人数_既存患者',
  '来院数':   '来院数',
}

const transformMaintenance = (rows, corpId, clinicIdToName) => {
  if (rows.length < 2) return []
  const header = rows[0]
  const ymCols = header.slice(3).map(parseYm) // D列以降
  const out = []

  for (const row of rows.slice(1)) {
    const clinicId = String(row[0] ?? '').trim()
    if (!clinicId) continue
    const category = String(row[2] ?? '').trim()
    const kpi = MAINTENANCE_KPI_MAP[category]
    if (!kpi) continue
    const clinicName = clinicIdToName.get(clinicId)
    if (!clinicName) {
      console.warn(`[warn] clinic_id=${clinicId} が clinics に未登録のためスキップ (メンテナンス)`)
      continue
    }
    for (let i = 0; i < ymCols.length; i++) {
      const ym = ymCols[i]
      if (!ym) continue
      const val = parseNum(row[i + 3])
      if (val === null) continue
      out.push({
        year: ym.year,
        month: ym.month,
        segment: 'clinic',
        clinic_name: clinicName,
        staff_name: '',
        kpi_name: kpi,
        value: val,
        is_target: false,
        date: monthFirstDate(ym.year, ym.month),
        corporation_id: corpId,
        clinic_id: clinicId,
        treatment_type: '',
        staff_role: '',
      })
    }
  }
  return out
}

// ---- 離脱シート変換 ----
// (C列, D列) の組合せで kpi_name を決定
const churnKpi = (c, d) => {
  if (c === '患者数' && d === '')      return '患者数'
  if (c === 'メンテ'  && d === '離脱数')  return 'メンテナンス_離脱数'
  if (c === 'メンテ'  && d === '未予約数') return 'メンテナンス_未予約数'
  if (c === '治療'    && d === '離脱数')  return '治療_離脱数'
  if (c === '治療'    && d === '未予約数') return '治療_未予約数'
  return null  // (メンテ,'') (治療,'') その他はスキップ
}

const transformChurn = (rows, corpId, clinicIdToName) => {
  if (rows.length < 2) return []
  const header = rows[0]
  const ymCols = header.slice(4).map(parseYm) // E列以降
  const out = []

  for (const row of rows.slice(1)) {
    const clinicId = String(row[0] ?? '').trim()
    if (!clinicId) continue
    const category = String(row[2] ?? '').trim()
    const status   = String(row[3] ?? '').trim()
    const kpi = churnKpi(category, status)
    if (!kpi) continue
    const clinicName = clinicIdToName.get(clinicId)
    if (!clinicName) {
      console.warn(`[warn] clinic_id=${clinicId} が clinics に未登録のためスキップ (離脱)`)
      continue
    }
    for (let i = 0; i < ymCols.length; i++) {
      const ym = ymCols[i]
      if (!ym) continue
      const val = parseNum(row[i + 4])
      if (val === null) continue
      out.push({
        year: ym.year,
        month: ym.month,
        segment: 'clinic',
        clinic_name: clinicName,
        staff_name: '',
        kpi_name: kpi,
        value: val,
        is_target: false,
        date: monthFirstDate(ym.year, ym.month),
        corporation_id: corpId,
        clinic_id: clinicId,
        treatment_type: '',
        staff_role: '',
      })
    }
  }
  return out
}

// ---- flexible_kpis への upsert ----
const upsertRows = async (rows) => {
  if (rows.length === 0) return 0
  const onConflict = 'corporation_id,clinic_name,staff_name,year,month,date,segment,kpi_name,is_target,treatment_type,staff_role'
  let total = 0
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK)
    await supaFetch(`/flexible_kpis?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(chunk),
    })
    total += chunk.length
    console.log(`  upserted ${total}/${rows.length}`)
  }
  return total
}

// ---- 法人ごとの処理 ----
const processCorporation = async (source) => {
  const { corporation_id, spreadsheet_id } = source
  console.log(`\n=== ${corporation_id} (${spreadsheet_id}) ===`)

  // clinics マッピングを取得
  const clinics = await supaFetch(`/clinics?corporation_id=eq.${corporation_id}&select=id,name`)
  const clinicIdToName = new Map(clinics.map(c => [String(c.id), c.name]))
  console.log(`  clinics: ${clinicIdToName.size}件`)

  // メンテナンス
  let maintenanceRows = []
  try {
    const raw = await readSheetRange(spreadsheet_id, `${SHEET_MAINTENANCE}!A1:AZ200`)
    maintenanceRows = transformMaintenance(raw, corporation_id, clinicIdToName)
    console.log(`  ${SHEET_MAINTENANCE}: ${maintenanceRows.length}行`)
  } catch (e) {
    console.error(`  [warn] ${SHEET_MAINTENANCE} 読取失敗: ${e.message}`)
  }

  // 離脱
  let churnRows = []
  try {
    const raw = await readSheetRange(spreadsheet_id, `${SHEET_CHURN}!A1:AZ200`)
    churnRows = transformChurn(raw, corporation_id, clinicIdToName)
    console.log(`  ${SHEET_CHURN}: ${churnRows.length}行`)
  } catch (e) {
    console.error(`  [warn] ${SHEET_CHURN} 読取失敗: ${e.message}`)
  }

  const all = [...maintenanceRows, ...churnRows]
  if (dryRun) {
    console.log(`  [dry-run] ${all.length}行 upsert予定（スキップ）`)
    return all.length
  }
  return upsertRows(all)
}

// ---- メイン ----
try {
  let sources
  if (dryRun && !SERVICE_ROLE) {
    // dry-run かつ service_role が無い場合は MCP 等から予めソースを環境変数に入れてもらう想定
    console.error('[error] dry-run でも kpi_sheet_sources 読取には service_role が必要')
    process.exit(2)
  }
  const filter = targetCorp ? `?corporation_id=eq.${targetCorp}` : '?order=corporation_id.asc'
  sources = await supaFetch(`/kpi_sheet_sources${filter}&select=corporation_id,spreadsheet_id,spreadsheet_url`)

  if (!sources || sources.length === 0) {
    console.error(`[error] kpi_sheet_sources に対象法人がありません ${targetCorp ? `(corporation_id=${targetCorp})` : ''}`)
    process.exit(1)
  }

  let grandTotal = 0
  for (const s of sources) {
    grandTotal += await processCorporation(s)
  }
  console.log(`\n[done] total upserted: ${grandTotal}`)
} catch (err) {
  console.error('[error]', err.message)
  process.exit(1)
}
