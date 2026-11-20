import Dexie, { type Transaction } from 'dexie'
import { supabase } from './supabase'
import { TABLES, type MiloDB, type SyncTable } from './db'

/*
 * Local-first sync.
 *  - Every write goes to IndexedDB first (instant, works offline).
 *  - Dexie hooks record which rows changed; a debounced flush upserts them to
 *    milonote.records (one row per local row, RLS-scoped to the account).
 *  - Pulls fetch rows changed on the server since the last pull. Rows with
 *    pending local edits are kept (local wins until it is pushed).
 */

type Key = string // `${tbl}\u0001${id}`
const SEP = '\u0001'
const PAGE = 1000

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error'

class SyncEngine {
  private db!: MiloDB
  private uid = ''
  private dirty = new Map<Key, number>() // key → version
  private version = 0
  private timer: number | undefined
  private flushing: Promise<void> | null = null
  private pollTimer: number | undefined
  private listeners = new Set<(s: SyncState, pending: number) => void>()
  state: SyncState = 'idle'

  private get dirtyKey() {
    return `milonote:dirty:${this.uid}`
  }
  private get pullKey() {
    return `milonote:lastPull:${this.uid}`
  }

  subscribe(fn: (s: SyncState, pending: number) => void) {
    this.listeners.add(fn)
    fn(this.state, this.dirty.size)
    return () => void this.listeners.delete(fn)
  }
  private emit(s?: SyncState) {
    if (s) this.state = s
    for (const l of this.listeners) l(this.state, this.dirty.size)
  }

  attach(db: MiloDB, uid: string) {
    this.detach()
    this.db = db
    this.uid = uid
    try {
      const saved = JSON.parse(localStorage.getItem(this.dirtyKey) ?? '[]') as Key[]
      for (const k of saved) this.dirty.set(k, ++this.version)
    } catch {
      /* ignore */
    }
    for (const t of TABLES) this.hook(t)
    const onWake = () => {
      if (document.visibilityState === 'visible') void this.sync()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('online', onWake)
    this.cleanup = () => {
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('online', onWake)
    }
    this.pollTimer = window.setInterval(() => document.visibilityState === 'visible' && void this.sync(), 30_000)
  }

  private cleanup = () => {}

  detach() {
    clearTimeout(this.timer)
    clearInterval(this.pollTimer)
    this.cleanup()
    this.dirty.clear()
    this.uid = ''
  }

  private hook(tbl: SyncTable) {
    const table = this.db.table(tbl)
    const mark = (id: unknown, tx: Transaction) => {
      if ((tx as unknown as { __remote?: boolean }).__remote) return
      if (id == null) return
      this.dirty.set(`${tbl}${SEP}${String(id)}`, ++this.version)
      this.persistDirty()
      this.schedule()
    }
    table.hook('creating', function (primKey, obj, tx) {
      const keyPath = table.schema.primKey.keyPath as string
      mark(primKey ?? (obj as Record<string, unknown>)[keyPath], tx)
    })
    table.hook('updating', function (_mods, primKey, _obj, tx) {
      mark(primKey, tx)
    })
    table.hook('deleting', function (primKey, _obj, tx) {
      mark(primKey, tx)
    })
  }

  private persistDirty() {
    try {
      localStorage.setItem(this.dirtyKey, JSON.stringify([...this.dirty.keys()]))
    } catch {
      /* storage full: rows still sync this session */
    }
  }

  private schedule() {
    clearTimeout(this.timer)
    this.emit()
    this.timer = window.setTimeout(() => void this.flush(), 1200)
  }

  pending() {
    return this.dirty.size
  }

  async flush(): Promise<void> {
    if (this.flushing) return this.flushing
    if (!this.dirty.size || !this.uid) return
    const run = async () => {
      const snapshot = [...this.dirty.entries()]
      this.emit('syncing')
      try {
        const rows = []
        for (const [key] of snapshot) {
          const [tbl, id] = key.split(SEP) as [SyncTable, string]
          const data = await this.db.table(tbl).get(id)
          rows.push({ user_id: this.uid, tbl, id, data: data ?? null, deleted: !data })
        }
        for (let i = 0; i < rows.length; i += 200) {
          const { error } = await supabase.from('records').upsert(rows.slice(i, i + 200), { onConflict: 'user_id,tbl,id' })
          if (error) throw error
        }
        for (const [key, ver] of snapshot) if (this.dirty.get(key) === ver) this.dirty.delete(key)
        this.persistDirty()
        this.emit(navigator.onLine ? 'idle' : 'offline')
      } catch {
        this.emit(navigator.onLine ? 'error' : 'offline')
        clearTimeout(this.timer)
        this.timer = window.setTimeout(() => void this.flush(), 15_000)
      }
    }
    this.flushing = run().finally(() => (this.flushing = null))
    return this.flushing
  }

  /** Pull server changes into the local db. Returns how many rows the server has in total on a full pull. */
  async pull(full = false): Promise<number> {
    if (!this.uid) return 0
    const since = full ? null : localStorage.getItem(this.pullKey)
    let from = 0
    let newest = since
    let count = 0
    for (;;) {
      let q = supabase.from('records').select('tbl,id,data,deleted,updated_at').eq('user_id', this.uid).order('updated_at').range(from, from + PAGE - 1)
      // overlap a few seconds so rows committed at the same instant are never skipped
      if (since) q = q.gt('updated_at', new Date(new Date(since).getTime() - 5000).toISOString())
      const { data, error } = await q
      if (error) throw error
      if (!data?.length) break
      count += data.length
      await this.apply(data as { tbl: SyncTable; id: string; data: unknown; deleted: boolean; updated_at: string }[])
      newest = data[data.length - 1].updated_at
      if (data.length < PAGE) break
      from += PAGE
    }
    if (newest) localStorage.setItem(this.pullKey, newest)
    return count
  }

  private async apply(rows: { tbl: SyncTable; id: string; data: unknown; deleted: boolean }[]) {
    const known = new Set<string>(TABLES)
    const usable = rows.filter((r) => known.has(r.tbl) && !this.dirty.has(`${r.tbl}${SEP}${r.id}`))
    if (!usable.length) return
    await this.db.transaction('rw', TABLES.map((t) => this.db.table(t)), async () => {
      ;(Dexie.currentTransaction as unknown as { __remote: boolean }).__remote = true
      for (const r of usable) {
        const t = this.db.table(r.tbl)
        if (r.deleted || r.data == null) await t.delete(r.id)
        else await t.put(r.data)
      }
    })
  }

  async sync() {
    if (!this.uid || !navigator.onLine) return this.emit('offline')
    try {
      await this.flush()
      this.emit('syncing')
      await this.pull()
      this.emit(this.dirty.size ? 'syncing' : 'idle')
    } catch {
      this.emit('error')
    }
  }

  /** Remove every cloud row of this account (used by "reset all data"). */
  async wipeRemote() {
    const { error } = await supabase.from('records').delete().eq('user_id', this.uid)
    if (error) throw error
    this.dirty.clear()
    this.persistDirty()
    localStorage.removeItem(this.pullKey)
  }

  forget(uid: string) {
    localStorage.removeItem(`milonote:dirty:${uid}`)
    localStorage.removeItem(`milonote:lastPull:${uid}`)
  }
}

export const sync = new SyncEngine()
