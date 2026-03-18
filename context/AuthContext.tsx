// 'use client'
// import { createContext, useContext, useEffect, useState } from 'react'
// import { createBrowserClient } from '@supabase/ssr'

// const AuthContext = createContext<{
//   corpId: string | null;
//   mode: 'single' | 'multi' | null;
//   loading: boolean;
// }>({ corpId: null, mode: null, loading: true })

// export function AuthProvider({ children }: { children: React.ReactNode }) {
//   const [data, setData] = useState<{corpId: string | null, mode: 'single' | 'multi' | null}>({ corpId: null, mode: null })
//   const [loading, setLoading] = useState(true)
  
//   // クライアントを一度だけ生成
//   const [supabase] = useState(() => createBrowserClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
//   ))

//   useEffect(() => {
//     console.log("0. AuthContext useEffect started"); // これが出るか確認

//     const getAuth = async () => {
//       try {
//         console.log("1. Fetching session...");
//         const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
//         if (sessionError) {
//           console.error("Session Error:", sessionError);
//           setLoading(false);
//           return;
//         }

//         console.log("2. Session User ID:", session?.user?.id);

//         if (session?.user) {
//           const { data: profile, error: profileError } = await supabase
//             .from('profiles')
//             .select('corporation_id, corporations(mode)')
//             .eq('id', session.user.id)
//             .single()
          
//           console.log("3. Profile Result:", profile, "Error:", profileError);
          
//           if (profile) {
//             setData({
//               corpId: profile.corporation_id,
//               mode: (profile.corporations as any).mode
//             })
//           }
//         } else {
//           console.log("No session found - Redirecting might be needed");
//           // ログインしていない場合も、ダッシュボード側のloadingを解くためにfalseにする
//         }
//       } catch (err) {
//         console.error("Fatal Auth Error:", err);
//       } finally {
//         setLoading(false)
//         console.log("5. Auth loading finished");
//       }
//     }
//     getAuth()
//   }, [supabase])

//   return (
//     <AuthContext.Provider value={{ ...data, loading }}>
//       {children}
//     </AuthContext.Provider>
//   )
// }

// export const useAuth = () => useContext(AuthContext)

'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, usePathname } from 'next/navigation'

type AuthContextType = {
  user: any
  corpId: string | null
  mode: 'single' | 'multi'
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  corpId: null,
  mode: 'single',
  loading: true
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [corpId, setCorpId] = useState<string | null>(null)
  const [mode, setMode] = useState<'single' | 'multi'>('single')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  
  // 💡 クライアント生成時に環境変数の存在をチェック
  const [supabase] = useState(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!url || !key) {
      console.error("Supabase environment variables are missing!")
    }
    
    return createBrowserClient(url || '', key || '')
  })

  useEffect(() => {
    let isMounted = true;

    const getAuth = async () => {
      // 💡 supabase.auth が存在しない場合は処理を中断
      if (!supabase?.auth) {
        console.error("Supabase auth client is not initialized correctly.");
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error("Session Error:", sessionError);
          if (isMounted) setLoading(false);
          return;
        }

        if (session?.user && isMounted) {
          setUser(session.user)
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('corporation_id, corporations(mode)')
            .eq('id', session.user.id)
            .single()
          
          if (profile && isMounted) {
            setCorpId(profile.corporation_id)
            const fetchedMode = (profile.corporations as any)?.mode || 'single'
            setMode(fetchedMode as 'single' | 'multi')
          }
        } else if (!session && isMounted) {
          if (pathname !== '/login') {
            router.push('/login')
          }
        }
      } catch (err) {
        console.error("Fatal Auth Error:", err);
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    getAuth()

    // 💡 認証状態の変化を監視（さらに安全な実装）
    // .auth や .onAuthStateChanged が存在する場合のみ実行
    let subscription: any = null;
    
    if (typeof supabase?.auth?.onAuthStateChanged === 'function') {
      const { data } = supabase.auth.onAuthStateChanged((_event, session) => {
        if (!isMounted) return;
        if (session) {
          setUser(session.user)
        } else {
          setUser(null)
          setCorpId(null)
          if (pathname !== '/login') router.push('/login')
        }
      })
      subscription = data?.subscription;
    } else {
      console.warn("supabase.auth.onAuthStateChanged is not available yet.");
    }

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    }
  }, [supabase, router, pathname])

  return (
    <AuthContext.Provider value={{ user, corpId, mode, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)