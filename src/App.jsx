import { useEffect, useState } from 'react'
import './App.css'
import { supabase } from './lib/supabaseClient'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function App() {
  const [session, setSession] = useState(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(res => {
      setSession(res.data.session)
      setInitializing(false)
    }).catch(() => setInitializing(false))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
    })

    return () => listener?.subscription?.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen bg-bg-dark text-text-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {initializing ? (
          <div className="flex items-center justify-center h-64 animate-fade-in">
            <div className="w-12 h-12 border-4 border-input border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          !session ? <Login /> : <Dashboard session={session} />
        )}
      </div>
    </div>
  )
}

export default App
