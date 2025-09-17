import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { supabase } from './lib/supabaseClient'

// If the app was opened via a Supabase magic link, parse the session and
// then remove the token fragment from the URL so tokens are not kept in history.
;(async () => {
  try {
    // supabase v2 helper to parse session from url
    const { data, error } = await supabase.auth.getSessionFromUrl({ storeSession: true })
    if (!error && data) {
      // remove hash fragments containing the token from URL
      try {
        const clean = window.location.pathname + window.location.search
        window.history.replaceState({}, document.title, clean)
      } catch {
        // ignore
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
