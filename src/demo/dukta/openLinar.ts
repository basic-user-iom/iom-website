import type { MouseEvent } from 'react'
import { unlockLinarForTrustedEntry } from '../dukta-linar-concept/auth'
import { LINAR_CONFIGURATOR } from './data/site'

export const LINAR_CONFIGURATOR_HREF = LINAR_CONFIGURATOR

/**
 * Open LINAR from the dukta website without the configurator password.
 * Direct visits to `/demos/dukta-linar-concept/` still require the original password.
 */
export function openLinarConfigurator(event?: MouseEvent<HTMLAnchorElement>) {
  event?.preventDefault()
  unlockLinarForTrustedEntry()
  window.location.assign(LINAR_CONFIGURATOR)
}
