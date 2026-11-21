import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { Minus, Plus, RotateCw, Trash2 } from 'lucide-react'
import type { ImageEl, PageBg, PageContent, PaperKind, PenKind, Stroke, TextBox } from '../../lib/db'
import { PageImage } from './PageImage'
import { drawBg, renderBg } from '../../lib/pdf'
import { PAGE_H, PAGE_W, drawAll, drawPaper, drawStroke, isDark, penDef, r1, snapLine, stabilize, strokeHit } from '../../lib/ink'
import { asmrMove, asmrStart, asmrStop } from '../../lib/asmr'
import { uid } from '../../lib/id'
import { STICKERS } from './stickers'

export type Tool = 'pen' | 'eraser' | 'text' | 'hand'

export interface ToolState {
  tool: Tool
  pen: PenKind
  color: string
  size: number // multiplier
  stabilizer: number
  ruler: boolean
  asmr: boolean
  pencilOnly: boolean
}

interface Props {
  content: PageContent
  paper: PaperKind
  paperColor: string
  /** imported PDF page or photo under the ink */
  bg?: PageBg
  width: number
  tools?: ToolState
  readOnly?: boolean
  onChange?: (c: PageContent) => void
  selected?: string | null
  onSelect?: (id: string | null) => void
  /** files dropped onto the page, with the drop point in page units */
  onDropFiles?: (files: File[], at: { x: number; y: number }) => void
}

const DPR = () => Math.min(2, window.devicePixelRatio || 1)

/** Once an Apple Pencil / stylus is used, fingers and palms stop drawing (like Apple Notes)
 * and scroll the pages instead. Shared by every page on screen. */
let penSeen = false
const penListeners = new Set<() => void>()
function markPen() {
  if (penSeen) return
  penSeen = true
  penListeners.forEach((l) => l())
}
function usePenSeen() {
  return useSyncExternalStore(
    (cb) => {
      penListeners.add(cb)
      return () => void penListeners.delete(cb)
    },
    () => penSeen,
  )
}

export function PageCanvas({ content, paper, paperColor, bg, width, tools, readOnly, onChange, selected = null, onSelect, onDropFiles }: Props) {
  const paperRef = useRef<HTMLCanvasElement>(null)
  const inkRef = useRef<HTMLCanvasElement>(null)
  const liveRef = useRef<HTMLCanvasElement>(null)
  const height = (width * PAGE_H) / PAGE_W
  const scale = (width * DPR()) / PAGE_W
  const drawing = useRef<{ stroke: Stroke; last: [number, number] | null; start: [number, number]; t: number; id: number; type: string } | null>(null)
  const erasing = useRef<{ removed: Set<string>; id: number } | null>(null)
  const [liveStrokes, setLiveStrokes] = useState<Stroke[] | null>(null)
  const dark = isDark(paperColor)

  // size canvases
  useLayoutEffect(() => {
    for (const c of [paperRef.current, inkRef.current, liveRef.current]) {
      if (!c) continue
      c.width = Math.round(width * DPR())
      c.height = Math.round(height * DPR())
    }
  }, [width, height])

  const [bgState, setBgState] = useState<'none' | 'loading' | 'ready' | 'missing'>('none')
  const bgKey = bg ? `${bg.fileId}:${bg.kind === 'pdf' ? bg.page : 'img'}` : ''
  useLayoutEffect(() => {
    const c = paperRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    drawPaper(ctx, bg ? 'blank' : paper, bg ? '#FFFFFF' : paperColor)
    if (!bg) return setBgState('none')
    let alive = true
    setBgState('loading')
    void renderBg(bg, width * DPR()).then((img) => {
      if (!alive) return
      if (!img) return setBgState('missing')
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      drawBg(ctx, img)
      setBgState('ready')
    })
    return () => {
      alive = false
    }
  }, [paper, paperColor, scale, width, bgKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const c = inkRef.current
    if (!c) return
    drawAll(c.getContext('2d')!, liveStrokes ?? content.strokes, scale)
  }, [content.strokes, liveStrokes, scale, width])

  const toPage = (e: { clientX: number; clientY: number }): [number, number] => {
    const rect = liveRef.current!.getBoundingClientRect()
    return [((e.clientX - rect.left) / rect.width) * PAGE_W, ((e.clientY - rect.top) / rect.height) * PAGE_H]
  }

  const renderLive = useCallback(() => {
    const c = liveRef.current
    const d = drawing.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    if (!d) return
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    drawStroke(ctx, d.stroke)
    if (tools?.ruler && d.stroke.pts.length >= 6) {
      // draw a translucent ruler along the line
      const [x0, y0] = [d.stroke.pts[0], d.stroke.pts[1]]
      const [x1, y1] = [d.stroke.pts[3], d.stroke.pts[4]]
      const ang = Math.atan2(y1 - y0, x1 - x0)
      ctx.save()
      ctx.translate(x0, y0)
      ctx.rotate(ang)
      ctx.fillStyle = 'rgba(249,233,167,0.35)'
      ctx.strokeStyle = 'rgba(39,55,47,0.35)'
      ctx.fillRect(-40, 6, Math.hypot(x1 - x0, y1 - y0) + 80, 46)
      for (let i = -40; i < Math.hypot(x1 - x0, y1 - y0) + 40; i += 10) {
        ctx.beginPath()
        ctx.moveTo(i, 6)
        ctx.lineTo(i, i % 50 === 0 ? 22 : 14)
        ctx.stroke()
      }
      ctx.restore()
    }
  }, [scale, tools?.ruler])

  const commit = (c: PageContent) => onChange?.(c)
  const renderLiveRef = useRef(renderLive)
  renderLiveRef.current = renderLive

  // Touch handling on the writing area:
  //  • Pencil/stylus: cancel the touch so iOS Safari delivers the stroke at once (no gap at the start)
  //  • fingers, once a Pencil has been used (or "stylus only" is on): let them scroll the pages
  //  • fingers when they draw (phones): two fingers scroll the pages instead of drawing
  const drawingTool = !readOnly && !!tools && tools.tool !== 'hand'
  const pen = usePenSeen()
  const fingersDraw = drawingTool && !(tools?.pencilOnly || pen)
  useEffect(() => {
    const el = liveRef.current
    if (!el || !drawingTool) return
    let last: { x: number; y: number } | null = null
    const mid = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 })
    const onStart = (e: TouchEvent) => {
      const stylus = [...e.touches].some((t) => (t as Touch & { touchType?: string }).touchType === 'stylus')
      if (stylus) {
        if (e.cancelable) e.preventDefault()
        return
      }
      if (!fingersDraw) return // native scrolling
      if (e.cancelable) e.preventDefault()
      if (e.touches.length >= 2) {
        // second finger: this is a scroll, not a stroke
        if (drawing.current?.type === 'touch') {
          drawing.current = null
          renderLiveRef.current()
        }
        last = mid(e.touches)
      }
    }
    const onMove = (e: TouchEvent) => {
      const stylus = [...e.touches].some((t) => (t as Touch & { touchType?: string }).touchType === 'stylus')
      if (stylus || fingersDraw) {
        if (e.cancelable) e.preventDefault()
      }
      if (fingersDraw && e.touches.length >= 2 && last) {
        const m = mid(e.touches)
        el.closest('[data-scroller]')?.scrollBy(last.x - m.x, last.y - m.y)
        last = m
      }
    }
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) last = null
    }
    el.addEventListener('touchstart', onStart, { passive: false })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [drawingTool, fingersDraw])

  const down = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (readOnly || !tools) return
    if (e.pointerType === 'pen') markPen()
    // palm rejection: a resting hand must never draw or interrupt the pen
    if ((tools.pencilOnly || penSeen) && e.pointerType === 'touch' && tools.tool !== 'text') return
    if (e.button > 0) return
    if (drawing.current || erasing.current) {
      // a pen landing while a finger/palm "stroke" is in progress replaces it; anything else is ignored
      if (e.pointerType === 'pen' && drawing.current?.type === 'touch') drawing.current = null
      else return
    }
    const [x, y] = toPage(e)
    if (tools.tool === 'text') {
      const box: TextBox = { id: uid(), x: r1(x), y: r1(y - 20), w: 360, text: '', size: 30, color: tools.color }
      commit({ ...content, texts: [...content.texts, box] })
      onSelect?.(box.id)
      return
    }
    if (tools.tool === 'hand') {
      onSelect?.(null)
      return
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* pointer already gone */
    }
    if (tools.tool === 'eraser') {
      erasing.current = { removed: new Set(), id: e.pointerId }
      eraseAt(x, y)
      return
    }
    const def = penDef(tools.pen)
    const pr = e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5
    drawing.current = {
      id: e.pointerId,
      type: e.pointerType,
      start: [x, y],
      last: [x, y],
      t: performance.now(),
      stroke: { id: uid(), pen: tools.pen, color: tools.color, width: def.width * tools.size, pts: [r1(x), r1(y), Math.round(pr * 100) / 100] },
    }
    if (tools.asmr) asmrStart(tools.pen === 'pencil' ? 'pencil' : tools.pen === 'marker' || tools.pen === 'highlighter' ? 'marker' : 'pen')
    renderLive()
  }

  const eraseAt = (x: number, y: number) => {
    const er = erasing.current
    if (!er) return
    const base = liveStrokes ?? content.strokes
    const hit = base.filter((s) => !er.removed.has(s.id) && strokeHit(s, x, y, 14 * (tools?.size ?? 1)))
    if (!hit.length) return
    for (const s of hit) er.removed.add(s.id)
    setLiveStrokes(content.strokes.filter((s) => !er.removed.has(s.id)))
  }

  const move = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (erasing.current && e.pointerId === erasing.current.id) {
      const [x, y] = toPage(e)
      eraseAt(x, y)
      return
    }
    const d = drawing.current
    if (!d || e.pointerId !== d.id || !tools) return
    // coalesced events give smoother lines at high pen rates; never let an empty list drop movement
    const co = e.nativeEvent.getCoalescedEvents?.()
    const events = (co && co.length ? co : [e.nativeEvent]) as PointerEvent[]
    for (const ev of events) {
      const [rx, ry] = toPage(ev)
      if (tools.ruler) {
        const [sx, sy] = snapLine(d.start[0], d.start[1], rx, ry)
        d.stroke.pts = [d.stroke.pts[0], d.stroke.pts[1], d.stroke.pts[2], r1(sx), r1(sy), d.stroke.pts[2]]
        continue
      }
      const [x, y] = stabilize(d.last, rx, ry, tools.stabilizer)
      const pts = d.stroke.pts
      const lx = pts[pts.length - 3]
      const ly = pts[pts.length - 2]
      if ((x - lx) ** 2 + (y - ly) ** 2 < 0.8) continue
      const pr = ev.pointerType === 'pen' ? ev.pressure || 0.5 : 0.5
      pts.push(r1(x), r1(y), Math.round(pr * 100) / 100)
      if (tools.asmr) {
        const now = performance.now()
        asmrMove(Math.hypot(x - d.last![0], y - d.last![1]) / Math.max(1, now - d.t))
        d.t = now
      }
      d.last = [x, y]
    }
    renderLive()
  }

  const up = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (erasing.current && e.pointerId === erasing.current.id) {
      const removed = erasing.current.removed
      erasing.current = null
      setLiveStrokes(null)
      if (removed.size) commit({ ...content, strokes: content.strokes.filter((s) => !removed.has(s.id)) })
      return
    }
    const d = drawing.current
    if (!d || e.pointerId !== d.id) return
    // the stabilizer trails slightly behind the pen — finish the line exactly where it lifted
    if (!tools?.ruler && e.type === 'pointerup') {
      const [x, y] = toPage(e)
      const pts = d.stroke.pts
      if ((x - pts[pts.length - 3]) ** 2 + (y - pts[pts.length - 2]) ** 2 > 0.8) pts.push(r1(x), r1(y), pts[pts.length - 1])
    }
    drawing.current = null
    asmrStop()
    renderLive()
    commit({ ...content, strokes: [...content.strokes, d.stroke] })
  }

  /* ---------- overlay: text boxes + stickers ---------- */
  const updateText = (id: string, patch: Partial<TextBox>) => commit({ ...content, texts: content.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)) })
  const dragging = useRef<{ id: string; kind: 'text' | 'sticker' | 'image' | 'resize'; sx: number; sy: number; ox: number; oy: number; ow?: number } | null>(null)
  const images = content.images ?? []
  const updateImage = (id: string, patch: Partial<ImageEl>) => commit({ ...content, images: images.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
  const pxToPage = PAGE_W / width

  const startDrag = (e: RPointerEvent, id: string, kind: 'text' | 'sticker' | 'image' | 'resize', ox: number, oy: number, ow?: number) => {
    if (readOnly || tools?.tool !== 'hand') return
    e.stopPropagation()
    onSelect?.(id)
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* pointer already gone */
    }
    dragging.current = { id, kind, sx: e.clientX, sy: e.clientY, ox, oy, ow }
  }
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number; w?: number } | null>(null)
  const onDragMove = (e: RPointerEvent) => {
    const d = dragging.current
    if (!d) return
    if (d.kind === 'resize') {
      // the handle sits on the bottom-left corner (RTL-friendly): dragging left/down grows the image
      const dx = (d.sx - e.clientX) * pxToPage
      const w = Math.max(60, Math.min(PAGE_W * 1.5, (d.ow ?? 300) + dx))
      setDragPos({ id: d.id, x: d.ox - (w - (d.ow ?? 300)), y: d.oy, w })
      return
    }
    setDragPos({ id: d.id, x: d.ox + (e.clientX - d.sx) * pxToPage, y: d.oy + (e.clientY - d.sy) * pxToPage })
  }
  const onDragEnd = () => {
    const d = dragging.current
    dragging.current = null
    if (!d || !dragPos) return setDragPos(null)
    const x = r1(Math.max(-50, Math.min(PAGE_W - 20, dragPos.x)))
    const y = r1(Math.max(-50, Math.min(PAGE_H - 20, dragPos.y)))
    if (d.kind === 'text') updateText(d.id, { x, y })
    else if (d.kind === 'image') updateImage(d.id, { x, y })
    else if (d.kind === 'resize') updateImage(d.id, { x: r1(dragPos.x), w: r1(dragPos.w ?? 300) })
    else commit({ ...content, stickers: content.stickers.map((s) => (s.id === d.id ? { ...s, x, y } : s)) })
    setDragPos(null)
  }

  // remove empty text boxes when they lose selection
  useEffect(() => {
    const empty = content.texts.filter((t) => !t.text.trim() && t.id !== selected)
    if (empty.length && !readOnly) commit({ ...content, texts: content.texts.filter((t) => t.text.trim() || t.id === selected) })
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const [dropping, setDropping] = useState(false)
  const k = width / PAGE_W
  const canvasActive = !readOnly && tools && (tools.tool === 'pen' || tools.tool === 'eraser' || tools.tool === 'text')

  return (
    <div
      className="relative touch-manipulation select-none overflow-hidden rounded-[6px] [-webkit-touch-callout:none] [-webkit-user-select:none] shadow-[0_10px_30px_-12px_rgba(39,55,47,.35)] ring-1 ring-black/5"
      style={{ width, height, background: paperColor }}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      onDragOver={(e) => {
        if (!onDropFiles || readOnly || !e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDropping(true)
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        setDropping(false)
        if (!onDropFiles || readOnly) return
        const files = [...e.dataTransfer.files]
        if (!files.length) return
        e.preventDefault()
        const rect = e.currentTarget.getBoundingClientRect()
        onDropFiles(files, { x: ((e.clientX - rect.left) / rect.width) * PAGE_W, y: ((e.clientY - rect.top) / rect.height) * PAGE_H })
      }}
    >
      {dropping && (
        <div className="pointer-events-none absolute inset-2 z-30 grid place-items-center rounded-md border-2 border-dashed border-sage bg-mint/40 font-display text-lg font-bold text-sage-deep">
          افلت الصورة هون
        </div>
      )}
      <canvas ref={paperRef} className="pointer-events-none absolute inset-0 size-full" aria-hidden />
      {bgState === 'loading' && <div className="absolute inset-0 grid place-items-center text-sm text-ink-faint">عم نفتح الصفحة…</div>}
      {bgState === 'missing' && (
        <div className="absolute inset-x-6 top-1/3 rounded-2xl bg-butter/80 p-4 text-center text-sm">
          الملف الأصلي لسا ما وصل لهاد الجهاز (بكون عم ينرفع من الجهاز الثاني). كتابتك محفوظة وبتظهر فوقه لما يوصل.
        </div>
      )}
      {/* photos sit under the ink so you can write and highlight on them */}
      {images.map((m) => {
        const pos = dragPos?.id === m.id ? dragPos : m
        const w = (pos.w ?? m.w) * k
        const sel = selected === m.id && !readOnly
        const hand = tools?.tool === 'hand' && !readOnly
        return (
          <div
            key={m.id}
            data-image-id={m.id}
            className={`absolute ${hand ? 'cursor-grab touch-none' : 'pointer-events-none'} ${sel ? 'outline-2 outline-offset-2 outline-dashed outline-sage' : ''}`}
            style={{ left: pos.x * k, top: pos.y * k, width: w, height: w * m.ratio, rotate: `${m.r}deg` }}
            onPointerDown={(e) => startDrag(e, m.id, 'image', m.x, m.y)}
          >
            <PageImage fileId={m.fileId} />
            {sel && hand && (
              <span
                role="slider"
                aria-label="غيّر حجم الصورة"
                aria-valuenow={Math.round(m.w)}
                className="absolute -bottom-3 -left-3 grid size-7 cursor-nesw-resize touch-none place-items-center rounded-full border-[1.5px] border-ink bg-white shadow"
                onPointerDown={(e) => startDrag(e, m.id, 'resize', m.x, m.y, m.w)}
              >
                <span className="size-2 rounded-full bg-sage" />
              </span>
            )}
          </div>
        )
      })}
      <canvas ref={inkRef} className="pointer-events-none absolute inset-0 size-full" aria-hidden />
      {/* stickers sit above ink, texts above stickers */}
      {content.stickers.map((s) => {
        const pos = dragPos?.id === s.id ? dragPos : s
        const size = 120 * s.s * k
        const sel = selected === s.id && !readOnly
        return (
          <div
            key={s.id}
            data-sticker-id={s.id}
            className={`absolute ${tools?.tool === 'hand' && !readOnly ? 'cursor-grab touch-none' : 'pointer-events-none'} ${sel ? 'outline-2 outline-dashed outline-sage' : ''}`}
            style={{ left: pos.x * k, top: pos.y * k, width: size, height: size, rotate: `${s.r}deg` }}
            onPointerDown={(e) => startDrag(e, s.id, 'sticker', s.x, s.y)}
          >
            {STICKERS[s.kind]?.render()}
          </div>
        )
      })}
      <canvas
        ref={liveRef}
        className="absolute inset-0 size-full"
        style={{ touchAction: canvasActive ? (fingersDraw ? 'none' : 'pan-x pan-y') : 'auto', pointerEvents: canvasActive ? 'auto' : 'none', cursor: tools?.tool === 'eraser' ? 'cell' : tools?.tool === 'text' ? 'text' : 'crosshair' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        aria-label={readOnly ? 'صفحة' : 'مساحة الكتابة'}
      />
      {content.texts.map((t) => {
        const pos = dragPos?.id === t.id ? dragPos : t
        const sel = selected === t.id && !readOnly
        const style = { left: pos.x * k, top: pos.y * k, width: t.w * k, fontSize: t.size * k, color: t.color === '#27372F' && dark ? '#F4F4F2' : t.color, lineHeight: 1.45 }
        return sel && tools?.tool !== 'hand' ? (
          <textarea
            key={t.id}
            autoFocus
            dir="auto"
            value={t.text}
            onChange={(e) => {
              updateText(t.id, { text: e.target.value })
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onFocus={(e) => {
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            placeholder="اكتب هون…"
            className="absolute z-10 resize-none overflow-hidden rounded-md border-[1.5px] border-dashed border-sage bg-white/40 p-1 font-sans outline-none"
            style={style}
          />
        ) : (
          <div
            key={t.id}
            dir="auto"
            onPointerDown={(e) => {
              if (readOnly || !tools) return
              if (tools.tool === 'hand') startDrag(e, t.id, 'text', t.x, t.y)
              else if (tools.tool === 'text') {
                e.stopPropagation()
                onSelect?.(t.id)
              }
            }}
            className={`absolute whitespace-pre-wrap break-words p-1 font-sans ${tools?.tool === 'hand' || tools?.tool === 'text' ? 'touch-none' : 'pointer-events-none'} ${sel ? 'rounded-md outline-2 outline-dashed outline-sage' : ''} ${tools?.tool === 'hand' && !readOnly ? 'cursor-grab' : ''}`}
            style={style}
          >
            {t.text}
          </div>
        )
      })}
      {/* selection toolbar for stickers / text */}
      {!readOnly && selected && (() => {
        const st = content.stickers.find((s) => s.id === selected)
        const tx = content.texts.find((t) => t.id === selected)
        const im = images.find((m) => m.id === selected)
        if (!st && !tx && !im) return null
        const x = (st ? st.x : tx ? tx.x : im!.x) * k
        const y = Math.max(0, (st ? st.y : tx ? tx.y : im!.y) * k - 48)
        const bump = (d: number) =>
          im
            ? updateImage(im.id, { w: r1(Math.max(60, Math.min(PAGE_W * 1.5, im.w * (1 + d * 0.75)))) })
            : st
            ? commit({ ...content, stickers: content.stickers.map((s) => (s.id === st.id ? { ...s, s: Math.max(0.3, Math.min(4, s.s + d)) } : s)) })
            : updateText(tx!.id, { size: Math.max(14, Math.min(120, tx!.size + d * 20)) })
        return (
          <div className="absolute z-20 flex gap-1 rounded-full border-[1.5px] border-ink bg-white p-1 shadow-lg" style={{ left: Math.min(x, width - 180), top: y }} onPointerDown={(e) => e.stopPropagation()}>
            <IconBtn label="أصغر" onClick={() => bump(-0.2)}><Minus size={16} /></IconBtn>
            <IconBtn label="أكبر" onClick={() => bump(0.2)}><Plus size={16} /></IconBtn>
            {im && (
              <IconBtn label="لف 90°" onClick={() => updateImage(im.id, { r: (im.r + 90) % 360 })}>
                <RotateCw size={16} />
              </IconBtn>
            )}
            {st && (
              <IconBtn label="لف" onClick={() => commit({ ...content, stickers: content.stickers.map((s) => (s.id === st.id ? { ...s, r: (s.r + 15) % 360 } : s)) })}>
                <RotateCw size={16} />
              </IconBtn>
            )}
            <IconBtn
              label="احذف"
              onClick={() => {
                commit(
                  im
                    ? { ...content, images: images.filter((m) => m.id !== im.id) }
                    : st
                      ? { ...content, stickers: content.stickers.filter((s) => s.id !== st.id) }
                      : { ...content, texts: content.texts.filter((t) => t.id !== tx!.id) },
                )
                onSelect?.(null)
              }}
            >
              <Trash2 size={16} />
            </IconBtn>
          </div>
        )
      })()}
    </div>
  )
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-9 place-items-center rounded-full hover:bg-mint">
      {children}
    </button>
  )
}
