export default function IconButton({ children, className = '', ...props }) {
  return (
    <button className={`p-2 rounded-md bg-neutral-800 hover:bg-neutral-700 ${className}`} {...props}>{children}</button>
  )
}
