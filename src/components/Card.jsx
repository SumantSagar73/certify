export default function Card({ children, className = '', ...props }) {
  // Use theme tokens for background and text so cards follow light/dark themes
  return (
    <div {...props} className={`bg-card text-text-primary p-4 rounded-lg shadow ${className}`}>
      {children}
    </div>
  )
}
