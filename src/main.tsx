import { Component, lazy, StrictMode, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { isCustomCursorSupported } from './cursor/support'
import './index.css'

const CustomCursor = lazy(() =>
  import('./cursor').then((m) => ({ default: m.CustomCursor })),
)

class RootErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app] rendering failed', error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      return (
        <>
          <header className="site-header">
            <a className="header-brand" href="/">
              <span className="brand-text">
                <span className="brand-name">IOM</span>
                <span className="brand-tag">Interactive Object Media</span>
              </span>
            </a>
            <nav className="header-nav" aria-label="Fallback navigation">
              <a href="/#software">Software</a>
              <a href="/#music">Music</a>
              <a href="/#about">About</a>
              <a href="/#contact">Contact</a>
            </nav>
            <a className="app-load-home" href="/">Home</a>
          </header>
          <main id="main-content" className="app-load-error">
            <h1>This page could not finish loading.</h1>
            <p>The main navigation is still available. Reload the page to try the download again.</p>
          </main>
        </>
      )
    }
    return this.props.children
  }
}

const rootNode = document.getElementById('root')
const mainCssLoaded =
  getComputedStyle(document.documentElement).getPropertyValue('--iom-css-loaded').trim() === '1'

if (!rootNode) {
  console.error('[app] #root is missing; keeping the static document fallback')
} else if (!mainCssLoaded) {
  console.error('[app] main stylesheet did not load; keeping the styled static fallback')
} else {
  createRoot(rootNode).render(
    <StrictMode>
      {isCustomCursorSupported() ? (
        <Suspense fallback={null}>
          <CustomCursor />
        </Suspense>
      ) : null}
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </StrictMode>,
  )
}
