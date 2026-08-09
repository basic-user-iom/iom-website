import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { isCustomCursorSupported } from './cursor/support'
import './index.css'

// Show React UI even if async CSS has not flipped `css-ready` yet (mobile/slow nets).
document.documentElement.classList.add('app-ready')

const CustomCursor = lazy(() =>
  import('./cursor').then((m) => ({ default: m.CustomCursor })),
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isCustomCursorSupported() ? (
      <Suspense fallback={null}>
        <CustomCursor />
      </Suspense>
    ) : null}
    <App />
  </StrictMode>,
)
