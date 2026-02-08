'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const AuthContext = createContext<{
  corpId: string | null;
  mode: 'single' | 'multi' | null;
  loading: boolean;
}>({ corpId: null, mode: null, loading: true })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<{corpId: string | null, mode: 'single' | 'multi' | null}>({ corpId: null, mode: null })
  const [loading, setLoading] = useState(true)
  
  // クライアントを一度だけ生成
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  useEffect(() => {
    console.log("0. AuthContext useEffect started"); // これが出るか確認

    const getAuth = async () => {
      try {
        console.log("1. Fetching session...");
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error("Session Error:", sessionError);
          setLoading(false);
          return;
        }

        console.log("2. Session User ID:", session?.user?.id);

        if (session?.user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('corporation_id, corporations(mode)')
            .eq('id', session.user.id)
            .single()
          
          console.log("3. Profile Result:", profile, "Error:", profileError);
          
          if (profile) {
            setData({
              corpId: profile.corporation_id,
              mode: (profile.corporations as any).mode
            })
          }
        } else {
          console.log("No session found - Redirecting might be needed");
          // ログインしていない場合も、ダッシュボード側のloadingを解くためにfalseにする
        }
      } catch (err) {
        console.error("Fatal Auth Error:", err);
      } finally {
        setLoading(false)
        console.log("5. Auth loading finished");
      }
    }
    getAuth()
  }, [supabase])

  return (
    <AuthContext.Provider value={{ ...data, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)