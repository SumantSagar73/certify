import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Button from './Button'

export default function HelpTour({ open = false, steps = [], onClose = () => {} }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!open) return
    const apply = () => {
      // clear previous highlights
      document.querySelectorAll('.help-highlight').forEach((el) => el.classList.remove('help-highlight'))
      const sel = steps[index]?.selector
      if (sel) {
        const el = document.querySelector(sel)
        if (el) el.classList.add('help-highlight')
      }
    }
    apply()
    return () => document.querySelectorAll('.help-highlight').forEach((el) => el.classList.remove('help-highlight'))
  }, [open, index, steps])

  useEffect(() => {
    const onKey = (e) => {
      if (!open) return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' || e.key === 'Enter') setIndex((i) => Math.min(steps.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, steps.length, onClose])

  if (!open) return null

  const step = steps[index] || {}

  const node = (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 p-4" style={{ zIndex: 99999 }}>
      <div className="w-full max-w-xl bg-card rounded-lg p-6 shadow-lg" style={{ zIndex: 100000 }}>
        <h3 className="text-lg font-semibold mb-2 text-text-primary">{step.title || 'Help'}</h3>
        <p className="text-sm text-text-secondary mb-4">{step.content}</p>

        <div className="flex items-center justify-between">
          <div className="text-sm text-text-secondary">Step {index + 1} of {steps.length}</div>
          <div className="flex gap-2">
            <Button type="button" variant="muted" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>Prev</Button>
            {index < steps.length - 1 ? (
              <Button type="button" variant="secondary" onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}>Next</Button>
            ) : (
              <Button type="button" variant="primary" onClick={() => { onClose(); setIndex(0) }}>Done</Button>
            )}
          </div>
        </div>

        <div className="mt-3 text-xs text-text-secondary">You can reopen this from Help in the header.</div>
      </div>
    </div>
  )

  try {
    return createPortal(node, document.body)
  } catch {
    // Fallback: if portals aren't available for some reason, render inline
    return node
  }
}
