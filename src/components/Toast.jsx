import Button from './Button'

export default function Toast({ message, actionLabel, onAction }) {
  if (!message) return null
  return (
    <div className="fixed left-4 bottom-4 bg-neutral-900 text-white p-3 rounded-md shadow flex items-center gap-3">
      <div>{message}</div>
    {actionLabel && <Button variant="primary" onClick={onAction} className="ml-2 px-3 py-1">{actionLabel}</Button>}
    </div>
  )
}
