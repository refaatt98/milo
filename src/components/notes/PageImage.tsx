import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { getFileBlob } from '../../lib/pdf'

/** Object URL for an imported file (local cache first, then the account's storage). */
export function useFileUrl(fileId: string) {
  const [url, setUrl] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    let made: string | null = null
    void getFileBlob(fileId).then((b) => {
      if (!alive) return
      if (!b) return setUrl(null)
      made = URL.createObjectURL(b)
      setUrl(made)
    })
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [fileId])
  return url
}

export function PageImage({ fileId }: { fileId: string }) {
  const url = useFileUrl(fileId)
  if (url === undefined) return <div className="size-full animate-pulse rounded bg-black/5" />
  if (url === null)
    return (
      <div className="grid size-full place-items-center rounded bg-black/5 text-ink-faint" title="الصورة لسا ما وصلت لهاد الجهاز">
        <ImageOff size={22} />
      </div>
    )
  return <img src={url} alt="" draggable={false} className="pointer-events-none size-full rounded-[2px] object-cover" />
}
