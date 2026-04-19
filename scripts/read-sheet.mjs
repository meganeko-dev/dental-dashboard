#!/usr/bin/env node
// Google スプレッドシートをサービスアカウント経由で読み取る CLI ヘルパー
//
// 使い方:
//   node scripts/read-sheet.mjs <spreadsheet_id_or_url> [<range>]
//
// 例:
//   node scripts/read-sheet.mjs 1DImIJaxeA0RdOpYIs5SbiNTxxXukjv5RjMB_tl6XlUw "Sheet1!A1:Z100"
//   node scripts/read-sheet.mjs "https://docs.google.com/spreadsheets/d/1DImIJ.../edit#gid=840189800"
//
// range 省略時は全シートのメタ情報を取得して sheetId/sheetName 一覧を表示
//
// 環境変数:
//   GOOGLE_SA_KEY_PATH  サービスアカウント JSON の場所（デフォルト: ~/.gcp/keys/claude-sheets-sa.json）

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { createSign } from 'node:crypto'
import { resolve } from 'node:path'

const KEY_PATH = process.env.GOOGLE_SA_KEY_PATH
  ?? resolve(homedir(), '.gcp/keys/claude-sheets-sa.json')

// ---- CLI 引数 ----
const [, , rawArg, rangeArg] = process.argv
if (!rawArg) {
  console.error('Usage: node scripts/read-sheet.mjs <spreadsheet_id_or_url> [<range>]')
  process.exit(2)
}

const extractId = (s) => {
  const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : s
}
const spreadsheetId = extractId(rawArg)

// ---- サービスアカウント JSON を読み込む ----
let sa
try {
  sa = JSON.parse(readFileSync(KEY_PATH, 'utf8'))
} catch (e) {
  console.error(`[error] サービスアカウントキーを読めません: ${KEY_PATH}`)
  console.error(e.message)
  process.exit(1)
}

// ---- JWT 生成 → アクセストークン取得 ----
const base64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

const getAccessToken = async () => {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const segments = [
    base64url(JSON.stringify(header)),
    base64url(JSON.stringify(claims)),
  ]
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
  if (!res.ok) {
    throw new Error(`token request failed: ${res.status} ${await res.text()}`)
  }
  const json = await res.json()
  return json.access_token
}

// ---- Sheets API ----
const callSheets = async (path, token) => {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`sheets api failed: ${res.status} ${text}`)
  }
  return JSON.parse(text)
}

// ---- メイン ----
try {
  const token = await getAccessToken()

  if (!rangeArg) {
    // メタ情報（シート一覧）を取得
    const meta = await callSheets('?fields=properties.title,sheets.properties(sheetId,title,index,gridProperties)', token)
    const summary = {
      title: meta.properties?.title,
      sheets: (meta.sheets ?? []).map(s => ({
        sheetId: s.properties?.sheetId,
        name:    s.properties?.title,
        index:   s.properties?.index,
        rows:    s.properties?.gridProperties?.rowCount,
        cols:    s.properties?.gridProperties?.columnCount,
      })),
    }
    console.log(JSON.stringify(summary, null, 2))
  } else {
    // 指定レンジの値を取得
    const encoded = encodeURIComponent(rangeArg)
    const data = await callSheets(`/values/${encoded}?majorDimension=ROWS`, token)
    console.log(JSON.stringify({
      range:  data.range,
      rowCount: (data.values ?? []).length,
      values: data.values ?? [],
    }, null, 2))
  }
} catch (err) {
  console.error('[error]', err.message)
  process.exit(1)
}
