import { useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import Button from '../components/Button'
import Card from '../components/Card'
import Input from '../components/Input'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export default function Upload({ onUploaded, authoritySuggestions = [] }) {
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [issuingAuthority, setIssuingAuthority] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [category, setCategory] = useState('Other')
  const [notes, setNotes] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredAuths, setFilteredAuths] = useState([])
  const [highlight, setHighlight] = useState(-1)
  const authDebounceRef = useRef(null)
  const inputRef = useRef(null)
  const [message, setMessage] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')
    if (!file) return setMessage('Please select a file')
    if (file.size > MAX_FILE_SIZE) return setMessage('File too large (max 10MB)')
    setLoading(true)

  try {
      // show loading spinner in this component; do not insert optimistic item into the list
  // ensure we have the current authenticated user from the client
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr) throw userErr
  const currentUser = userData?.user
  if (!currentUser) throw new Error('Not authenticated')

      const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`
  const folder = currentUser.id || 'public'
  const path = `${folder}/${fileName}`

      // perform upload via XHR to get progress events
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const bucket = 'certvault-certificates'
      const base = import.meta.env.VITE_SUPABASE_URL
      const uploadUrl = `${base.replace(/\/$/, '')}/storage/v1/object/${bucket}/${encodeURIComponent(path)}`

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl, true)
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        xhr.setRequestHeader('x-upsert', 'false')
        xhr.upload.onprogress = function (e) {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = function () {
          if (xhr.status >= 200 && xhr.status < 300) resolve(true)
          else reject(new Error('Upload failed: ' + xhr.status))
        }
        xhr.onerror = function () { reject(new Error('Upload network error')) }
        xhr.send(file)
      })

  // currentUser determined
  // prepare payload

      // store metadata in certificates table
    const { data: _data, error: insertError } = await supabase.from('certificates').insert([
        {
      user_id: currentUser.id,
          title: title || file.name,
          issuing_authority: issuingAuthority,
          issue_date: issueDate || null,
          expiry_date: expiryDate || null,
          category,
          notes,
          is_private: isPrivate,
          storage_path: path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
        },
      ]).select().single()

      if (insertError) throw insertError

  // try to generate a signed url so the dashboard can show the file immediately
      let signedUrl = null
      try {
        const { data: signed } = await supabase.storage.from('certvault-certificates').createSignedUrl(path, 3600)
        signedUrl = signed?.signedUrl ?? null
      } catch {
        // ignore signed url errors
      }

  setMessage('Upload successful')
  setProgress(100)
  // reset form fields
  setFile(null)
      setTitle('')
      setIssuingAuthority('')
      setIssueDate('')
      setExpiryDate('')
      setCategory('Other')
      setNotes('')
      setIsPrivate(true)

    // pass the newly created record info to the parent so it can display
  const created = (_data && _data[0]) ? _data[0] : null
  // notify parent component; Dashboard handles merging via realtime or verifyCreated
  onUploaded && onUploaded({ created, signedUrl })
    } catch (err) {
  setMessage(err.message || String(err))
    } finally {
      // small delay so progress 100% is visible
      setTimeout(() => {
        setLoading(false)
        setProgress(0)
      }, 350)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card>
        <h3 className="text-xl font-semibold mb-3">Upload certificate</h3>
        <form onSubmit={handleSubmit}>
        <label>
          File (PDF, JPG, PNG)
          <input type="file" accept="application/pdf,image/*" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); }} />
        </label>

        {loading ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 10, background: '#222', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: '#4caf50', transition: 'width 250ms linear' }} />
            </div>
            <div style={{ fontSize: 12, color: '#9aa', marginTop: 6 }}>{progress}%</div>
          </div>
        ) : null}

        <label className="block mb-3">
          Title
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label style={{ position: 'relative' }}>
          Issuing Authority
          <input
            ref={inputRef}
            value={issuingAuthority}
            onChange={(e) => {
              setIssuingAuthority(e.target.value)
              setShowSuggestions(true)
              setHighlight(-1)
              // debounce filtering
              if (authDebounceRef.current) clearTimeout(authDebounceRef.current)
              authDebounceRef.current = setTimeout(() => {
                const q = (e.target.value || '').trim().toLowerCase()
                if (!q) setFilteredAuths(authoritySuggestions.slice(0, 6))
                else {
                  // simple fuzzy: all tokens present in order
                  const parts = q.split(/\s+/).filter(Boolean)
                  const filtered = authoritySuggestions.filter((a) => {
                    const s = (a || '').toLowerCase()
                    return parts.every((p) => s.includes(p))
                  })
                  setFilteredAuths(filtered.slice(0, 8))
                }
              }, 180)
            }}
            onKeyDown={(e) => {
              if (!showSuggestions) return
              if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min((filteredAuths.length || 1) - 1, h + 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(0, h - 1)) }
              else if (e.key === 'Enter') { e.preventDefault(); if (highlight >= 0 && filteredAuths[highlight]) { setIssuingAuthority(filteredAuths[highlight]); setShowSuggestions(false) } }
              else if (e.key === 'Escape') { setShowSuggestions(false) }
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          {showSuggestions && filteredAuths && filteredAuths.length > 0 && (
            <div style={{ position: 'absolute', left: 0, right: 0, background: '#0f0f0f', border: '1px solid #222', maxHeight: 160, overflowY: 'auto', zIndex: 40 }}>
              {filteredAuths.map((a, i) => (
                <div key={a}
                  onMouseDown={(ev) => { ev.preventDefault(); setIssuingAuthority(a); setShowSuggestions(false) }}
                  style={{ padding: 8, background: i === highlight ? '#222' : 'transparent', cursor: 'pointer' }}>
                  {a}
                </div>
              ))}
            </div>
          )}
        </label>

        <label>
          Issue Date
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </label>

        <label>
          Expiry Date
          <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </label>

        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option>Academic</option>
            <option>Online Course</option>
            <option>Competition</option>
            <option>Workshop</option>
            <option>Internship</option>
            <option>Other</option>
          </select>
        </label>

        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <label style={{ display: 'block', marginTop: 8 }}>
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} /> Private (default)
        </label>

        <div style={{ marginTop: 12 }}>
          <Button type="submit" disabled={loading}>Upload</Button>
        </div>

        {message && <p style={{ marginTop: 12 }}>{message}</p>}
    {/* debug info removed */}
        </form>
      </Card>
    </div>
  )
}
