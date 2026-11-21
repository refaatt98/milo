import { useCallback, useEffect, useRef, useState } from 'react'
import { PageCanvas, type ToolState } from './PageCanvas'
import type { Notebook, NotePage, PageContent } from '../../lib/db'
import { PAGE_H, PAGE_W } from '../../lib/ink'
import { readContent, writeContent } from '../../lib/notes'

/** What the shared toolbar can do with one page of the scroll. */
export interface PageHandle {
  getContent: () => PageContent | null
  change: (c: PageContent, record?: boolean) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  flush: () => Promise<void>
}

export function hasContent(c: PageContent | null | undefined) {
  return !!c && c.strokes.length + c.texts.filter((t) => t.text.trim()).length + c.stickers.length + (c.images?.length ?? 0) > 0
}

interface Props {
  nb: Notebook
  page: NotePage
  width: number
  tools: ToolState
  selected: string | null
  onSelect: (id: string | null) => void
  register: (id: string, h: PageHandle | null) => void
  onHistory: () => void
  /** fired the first time an empty page gets content */
  onFirstContent: (pageId: string) => void
  onDropFiles: (files: File[], at: { x: number; y: number }, pageId: string) => void
}

/** One page in the vertical scroll: loads, edits, saves and keeps its own undo history. */
export function PageEditor({ nb, page, width, tools, selected, onSelect, register, onHistory, onFirstContent, onDropFiles }: Props) {
  const [content, setContent] = useState<PageContent | null>(null)
  const contentRef = useRef<PageContent | null>(null)
  contentRef.current = content
  const undo = useRef<PageContent[]>([])
  const redo = useRef<PageContent[]>([])
  const pending = useRef<PageContent | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  const lastWrite = useRef(0)

  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current)
    const c = pending.current
    if (!c) return
    pending.current = null
    lastWrite.current = Date.now() + 2000 // our own save echoing back is not a "remote" change
    await writeContent(nb, page.id, c)
  }, [nb, page.id])

  // load on mount
  useEffect(() => {
    let alive = true
    void readContent(nb, page).then((c) => alive && setContent(c))
    return () => {
      alive = false
    }
  }, [page.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // the same page changed on another device → reload (unless we have unsaved edits)
  useEffect(() => {
    if (!contentRef.current || pending.current || page.updatedAt <= lastWrite.current) return
    let alive = true
    void readContent(nb, page).then((c) => alive && setContent(c))
    return () => {
      alive = false
    }
  }, [page.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // save when scrolled away (unmounted) or when the app is hidden
  useEffect(() => {
    const onHide = () => void flush()
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
      void flush()
    }
  }, [flush])

  const change = useCallback(
    (c: PageContent, record = true) => {
      const prev = contentRef.current
      if (record && prev) {
        undo.current.push(prev)
        if (undo.current.length > 60) undo.current.shift()
        redo.current = []
      }
      if (record && !hasContent(prev) && hasContent(c)) onFirstContent(page.id)
      contentRef.current = c
      setContent(c)
      pending.current = c
      clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => void flush(), 600)
      onHistory()
    },
    [flush, onHistory, onFirstContent, page.id],
  )

  useEffect(() => {
    register(page.id, {
      getContent: () => contentRef.current,
      change,
      undo: () => {
        const prev = undo.current.pop()
        const cur = contentRef.current
        if (!prev || !cur) return
        redo.current.push(cur)
        change(prev, false)
      },
      redo: () => {
        const next = redo.current.pop()
        const cur = contentRef.current
        if (!next || !cur) return
        undo.current.push(cur)
        change(next, false)
      },
      canUndo: () => undo.current.length > 0,
      canRedo: () => redo.current.length > 0,
      flush,
    })
    return () => register(page.id, null)
  }, [page.id, change, flush, register])

  if (!content) return <div className="animate-pulse rounded-md bg-white" style={{ width, height: (width * PAGE_H) / PAGE_W }} />
  return (
    <PageCanvas
      content={content}
      paper={page.paper ?? nb.paper}
      paperColor={nb.paperColor}
      bg={page.bg}
      width={width}
      tools={tools}
      onChange={change}
      selected={selected}
      onSelect={onSelect}
      onDropFiles={(files, at) => onDropFiles(files, at, page.id)}
    />
  )
}
