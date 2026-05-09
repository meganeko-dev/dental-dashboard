import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import Papa from 'papaparse'
import { DataImporter, type PatientListInputRow } from '@/lib/importers'
import { hashKarteNumber } from '@/lib/server/patient-hash'

export const runtime = 'nodejs' // node:crypto を使うため

type SnapshotRow = Omit<PatientListInputRow, 'karte_number'> & {
  corporation_id: string
  clinic_id: string
  clinic_name: string | null
  patient_hash: string
}

const buildServerSupabase = async () => {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    },
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await buildServerSupabase()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: '認証セッションが無効です。再ログインしてください。' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file')
    const clinicIdRaw = formData.get('clinicId')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'CSVファイルが添付されていません。' }, { status: 400 })
    }
    if (typeof clinicIdRaw !== 'string' || !clinicIdRaw.trim()) {
      return NextResponse.json({ error: 'clinicId が指定されていません。' }, { status: 400 })
    }
    const clinicId = clinicIdRaw.trim()

    // セッションユーザーの法人ID
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('corporation_id')
      .eq('id', session.user.id)
      .single()
    if (profileErr || !profile?.corporation_id) {
      return NextResponse.json({ error: 'プロフィール取得に失敗しました。' }, { status: 403 })
    }

    // クリニック確認
    const { data: clinic, error: clinicErr } = await supabase
      .from('clinics')
      .select('id, name, corporation_id')
      .eq('id', clinicId)
      .single()
    if (clinicErr || !clinic) {
      return NextResponse.json({ error: `clinic_id=${clinicId} が見つかりません。` }, { status: 404 })
    }
    if (clinic.corporation_id !== profile.corporation_id) {
      return NextResponse.json({ error: 'このクリニックを操作する権限がありません。' }, { status: 403 })
    }

    const corporationId = clinic.corporation_id as string
    const clinicName = clinic.name as string

    // CSV をテキストにしてパース
    const text = await file.text()
    const parsed = Papa.parse<string[]>(text, {
      header: false,
      skipEmptyLines: true,
    })
    if (parsed.errors.length > 0) {
      return NextResponse.json({ error: `CSVパースエラー: ${parsed.errors[0].message}` }, { status: 400 })
    }
    const rows = parsed.data as string[][]
    const transformed = DataImporter.transformPatientList(rows)
    if (transformed.length === 0) {
      return NextResponse.json({ error: 'CSVから有効な患者行が見つかりませんでした。' }, { status: 400 })
    }

    // patient_hash 単位で重複排除。CSV内に同一カルテ番号の行が複数あれば、後出の行で上書き。
    // PK=(corporation_id, clinic_id, patient_hash) なので重複したまま INSERT すると一意制約違反になる。
    const snapshotMap = new Map<string, SnapshotRow>()
    for (const r of transformed) {
      const { karte_number, ...rest } = r
      const patient_hash = hashKarteNumber(corporationId, clinicId, karte_number)
      snapshotMap.set(patient_hash, {
        ...rest,
        corporation_id: corporationId,
        clinic_id: clinicId,
        clinic_name: clinicName,
        patient_hash,
      })
    }
    const snapshotRows: SnapshotRow[] = Array.from(snapshotMap.values())
    const dedupedCount = transformed.length - snapshotRows.length

    // ClinicID ごとに DELETE → INSERT で常に最新スナップショットだけ保持。
    const { error: deleteErr } = await supabase
      .from('patient_snapshots')
      .delete()
      .eq('corporation_id', corporationId)
      .eq('clinic_id', clinicId)
    if (deleteErr) {
      return NextResponse.json({ error: `既存データ削除エラー: ${deleteErr.message}` }, { status: 500 })
    }

    const chunkSize = 500
    let inserted = 0
    for (let i = 0; i < snapshotRows.length; i += chunkSize) {
      const chunk = snapshotRows.slice(i, i + chunkSize)
      const { error: insertErr } = await supabase.from('patient_snapshots').insert(chunk)
      if (insertErr) {
        return NextResponse.json({
          error: `INSERTエラー(${inserted}件挿入後): ${insertErr.message}`,
        }, { status: 500 })
      }
      inserted += chunk.length
    }

    return NextResponse.json({
      ok: true,
      clinic_id: clinicId,
      clinic_name: clinicName,
      inserted,
      deduplicated: dedupedCount,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
