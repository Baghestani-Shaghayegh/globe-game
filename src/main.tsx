import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'
import { startAppearance } from './lib/appearance'
import { reviewMode } from './lib/youtube'

startAppearance()
// Before the router tidies the address: ?review=youtube is kept for the tab.
reviewMode()

// Page views go to Vercel Web Analytics (cookieless). Sign-in links and the
// YouTube callback carry tokens in the query and hash, so only `ref` — the tag
// on links we post elsewhere — survives into what is sent.
function keepOnlyRef(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url)
  const ref = url.searchParams.get('ref')
  url.search = ref ? `?ref=${encodeURIComponent(ref)}` : ''
  url.hash = ''
  return { ...event, url: url.toString() }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics beforeSend={keepOnlyRef} />
  </StrictMode>,
)
