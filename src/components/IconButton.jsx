export default function IconButton({ children, className = '', ...props }) {
  return (
  <button className={`p-2 rounded-md bg-card hover:opacity-90 ${className}`} {...props}>{children}</button>
  )
}
