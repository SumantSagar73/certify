import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export default function Upload({ onUploaded }) {
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [issuingAuthority, setIssuingAuthority] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [category, setCategory] = useState('Other')
  const [notes, setNotes] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)
  const [loading, setLoading] = useState(false)
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

  const { error: uploadError } = await supabase.storage
        .from('certvault-certificates')
        .upload(path, file, { upsert: false })

      if (uploadError) throw uploadError

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
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h3>Upload certificate</h3>
      <form onSubmit={handleSubmit}>
        <label>
          File (PDF, JPG, PNG)
          <input type="file" accept="application/pdf,image/*" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); }} />
        </label>

  {loading ? (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 18, height: 18, border: '3px solid #333', borderTop: '3px solid #888', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 13, color: '#9aa' }}>Uploading…</div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : null}

        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label>
          Issuing Authority
          <input value={issuingAuthority} onChange={(e) => setIssuingAuthority(e.target.value)} />
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
          <button type="submit" disabled={loading}>Upload</button>
        </div>

        {message && <p style={{ marginTop: 12 }}>{message}</p>}
    {/* debug info removed */}
      </form>
    </div>
  )
}
