import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Notebook, NotePage, PageContent, PaperKind, TextBox } from './db'
import { PAGE_H, PAGE_W, drawAll, drawPaper } from './ink'
import { STICKERS } from '../components/notes/stickers'
import { containRect, drawBg, pdfBytes, renderBg } from './pdf'
import { readContent } from './notes'

const stickerImgs = new Map<string, Promise<HTMLImageElement | null>>()

function stickerImage(kind: string) {
  let p = stickerImgs.get(kind)
  if (!p) {
    p = (async () => {
      const def = STICKERS[kind]
      if (!def) return null
      const markup = renderToStaticMarkup(createElement('div', null, def.render()))
      const svg = markup.match(/<svg[\s\S]*<\/svg>/)?.[0]
      if (!svg) return null
      const withNs = svg.includes('xmlns=') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
      const img = new Image()
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(withNs)
      try {
        await img.decode()
        return img
      } catch {
        return null
      }
    })()
    stickerImgs.set(kind, p)
  }
  return p
}

const RTL = /[֐-ࣿ]/

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/(\s+)/)) {
      const next = line + word
      if (line && ctx.measureText(next).width > maxW) {
        out.push(line.trimEnd())
        line = word.trimStart()
      } else line = next
    }
    out.push(line)
  }
  return out
}

function drawText(ctx: CanvasRenderingContext2D, t: TextBox) {
  ctx.save()
  ctx.fillStyle = t.color
  ctx.font = `${t.size}px "IBM Plex Sans Arabic", system-ui, sans-serif`
  ctx.textBaseline = 'top'
  const rtl = RTL.test(t.text)
  ctx.direction = rtl ? 'rtl' : 'ltr'
  ctx.textAlign = rtl ? 'right' : 'left'
  const pad = 4
  const lines = wrapLines(ctx, t.text, t.w - pad * 2)
  lines.forEach((l, i) => ctx.fillText(l, rtl ? t.x + t.w - pad : t.x + pad, t.y + pad + i * t.size * 1.45))
  ctx.restore()
}

/**
 * Renders a page into a canvas of `scale` px per page unit.
 * `annotationsOnly` leaves paper/background transparent (for overlaying onto a PDF).
 */
export async function renderPage(
  content: PageContent,
  opts: { scale: number; paper?: PaperKind; paperColor?: string; page?: NotePage; annotationsOnly?: boolean },
) {
  const c = document.createElement('canvas')
  c.width = Math.round(PAGE_W * opts.scale)
  c.height = Math.round(PAGE_H * opts.scale)
  const ctx = c.getContext('2d')!
  ctx.setTransform(opts.scale, 0, 0, opts.scale, 0, 0)
  if (!opts.annotationsOnly) {
    drawPaper(ctx, opts.paper ?? 'blank', opts.paperColor ?? '#FFFFFF')
    if (opts.page?.bg) {
      const img = await renderBg(opts.page.bg, PAGE_W * opts.scale)
      if (img) drawBg(ctx, img)
    }
  }
  for (const st of content.stickers) {
    const img = await stickerImage(st.kind)
    if (!img) continue
    const size = 120 * st.s
    ctx.save()
    ctx.translate(st.x + size / 2, st.y + size / 2)
    ctx.rotate((st.r * Math.PI) / 180)
    ctx.drawImage(img, -size / 2, -size / 2, size, size)
    ctx.restore()
  }
  const ink = document.createElement('canvas')
  ink.width = c.width
  ink.height = c.height
  drawAll(ink.getContext('2d')!, content.strokes, opts.scale)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(ink, 0, 0)
  ctx.setTransform(opts.scale, 0, 0, opts.scale, 0, 0)
  for (const t of content.texts) if (t.text.trim()) drawText(ctx, t)
  return c
}

const toBytes = async (c: HTMLCanvasElement, type: 'image/png' | 'image/jpeg') => {
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, type, 0.9))
  return new Uint8Array(await blob!.arrayBuffer())
}

/**
 * Exports the whole notebook as a PDF. Pages that came from an imported PDF keep
 * the original vector page (sharp text) with the handwriting layered on top.
 */
export async function exportNotebookPdf(nb: Notebook, pages: NotePage[], onProgress?: (done: number, total: number) => void) {
  const { PDFDocument } = await import('pdf-lib')
  const out = await PDFDocument.create()
  out.setTitle(nb.title)
  out.setProducer('MiloNote')
  const sources = new Map<string, Awaited<ReturnType<typeof PDFDocument.load>> | null>()
  const A4 = { w: 595.28, h: 841.89 }

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]
    const content = (await readContent(nb, p)) ?? { strokes: [], texts: [], stickers: [] }
    const hasInk = content.strokes.length + content.texts.length + content.stickers.length > 0
    if (p.bg?.kind === 'pdf') {
      if (!sources.has(p.bg.fileId)) {
        const bytes = await pdfBytes(p.bg.fileId)
        sources.set(p.bg.fileId, bytes ? await PDFDocument.load(bytes, { ignoreEncryption: true }) : null)
      }
      const src = sources.get(p.bg.fileId)
      if (src) {
        const [copied] = await out.copyPages(src, [p.bg.page - 1])
        out.addPage(copied)
        if (hasInk) {
          const { width: pw, height: ph } = copied.getSize()
          // where the PDF page sits inside our A4 frame; the overlay covers the whole frame,
          // so frame unit (u, v) lands at PDF point ((u - r.x)·k, ph − (v − r.y)·k)
          const r = containRect(pw, ph)
          const k = pw / r.w // PDF points per page unit
          const layer = await renderPage(content, { scale: 2, annotationsOnly: true })
          const png = await out.embedPng(await toBytes(layer, 'image/png'))
          copied.drawImage(png, { x: -r.x * k, y: ph - (PAGE_H - r.y) * k, width: PAGE_W * k, height: PAGE_H * k })
        }
        onProgress?.(i + 1, pages.length)
        continue
      }
    }
    const canvas = await renderPage(content, { scale: 1.6, paper: p.paper ?? nb.paper, paperColor: nb.paperColor, page: p })
    const jpg = await out.embedJpg(await toBytes(canvas, 'image/jpeg'))
    const page = out.addPage([A4.w, A4.h])
    page.drawImage(jpg, { x: 0, y: 0, width: A4.w, height: A4.h })
    onProgress?.(i + 1, pages.length)
  }
  const bytes = await out.save()
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${nb.title}.pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
