import { useEffect, useState } from 'react'
import Button from './Button'

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState(() => localStorage.getItem('certify:theme') || 'light')

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('certify:theme', theme)
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return (
    <div className="flex items-center">
      <Button
        onClick={toggle}
        variant="ghost"
        className="p-0 h-10 w-10 flex items-center justify-center theme-switcher-border"
        style={{ borderRadius: '9999px', padding: 0 }}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        <span style={{ fontSize: '18px', lineHeight: 1 }}>{theme === 'dark' ? '🌙' : '🌞'}</span>
      </Button>
    </div>
  )
}
