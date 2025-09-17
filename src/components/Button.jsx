export default function Button({ children, className = '', ...props }) {
  return (
    <button className={`px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition ${className}`} {...props}>
      {children}
    </button>
  )
}
