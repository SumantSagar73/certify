export default function Input({ className = '', ...props }) {
  return (
    <input className={`px-3 py-2 rounded-md bg-neutral-800 border border-neutral-700 focus:border-indigo-500 focus:outline-none ${className}`} {...props} />
  )
}
