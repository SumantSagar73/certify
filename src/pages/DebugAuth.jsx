import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function DebugAuth() {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    (async () => {
      const session = await supabase.auth.getSession()
      const user = await supabase.auth.getUser()
      setInfo({ session: session?.data, user: user?.data })
    })()
  }, [])

  return (
    <div style={{ padding: 24 }}>
      <h3>Supabase Auth Debug</h3>
      <pre style={{ background: '#111', padding: 12, color: '#eee' }}>{JSON.stringify(info, null, 2)}</pre>
    </div>
  )
}
