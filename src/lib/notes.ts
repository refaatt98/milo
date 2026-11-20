import { db, type Notebook, type NotePage, type PageContent, type PaperKind } from './db'
import { uid } from './id'
import { createLock, decryptJSON, encryptJSON, openLock, unlockedKeys } from './crypto'
import { supabase } from './supabase'

export const EMPTY: PageContent = { strokes: [], texts: [], stickers: [] }

export async function createNotebook(input: { title: string; cover: string; paper: PaperKind; paperColor: string; unitId?: string }) {
  const now = Date.now()
  const count = await db.notebooks.count()
  const nb: Notebook = { id: uid(), order: count, createdAt: now, updatedAt: now, ...input, title: input.title.trim() || 'دفتر جديد' }
  await db.transaction('rw', db.notebooks, db.pages, async () => {
    await db.notebooks.add(nb)
    await db.pages.add({ id: uid(), notebookId: nb.id, order: 0, content: EMPTY, updatedAt: now })
  })
  return nb
}

export async function addPage(nb: Notebook, afterOrder: number) {
  const pages = await db.pages.where('notebookId').equals(nb.id).sortBy('order')
  const id = uid()
  const now = Date.now()
  const key = unlockedKeys.get(nb.id)
  const page: NotePage = { id, notebookId: nb.id, order: afterOrder + 0.5, updatedAt: now }
  if (nb.lock) {
    if (!key) throw new Error('locked')
    page.enc = await encryptJSON(key, EMPTY)
  } else page.content = EMPTY
  await db.transaction('rw', db.pages, db.notebooks, async () => {
    await db.pages.add(page)
    // renumber so orders stay integers
    const all = [...pages, page].sort((a, b) => a.order - b.order)
    for (let i = 0; i < all.length; i++) if (all[i].order !== i) await db.pages.update(all[i].id, { order: i })
    await db.notebooks.update(nb.id, { updatedAt: now })
  })
  return id
}

export async function deletePage(nb: Notebook, pageId: string) {
  await db.transaction('rw', db.pages, db.audio, db.audioBlobs, async () => {
    await db.pages.delete(pageId)
    const clips = await db.audio.where('pageId').equals(pageId).toArray()
    for (const c of clips) await removeClip(c.id, c.path)
    const rest = await db.pages.where('notebookId').equals(nb.id).sortBy('order')
    for (let i = 0; i < rest.length; i++) if (rest[i].order !== i) await db.pages.update(rest[i].id, { order: i })
  })
}

export async function deleteNotebook(nb: Notebook) {
  const clips = await db.audio.where('notebookId').equals(nb.id).toArray()
  await db.transaction('rw', db.notebooks, db.pages, db.audio, db.audioBlobs, async () => {
    await db.pages.where('notebookId').equals(nb.id).delete()
    for (const c of clips) {
      await db.audio.delete(c.id)
      await db.audioBlobs.delete(c.id)
    }
    await db.notebooks.delete(nb.id)
  })
  const paths = clips.map((c) => c.path).filter(Boolean) as string[]
  if (paths.length) void supabase.storage.from('milonote-audio').remove(paths)
  const { removeNotebookFiles } = await import('./pdf')
  await removeNotebookFiles(nb.id)
  unlockedKeys.delete(nb.id)
}

export async function readContent(nb: Notebook, page: NotePage): Promise<PageContent | null> {
  if (page.enc) {
    const key = unlockedKeys.get(nb.id)
    if (!key) return null
    return decryptJSON<PageContent>(key, page.enc)
  }
  return { ...EMPTY, ...(page.content ?? {}) }
}

export async function writeContent(nb: Notebook, pageId: string, content: PageContent) {
  const now = Date.now()
  if (nb.lock) {
    const key = unlockedKeys.get(nb.id)
    if (!key) throw new Error('locked')
    await db.pages.update(pageId, { enc: await encryptJSON(key, content), content: undefined, updatedAt: now })
  } else {
    await db.pages.update(pageId, { content, enc: undefined, updatedAt: now })
  }
  await db.notebooks.update(nb.id, { updatedAt: now })
}

export async function lockNotebook(nb: Notebook, password: string) {
  const { key, lock } = await createLock(password)
  const pages = await db.pages.where('notebookId').equals(nb.id).toArray()
  const encrypted = await Promise.all(pages.map(async (p) => ({ id: p.id, enc: await encryptJSON(key, { ...EMPTY, ...(p.content ?? {}) }) })))
  await db.transaction('rw', db.pages, db.notebooks, async () => {
    for (const p of encrypted) await db.pages.update(p.id, { enc: p.enc, content: undefined })
    await db.notebooks.update(nb.id, { lock, updatedAt: Date.now() })
  })
  unlockedKeys.set(nb.id, key)
}

export async function unlockNotebook(nb: Notebook, password: string) {
  if (!nb.lock) return true
  const key = await openLock(password, nb.lock)
  if (!key) return false
  unlockedKeys.set(nb.id, key)
  return true
}

export async function removeLock(nb: Notebook, password: string) {
  if (!nb.lock) return true
  const key = await openLock(password, nb.lock)
  if (!key) return false
  const pages = await db.pages.where('notebookId').equals(nb.id).toArray()
  const plain = await Promise.all(pages.map(async (p) => ({ id: p.id, content: p.enc ? await decryptJSON<PageContent>(key, p.enc) : (p.content ?? EMPTY) })))
  await db.transaction('rw', db.pages, db.notebooks, async () => {
    for (const p of plain) await db.pages.update(p.id, { content: p.content, enc: undefined })
    await db.notebooks.update(nb.id, { lock: undefined, updatedAt: Date.now() })
  })
  unlockedKeys.delete(nb.id)
  return true
}

/* ---------- voice notes ---------- */

export async function saveClip(nb: Notebook, pageId: string, blob: Blob, durationMs: number, userId: string) {
  const id = uid()
  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  const count = await db.audio.where('pageId').equals(pageId).count()
  // fixed path up front (see pdf.ts storeFile)
  const path = `${userId}/${id}.${ext}`
  await db.audioBlobs.put({ id, blob })
  await db.audio.add({ id, notebookId: nb.id, pageId, title: `تسجيل ${count + 1}`, durationMs, createdAt: Date.now(), mime: blob.type || 'audio/webm', path })
  // upload in the background; the clip already plays from this device
  void (async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await supabase.storage.from('milonote-audio').upload(path, blob, { contentType: blob.type || 'audio/webm', upsert: true })
      if (!error) return
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)))
    }
  })()
  return id
}

export async function clipUrl(id: string, path?: string): Promise<string | null> {
  const local = await db.audioBlobs.get(id)
  if (local) return URL.createObjectURL(local.blob)
  if (!path) return null
  const { data, error } = await supabase.storage.from('milonote-audio').download(path)
  if (error || !data) return null
  await db.audioBlobs.put({ id, blob: data })
  return URL.createObjectURL(data)
}

export async function removeClip(id: string, path?: string) {
  await db.audio.delete(id)
  await db.audioBlobs.delete(id)
  if (path) void supabase.storage.from('milonote-audio').remove([path])
}
