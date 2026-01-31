'use client'
import './../globals.css'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      
      if (error) {
        setErrorMsg('ログイン失敗: ' + error.message)
        setLoading(false)
        return
      }

      if (data.session) {
        // 成功時：クッキーを強制更新してトップへ
        await router.refresh()
        window.location.href = '/'
      }
    } catch (err: any) {
      setErrorMsg('予期せぬエラー: ' + err.message)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-black p-4">
      <form onSubmit={handleLogin} className="p-8 bg-white border rounded shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">歯科医院KPI ログイン</h1>
        
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 text-sm rounded border border-red-200">
            {errorMsg}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-slate-700">メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded bg-white text-black"
            placeholder="example@mail.com"
            required
            disabled={loading}
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1 text-slate-700">パスワード</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded bg-white text-black"
            required
            disabled={loading}
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className={`w-full p-2 rounded font-bold text-white transition-all ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
        >
          {loading ? '通信中...' : 'ログイン'}
        </button>
      </form>
    </div>
  )
}