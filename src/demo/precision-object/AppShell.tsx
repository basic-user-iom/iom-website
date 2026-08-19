import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  headerEnd?: ReactNode
}

export function AppShell({ children, headerEnd }: Props) {
  return (
    <div className="pov-page">
      <a className="pov-skip" href="#viewer">
        Skip to viewer
      </a>
      <header className="pov-header">
        <a className="pov-brand" href="https://iobjectm.com/">
          IOM
        </a>
        <div className="pov-header__end">
          <p className="pov-header__meta">Precision object study</p>
          {headerEnd}
        </div>
      </header>
      {children}
    </div>
  )
}
