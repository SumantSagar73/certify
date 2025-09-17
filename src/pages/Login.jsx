import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function signInWithEmail(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) setMessage(error.message)
    else setMessage('Check your email for the login link')
    setLoading(false)
  }

  async function signInWithGoogle() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
    if (error) setMessage(error.message)
    setLoading(false)
  }

  return (
    <div style={{ padding: 24, maxWidth: 480 }}>
      <h2>Sign in to CertVault</h2>
      <form onSubmit={signInWithEmail}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 8 }}
          />
        </label>
        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={loading}>Send magic link</button>
        </div>
      </form>

      <div style={{ marginTop: 20 }}>
        <button onClick={signInWithGoogle} disabled={loading}>Continue with Google</button>
      </div>

      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </div>
  )
}
