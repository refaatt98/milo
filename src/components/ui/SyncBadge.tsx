import { useEffect, useState } from 'react'
import { Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { sync, type SyncState } from '../../lib/sync'

export function SyncBadge({ withLabel = false }: { withLabel?: boolean }) {
  const [s, setS] = useState<{ state: SyncState; pending: number }>({ state: sync.state, pending: 0 })
  useEffect(() => sync.subscribe((state, pending) => setS({ state, pending })), [])
  const label =
    s.state === 'offline' ? 'بدون إنترنت — محفوظ عالجهاز' : s.state === 'error' ? 'مشكلة بالمزامنة، رح نحاول كمان' : s.state === 'syncing' || s.pending ? 'عم نحفظ بالحساب…' : 'محفوظ بالحساب'
  const Icon = s.state === 'offline' ? CloudOff : s.state === 'error' ? AlertTriangle : s.state === 'syncing' || s.pending ? RefreshCw : Cloud
  return (
    <button onClick={() => void sync.sync()} title={label} aria-label={label} className="flex min-h-10 items-center gap-1.5 rounded-full px-2 text-xs text-ink-soft">
      <Icon size={16} className={s.state === 'syncing' ? 'animate-spin' : s.state === 'error' ? 'text-[#C0603F]' : ''} />
      {withLabel && <span>{label}</span>}
    </button>
  )
}
