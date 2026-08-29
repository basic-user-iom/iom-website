import { useEffect } from 'react'
import { create } from 'zustand'
import { OPTIONS, getDefaultValues } from '../config/productConfig.js'
import { configFromSearch, writeConfigToUrl } from '../utils/shareConfig.js'

export const useConfigurator = create((set, get) => ({
  values: { ...getDefaultValues(), ...configFromSearch() },
  sheen: 0,
  setOption: (id, value) => {
    const option = OPTIONS[id]
    if (!option) return
    const prev = get().values[id]
    if (prev === value) return
    set({
      values: { ...get().values, [id]: value },
      sheen: option.target === 'wood' || id === 'finish' ? get().sheen + 1 : get().sheen,
    })
  },
  reset: () => set({ values: getDefaultValues(), sheen: get().sheen + 1 }),
  hydrateFromUrl: () => set({ values: { ...getDefaultValues(), ...configFromSearch() } }),
}))

export function useConfigSync() {
  const values = useConfigurator((state) => state.values)
  useEffect(() => {
    writeConfigToUrl(values)
  }, [values])
}
