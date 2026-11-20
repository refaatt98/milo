import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { Minus, Plus, RotateCw, Trash2 } from 'lucide-react'
import type { PageBg, PageContent, PaperKind, PenKind, Stroke, TextBox } from '../../lib/db'
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
}

const DPR = () => Math.min(2, window.devicePixelRatio || 1)

export function PageCanvas({ content, paper, paperColor, bg, width, tools, readOnly, onChange, selected = null, onSelect }: Props) {
  const paperRef = useRef<HTMLCanvasElement>(null)
  const inkRef = useRef<HTMLCanvasElement>(null)
  const liveRef = useRef<HTMLCanvasElement>(null)
  const height = (width * PAGE_H) / PAGE_W
  const scale = (width * DPR()) / PAGE_W
  const drawing = useRef<{ stroke: Stroke; last: [number, number] | null; start: [number, number]; t: number; id: number } | null>(null)
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

  const down = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (readOnly || !tools) return
    if (tools.pencilOnly && e.pointerType === 'touch') return
    if (e.button > 0) return
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
    e.currentTarget.setPointerCapture(e.pointerId)
    if (tools.tool === 'eraser') {
      erasing.current = { removed: new Set(), id: e.pointerId }
      eraseAt(x, y)
      return
    }
    const def = penDef(tools.pen)
    const pr = e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5
    drawing.current = {
      id: e.pointerId,
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
    const events = (e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]) as PointerEvent[]
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
    drawing.current = null
    asmrStop()
    renderLive()
    commit({ ...content, strokes: [...content.strokes, d.stroke] })
  }

  /* ---------- overlay: text boxes + stickers ---------- */
  const updateText = (id: string, patch: Partial<TextBox>) => commit({ ...content, texts: content.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)) })
  const dragging = useRef<{ id: string; kind: 'text' | 'sticker'; sx: number; sy: number; ox: number; oy: number } | null>(null)
  const pxToPage = PAGE_W / width

  const startDrag = (e: RPointerEvent, id: string, kind: 'text' | 'sticker', ox: number, oy: number) => {
    if (readOnly || tools?.tool !== 'hand') return
    e.stopPropagation()
    onSelect?.(id)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragging.current = { id, kind, sx: e.clientX, sy: e.clientY, ox, oy }
  }
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null)
  const onDragMove = (e: RPointerEvent) => {
    const d = dragging.current
    if (!d) return
    setDragPos({ id: d.id, x: d.ox + (e.clientX - d.sx) * pxToPage, y: d.oy + (e.clientY - d.sy) * pxToPage })
  }
  const onDragEnd = () => {
    const d = dragging.current
    dragging.current = null
    if (!d || !dragPos) return setDragPos(null)
    const x = r1(Math.max(-50, Math.min(PAGE_W - 20, dragPos.x)))
    const y = r1(Math.max(-50, Math.min(PAGE_H - 20, dragPos.y)))
    if (d.kind === 'text') updateText(d.id, { x, y })
    else commit({ ...content, stickers: content.stickers.map((s) => (s.id === d.id ? { ...s, x, y } : s)) })
    setDragPos(null)
  }

  // remove empty text boxes when they lose selection
  useEffect(() => {
    const empty = content.texts.filter((t) => !t.text.trim() && t.id !== selected)
    if (empty.length && !readOnly) commit({ ...content, texts: content.texts.filter((t) => t.text.trim() || t.id === selected) })
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const k = width / PAGE_W
  const canvasActive = !readOnly && tools && (tools.tool === 'pen' || tools.tool === 'eraser' || tools.tool === 'text')

  return (
    <div
      className="relative select-none overflow-hidden rounded-[6px] shadow-[0_10px_30px_-12px_rgba(39,55,47,.35)] ring-1 ring-black/5"
      style={{ width, height, background: paperColor }}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
    >
      <canvas ref={paperRef} className="absolute inset-0 size-full" aria-hidden />
      {bgState === 'loading' && <div className="absolute inset-0 grid place-items-center text-sm text-ink-faint">عم نفتح الصفحة…</div>}
      {bgState === 'missing' && (
        <div className="absolute inset-x-6 top-1/3 rounded-2xl bg-butter/80 p-4 text-center text-sm">
          الملف الأصلي لسا ما وصل لهاد الجهاز (بكون عم ينرفع من الجهاز الثاني). كتابتك محفوظة وبتظهر فوقه لما يوصل.
        </div>
      )}
      <canvas ref={inkRef} className="absolute inset-0 size-full" aria-hidden />
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
        style={{ touchAction: canvasActive ? 'none' : 'auto', pointerEvents: canvasActive ? 'auto' : 'none', cursor: tools?.tool === 'eraser' ? 'cell' : tools?.tool === 'text' ? 'text' : 'crosshair' }}
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
        if (!st && !tx) return null
        const x = (st ? st.x : tx!.x) * k
        const y = Math.max(0, (st ? st.y : tx!.y) * k - 48)
        const bump = (d: number) =>
          st
            ? commit({ ...content, stickers: content.stickers.map((s) => (s.id === st.id ? { ...s, s: Math.max(0.3, Math.min(4, s.s + d)) } : s)) })
            : updateText(tx!.id, { size: Math.max(14, Math.min(120, tx!.size + d * 20)) })
        return (
          <div className="absolute z-20 flex gap-1 rounded-full border-[1.5px] border-ink bg-white p-1 shadow-lg" style={{ left: Math.min(x, width - 180), top: y }} onPointerDown={(e) => e.stopPropagation()}>
            <IconBtn label="أصغر" onClick={() => bump(-0.2)}><Minus size={16} /></IconBtn>
            <IconBtn label="أكبر" onClick={() => bump(0.2)}><Plus size={16} /></IconBtn>
            {st && (
              <IconBtn label="لف" onClick={() => commit({ ...content, stickers: content.stickers.map((s) => (s.id === st.id ? { ...s, r: (s.r + 15) % 360 } : s)) })}>
                <RotateCw size={16} />
              </IconBtn>
            )}
            <IconBtn
              label="احذف"
              onClick={() => {
                commit(st ? { ...content, stickers: content.stickers.filter((s) => s.id !== st.id) } : { ...content, texts: content.texts.filter((t) => t.id !== tx!.id) })
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
