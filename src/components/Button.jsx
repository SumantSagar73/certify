export default function Button({ children, className = '', variant = 'primary', ...props }) {
  const base = 'btn'
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    muted: 'btn-muted',
    warning: 'btn-warning',
    ghost: 'btn-ghost',
  }

  const cls = `${base} ${variants[variant] || variants.primary} ${className}`.trim()
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  )
}
