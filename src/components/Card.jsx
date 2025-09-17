export default function Card({ children, className = '' }) {
  return (
    <div className={`bg-neutral-900 text-white p-4 rounded-lg shadow ${className}`}>
      {children}
    </div>
  )
}
