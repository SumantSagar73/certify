import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { supabase } from './lib/supabaseClient'

// Apply theme class early (before React mounts) to avoid flash
try {
  const saved = localStorage.getItem('certify:theme')
  if (saved === 'dark') document.documentElement.classList.add('dark')
  else if (saved === 'light') document.documentElement.classList.remove('dark')
  else {
    // default to dark theme when no explicit saved preference exists
    document.documentElement.classList.add('dark')
  }
} catch {
  // ignore localStorage errors
}

// If the app was opened via a Supabase magic link, parse the session and
// then remove the token fragment from the URL so tokens are not kept in history.
;(async () => {
  try {
    // If the helper exists (some SDK versions), use it. Otherwise try a small
    // manual fallback to parse the URL fragment for access/refresh tokens and
    // call supabase.auth.setSession so the app receives the session.
    if (typeof supabase?.auth?.getSessionFromUrl === 'function') {
      const { data, error } = await supabase.auth.getSessionFromUrl({ storeSession: true })
      if (!error && data) {
        try {
          const clean = window.location.pathname + window.location.search
          window.history.replaceState({}, document.title, clean)
        } catch {
          // ignore
        }
      }
    } else {
      // Manual fallback: check for token fragments in the URL hash
      try {
        const hash = window.location.hash || ''
        if (hash.includes('access_token') || hash.includes('refresh_token')) {
          const params = Object.fromEntries(hash.replace(/^#/, '').split('&').map((p) => {
            const [k, v] = p.split('=')
            return [k, decodeURIComponent(v || '')]
          }))
          const access_token = params.access_token || params.accessToken || null
          const refresh_token = params.refresh_token || params.refreshToken || null
          if (access_token || refresh_token) {
            // setSession will store session in the client and trigger auth listeners
            await supabase.auth.setSession({ access_token, refresh_token })
            try {
              const clean = window.location.pathname + window.location.search
              window.history.replaceState({}, document.title, clean)
            } catch {
              // ignore
            }
          }
        }
      } catch (e) {
        console.warn('manual auth fragment parse failed', e)
      }
    }
  } catch (err) {
    // ignore; continue to render app
    console.warn('auth redirect parse failed', err)
  } finally {
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  }
})()
