import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  FilePlus2,
  FileUp,
  FileDown,
  Hand,
  Lock,
  Mic,
  Pause,
  Play,
  Redo2,
  Ruler,
  Smile,
  ImagePlus,
  Square,
  Trash2,
  Type,
  Undo2,
  Volume2,
  VolumeX,
  Waves,
  Languages,
  ZoomIn,
  ZoomOut,
  Settings2,
  PenLine,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageCanvas, type ToolState } from '../components/notes/PageCanvas'
import { STICKERS, STICKER_IDS } from '../components/notes/stickers'
import { Button } from '../components/ui/Button'
import { Confirm } from '../components/ui/Confirm'
import { db, type Notebook, type NotePage, type PageContent, type PaperKind, type PenKind } from '../lib/db'
import { INK_COLORS, PAGE_H, PAGE_W, PAPERS, PAPER_COLORS, PENS, r1 } from '../lib/ink'
import { renderPage, exportNotebookPdf } from '../lib/render'
import { insertFile, storePageImage } from '../lib/pdf'
import { LANGS, translate } from '../lib/translate'
import { addPage, clipUrl, deletePage, readContent, removeClip, saveClip, unlockNotebook, writeContent } from '../lib/notes'
import { unlockedKeys } from '../lib/crypto'
import { useAuth } from '../lib/auth'
import { uid } from '../lib/id'
import { formatHMS } from '../lib/time'

const TOOLS_KEY = 'milonote:tools'
const DEFAULT_TOOLS: ToolState = { tool: 'pen', pen: 'ballpoint', color: '#27372F', size: 1, stabilizer: 0.35, ruler: false, asmr: false, pencilOnly: false }

export default function NotebookPage() {
  const { id = '' } = useParams()
  const nb = useLiveQuery(() => db.notebooks.get(id), [id])
  const pages = useLiveQuery(() => db.pages.where('notebookId').equals(id).sortBy('order'), [id])
  const [unlocked, setUnlocked] = useState(() => unlockedKeys.has(id))
  const nav = useNavigate()

  if (nb === undefined || pages === undefined) return <div className="grid min-h-dvh place-items-center text-ink-soft">…</div>
  if (!nb)
    return (
      <div className="grid min-h-dvh place-items-center text-center">
        <div>
          <p className="mb-4 text-ink-soft">الدفتر مش موجود.</p>
          <Button onClick={() => nav('/notes')}>رجوع للدفاتر</Button>
        </div>
      </div>
    )
  if (nb.lock && !unlocked) return <LockScreen nb={nb} onUnlocked={() => setUnlocked(true)} />
  return <Editor nb={nb} pages={pages} />
}

function LockScreen({ nb, onUnlocked }: { nb: Notebook; onUnlocked: () => void }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()
  return (
    <div className="pt-safe grid min-h-dvh place-items-center px-5">
      <form
        className="sheet w-full max-w-sm p-6 text-center"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          const ok = await unlockNotebook(nb, pw)
          setBusy(false)
          if (ok) onUnlocked()
          else setErr(true)
        }}
      >
        <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-butter">
          <Lock />
        </div>
        <h1 className="text-2xl font-extrabold">{nb.title}</h1>
        <p className="mb-4 text-sm text-ink-soft">هالدفتر مقفول. اكتب كلمة السر.</p>
        <input className="field mb-3 text-center" type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(false) }} autoFocus aria-label="كلمة السر" />
        {err && <p className="mb-3 text-sm text-[#8a3b22]" role="alert">كلمة السر غلط.</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="ghost" onClick={() => nav('/notes')}>رجوع</Button>
          <Button type="submit" disabled={!pw || busy}>افتح</Button>
        </div>
      </form>
    </div>
  )
}

function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(360)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function Editor({ nb, pages }: { nb: Notebook; pages: NotePage[] }) {
  const nav = useNavigate()
  const { session } = useAuth()
  const [params, setParams] = useSearchParams()
  const idx = Math.min(Math.max(0, Number(params.get('p') ?? 0)), Math.max(0, pages.length - 1))
  const page = pages[idx]
  const [tools, setTools] = useState<ToolState>(() => {
    try {
      return { ...DEFAULT_TOOLS, ...JSON.parse(localStorage.getItem(TOOLS_KEY) ?? '{}'), tool: 'pen' }
    } catch {
      return DEFAULT_TOOLS
    }
  })
  useEffect(() => localStorage.setItem(TOOLS_KEY, JSON.stringify(tools)), [tools])
  const [content, setContent] = useState<PageContent | null>(null)
  const contentRef = useRef<PageContent | null>(null)
  contentRef.current = content
  const [selected, setSelected] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [reading, setReading] = useState(false)
  const [panel, setPanel] = useState<null | 'stickers' | 'audio' | 'page' | 'pen' | 'translate'>(null)
  const [delPage, setDelPage] = useState(false)
  const undo = useRef<PageContent[]>([])
  const redo = useRef<PageContent[]>([])
  const lastWrite = useRef(0)
  const saveTimer = useRef<number | undefined>(undefined)
  const pending = useRef<PageContent | null>(null)
  const [, force] = useState(0)
  const [wrapRef, wrapW] = useContainerWidth()

  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current)
    const c = pending.current
    if (!c || !page) return
    pending.current = null
    lastWrite.current = Date.now()
    await writeContent(nb, page.id, c)
  }, [nb, page])

  // load page content (and reload when another device changed it)
  useEffect(() => {
    if (!page) return
    if (pending.current) return
    if (page.updatedAt <= lastWrite.current && content) return
    let alive = true
    void readContent(nb, page).then((c) => alive && setContent(c))
    return () => {
      alive = false
    }
  }, [page?.id, page?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // switching pages: save, reset history
  useEffect(() => {
    undo.current = []
    redo.current = []
    setSelected(null)
    setContent(null)
    lastWrite.current = 0
    return () => void flush()
  }, [page?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onHide = () => void flush()
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [flush])

  const change = useCallback(
    (c: PageContent, record = true) => {
      setContent((prev) => {
        if (record && prev) {
          undo.current.push(prev)
          if (undo.current.length > 60) undo.current.shift()
          redo.current = []
        }
        return c
      })
      pending.current = c
      clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => void flush(), 600)
    },
    [flush],
  )

  const doUndo = () => {
    const prev = undo.current.pop()
    if (!prev || !content) return
    redo.current.push(content)
    change(prev, false)
    force((x) => x + 1)
  }
  const doRedo = () => {
    const next = redo.current.pop()
    if (!next || !content) return
    undo.current.push(content)
    change(next, false)
    force((x) => x + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT') return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) doRedo()
        else doUndo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const go = async (i: number) => {
    await flush()
    setParams({ p: String(i) }, { replace: true })
  }
  const newPage = async () => {
    await flush()
    await addPage(nb, idx)
    setParams({ p: String(idx + 1) }, { replace: true })
  }

  const paper: PaperKind = page?.paper ?? nb.paper
  const pageW = Math.max(240, Math.min(wrapW - 24, 900) * zoom)

  const exportPng = async () => {
    if (!content || !page) return
    await flush()
    const c = await renderPage(content, { scale: 2, paper, paperColor: nb.paperColor, page })
    const a = document.createElement('a')
    a.href = c.toDataURL('image/png')
    a.download = `${nb.title}-ص${idx + 1}.png`
    a.click()
  }

  const [busyMsg, setBusyMsg] = useState<string | null>(null)
  const [fileErr, setFileErr] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)

  const exportPdf = async () => {
    await flush()
    setBusyMsg('عم نجهّز الـ PDF…')
    try {
      await exportNotebookPdf(nb, pages, (d, t) => setBusyMsg(`عم نجهّز الـ PDF… ${d}/${t}`))
    } catch {
      setFileErr('ما قدرنا نعمل الـ PDF. جرّب كمان مرة.')
    } finally {
      setBusyMsg(null)
    }
  }

  /** Places photos on the current page (centred in view, or where they were dropped). PDFs become pages. */
  const addFiles = async (files: File[], at?: { x: number; y: number }) => {
    if (!session) return
    const pdfs = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))
    const imgs = files.filter((f) => f.type.startsWith('image/'))
    if (!pdfs.length && !imgs.length) return setFileErr('بس صور أو ملفات PDF.')
    setFileErr(null)
    try {
      if (imgs.length) {
        setBusyMsg(imgs.length > 1 ? `عم نضيف ${imgs.length} صور…` : 'عم نضيف الصورة…')
        const added = []
        const viewTop = ((scroller.current?.scrollTop ?? 0) / pageW) * PAGE_W
        for (const [i, f] of imgs.entries()) {
          const { fileId, ratio } = await storePageImage(f, nb.id, session.user.id)
          let w = 560
          if (w * ratio > 760) w = 760 / ratio
          const h = w * ratio
          const cx = at ? at.x : PAGE_W / 2
          const cy = at ? at.y : Math.min(PAGE_H - h / 2 - 20, viewTop + 120 + h / 2)
          added.push({ id: uid(), fileId, ratio, w: r1(w), x: r1(cx - w / 2 + i * 30), y: r1(Math.max(10, cy - h / 2 + i * 30)), r: 0 })
        }
        const cur = contentRef.current
        if (cur) {
          change({ ...cur, images: [...(cur.images ?? []), ...added] })
          setTools((t) => ({ ...t, tool: 'hand' }))
          setSelected(added[added.length - 1].id)
        }
      }
      for (const f of pdfs) await insert(f)
    } catch (e) {
      setFileErr((e as Error).message)
    } finally {
      setBusyMsg(null)
    }
  }

  // paste a screenshot / copied photo straight onto the page
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT') return
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
      if (!files.length) return
      e.preventDefault()
      void addFiles(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  const insert = async (file: File) => {
    if (!session) return
    await flush()
    setFileErr(null)
    setBusyMsg('عم نضيف الملف…')
    try {
      await insertFile(nb, file, idx, session.user.id)
      setParams({ p: String(idx + 1) }, { replace: true })
      setPanel(null)
      setBusyMsg(null)
    } catch (e) {
      setBusyMsg(null)
      setFileErr((e as Error).message)
    }
  }

  const setTool = (patch: Partial<ToolState>) => setTools((t) => ({ ...t, ...patch }))

  if (reading) return <ReadingView nb={nb} pages={pages} onClose={() => setReading(false)} start={idx} />

  return (
    <div className="flex h-dvh flex-col bg-[#EEF0EC]">
      {/* top bar */}
      <header className="pt-safe z-30 flex items-center gap-2 border-b border-line bg-paper/95 px-2 pb-2 backdrop-blur">
        <IconButton label="رجوع" onClick={async () => { await flush(); nav('/notes') }}>
          <ArrowRight size={20} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold leading-tight">{nb.title}</h1>
          <p className="text-xs text-ink-soft">
            صفحة <span className="num">{idx + 1}</span> من <span className="num">{pages.length}</span>
            {nb.lock && ' · 🔒 مشفّر'}
          </p>
        </div>
        <IconButton label="تسجيل صوتي" active={panel === 'audio'} onClick={() => setPanel(panel === 'audio' ? null : 'audio')}>
          <Mic size={19} />
        </IconButton>
        <IconButton label="وضع القراءة" onClick={async () => { await flush(); setReading(true) }}>
          <BookOpenText size={19} />
        </IconButton>
        <IconButton label="إعدادات الصفحة" active={panel === 'page'} onClick={() => setPanel(panel === 'page' ? null : 'page')}>
          <Settings2 size={19} />
        </IconButton>
      </header>

      {/* tools */}
      <div className="z-20 border-b border-line bg-white">
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto px-2 py-1.5">
          {PENS.map((p) => (
            <PenButton key={p.kind} kind={p.kind} label={p.label} color={tools.color} active={tools.tool === 'pen' && tools.pen === p.kind} onClick={() => (tools.tool === 'pen' && tools.pen === p.kind ? setPanel(panel === 'pen' ? null : 'pen') : setTool({ tool: 'pen', pen: p.kind }))} />
          ))}
          <Divider />
          <IconButton label="ممحاة" active={tools.tool === 'eraser'} onClick={() => setTool({ tool: 'eraser' })}><Eraser size={19} /></IconButton>
          <IconButton label="نص" active={tools.tool === 'text'} onClick={() => setTool({ tool: 'text' })}><Type size={19} /></IconButton>
          <IconButton label="تحريك وتحديد" active={tools.tool === 'hand'} onClick={() => setTool({ tool: 'hand' })}><Hand size={19} /></IconButton>
          <IconButton label="ترجمة" active={panel === 'translate'} onClick={() => setPanel(panel === 'translate' ? null : 'translate')}><Languages size={19} /></IconButton>
          <IconButton label="صورة" onClick={() => imageInput.current?.click()}><ImagePlus size={19} /></IconButton>
          <IconButton label="ملصقات" active={panel === 'stickers'} onClick={() => setPanel(panel === 'stickers' ? null : 'stickers')}><Smile size={19} /></IconButton>
          <Divider />
          <IconButton label="المسطرة" active={tools.ruler} onClick={() => setTool({ ruler: !tools.ruler })}><Ruler size={19} /></IconButton>
          <IconButton label="مثبّت الكتابة" active={tools.stabilizer > 0.05} onClick={() => setPanel(panel === 'pen' ? null : 'pen')}><Waves size={19} /></IconButton>
          <IconButton label={tools.asmr ? 'صوت الكتابة شغّال' : 'صوت الكتابة'} active={tools.asmr} onClick={() => setTool({ asmr: !tools.asmr })}>{tools.asmr ? <Volume2 size={19} /> : <VolumeX size={19} />}</IconButton>
          <Divider />
          <IconButton label="تراجع" onClick={doUndo} disabled={!undo.current.length}><Undo2 size={19} /></IconButton>
          <IconButton label="إعادة" onClick={doRedo} disabled={!redo.current.length}><Redo2 size={19} /></IconButton>
        </div>
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto px-3 pb-2">
          {INK_COLORS.map((c) => (
            <button
              key={c}
              aria-label={`لون ${c}`}
              aria-pressed={tools.color === c}
              onClick={() => setTool({ color: c, tool: tools.tool === 'eraser' || tools.tool === 'hand' ? 'pen' : tools.tool })}
              className={`size-7 shrink-0 rounded-full border-[1.5px] transition ${tools.color === c ? 'scale-110 border-ink ring-2 ring-sage ring-offset-1' : 'border-black/15'}`}
              style={{ background: c }}
            />
          ))}
          <label className="relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-full border-[1.5px] border-dashed border-ink/40" title="لون مخصص" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}>
            <input type="color" className="absolute inset-0 opacity-0" value={tools.color} onChange={(e) => setTool({ color: e.target.value })} aria-label="لون مخصص" />
          </label>
          <input type="range" min={0.4} max={3} step={0.1} value={tools.size} onChange={(e) => setTool({ size: Number(e.target.value) })} className="ms-2 w-28 shrink-0 accent-[#6F9876]" aria-label="سماكة القلم" />
          <span className="num shrink-0 text-xs text-ink-soft">{tools.size.toFixed(1)}×</span>
        </div>
        <AnimatePresence>
          {panel && panel !== 'audio' && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-dashed border-line">
              {panel === 'stickers' && (
                <div className="no-scrollbar flex gap-2 overflow-x-auto p-2">
                  {STICKER_IDS.map((k) => (
                    <button
                      key={k}
                      title={STICKERS[k].label}
                      aria-label={`ملصق ${STICKERS[k].label}`}
                      onClick={() => {
                        if (!content) return
                        const scrollTop = scroller.current?.scrollTop ?? 0
                        const y = Math.min(PAGE_H - 200, ((scrollTop + 120) / pageW) * PAGE_W)
                        const st = { id: uid(), kind: k, x: 380 + Math.random() * 120, y: Math.max(40, y), s: 1, r: 0 }
                        change({ ...content, stickers: [...content.stickers, st] })
                        setTool({ tool: 'hand' })
                        setSelected(st.id)
                      }}
                      className="grid size-16 shrink-0 place-items-center rounded-2xl bg-paper p-1.5 ring-1 ring-line hover:bg-mint"
                    >
                      <span className="pointer-events-none size-12">{STICKERS[k].render()}</span>
                    </button>
                  ))}
                </div>
              )}
              {panel === 'translate' && content && (
                <TranslatePanel
                  initial={content.texts.find((t) => t.id === selected)?.text ?? ''}
                  onInsert={(text) => {
                    const box = { id: uid(), x: 120, y: Math.max(40, ((scroller.current?.scrollTop ?? 0) / pageW) * PAGE_W + 120), w: 560, text, size: 30, color: tools.color }
                    change({ ...content, texts: [...content.texts, box] })
                    setSelected(box.id)
                  }}
                />
              )}
              {panel === 'pen' && (
                <div className="grid gap-3 p-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 flex justify-between font-semibold">
                      <span>مثبّت الكتابة (خط أنعم)</span>
                      <span className="num">{Math.round(tools.stabilizer * 100)}%</span>
                    </span>
                    <input type="range" min={0} max={0.85} step={0.05} value={tools.stabilizer} onChange={(e) => setTool({ stabilizer: Number(e.target.value) })} className="w-full accent-[#6F9876]" />
                  </label>
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input type="checkbox" className="size-5 accent-[#6F9876]" checked={tools.pencilOnly} onChange={(e) => setTool({ pencilOnly: e.target.checked })} />
                    <span>
                      <span className="block font-semibold">قلم ستايلس بس</span>
                      <span className="text-xs text-ink-soft">الإصبع ما بيكتب (منع لمس الكف)</span>
                    </span>
                  </label>
                </div>
              )}
              {panel === 'page' && page && (
                <div className="space-y-3 p-3">
                  <div className="flex flex-wrap gap-2">
                    {PAPERS.map((p) => (
                      <button key={p.kind} onClick={() => db.pages.update(page.id, { paper: p.kind })} aria-pressed={paper === p.kind} className={`min-h-9 rounded-full px-3 text-sm font-semibold ring-1 ${paper === p.kind ? 'bg-ink text-white ring-ink' : 'bg-white ring-line'}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {PAPER_COLORS.map((c) => (
                      <button key={c} aria-label={`لون الورق ${c}`} onClick={() => db.notebooks.update(nb.id, { paperColor: c })} className={`size-8 rounded-full border-[1.5px] ${nb.paperColor === c ? 'border-ink ring-2 ring-sage ring-offset-1' : 'border-line'}`} style={{ background: c }} />
                    ))}
                    <div className="flex-1" />
                    <Button size="sm" variant="ghost" icon={<FileUp size={16} />} onClick={() => fileInput.current?.click()}>أضف PDF أو صورة</Button>
                    <Button size="sm" variant="ghost" icon={<FileDown size={16} />} onClick={exportPdf}>صدّر الدفتر PDF</Button>
                    <Button size="sm" variant="ghost" icon={<Download size={16} />} onClick={exportPng}>الصفحة PNG</Button>
                    <Button size="sm" variant="danger" icon={<Trash2 size={16} />} onClick={() => setDelPage(true)} disabled={pages.length <= 1}>احذف الصفحة</Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {panel === 'audio' && page && session && <AudioPanel nb={nb} pageId={page.id} userId={session.user.id} onClose={() => setPanel(null)} />}

      {/* page */}
      <div ref={(el) => { wrapRef.current = el; scroller.current = el }} className="relative flex-1 overflow-auto" onPointerDown={(e) => e.target === e.currentTarget && setSelected(null)}>
        <div className="flex min-h-full justify-center px-3 py-5" style={{ minWidth: pageW + 24 }}>
          {content && page ? (
            <PageCanvas content={content} paper={paper} paperColor={nb.paperColor} bg={page.bg} width={pageW} tools={tools} onChange={change} selected={selected} onSelect={setSelected} onDropFiles={(files, at) => void addFiles(files, at)} />
          ) : (
            <div className="animate-pulse rounded-md bg-white" style={{ width: pageW, height: (pageW * PAGE_H) / PAGE_W }} />
          )}
        </div>
      </div>

      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) void addFiles(files)
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void insert(f)
        }}
      />
      {(busyMsg || fileErr) && (
        <div className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4" style={{ bottom: 'calc(var(--safe-bottom) + 70px)' }}>
          <div className={`pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-lg ${fileErr ? 'bg-peach' : 'bg-ink text-white'}`} role="status">
            {busyMsg ?? fileErr}
            {fileErr && <button className="font-bold" onClick={() => setFileErr(null)} aria-label="سكّر">×</button>}
          </div>
        </div>
      )}

      {/* page nav */}
      <footer className="z-20 flex items-center gap-1 border-t border-line bg-paper/95 px-2 pt-1.5 backdrop-blur" style={{ paddingBottom: 'max(var(--safe-bottom), 8px)' }}>
        <IconButton label="الصفحة السابقة" onClick={() => go(idx - 1)} disabled={idx === 0}><ChevronRight size={20} /></IconButton>
        <div className="no-scrollbar flex flex-1 justify-center gap-1 overflow-x-auto">
          {pages.map((p, i) => (
            <button key={p.id} onClick={() => go(i)} aria-label={`صفحة ${i + 1}`} aria-current={i === idx} className={`num grid h-9 min-w-9 shrink-0 place-items-center rounded-lg px-2 text-sm font-semibold ${i === idx ? 'bg-ink text-white' : 'bg-white ring-1 ring-line'}`}>
              {i + 1}
            </button>
          ))}
        </div>
        <IconButton label="الصفحة التالية" onClick={() => go(idx + 1)} disabled={idx >= pages.length - 1}><ChevronLeft size={20} /></IconButton>
        <IconButton label="صفحة جديدة" onClick={newPage}><FilePlus2 size={20} /></IconButton>
        <IconButton label="تصغير" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}><ZoomOut size={19} /></IconButton>
        <IconButton label="تكبير" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}><ZoomIn size={19} /></IconButton>
      </footer>

      <Confirm
        open={delPage}
        title="نحذف الصفحة؟"
        message="الصفحة وكل اللي عليها والتسجيلات المربوطة فيها رح ينحذفوا."
        confirmLabel="احذفها"
        onCancel={() => setDelPage(false)}
        onConfirm={async () => {
          setDelPage(false)
          setPanel(null)
          pending.current = null
          if (page) await deletePage(nb, page.id)
          setParams({ p: String(Math.max(0, idx - 1)) }, { replace: true })
        }}
      />
    </div>
  )
}

const scroller: { current: HTMLDivElement | null } = { current: null }

function IconButton({ label, onClick, active, disabled, children }: { label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={active} onClick={onClick} disabled={disabled} className={`grid size-10 shrink-0 place-items-center rounded-xl transition disabled:opacity-30 ${active ? 'bg-ink text-white' : 'text-ink hover:bg-mint'}`}>
      {children}
    </button>
  )
}

const Divider = () => <span className="mx-1 h-6 w-px shrink-0 bg-line" />

/** Pens are drawn as little pens standing in a pencil cup — their nib shows the colour. */
function PenButton({ kind, label, color, active, onClick }: { kind: PenKind; label: string; color: string; active: boolean; onClick: () => void }) {
  const body: Record<PenKind, string> = { ballpoint: '#DCEEF4', fountain: '#27372F', pencil: '#F9E9A7', marker: '#EAE3F6', brush: '#C9B79C', highlighter: '#E4EEDC' }
  const tip = kind === 'highlighter' ? 'M8 4H16V12H8Z' : kind === 'marker' ? 'M9 3H15L14 10H10Z' : kind === 'brush' ? 'M12 1C15 5 15 9 14 11H10C9 9 9 5 12 1Z' : 'M12 1L15 10H9Z'
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={active} onClick={onClick} className={`relative grid h-11 w-9 shrink-0 place-items-end justify-center rounded-xl transition ${active ? 'bg-mint' : 'hover:bg-paper'}`}>
      <motion.svg width="24" height="40" viewBox="0 0 24 40" animate={{ y: active ? -4 : 2 }} transition={{ type: 'spring', damping: 18, stiffness: 300 }}>
        <path d={tip} fill={kind === 'pencil' ? '#27372F' : color} stroke="#27372F" strokeWidth="1.2" strokeLinejoin="round" opacity={kind === 'highlighter' ? 0.7 : 1} />
        <rect x={kind === 'highlighter' || kind === 'marker' ? 6 : 8} y="10" width={kind === 'highlighter' || kind === 'marker' ? 12 : 8} height="30" rx="2" fill={body[kind]} stroke="#27372F" strokeWidth="1.2" />
        {kind === 'pencil' && <path d="M9 10L12 1L15 10" fill="#F2D3A6" stroke="#27372F" strokeWidth="1.2" />}
        {kind === 'pencil' && <path d="M11 4L12 1L13 4Z" fill={color} />}
      </motion.svg>
    </button>
  )
}

/* ───────── voice notes ───────── */

function AudioPanel({ nb, pageId, userId, onClose }: { nb: Notebook; pageId: string; userId: string; onClose: () => void }) {
  const clips = useLiveQuery(() => db.audio.where('pageId').equals(pageId).sortBy('createdAt'), [pageId])
  const [rec, setRec] = useState<{ mr: MediaRecorder; start: number; chunks: Blob[] } | null>(null)
  const [now, setNow] = useState(Date.now())
  const [err, setErr] = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!rec) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [rec])
  useEffect(() => () => audio.current?.pause(), [])

  const start = async () => {
    setErr(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported?.(m))
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      const chunks: Blob[] = []
      const startAt = Date.now()
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' })
        if (blob.size) await saveClip(nb, pageId, blob, Date.now() - startAt, userId)
      }
      mr.start(1000)
      setRec({ mr, start: startAt, chunks })
    } catch {
      setErr('ما قدرنا نوصل للمايكروفون. اسمح للموقع يستعمله من إعدادات المتصفح.')
    }
  }
  const stop = () => {
    rec?.mr.stop()
    setRec(null)
  }
  const play = async (id: string, path?: string) => {
    audio.current?.pause()
    if (playing === id) return setPlaying(null)
    const url = await clipUrl(id, path)
    if (!url) return setErr('التسجيل مش متوفر هلأ (لسا ما انرفع من الجهاز الثاني).')
    const a = new Audio(url)
    audio.current = a
    a.onended = () => setPlaying(null)
    await a.play().catch(() => setErr('ما قدرنا نشغّل التسجيل.'))
    setPlaying(id)
  }

  return (
    <div className="z-20 border-b border-line bg-lavender/60 px-3 py-2">
      <div className="flex items-center gap-2">
        {rec ? (
          <Button size="sm" variant="danger" icon={<Square size={14} fill="currentColor" />} onClick={stop}>
            وقّف <span className="num">{formatHMS(now - rec.start).slice(3)}</span>
          </Button>
        ) : (
          <Button size="sm" icon={<Mic size={16} />} onClick={start}>سجّل</Button>
        )}
        {rec && <span className="size-2.5 animate-pulse rounded-full bg-[#C0392B]" aria-label="عم يسجّل" />}
        <span className="flex-1 text-xs text-ink-soft">تسجيلات هالصفحة</span>
        <button onClick={onClose} className="min-h-9 rounded-lg px-2 text-sm text-ink-soft">سكّر</button>
      </div>
      {err && <p className="mt-2 rounded-xl bg-peach px-3 py-1.5 text-xs">{err}</p>}
      <ul className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
        {clips?.map((c) => (
          <li key={c.id} className="flex shrink-0 items-center gap-1 rounded-full bg-white py-1 ps-1 pe-2 ring-1 ring-line">
            <button onClick={() => play(c.id, c.path)} aria-label={playing === c.id ? 'وقّف' : 'شغّل'} className="grid size-8 place-items-center rounded-full bg-sage text-white">
              {playing === c.id ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            </button>
            <span className="text-sm font-semibold">{c.title}</span>
            <span className="num text-xs text-ink-soft">{formatHMS(c.durationMs).slice(3)}</span>
            <button aria-label="احذف التسجيل" onClick={() => removeClip(c.id, c.path)} className="grid size-7 place-items-center rounded-full text-ink-faint hover:bg-peach">
              <Trash2 size={13} />
            </button>
          </li>
        ))}
        {clips && !clips.length && <li className="text-xs text-ink-soft">ما في تسجيلات. سجّل شرح الأستاذ أو ملاحظة صوتية 🎙️</li>}
      </ul>
    </div>
  )
}

/* ───────── reading mode ───────── */

function ReadingView({ nb, pages, onClose, start }: { nb: Notebook; pages: NotePage[]; onClose: () => void; start: number }) {
  const [contents, setContents] = useState<(PageContent | null)[]>([])
  const [ref, w] = useContainerWidth()
  useEffect(() => {
    void Promise.all(pages.map((p) => readContent(nb, p).catch(() => null))).then(setContents)
  }, [nb, pages])
  useEffect(() => {
    if (!contents.length) return
    document.getElementById(`read-${start}`)?.scrollIntoView({ block: 'start' })
  }, [contents.length, start])
  const width = useMemo(() => Math.min(w - 24, 820), [w])
  return (
    <div className="flex h-dvh flex-col bg-[#2A2F2C]">
      <header className="pt-safe flex items-center gap-3 px-3 pb-2 text-white">
        <button onClick={onClose} className="grid size-10 place-items-center rounded-xl hover:bg-white/10" aria-label="خروج من وضع القراءة">
          <ArrowRight size={20} />
        </button>
        <h1 className="flex-1 truncate font-bold">{nb.title}</h1>
        <PenLine size={18} className="opacity-50" />
        <button onClick={onClose} className="rounded-full bg-white/10 px-3 py-1.5 text-sm">رجوع للكتابة</button>
      </header>
      <div ref={ref} className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center gap-6 px-3 py-6">
          {pages.map((p, i) => (
            <div key={p.id} id={`read-${i}`} className="flex flex-col items-center gap-2">
              {contents[i] ? (
                <PageCanvas content={contents[i]!} paper={p.paper ?? nb.paper} paperColor={nb.paperColor} bg={p.bg} width={width} readOnly />
              ) : (
                <div className="rounded-md bg-white/10" style={{ width, height: (width * PAGE_H) / PAGE_W }} />
              )}
              <span className="num text-xs text-white/50">{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TranslatePanel({ initial, onInsert }: { initial: string; onInsert: (t: string) => void }) {
  const [text, setText] = useState(initial)
  const [to, setTo] = useState(() => (/[\u0600-\u06FF]/.test(initial) ? 'en' : 'ar'))
  const [out, setOut] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => setText(initial), [initial])
  return (
    <div className="space-y-2 p-3">
      <div className="flex gap-2">
        <textarea className="field min-h-16 flex-1" dir="auto" value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب أو اختار مربع نص بالصفحة…" aria-label="النص للترجمة" maxLength={500} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">لـ</span>
        <select className="field min-h-10 w-auto py-1" value={to} onChange={(e) => setTo(e.target.value)} aria-label="لغة الترجمة">
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={!text.trim() || busy}
          icon={<Languages size={16} />}
          onClick={async () => {
            setBusy(true)
            setErr(null)
            try {
              setOut(await translate(text, to))
            } catch (e) {
              setErr((e as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? '…' : 'ترجم'}
        </Button>
        <span className="text-[0.7rem] text-ink-faint">النص بينبعت لخدمة ترجمة خارجية (MyMemory)</span>
      </div>
      {err && <p className="rounded-xl bg-peach px-3 py-1.5 text-sm">{err}</p>}
      {out && (
        <div className="flex items-start gap-2 rounded-2xl bg-mint/60 p-3">
          <p className="flex-1 whitespace-pre-wrap" dir="auto">{out}</p>
          <Button size="sm" variant="ghost" onClick={() => onInsert(out)}>حطها بالصفحة</Button>
        </div>
      )}
    </div>
  )
}
