import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

export function AppShell({ children }: Props) {
  return (
    <div className="pov-page">
      <a className="pov-skip" href="#viewer">
        Skip to viewer
      </a>
      <header className="pov-header">
        <a className="pov-brand" href="https://iobjectm.com/">
          IOM
        </a>
        <p className="pov-header__meta">Precision object study</p>
      </header>
      {children}
    </div>
  )
}
