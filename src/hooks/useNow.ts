import { useEffect, useState } from 'react'

/** Re-renders every `interval` ms while `active`, and on tab visibility changes. */
export function useNow(active = true, interval = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const onVis = () => tick()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    window.addEventListener('pageshow', onVis)
    let id: number | undefined
    if (active) id = window.setInterval(tick, interval)
    tick()
    return () => {
      if (id) clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onVis)
      window.removeEventListener('pageshow', onVis)
    }
  }, [active, interval])
  return now
}
