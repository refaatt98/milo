import type { PaperKind, PenKind, Stroke } from './db'

export const PAGE_W = 1000
export const PAGE_H = 1414

export interface PenDef {
  kind: PenKind
  label: string
  /** default width in page units */
  width: number
  alpha: number
  pressure: number // 0 = constant width, 1 = fully pressure driven
}

export const PENS: PenDef[] = [
  { kind: 'ballpoint', label: 'قلم حبر ناشف', width: 3, alpha: 1, pressure: 0.25 },
  { kind: 'fountain', label: 'قلم ريشة', width: 4, alpha: 1, pressure: 0.85 },
  { kind: 'pencil', label: 'قلم رصاص', width: 2.6, alpha: 0.72, pressure: 0.4 },
  { kind: 'marker', label: 'ماركر', width: 7, alpha: 0.95, pressure: 0.1 },
  { kind: 'brush', label: 'فرشاة', width: 10, alpha: 0.9, pressure: 1 },
  { kind: 'highlighter', label: 'هايلايتر', width: 22, alpha: 0.33, pressure: 0 },
]
export const penDef = (k: PenKind) => PENS.find((p) => p.kind === k) ?? PENS[0]

export const INK_COLORS = ['#27372F', '#1F3A93', '#2E7D5B', '#B23A48', '#E07A2E', '#7B4FBF', '#0E7C86', '#8B6B4A', '#F2C94C', '#F4A6B7', '#9ED6C7', '#FFFFFF']

/** width at one point given pen + pressure */
function w(def: PenDef, base: number, p: number) {
  const pr = p > 0 ? p : 0.5
  return Math.max(0.6, base * (1 - def.pressure + def.pressure * pr * 1.6))
}

function seeded(i: number) {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/** Draw one stroke onto a 2D context already scaled to page units. */
export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  const def = penDef(s.pen)
  const pts = s.pts
  const n = pts.length / 3
  if (n === 0) return
  ctx.save()
  ctx.strokeStyle = s.color
  ctx.fillStyle = s.color
  ctx.lineCap = s.pen === 'highlighter' ? 'butt' : 'round'
  ctx.lineJoin = 'round'
  ctx.globalAlpha = def.alpha
  if (s.pen === 'highlighter') ctx.globalCompositeOperation = 'multiply'

  if (n === 1) {
    ctx.beginPath()
    ctx.arc(pts[0], pts[1], w(def, s.width, pts[2]) / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  if (def.pressure < 0.3) {
    // constant-width pens: one smooth path (no darkening where segments overlap)
    ctx.lineWidth = w(def, s.width, 0.5)
    ctx.beginPath()
    ctx.moveTo(pts[0], pts[1])
    for (let i = 1; i < n - 1; i++) {
      const mx = (pts[i * 3] + pts[(i + 1) * 3]) / 2
      const my = (pts[i * 3 + 1] + pts[(i + 1) * 3 + 1]) / 2
      ctx.quadraticCurveTo(pts[i * 3], pts[i * 3 + 1], mx, my)
    }
    ctx.lineTo(pts[(n - 1) * 3], pts[(n - 1) * 3 + 1])
    ctx.stroke()
  } else {
    // pressure pens: variable width segments
    for (let i = 1; i < n; i++) {
      const x0 = pts[(i - 1) * 3]
      const y0 = pts[(i - 1) * 3 + 1]
      const x1 = pts[i * 3]
      const y1 = pts[i * 3 + 1]
      const p = (pts[(i - 1) * 3 + 2] + pts[i * 3 + 2]) / 2
      let width = w(def, s.width, p)
      if (s.pen === 'fountain') {
        // nib angle: thinner on strokes that run along the nib
        const ang = Math.atan2(y1 - y0, x1 - x0)
        width *= 0.55 + 0.45 * Math.abs(Math.sin(ang - Math.PI / 4))
      }
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
    }
  }
  if (s.pen === 'pencil') {
    // graphite grain
    ctx.globalAlpha = 0.25
    for (let i = 0; i < n; i += 2) {
      const r = seeded(i + n)
      ctx.fillRect(pts[i * 3] + (r - 0.5) * s.width * 1.4, pts[i * 3 + 1] + (seeded(i * 7) - 0.5) * s.width * 1.4, 0.8, 0.8)
    }
  }
  ctx.restore()
}

export function drawAll(ctx: CanvasRenderingContext2D, strokes: Stroke[], scale: number) {
  ctx.save()
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.clearRect(0, 0, PAGE_W, PAGE_H)
  for (const s of strokes) drawStroke(ctx, s)
  ctx.restore()
}

/** Exponential smoothing — the "stabilizer" for beautiful handwriting. */
export function stabilize(prev: [number, number] | null, x: number, y: number, amount: number): [number, number] {
  if (!prev || amount <= 0) return [x, y]
  const k = 1 - Math.min(0.92, amount)
  return [prev[0] + (x - prev[0]) * k, prev[1] + (y - prev[1]) * k]
}

/** Ruler: snap a straight line to 15° steps when close. */
export function snapLine(x0: number, y0: number, x1: number, y1: number): [number, number] {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy)
  const ang = Math.atan2(dy, dx)
  const step = Math.PI / 12
  const snapped = Math.round(ang / step) * step
  const a = Math.abs(snapped - ang) < 0.06 ? snapped : ang
  return [x0 + Math.cos(a) * len, y0 + Math.sin(a) * len]
}

export function strokeHit(s: Stroke, x: number, y: number, r: number) {
  const rr = (r + s.width / 2) ** 2
  for (let i = 0; i < s.pts.length; i += 3) {
    const dx = s.pts[i] - x
    const dy = s.pts[i + 1] - y
    if (dx * dx + dy * dy <= rr) return true
  }
  // segment check for fast strokes with sparse points
  for (let i = 3; i < s.pts.length; i += 3) {
    const ax = s.pts[i - 3]
    const ay = s.pts[i - 2]
    const bx = s.pts[i]
    const by = s.pts[i + 1]
    const l2 = (bx - ax) ** 2 + (by - ay) ** 2
    if (!l2) continue
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / l2))
    if ((ax + t * (bx - ax) - x) ** 2 + (ay + t * (by - ay) - y) ** 2 <= rr) return true
  }
  return false
}

/** Round to 1 decimal to keep synced data small. */
export const r1 = (v: number) => Math.round(v * 10) / 10

/* ---------- paper ---------- */

export const PAPERS: { kind: PaperKind; label: string }[] = [
  { kind: 'lined', label: 'مسطّر' },
  { kind: 'grid', label: 'مربعات' },
  { kind: 'dots', label: 'نقاط' },
  { kind: 'cornell', label: 'كورنيل' },
  { kind: 'blank', label: 'فاضي' },
]
export const PAPER_COLORS = ['#FFFFFF', '#FBF8F0', '#F4F8F1', '#F6F3FB', '#F2F7FA', '#2B2F2D']

/** Draw paper pattern in page units (used for export and as CSS fallback). */
export function drawPaper(ctx: CanvasRenderingContext2D, kind: PaperKind, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, PAGE_W, PAGE_H)
  const dark = isDark(color)
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.12)' : 'rgba(39,55,47,0.13)'
  ctx.fillStyle = ctx.strokeStyle
  ctx.lineWidth = 1.4
  if (kind === 'lined' || kind === 'cornell') {
    for (let y = 120; y < PAGE_H - 30; y += 44) {
      ctx.beginPath()
      ctx.moveTo(kind === 'cornell' ? 0 : 40, y)
      ctx.lineTo(PAGE_W - 40, y)
      ctx.stroke()
    }
    if (kind === 'cornell') {
      ctx.strokeStyle = 'rgba(178,58,72,0.35)'
      ctx.beginPath()
      ctx.moveTo(PAGE_W - 280, 80)
      ctx.lineTo(PAGE_W - 280, PAGE_H - 260)
      ctx.moveTo(0, PAGE_H - 260)
      ctx.lineTo(PAGE_W, PAGE_H - 260)
      ctx.stroke()
    }
  } else if (kind === 'grid') {
    for (let x = 40; x < PAGE_W; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, PAGE_H)
      ctx.stroke()
    }
    for (let y = 40; y < PAGE_H; y += 40) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(PAGE_W, y)
      ctx.stroke()
    }
  } else if (kind === 'dots') {
    for (let x = 40; x < PAGE_W; x += 40) for (let y = 40; y < PAGE_H; y += 40) ctx.fillRect(x - 1.5, y - 1.5, 3, 3)
  }
}

export function isDark(hex: string) {
  const v = parseInt(hex.slice(1), 16)
  const r = (v >> 16) & 255
  const g = (v >> 8) & 255
  const b = v & 255
  return r * 0.299 + g * 0.587 + b * 0.114 < 110
}
