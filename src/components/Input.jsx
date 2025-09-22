export default function Input({ className = '', ...props }) {
  // Use theme tokens so inputs are readable in both light and dark themes
  return (
    <input
      className={`px-3 py-2 rounded-md bg-input border border-secondary text-text-primary focus:border-primary-solid focus:outline-none ${className}`}
      {...props}
    />
  )
}
