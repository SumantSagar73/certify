import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Button from '../components/Button'
import Card from '../components/Card'

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
    <div className="min-h-screen flex items-center justify-center bg-neutral-900 px-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to Certify</h2>
          <p className="text-gray-400">Sign in to manage your certificates</p>
        </div>

        <form onSubmit={signInWithEmail} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your email"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Sending...' : 'Send magic link'}
          </Button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-neutral-800 text-gray-400">Or continue with</span>
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={signInWithGoogle} disabled={loading} variant="secondary" className="w-full">
              Continue with Google
            </Button>
          </div>
        </div>

        {message && (
          <div className={`mt-4 p-3 rounded-md text-sm ${message.includes('Check') ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
            {message}
          </div>
        )}
      </Card>
    </div>
  )
}
