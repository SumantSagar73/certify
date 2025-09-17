import { useEffect, useState, useRef } from 'react'
import JSZip from 'jszip'
import { supabase } from '../lib/supabaseClient'
import Upload from './Upload'

const PAGE_SIZE = 8

function EditModal({ cert, onClose, onSave }) {
  const [title, setTitle] = useState(cert.title || '')
  const [issuingAuthority, setIssuingAuthority] = useState(cert.issuing_authority || '')
  const [category, setCategory] = useState(cert.category || 'Other')
  const [notes, setNotes] = useState(cert.notes || '')
  const [issueDate, setIssueDate] = useState(cert.issue_date || '')
  const [expiryDate, setExpiryDate] = useState(cert.expiry_date || '')
  const [isPrivate, setIsPrivate] = useState(cert.is_private ?? true)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#1a1a1a', padding: 20, width: 560, borderRadius: 8 }}>
        <h3>Edit certificate</h3>
  <label style={{ display: 'block', marginTop: 8 }}>Title<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label style={{ display: 'block', marginTop: 8 }}>Issuing Authority<input value={issuingAuthority} onChange={(e) => setIssuingAuthority(e.target.value)} /></label>
        <label style={{ display: 'block', marginTop: 8 }}>Category<select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option>Academic</option>
          <option>Online Course</option>
          <option>Competition</option>
          <option>Workshop</option>
          <option>Internship</option>
          <option>Other</option>
        </select></label>
        <label style={{ display: 'block', marginTop: 8 }}>Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <label style={{ fontSize: 12 }}>Issue Date<input type="date" value={issueDate || ''} onChange={(e) => setIssueDate(e.target.value)} /></label>
          <label style={{ fontSize: 12 }}>Expiry Date<input type="date" value={expiryDate || ''} onChange={(e) => setExpiryDate(e.target.value)} /></label>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} /> Private</label>
        </div>
        {/* simple validation */}
        {title.trim() === '' && <div style={{ color: 'salmon', marginTop: 8 }}>Title is required</div>}
        {issueDate && expiryDate && issueDate > expiryDate && <div style={{ color: 'salmon', marginTop: 8 }}>Expiry date must be after issue date</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Cancel</button>
          <button disabled={title.trim() === '' || (issueDate && expiryDate && issueDate > expiryDate)} onClick={() => onSave({ title: title.trim(), issuing_authority: issuingAuthority.trim(), category, notes: notes.trim(), issue_date: issueDate || null, expiry_date: expiryDate || null, is_private: isPrivate })}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ session }) {
  const [user, setUser] = useState(session?.user ?? null)
  const [certs, setCerts] = useState([])
  const [loading, setLoading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [urls, setUrls] = useState({})
  const [selected, setSelected] = useState([])

  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterAuthority, setFilterAuthority] = useState('')
  const [filterFromDate, setFilterFromDate] = useState('')
  const [filterToDate, setFilterToDate] = useState('')
  const [editing, setEditing] = useState(null)
  const [authoritySuggestions, setAuthoritySuggestions] = useState([])
  const lastUploadedRef = useRef(null)
  const [lastUploadedId, setLastUploadedId] = useState(null)
  // no optimistic pending state; Upload shows spinner instead

  useEffect(() => {
    setUser(session?.user ?? null)
  }, [session])

  async function generateUrlForCert(c) {
    try {
      // Try public URL first
      const { data: publicData } = supabase.storage.from('certvault-certificates').getPublicUrl(c.storage_path)
      if (publicData?.publicUrl) {
        setUrls((u) => ({ ...u, [c.id]: publicData.publicUrl }))
        return
      }

      // fallback to signed URL (1 hour)
      const { data, error } = await supabase.storage.from('certvault-certificates').createSignedUrl(c.storage_path, 3600)
      if (error) throw error
      setUrls((u) => ({ ...u, [c.id]: data.signedUrl }))
    } catch (err) {
      console.warn('generateUrlForCert error', err)
    }
  }

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    ;(async () => {
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

  let q = supabase.from('certificates').select('*', { count: 'exact' }).eq('user_id', user.id)

  if (query) q = q.ilike('title', `%${query}%`)
  if (filterCategory) q = q.eq('category', filterCategory)
  if (filterAuthority) q = q.ilike('issuing_authority', `%${filterAuthority}%`)
  if (filterFromDate) q = q.gte('issue_date', filterFromDate)
  if (filterToDate) q = q.lte('issue_date', filterToDate)

  q = q.order('created_at', { ascending: false }).range(from, to)

  const { data, error, count } = await q

      if (error) console.warn('fetch certs error', error)
      else {
        // merge lastUploaded (from ref) if present and missing from server results
        let result = data ?? []
        const lu = lastUploadedRef.current
        if (lu) {
          const exists = (result || []).some((r) => r.id === lu.id)
          if (!exists) result = [lu, ...(result || [])]
        }
        setCerts(result)
        setTotal(count ?? 0)
      }
      setLoading(false)
    })()
  }, [user?.id, page, query, filterCategory, filterAuthority, filterFromDate, filterToDate, lastUploadedId])

  // fetch authority suggestions (distinct issuing_authority values for this user)
  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const { data } = await supabase.from('certificates').select('issuing_authority').eq('user_id', user.id)
        const unique = Array.from(new Set((data || []).map((r) => r.issuing_authority).filter(Boolean)))
        setAuthoritySuggestions(unique)
      } catch (err) {
        console.warn('authority suggestions error', err)
      }
    })()
  }, [user])

  // Realtime subscription: listen for inserts/updates/deletes on certificates and update list
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase.channel('public:certificates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'certificates' }, (payload) => {
        const newRow = payload.new
        if (!newRow || newRow.user_id !== user.id) return
        setCerts((cs) => {
          // avoid duplicate
          if ((cs || []).some((c) => c.id === newRow.id)) return cs
          return [newRow, ...(cs || [])]
        })
        setTotal((t) => (typeof t === 'number' ? t + 1 : 1))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'certificates' }, (payload) => {
        const updated = payload.new
        if (!updated || updated.user_id !== user.id) return
        setCerts((cs) => (cs || []).map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'certificates' }, (payload) => {
        const old = payload.old
        if (!old || old.user_id !== user.id) return
        setCerts((cs) => (cs || []).filter((c) => c.id !== old.id))
        setTotal((t) => Math.max(0, (t || 1) - 1))
      })
      .subscribe()

    return () => {
      // unsubscribe and remove channel
      try { channel.unsubscribe() } catch { /* ignore */ }
    }
  }, [user?.id])

  // fetch logic is executed in useEffect to avoid stale dependencies

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function handleDelete(c) {
    if (!confirm('Delete this certificate? This will remove both metadata and the stored file.')) return
    setLoading(true)
    // delete storage object first
    try {
      const { error: storageErr } = await supabase.storage.from('certvault-certificates').remove([c.storage_path])
      if (storageErr) throw storageErr
      const { error: delErr } = await supabase.from('certificates').delete().eq('id', c.id)
      if (delErr) throw delErr
      // refresh
      setCerts((cs) => cs.filter((x) => x.id !== c.id))
    } catch (err) {
      console.error('delete error', err)
      alert('Delete failed: ' + (err.message || String(err)))
    } finally {
      setLoading(false)
    }
  }

  function toggleSelect(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function bulkDelete() {
    if (selected.length === 0) return
    if (!confirm(`Delete ${selected.length} certificates? This will remove files and metadata.`)) return
    setLoading(true)
    try {
      // fetch selected certs to get storage paths
      const { data } = await supabase.from('certificates').select('id,storage_path').in('id', selected)
      if (data && data.length > 0) {
        // remove storage objects one-by-one
        await Promise.all(data.map((d) => supabase.storage.from('certvault-certificates').remove([d.storage_path])))
      }
      // remove metadata rows
      const { error } = await supabase.from('certificates').delete().in('id', selected)
      if (error) throw error
      // update UI
      setCerts((cs) => cs.filter((c) => !selected.includes(c.id)))
      setSelected([])
    } catch (err) {
      console.error('bulk delete error', err)
      alert('Bulk delete failed: ' + (err.message || String(err)))
    } finally {
      setLoading(false)
    }
  }

  async function bulkDownload() {
    if (selected.length === 0) return
    setLoading(true)
    try {
      const { data } = await supabase.from('certificates').select('id,storage_path,file_name,mime_type').in('id', selected)
      if (!data) throw new Error('No data for selected items')
      // Client-side zipping: fetch each file as blob via signed URL and pack into a ZIP
      const zip = new JSZip()
      let included = 0
      for (const c of data) {
        try {
          // try public URL first
          const { data: publicData } = supabase.storage.from('certvault-certificates').getPublicUrl(c.storage_path)
          let fileUrl = publicData?.publicUrl
          if (!fileUrl) {
            const { data: signed, error } = await supabase.storage.from('certvault-certificates').createSignedUrl(c.storage_path, 3600)
            if (error) throw error
            fileUrl = signed.signedUrl
          }

          const resp = await fetch(fileUrl)
          if (!resp.ok) throw new Error(`Failed to fetch ${c.file_name} (${resp.status})`)
          const blob = await resp.blob()
          zip.file(c.file_name || c.storage_path.split('/').pop(), blob)
          included += 1
        } catch (err) {
          console.warn('failed to include file in zip for', c, err)
        }
      }

      if (included === 0) {
        alert('No files could be fetched for download. Check bucket permissions or file paths.')
        return
      }

      // generate zip and trigger download
      const content = await zip.generateAsync({ type: 'blob' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(content)
      link.href = url
      link.download = `certificates_${Date.now()}.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('bulk download error', err)
      alert('Bulk download failed: ' + (err.message || String(err)))
    } finally {
      setLoading(false)
    }
  }

  async function handleEdit(c, updates) {
    setLoading(true)
    try {
      const { error } = await supabase.from('certificates').update(updates).eq('id', c.id)
      if (error) throw error
      // refresh list
      setCerts((cs) => cs.map((x) => (x.id === c.id ? { ...x, ...updates } : x)))
    } catch (err) {
      console.error('edit error', err)
      alert('Update failed: ' + (err.message || String(err)))
    } finally {
      setLoading(false)
    }
  }

  // helper: poll for a created record by id and merge it into the list when available
  async function verifyCreated(createdId, attempts = 6, delayMs = 1000) {
    if (!createdId) return null
    for (let i = 0; i < attempts; i++) {
      try {
        const { data } = await supabase.from('certificates').select('*').eq('id', createdId).single()
        if (data && data.id) {
          // merge and return
          setCerts((cs) => {
            const exists = (cs || []).some((c) => c.id === data.id)
            if (exists) return cs
            return [data, ...(cs || [])]
          })
          return data
        }
      } catch {
        // ignore and retry
      }
      await new Promise((r) => setTimeout(r, delayMs))
    }
    return null
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>CertVault</h2>
        <div>
          <span style={{ marginRight: 12 }}>{user?.email}</span>
          <button onClick={() => setShowUpload((s) => !s)} style={{ marginRight: 8 }}>{showUpload ? 'Back' : 'Upload'}</button>
          <button onClick={signOut}>Sign out</button>
        </div>
      </div>

      {showUpload ? (
  <Upload onUploaded={(payload) => {
          setShowUpload(false)
          setPage(1)
          if (!payload) return
          const { created, signedUrl, error } = payload
          if (error) {
            // remove any temp item (if present) and show message
            setCerts((cs) => (cs || []).filter((c) => !c.id?.toString().startsWith('temp-')))
            setTotal((t) => Math.max(0, (t || 1) - 1))
            alert('Upload failed: ' + (error.message || String(error)))
            return
          }
          if (created) {
            lastUploadedRef.current = created
            setLastUploadedId(created.id)
            setCerts((cs) => [created, ...(cs || [])])
            if (signedUrl) setUrls((u) => ({ ...u, [created.id]: signedUrl }))
            // verify on the server and ensure it's merged (retry if necessary)
            verifyCreated(created.id).then(() => {}).catch(() => {})
          }
        }} />
      ) : (
        <section style={{ marginTop: 32 }}>
          <h3>Your certificates</h3>
          {loading && <p>Loading...</p>}
          {!loading && certs.length === 0 && <p style={{ color: '#9aa' }}>No certificates yet. Use Upload to add PDF or images.</p>}

          {/* Filters */}
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input placeholder="Search title..." value={query} onChange={(e) => setQuery(e.target.value)} />
            <input placeholder="Issuing authority" list="auth-list" value={filterAuthority} onChange={(e) => setFilterAuthority(e.target.value)} />
            <datalist id="auth-list">
              {authoritySuggestions.map((a) => <option key={a} value={a} />)}
            </datalist>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All categories</option>
              <option value="Academic">Academic</option>
              <option value="Online Course">Online Course</option>
              <option value="Competition">Competition</option>
              <option value="Workshop">Workshop</option>
              <option value="Internship">Internship</option>
              <option value="Other">Other</option>
            </select>
            <label style={{ fontSize: 12 }}>From<input type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} /></label>
            <label style={{ fontSize: 12 }}>To<input type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} /></label>
            <button onClick={() => { setPage(1) }}>Apply</button>
            <button onClick={() => { setQuery(''); setFilterCategory(''); setFilterAuthority(''); setFilterFromDate(''); setFilterToDate(''); setPage(1) }}>Clear</button>
          </div>

          {/* Bulk action toolbar */}
          {selected.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <strong>{selected.length} selected</strong>
              <button onClick={bulkDelete}>Delete selected</button>
              <button onClick={bulkDownload}>Download selected</button>
              <button onClick={() => setSelected([])}>Clear selection</button>
            </div>
          )}

          <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
            {certs.map((c) => (
              <li key={c.id} style={{ padding: 8, borderBottom: '1px solid #2a2a2a', display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} />
                </div>

                <div style={{ width: 88, height: 64, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {urls[c.id] ? (
                    c.mime_type?.startsWith('image') ? (
                      <img src={urls[c.id]} alt={c.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <a href={urls[c.id]} target="_blank" rel="noreferrer">Download</a>
                    )
                  ) : (
                    <button onClick={async () => await generateUrlForCert(c)}>Preview</button>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <strong>{c.title || c.file_name}</strong>
                  <div style={{ fontSize: 12, color: '#9aa' }}>{c.issuing_authority} • {c.category} • {c.issue_date}</div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {urls[c.id] ? (
                    <a href={urls[c.id]} target="_blank" rel="noreferrer">Open</a>
                  ) : (
                    <button onClick={async () => await generateUrlForCert(c)}>Get URL</button>
                  )}
                  <button onClick={() => setEditing(c)}>Edit</button>
                  <button onClick={() => handleDelete(c)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>

          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              Showing {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, total)} of {total}
              <span style={{ marginLeft: 12 }}>{selected.length > 0 ? `${selected.length} selected` : ''}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page * PAGE_SIZE >= total}>Next</button>
            </div>
          </div>
        </section>
      )}

      {editing && <EditModal cert={editing} onClose={() => setEditing(null)} onSave={(updates) => { handleEdit(editing, updates); setEditing(null) }} />}
    </div>
  )
}
