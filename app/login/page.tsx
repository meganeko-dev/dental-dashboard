'use client'
import './../globals.css'
import { createBrowserClient } from '@supabase/ssr' // 最新のライブラリを使用
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  // 最新のブラウザ用クライアント作成方法
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    
    setLoading(true)
    setErrorMsg(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        setErrorMsg('ログイン失敗: ' + error.message)
        setLoading(false)
        return
      }

      if (data?.session) {
        // ログイン成功
        router.refresh()
        // Cookieが反映されるまで一瞬待ってからトップへ
        setTimeout(() => {
          window.location.href = '/'
        }, 100)
      }
    } catch (err: any) {
      setErrorMsg('エラーが発生しました')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-slate-900 p-4">
      <div className="p-8 bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-700">歯科医院KPI ログイン</h1>
        
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded border border-red-200 font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1 text-slate-700">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-black"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-slate-700">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-black"
              required
              disabled={loading}
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className={`w-full p-3 rounded-md font-bold text-white transition-all shadow-md ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:transform active:scale-95'
            }`}
          >
            {loading ? '認証中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}