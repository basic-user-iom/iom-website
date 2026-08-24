import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  applyFontPairing,
  detectFontPairing,
  persistFontPairing,
  type FontPairingId,
} from './pairings'

type FontContextValue = {
  font: FontPairingId
  setFont: (id: FontPairingId) => void
}

const FontContext = createContext<FontContextValue | null>(null)

export function FontProvider({ children }: { children: ReactNode }) {
  const [font, setFontState] = useState<FontPairingId>(() =>
    typeof window === 'undefined' ? 'editorial' : detectFontPairing(),
  )

  const setFont = useCallback((id: FontPairingId) => {
    setFontState(id)
    persistFontPairing(id)
  }, [])

  useEffect(() => {
    applyFontPairing(font)
  }, [font])

  const value = useMemo<FontContextValue>(() => ({ font, setFont }), [font, setFont])

  return <FontContext.Provider value={value}>{children}</FontContext.Provider>
}

export function useFont(): FontContextValue {
  const ctx = useContext(FontContext)
  if (!ctx) throw new Error('useFont must be used within FontProvider')
  return ctx
}
