import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/index.css'

// Ask the browser not to evict our IndexedDB under storage pressure.
if (navigator.storage?.persist) void navigator.storage.persist().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
