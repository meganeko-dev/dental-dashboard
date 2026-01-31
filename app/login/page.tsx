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
  const [loading, setLoading] = useState(false) // 連続クリック防止用
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    
    if (error) {
      alert('ログイン失敗: ' + error.message)
      setLoading(false)
    } else {
      // ログイン成功時
      // 1. まず現在のページ情報をリフレッシュしてクッキーを認識させる
      router.refresh()
      
      // 2. 確実にトップページへ遷移させる（Middlewareのガードを突破するため）
      // router.push('/') だとキャッシュで残る場合があるため、window.location を併用するのが本番では確実です
      window.location.href = '/' 
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-black">
      <form onSubmit={handleLogin} className="p-8 bg-white border rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">歯科医院KPI ログイン</h1>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
            required
            disabled={loading}
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">パスワード</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            required
            disabled={loading}
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className={`w-full p-2 rounded font-bold text-white ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>
    </div>
  )
}