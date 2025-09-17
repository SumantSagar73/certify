import { FaSignOutAlt, FaUpload } from 'react-icons/fa'
export default function Header({ userEmail, onUploadToggle, onSignOut, showUpload }) {
  return (
    <header className="flex items-center justify-between py-4">
      <h1 className="text-2xl font-bold">CertVault</h1>
      <div className="flex items-center gap-3">
        <span className="text-sm opacity-80">{userEmail}</span>
        <button className="px-3 py-2 rounded-md bg-neutral-800" onClick={onUploadToggle}>{showUpload ? 'Back' : (<><FaUpload className="inline mr-2"/> Upload</>)}</button>
        <button className="px-3 py-2 rounded-md bg-neutral-800" onClick={onSignOut}><FaSignOutAlt /></button>
      </div>
    </header>
  )
}
