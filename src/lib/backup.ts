import { db, TABLES } from './db'

export const BACKUP_APP = 'milo-study'
export const BACKUP_VERSION = 1

export async function exportData() {
  const data: Record<string, unknown[]> = {}
  await db.transaction('r', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) data[t] = await db.table(t).toArray()
  })
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data }
}

export async function downloadBackup() {
  const payload = await exportData()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `milo-backup-${payload.exportedAt.slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  await db.kv.put({ key: 'last-backup', value: Date.now() })
}

export async function importData(text: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('الملف مش JSON صالح.')
  }
  const p = parsed as { app?: string; version?: number; data?: Record<string, unknown> }
  if (p?.app !== BACKUP_APP || !p.data || typeof p.data !== 'object') throw new Error('هاد مش ملف نسخة احتياطية من milo.')
  if ((p.version ?? 0) > BACKUP_VERSION) throw new Error('النسخة الاحتياطية من إصدار أحدث من التطبيق.')
  for (const t of TABLES) {
    const rows = p.data[t]
    if (rows !== undefined && !Array.isArray(rows)) throw new Error(`بيانات «${t}» تالفة.`)
  }
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      const rows = (p.data![t] as unknown[] | undefined) ?? []
      await db.table(t).clear()
      if (rows.length) await db.table(t).bulkPut(rows)
    }
  })
}

export async function resetAll() {
  await db.delete()
  location.reload()
}
