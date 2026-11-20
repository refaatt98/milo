import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { db, type FileMeta, type Notebook, type NotePage, type PageBg, type PaperKind } from './db'
import { uid } from './id'
import { supabase } from './supabase'
import { r2Delete, r2Download, r2Upload } from './r2'
import { PAGE_H, PAGE_W } from './ink'
import { EMPTY } from './notes'
import { encryptJSON, unlockedKeys } from './crypto'

const BUCKET = 'milonote-files'
export const MAX_FILE_MB = 100

/* ---------- pdf.js (loaded only when a PDF is used) ---------- */

let pdfjsPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null
function pdfjs() {
  pdfjsPromise ??= (async () => {
    const lib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
    lib.GlobalWorkerOptions.workerSrc = worker.default
    return lib
  })()
  return pdfjsPromise
}

const docs = new Map<string, Promise<PDFDocumentProxy>>()

/* ---------- file bytes: local cache first, then the account's storage ---------- */

const blobs = new Map<string, Promise<Blob | null>>()

export function getFileBlob(fileId: string): Promise<Blob | null> {
  let p = blobs.get(fileId)
  if (!p) {
    p = (async () => {
      const local = await db.fileBlobs.get(fileId)
      if (local) return local.blob
      const meta = await db.files.get(fileId)
      if (!meta?.path) return null
      let data: Blob | null = null
      if (meta.store === 'r2') data = await r2Download(meta.path)
      else {
        const res = await supabase.storage.from(BUCKET).download(meta.path)
        data = res.error ? null : res.data
      }
      if (!data) return null
      await db.fileBlobs.put({ id: fileId, blob: data })
      return data
    })()
    blobs.set(fileId, p)
    // let a later attempt retry if it failed (e.g. still uploading from the other device)
    void p.then((b) => !b && blobs.delete(fileId))
  }
  return p
}

async function getDoc(fileId: string) {
  let d = docs.get(fileId)
  if (!d) {
    d = (async () => {
      const blob = await getFileBlob(fileId)
      if (!blob) throw new Error('missing')
      const lib = await pdfjs()
      return lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
    })()
    docs.set(fileId, d)
    d.catch(() => docs.delete(fileId))
  }
  return d
}

/** Rectangle (in page units) where a background of size w×h sits, centred, inside the A4 frame. */
export function containRect(w: number, h: number) {
  const s = Math.min(PAGE_W / w, PAGE_H / h)
  const dw = w * s
  const dh = h * s
  return { x: (PAGE_W - dw) / 2, y: (PAGE_H - dh) / 2, w: dw, h: dh }
}

const rendered = new Map<string, Promise<CanvasImageSource | null>>()

/** Renders a background at `pxWidth` pixels for the full A4 frame (cached). */
export function renderBg(bg: PageBg, pxWidth: number): Promise<CanvasImageSource | null> {
  const bucket = Math.ceil(pxWidth / 200) * 200 // re-render only on real size changes
  const key = `${bg.fileId}:${bg.kind === 'pdf' ? bg.page : 'img'}:${bucket}`
  let p = rendered.get(key)
  if (!p) {
    p = (async () => {
      try {
        if (bg.kind === 'image') {
          const blob = await getFileBlob(bg.fileId)
          return blob ? await createImageBitmap(blob) : null
        }
        const doc = await getDoc(bg.fileId)
        const page = await doc.getPage(bg.page)
        const vp1 = page.getViewport({ scale: 1 })
        const r = containRect(vp1.width, vp1.height)
        const scale = ((r.w / PAGE_W) * bucket) / vp1.width
        const vp = page.getViewport({ scale })
        const c = document.createElement('canvas')
        c.width = Math.ceil(vp.width)
        c.height = Math.ceil(vp.height)
        await page.render({ canvas: c, canvasContext: c.getContext('2d')!, viewport: vp }).promise
        return c
      } catch {
        return null
      }
    })()
    rendered.set(key, p)
    if (rendered.size > 40) rendered.delete(rendered.keys().next().value!)
    void p.then((v) => !v && rendered.delete(key))
  }
  return p
}

/** Draw a background into a context already scaled to page units. */
export function drawBg(ctx: CanvasRenderingContext2D, img: CanvasImageSource) {
  const w = (img as HTMLCanvasElement).width
  const h = (img as HTMLCanvasElement).height
  const r = containRect(w, h)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(r.x, r.y, r.w, r.h)
  ctx.drawImage(img, r.x, r.y, r.w, r.h)
}

/* ---------- import ---------- */

export async function storeFile(file: File, notebookId: string, userId: string, pageCount?: number): Promise<FileMeta> {
  const id = uid()
  const mime = file.type || 'application/pdf'
  const ext = (file.name.split('.').pop() || (mime === 'application/pdf' ? 'pdf' : 'bin')).toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  // the storage path is fixed up front, so every device can find (or delete) the file
  // even before the upload's completion has synced
  // photos go to Cloudflare R2; PDFs stay in Supabase Storage
  const store: FileMeta['store'] = mime.startsWith('image/') ? 'r2' : 'supabase'
  const meta: FileMeta = { id, notebookId, name: file.name, mime, size: file.size, pageCount, createdAt: Date.now(), path: `${userId}/${id}.${ext}`, store }
  await db.fileBlobs.put({ id, blob: file })
  await db.files.add(meta)
  // upload in the background; the file already works on this device
  void uploadWithRetry(meta, file)
  return meta
}

async function uploadWithRetry(meta: FileMeta, blob: Blob, attempt = 0): Promise<void> {
  let ok = false
  if (meta.store === 'r2') ok = await r2Upload(meta.path!, blob, meta.mime).then(() => true, () => false)
  else ok = !(await supabase.storage.from(BUCKET).upload(meta.path!, blob, { contentType: meta.mime, upsert: true })).error
  if (!ok && attempt < 4) {
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)))
    return uploadWithRetry(meta, blob, attempt + 1)
  }
}

export async function countPdfPages(file: File) {
  const lib = await pdfjs()
  const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const doc = await task.promise
  const n = doc.numPages
  void task.destroy()
  return n
}

function checkSize(file: File) {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`الملف أكبر من ${MAX_FILE_MB} ميغا.`)
}

/** A brand new notebook made from a PDF: one writable page per PDF page. */
export async function notebookFromPdf(file: File, userId: string, cover: string) {
  checkSize(file)
  let pages: number
  try {
    pages = await countPdfPages(file)
  } catch {
    throw new Error('ما قدرنا نقرأ ملف الـ PDF. ممكن يكون تالف أو محمي بكلمة سر.')
  }
  const now = Date.now()
  const nb: Notebook = {
    id: uid(),
    title: file.name.replace(/\.pdf$/i, '').slice(0, 60) || 'ملف PDF',
    cover,
    paper: 'blank' as PaperKind,
    paperColor: '#FFFFFF',
    order: await db.notebooks.count(),
    createdAt: now,
    updatedAt: now,
  }
  await db.notebooks.add(nb)
  const meta = await storeFile(file, nb.id, userId, pages)
  const rows: NotePage[] = Array.from({ length: pages }, (_, i) => ({
    id: uid(),
    notebookId: nb.id,
    order: i,
    bg: { kind: 'pdf', fileId: meta.id, page: i + 1 },
    content: EMPTY,
    updatedAt: now,
  }))
  await db.pages.bulkAdd(rows)
  return nb
}

/** Insert a PDF's pages (or a photo as one page) after `afterOrder` in an existing notebook. */
export async function insertFile(nb: Notebook, file: File, afterOrder: number, userId: string) {
  checkSize(file)
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  let count = 1
  if (isPdf) {
    try {
      count = await countPdfPages(file)
    } catch {
      throw new Error('ما قدرنا نقرأ ملف الـ PDF.')
    }
  } else if (!file.type.startsWith('image/')) throw new Error('بس ملفات PDF أو صور.')
  const meta = isPdf ? await storeFile(file, nb.id, userId, count) : await db.files.get((await storePageImage(file, nb.id, userId)).fileId).then((m) => m!)
  const key = unlockedKeys.get(nb.id)
  const empty = nb.lock && key ? { enc: await encryptJSON(key, EMPTY) } : { content: EMPTY }
  const now = Date.now()
  const existing = await db.pages.where('notebookId').equals(nb.id).sortBy('order')
  const fresh: NotePage[] = Array.from({ length: count }, (_, i) => ({
    id: uid(),
    notebookId: nb.id,
    order: afterOrder + 0.001 * (i + 1),
    bg: isPdf ? { kind: 'pdf', fileId: meta.id, page: i + 1 } : { kind: 'image', fileId: meta.id },
    ...empty,
    updatedAt: now,
  }))
  await db.transaction('rw', db.pages, db.notebooks, async () => {
    await db.pages.bulkAdd(fresh)
    const all = [...existing, ...fresh].sort((a, b) => a.order - b.order)
    for (let i = 0; i < all.length; i++) if (all[i].order !== i) await db.pages.update(all[i].id, { order: i })
    await db.notebooks.update(nb.id, { updatedAt: now })
  })
  return count
}

export async function removeNotebookFiles(notebookId: string) {
  const files = await db.files.where('notebookId').equals(notebookId).toArray()
  for (const f of files) {
    await db.files.delete(f.id)
    await db.fileBlobs.delete(f.id)
    docs.delete(f.id)
    blobs.delete(f.id)
  }
  const inR2 = files.filter((f) => f.store === 'r2' && f.path).map((f) => f.path!)
  const inSupabase = files.filter((f) => f.store !== 'r2' && f.path).map((f) => f.path!)
  if (inR2.length) void r2Delete(inR2)
  if (inSupabase.length) void supabase.storage.from(BUCKET).remove(inSupabase)
}

/** Raw bytes of an imported PDF (for exporting annotations onto it). */
export async function pdfBytes(fileId: string) {
  const b = await getFileBlob(fileId)
  return b ? new Uint8Array(await b.arrayBuffer()) : null
}

/* ---------- photos placed on a page ---------- */

/** Shrinks big photos (phones take 4000px+) so pages stay light, then stores the file. */
export async function storePageImage(file: File, notebookId: string, userId: string) {
  checkSize(file)
  if (!file.type.startsWith('image/')) throw new Error('هاد مش ملف صورة.')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('ما قدرنا نفتح الصورة. جرّب صيغة JPG أو PNG.')
  }
  const MAX = 2000
  const k = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * k))
  const h = Math.max(1, Math.round(bitmap.height * k))
  let out: File = file
  const keepPng = file.type === 'image/png' && file.size < 1.5 * 1024 * 1024 // screenshots/diagrams with transparency
  const webSafe = /^image\/(jpeg|png|webp|gif)$/.test(file.type)
  if (k < 1 || (!keepPng && file.size > 1.5 * 1024 * 1024) || !webSafe) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.86))
    if (blob) out = new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  }
  bitmap.close()
  const meta = await storeFile(out, notebookId, userId)
  return { fileId: meta.id, ratio: h / w }
}
