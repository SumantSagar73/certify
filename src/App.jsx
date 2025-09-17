import { useEffect, useState } from 'react'
import './App.css'
import { supabase } from './lib/supabaseClient'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(res => setSession(res.data.session))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
    })

    return () => listener?.subscription?.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen bg-neutral-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!session ? <Login /> : <Dashboard session={session} />}
      </div>
    </div>
  )
}

export default App
