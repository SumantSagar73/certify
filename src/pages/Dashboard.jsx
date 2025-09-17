import { useEffect, useState, useRef } from 'react'
import JSZip from 'jszip'
import { supabase } from '../lib/supabaseClient'
import Upload from './Upload'
import Header from '../components/Header'
import Toast from '../components/Toast'
import Input from '../components/Input'
import Button from '../components/Button'
import Card from '../components/Card'
import { FaDownload } from 'react-icons/fa'

const PAGE_SIZE = 8

// helper: try removing an object from storage with a few common encodings
async function tryRemoveStoragePath(bucket, path) {
  const candidates = new Set()
  if (!path) return false
  const raw = String(path).trim()
  candidates.add(raw)

  // try trimming leading slash
  if (raw.startsWith('/')) candidates.add(raw.replace(/^\//, ''))

  // try removing 'public/' prefix if present
  if (raw.startsWith('public/')) candidates.add(raw.replace(/^public\//, ''))
  if (raw.includes('/public/')) candidates.add(raw.split('/public/').pop())

  // if a full URL was stored, try to extract the path after the bucket
  try {
    const u = new URL(raw)
    // attempt to find bucket in pathname
    const parts = u.pathname.split('/').filter(Boolean)
    const idx = parts.indexOf(bucket)
    if (idx >= 0 && parts.length > idx + 0) {
      const sub = parts.slice(idx + 1).join('/')
      if (sub) candidates.add(sub)
      // also try without any leading 'public' segment
      if (sub.startsWith('public/')) candidates.add(sub.replace(/^public\//, ''))
    }
    // also try last two segments (user/file)
    if (parts.length >= 2) candidates.add(parts.slice(-2).join('/'))
  // also try extracting after known storage URL patterns
  const objMatch = raw.match(/\/storage\/v1\/object\/[^/]+\/(.*)$/)
  if (objMatch && objMatch[1]) candidates.add(objMatch[1])
  const obj2 = raw.match(/\/object\/([^/]+)\/(.*)$/)
  if (obj2 && obj2[2]) candidates.add(obj2[2])
  } catch (e) {
    // not a URL — ignore parsing error
    // keep going with other variants
    void e
  }

  // encoded/decoded segment variants
  try {
    const decoded = decodeURIComponent(raw)
    if (decoded !== raw) candidates.add(decoded)
  } catch (e) {
    // ignore decode errors
    void e
  }
  try {
    const encoded = raw.split('/').map((s) => encodeURIComponent(s)).join('/')
    if (encoded !== raw) candidates.add(encoded)
  } catch (e) {
    // ignore encode errors
    void e
  }

  for (const p of Array.from(candidates)) {
    if (!p) continue
    try {
      const { data, error } = await supabase.storage.from(bucket).remove([p])
      if (!error) {
        console.debug('removed storage object', p, data)
        return true
      }
      // continue on not-found
      if (error && /not found|404/i.test(error.message || '')) {
        console.debug('not found for path variant', p)
        continue
      }
      console.warn('remove returned error for path variant', p, error)
    } catch (err) {
      console.warn('tryRemoveStoragePath attempt failed for', p, err)
      // continue trying other variants
    }
  }
  // final attempt: if the raw string contains query params or fragments, try stripping
  try {
    const clean = raw.split('?')[0].split('#')[0]
    if (clean && !Array.from(candidates).includes(clean)) {
      const { data, error } = await supabase.storage.from(bucket).remove([clean])
      if (!error) {
        console.debug('removed storage object (cleaned)', clean, data)
        return true
      }
      console.debug('final clean removal attempt failed', clean, error)
    }
  } catch (e) {
    void e
  }
  return false
}

function EditModal({ cert, onClose, onSave }) {
  const [title, setTitle] = useState(cert.title || '')
  const [issuingAuthority, setIssuingAuthority] = useState(cert.issuing_authority || '')
  const [category, setCategory] = useState(cert.category || 'Other')
  const [notes, setNotes] = useState(cert.notes || '')
  const [issueDate, setIssueDate] = useState(cert.issue_date || '')
  const [expiryDate, setExpiryDate] = useState(cert.expiry_date || '')
  const [isPrivate, setIsPrivate] = useState(cert.is_private ?? true)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-neutral-800 p-6 rounded-lg w-full max-w-lg shadow-xl">
        <h3 className="text-xl font-semibold mb-4 text-white">Edit certificate</h3>
        <label className="block mb-3">
          <span className="text-sm text-gray-300">Title</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
        </label>
        <label className="block mb-3">
          <span className="text-sm text-gray-300">Issuing Authority</span>
          <Input value={issuingAuthority} onChange={(e) => setIssuingAuthority(e.target.value)} className="mt-1" />
        </label>
        <label className="block mb-3">
          <span className="text-sm text-gray-300">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md bg-neutral-700 border border-neutral-600 text-white">
            <option>Academic</option>
            <option>Online Course</option>
            <option>Competition</option>
            <option>Workshop</option>
            <option>Internship</option>
            <option>Other</option>
          </select>
        </label>
        <label className="block mb-3">
          <span className="text-sm text-gray-300">Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full mt-1 p-2 bg-neutral-700 rounded-md text-white" />
        </label>
        <div className="flex gap-4 mb-3">
          <label className="flex-1">
            <span className="text-sm text-gray-300">Issue Date</span>
            <Input type="date" value={issueDate || ''} onChange={(e) => setIssueDate(e.target.value)} className="mt-1" />
          </label>
          <label className="flex-1">
            <span className="text-sm text-gray-300">Expiry Date</span>
            <Input type="date" value={expiryDate || ''} onChange={(e) => setExpiryDate(e.target.value)} className="mt-1" />
          </label>
        </div>
        <label className="flex items-center mb-4">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="mr-2" />
          <span className="text-sm text-gray-300">Private</span>
        </label>
        {/* simple validation */}
        {title.trim() === '' && <div className="text-red-400 mb-3">Title is required</div>}
        {issueDate && expiryDate && issueDate > expiryDate && <div className="text-red-400 mb-3">Expiry date must be after issue date</div>}
        <div className="flex gap-3 justify-end">
          <Button onClick={onClose} className="bg-gray-600 hover:bg-gray-500">Cancel</Button>
          <Button disabled={title.trim() === '' || (issueDate && expiryDate && issueDate > expiryDate)} onClick={() => onSave({ title: title.trim(), issuing_authority: issuingAuthority.trim(), category, notes: notes.trim(), issue_date: issueDate || null, expiry_date: expiryDate || null, is_private: isPrivate })}>Save</Button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ session }) {
  const [user, setUser] = useState(session?.user ?? null)
  const [certs, setCerts] = useState([])
  const [loading, setLoading] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const pendingDeleteRef = useRef(null)
  const [showUpload, setShowUpload] = useState(false)
  const [urls, setUrls] = useState({})
  const [selected, setSelected] = useState([])

  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
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

  // debounce local search input into query to reduce server requests
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      setQuery(searchTerm)
    }, 300)
    return () => clearTimeout(t)
  }, [searchTerm])

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
    // show undo option for 7s before actual deletion
    if (!confirm('Delete this certificate? You will have 7 seconds to undo.')) return
    setPendingDelete(c)
    // optimistic UI: remove from list immediately
    setCerts((cs) => cs.filter((x) => x.id !== c.id))
  const t = setTimeout(async () => {
      setLoading(true)
      try {
    // attempt robust removal (try several encodings)
    const removed = await tryRemoveStoragePath('certvault-certificates', c.storage_path)
    if (!removed) throw new Error('Failed to remove storage object for ' + c.storage_path)
    const { error: delErr } = await supabase.from('certificates').delete().eq('id', c.id)
    if (delErr) throw delErr
      } catch (err) {
        console.error('delete error', err)
        alert('Delete failed: ' + (err.message || String(err)))
      } finally {
        setLoading(false)
        setPendingDelete(null)
        pendingDeleteRef.current = null
      }
    }, 7000)
    pendingDeleteRef.current = t
  }

  function undoDelete() {
    if (!pendingDelete) return
    // cancel scheduled delete and restore item into list
    if (pendingDeleteRef.current) clearTimeout(pendingDeleteRef.current)
    setCerts((cs) => [pendingDelete, ...(cs || [])])
    setPendingDelete(null)
    pendingDeleteRef.current = null
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
        // remove storage objects one-by-one using robust remover
        const failed = []
        await Promise.all(data.map(async (d) => {
          try {
            const ok = await tryRemoveStoragePath('certvault-certificates', d.storage_path)
            if (!ok) failed.push(d.storage_path)
          } catch (err) {
            console.warn('bulk remove attempt failed for', d.storage_path, err)
            failed.push(d.storage_path)
          }
        }))
        if (failed.length) throw new Error('Failed to remove some storage objects: ' + failed.join(', '))
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
    <div className="min-h-screen bg-neutral-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Header userEmail={user?.email} onUploadToggle={() => setShowUpload((s) => !s)} onSignOut={signOut} showUpload={showUpload} />

        {showUpload ? (
          <Upload authoritySuggestions={authoritySuggestions} onUploaded={(payload) => {
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
          <section className="mt-8">
            <h3 className="text-2xl font-semibold mb-4">Your certificates</h3>
            {loading && <p className="text-gray-400">Loading...</p>}
            {!loading && certs.length === 0 && <p className="text-gray-400">No certificates yet. Use Upload to add PDF or images.</p>}

            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-64">
                <label className="block text-sm text-gray-300 mb-1">Search title</label>
                <Input placeholder="Search title..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="flex-1 min-w-64">
                <label className="block text-sm text-gray-300 mb-1">Issuing authority</label>
                <Input placeholder="Issuing authority" list="auth-list" value={filterAuthority} onChange={(e) => setFilterAuthority(e.target.value)} />
                <datalist id="auth-list">
                  {authoritySuggestions.map((a) => <option key={a} value={a} />)}
                </datalist>
              </div>
              <div className="min-w-48">
                <label className="block text-sm text-gray-300 mb-1">Category</label>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full px-3 py-2 rounded-md bg-neutral-700 border border-neutral-600 text-white">
                <option value="">All categories</option>
                <option value="Academic">Academic</option>
                <option value="Online Course">Online Course</option>
                <option value="Competition">Competition</option>
                <option value="Workshop">Workshop</option>
                <option value="Internship">Internship</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="min-w-32">
              <label className="block text-sm text-gray-300 mb-1">From</label>
              <Input type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} />
            </div>
            <div className="min-w-32">
              <label className="block text-sm text-gray-300 mb-1">To</label>
              <Input type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} />
            </div>
            <Button onClick={() => { setPage(1) }}>Apply</Button>
            <Button onClick={() => { setQuery(''); setFilterCategory(''); setFilterAuthority(''); setFilterFromDate(''); setFilterToDate(''); setPage(1) }} className="bg-gray-600 hover:bg-gray-500">Clear</Button>
          </div>
          {/* Undo snackbar for deletes */}
          {pendingDelete && (
            <Toast message={`Deleted "${pendingDelete.title || pendingDelete.file_name}"`} actionLabel="Undo" onAction={undoDelete} />
          )}

          {/* Bulk action toolbar */}
          {selected.length > 0 && (
            <div className="mb-4 p-3 bg-neutral-800 rounded-lg flex items-center gap-3 flex-wrap">
              <strong className="text-white mr-2">{selected.length} selected</strong>
              <div className="flex gap-2">
                <Button onClick={bulkDelete} className="bg-red-600 hover:bg-red-500 px-3 py-1 text-sm">Delete</Button>
                <Button onClick={bulkDownload} className="bg-blue-600 hover:bg-blue-500 px-3 py-1 text-sm"><FaDownload className="inline mr-2" />Download</Button>
                <Button onClick={() => setSelected([])} className="bg-gray-600 hover:bg-gray-500 px-3 py-1 text-sm">Clear</Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {certs.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex items-center">
                    <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} className="mr-2" />
                  </div>
                  <div className="flex-1">
                    <div className="w-full h-32 bg-neutral-700 rounded-md flex items-center justify-center mb-3">
                      {urls[c.id] ? (
                        c.mime_type?.startsWith('image') ? (
                          <img src={urls[c.id]} alt={c.file_name} className="w-full h-full object-cover rounded-md" />
                        ) : (
                          <a href={urls[c.id]} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">Download</a>
                        )
                      ) : (
                        <Button onClick={async () => await generateUrlForCert(c)} className="text-sm">Preview</Button>
                      )}
                    </div>
                    <h4 className="font-semibold text-lg mb-1">{c.title || c.file_name}</h4>
                    <p className="text-gray-400 text-sm mb-1">{c.issuing_authority} • {c.category}</p>
                    <p className="text-gray-500 text-xs">{c.issue_date}</p>
                    <div className="mt-3 flex gap-2">
                      {urls[c.id] ? (
                        <Button onClick={() => window.open(urls[c.id], '_blank')} className="text-sm">Open</Button>
                      ) : (
                        <Button onClick={async () => await generateUrlForCert(c)} className="text-sm">Get URL</Button>
                      )}
                      <Button onClick={() => setEditing(c)} className="text-sm bg-yellow-600 hover:bg-yellow-500">Edit</Button>
                      <Button onClick={() => handleDelete(c)} className="text-sm bg-red-600 hover:bg-red-500">Delete</Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-6 flex justify-between items-center">
            <div className="text-gray-400">
              Showing {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, total)} of {total}
              {selected.length > 0 && <span className="ml-4 text-white">{selected.length} selected</span>}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="bg-gray-600 hover:bg-gray-500">Prev</Button>
              <Button onClick={() => setPage((p) => p + 1)} disabled={page * PAGE_SIZE >= total} className="bg-gray-600 hover:bg-gray-500">Next</Button>
            </div>
          </div>
        </section>
      )}

      {editing && <EditModal cert={editing} onClose={() => setEditing(null)} onSave={(updates) => { handleEdit(editing, updates); setEditing(null) }} />}
      </div>
    </div>
  )
}
