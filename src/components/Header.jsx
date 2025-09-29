import { FaSignOutAlt, FaUpload } from 'react-icons/fa'
import ThemeSwitcher from './ThemeSwitcher'
import Button from './Button'

export default function Header({ userEmail, onUploadToggle, onSignOut, showUpload, onHelp }) {
  return (
    <header className="flex items-center justify-between py-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-primary">Certify</h1>
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-secondary">{userEmail}</span>
        <ThemeSwitcher />
        <Button type="button" variant="secondary" onClick={onUploadToggle}>
          {showUpload ? 'Back' : (<><FaUpload className="inline mr-2"/> Upload</>)}
        </Button>
        <Button type="button" variant="ghost" onClick={onHelp} title="Help" aria-label="Help">Help</Button>
  <Button type="button" variant="ghost" onClick={() => { console.log('Header: signout click'); if (typeof onSignOut === 'function') onSignOut() }} title="Sign out"><FaSignOutAlt /></Button>
      </div>
    </header>
  )
}
