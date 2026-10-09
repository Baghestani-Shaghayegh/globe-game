import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startAppearance } from './lib/appearance'
import { reviewMode } from './lib/youtube'

startAppearance()
// Before the router tidies the address: ?review=youtube is kept for the tab.
reviewMode()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
