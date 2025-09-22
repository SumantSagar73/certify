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
  const [customCategory, setCustomCategory] = useState('')
  const [userId, setUserId] = useState(null)
  const [categories, setCategories] = useState(['Academic', 'Online Course', 'Competition', 'Workshop', 'Internship', 'Other'])
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
  const [errors, setErrors] = useState({})

  // load per-user categories when component mounts
  useState(() => {
    ;(async () => {
      try {
        const { data: userData } = await supabase.auth.getUser()
        const uid = userData?.user?.id
        if (uid) {
          setUserId(uid)
          const key = `certvault:categories:${uid}`
          const prev = JSON.parse(localStorage.getItem(key) || '[]')
          if (prev && prev.length) setCategories((c) => Array.from(new Set([...(c || []), ...prev])))
        }
      } catch {
        // ignore
      }
    })()
  })

  async function handleSubmit(e) {
    e.preventDefault()
  setMessage('')
  setErrors({})
  // required fields: file, title, category (or custom), issue date, issuing authority
  const newErrors = {}
  if (!file) newErrors.file = 'Please select a file'
  if (!title || !title.trim()) newErrors.title = 'Please provide a title'
  if (!issuingAuthority || !issuingAuthority.trim()) newErrors.issuingAuthority = 'Please provide the issuing authority'
  if (!issueDate) newErrors.issueDate = 'Please provide the issue date'
  if (!category) newErrors.category = 'Please select a category'
  if (category === 'Other' && (!customCategory || !customCategory.trim())) newErrors.customCategory = 'Please name the new category'
  if (Object.keys(newErrors).length) return setErrors(newErrors)
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
  // encode path but keep slashes for storage path
  const encodedPath = path.split('/').map((p) => encodeURIComponent(p)).join('/')
  const uploadUrl = `${base.replace(/\/$/, '')}/storage/v1/object/${bucket}/${encodedPath}`

            try {
              await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest()
                xhr.open('PUT', uploadUrl, true)
                if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
                // set content type for the uploaded file
                if (file.type) xhr.setRequestHeader('Content-Type', file.type)
                xhr.setRequestHeader('x-upsert', 'false')
                xhr.upload.onprogress = function (e) {
                  if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
                }
                xhr.onload = function () {
                  if (xhr.status >= 200 && xhr.status < 300) resolve(true)
                  else {
                    const body = xhr.responseText || ''
                    // provide a hint when common bucket-not-found error occurs
                    if (xhr.status === 400 && /bucket/.test(body.toLowerCase())) {
                      console.error('Storage returned 400 — check that the bucket exists and VITE_SUPABASE_BUCKET is set to the correct name')
                    }
                    reject(new Error(`XHR upload failed: ${xhr.status} ${body}`))
                  }
                }
                xhr.onerror = function () { reject(new Error('Upload network error')) }
                xhr.send(file)
              })
            } catch (xhrErr) {
              // log XHR error and attempt fallback via supabase client upload; only show error if fallback fails
              console.warn('XHR upload failed, falling back to supabase.storage.upload:', xhrErr)
              const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { upsert: false })
              if (uploadError) {
                // include fallback error in UI
                const msg = uploadError.message || String(uploadError)
                setMessage(`Upload failed: ${xhrErr.message || 'XHR upload failed'}; fallback failed: ${msg}`)
                throw uploadError
              }
              // best-effort: set progress to complete
              setProgress(100)
            }

  // currentUser determined
  // prepare payload

        // decide category to save (support custom per-user category)
        const categoryToSave = category === 'Other' ? customCategory.trim() : category

        // store metadata in certificates table
        const { data: _data, error: insertError } = await supabase.from('certificates').insert([
            {
          user_id: currentUser.id,
              title: title || file.name,
              issuing_authority: issuingAuthority,
              issue_date: issueDate || null,
              expiry_date: expiryDate || null,
              category: categoryToSave,
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
        const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
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
  setCustomCategory('')
      setNotes('')
      setIsPrivate(true)

    // pass the newly created record info to the parent so it can display
  // when using .single() Supabase returns a single object in `data`
  const created = _data ?? null
  // notify parent component; Dashboard handles merging via realtime or verifyCreated
  onUploaded && onUploaded({ created, signedUrl })
  
    // persist the custom category for this user locally so it's available next time
  try {
    if (created && userId && category === 'Other' && customCategory && customCategory.trim()) {
      const key = `certvault:categories:${userId}`
      const prev = JSON.parse(localStorage.getItem(key) || '[]')
      const merged = Array.from(new Set([...(prev || []), customCategory.trim()]))
      localStorage.setItem(key, JSON.stringify(merged))
      setCategories((c) => Array.from(new Set([...(c || []), customCategory.trim()])))
    }
  } catch {
    // ignore localStorage errors
  }
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
    <div className="p-6 max-w-3xl mx-auto animate-fade-in">
      <Card className="bg-card rounded-lg shadow-lg">
        <h3 className="text-xl font-semibold mb-3 text-text-primary">Upload certificate</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">File (PDF, JPG, PNG) <span className="text-red-400">*</span></label>
            <input type="file" accept="application/pdf,image/*" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); }} className="w-full px-3 py-2 bg-input border border-secondary rounded-md text-text-primary transition-all duration-300 focus:ring-2 focus:ring-primary" />
            {errors.file && <div className="text-sm text-red-400 mt-1">{errors.file}</div>}
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <div className="text-sm text-gray-400">{progress}%</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Title <span className="text-red-400">*</span></label>
              <Input placeholder="e.g. AWS Certified Cloud Practitioner" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-input border-secondary text-text-primary focus:ring-primary" />
              {errors.title && <div className="text-sm text-red-400 mt-1">{errors.title}</div>}
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Issuing Authority <span className="text-red-400">*</span></label>
              <div className="relative">
                <Input
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
                  <div className="absolute left-0 right-0 bg-card border border-secondary rounded-md mt-1 max-h-40 overflow-y-auto z-40">
                    {filteredAuths.map((a, i) => (
                      <div key={a}
                        onMouseDown={(ev) => { ev.preventDefault(); setIssuingAuthority(a); setShowSuggestions(false) }}
                        className={`px-3 py-2 cursor-pointer ${i === highlight ? 'bg-input' : 'hover:bg-input'}`}>
                        {a}
                      </div>
                    ))}
                  </div>
                )}
                {errors.issuingAuthority && <div className="text-sm text-red-400 mt-1">{errors.issuingAuthority}</div>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Issue Date <span className="text-red-400">*</span></label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              {errors.issueDate && <div className="text-sm text-red-400 mt-1">{errors.issueDate}</div>}
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Expiry Date</label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Category <span className="text-red-400">*</span></label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 rounded-md bg-input border border-secondary text-text-primary transition-all duration-300 focus:ring-2 focus:ring-primary">
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {category === 'Other' && (
                <div>
                  <input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Name your category" className="mt-2 w-full px-3 py-2 rounded-md bg-input border border-secondary text-text-primary" />
                  {errors.customCategory && <div className="text-sm text-red-400 mt-1">{errors.customCategory}</div>}
                </div>
              )}
              {errors.category && <div className="text-sm text-red-400 mt-1">{errors.category}</div>}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-2 bg-input rounded-md text-text-primary border border-secondary transition-all duration-300 focus:ring-2 focus:ring-primary" />
          </div>

          <div className="flex items-center">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="mr-2" />
            <label className="text-sm text-gray-300">Private (default)</label>
          </div>

          <div className="pt-4">
            <Button type="submit" disabled={loading} className="w-full md:w-auto" variant="secondary" aria-label="Upload certificate">Upload</Button>
          </div>

          {message && <p className="text-sm text-red-400">{message}</p>}
        </form>
      </Card>
    </div>
  )
}
