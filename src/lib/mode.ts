import { useSyncExternalStore } from 'react'

export type UiMode = 'playful' | 'serious'

/** Reads the mode from <html data-mode> so any component can follow it. */
function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] })
  return () => obs.disconnect()
}
const get = () => (document.documentElement.dataset.mode === 'serious' ? 'serious' : 'playful') as UiMode

export function useUiMode(): UiMode {
  return useSyncExternalStore(subscribe, get, () => 'playful')
}
