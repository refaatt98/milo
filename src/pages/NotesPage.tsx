import { motion } from 'motion/react'
import { Lock, LockOpen, MoreVertical, Plus, Search, Trash2, Pencil } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Milo from '../components/character/Milo'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { Confirm } from '../components/ui/Confirm'
import { useCelebrate } from '../components/ui/Celebration'
import { COVERS, NotebookCover } from '../components/notes/covers'
import { db, type Notebook, type PaperKind } from '../lib/db'
import { useUnits } from '../hooks/useData'
import { PAPERS, PAPER_COLORS } from '../lib/ink'
import { createNotebook, deleteNotebook, lockNotebook, removeLock } from '../lib/notes'
import { formatDayShort, dayKey } from '../lib/time'

export default function NotesPage() {
  const notebooks = useLiveQuery(() => db.notebooks.orderBy('updatedAt').reverse().toArray(), [])
  const counts = useLiveQuery(async () => {
    const m = new Map<string, number>()
    await db.pages.each((p) => m.set(p.notebookId, (m.get(p.notebookId) ?? 0) + 1))
    return m
  }, [])
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [menu, setMenu] = useState<Notebook | null>(null)

  const list = useMemo(() => (notebooks ?? []).filter((n) => !q.trim() || n.title.includes(q.trim())), [notebooks, q])

  return (
    <div>
      <PageHeader eyebrow="MiloNote" title="الدفاتر" art={<Milo mood="studying" size={96} />}>
        دفاتر بلا حدود، صفحات بلا حدود. اكتب بخط إيدك، لزّق ملصقات، سجّل صوتك، واقفل اللي بدك ياه بكلمة سر.
      </PageHeader>

      <div className="mb-6 flex gap-2">
        <label className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-ink-faint" />
          <input className="field ps-10" placeholder="دوّر على دفتر…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث بالدفاتر" />
        </label>
        <Button onClick={() => setCreating(true)} icon={<Plus size={20} />}>
          دفتر جديد
        </Button>
      </div>

      {/* the shelf */}
      <div className="relative">
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          <motion.button
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setCreating(true)}
            className="grid place-items-center justify-self-center rounded-[6px_14px_14px_6px] border-[1.5px] border-dashed border-sage/60 bg-mint/40 text-sage-deep"
            style={{ width: 150, height: 195 }}
          >
            <span className="flex flex-col items-center gap-2 font-semibold">
              <Plus size={30} />
              دفتر جديد
            </span>
          </motion.button>
          {list.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.04 }}
              className="relative flex flex-col items-center"
            >
              <motion.button whileHover={{ y: -6, rotate: -1 }} whileTap={{ scale: 0.97 }} onClick={() => nav(`/notes/${n.id}`)} aria-label={`افتح ${n.title}`}>
                <NotebookCover cover={n.cover} title={n.title} locked={!!n.lock} pages={counts?.get(n.id)} />
              </motion.button>
              <div className="mt-3 flex w-[150px] items-start justify-between gap-1">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{n.title}</p>
                  <p className="text-xs text-ink-faint">{formatDayShort(dayKey(n.updatedAt))}</p>
                </div>
                <button onClick={() => setMenu(n)} aria-label={`خيارات ${n.title}`} className="grid size-9 shrink-0 place-items-center rounded-xl text-ink-faint hover:bg-white">
                  <MoreVertical size={18} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
        {notebooks && !notebooks.length && (
          <p className="mt-10 text-center text-ink-soft">رف الدفاتر فاضي. اعمل أول دفتر — مثلًا «ملخصات الوحدة 1» ✏️</p>
        )}
      </div>

      <CreateSheet open={creating} onClose={() => setCreating(false)} onCreated={(id) => nav(`/notes/${id}`)} />
      <NotebookMenu nb={menu} onClose={() => setMenu(null)} />
    </div>
  )
}

function CreateSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const units = useUnits()
  const [title, setTitle] = useState('')
  const [cover, setCover] = useState(COVERS[0].id)
  const [paper, setPaper] = useState<PaperKind>('lined')
  const [paperColor, setPaperColor] = useState(PAPER_COLORS[1])
  const [unitId, setUnitId] = useState('')
  return (
    <Sheet open={open} onClose={onClose} title="دفتر جديد" wide>
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault()
          const nb = await createNotebook({ title, cover, paper, paperColor, unitId: unitId || undefined })
          setTitle('')
          onClose()
          onCreated(nb.id)
        }}
      >
        <div className="flex items-center gap-5">
          <NotebookCover cover={cover} title={title} size={110} />
          <label className="flex-1">
            <span className="mb-1 block text-sm font-semibold">اسم الدفتر</span>
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلًا: ملخصات الكيمياء" autoFocus maxLength={60} />
            <span className="mt-3 mb-1 block text-sm font-semibold">مربوط بوحدة؟</span>
            <select className="field" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">— لا —</option>
              {units?.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">الغلاف</legend>
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {COVERS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={cover === c.id}
                aria-label={c.label}
                title={c.label}
                onClick={() => setCover(c.id)}
                className={`h-16 w-12 shrink-0 rounded-[3px_8px_8px_3px] border-[1.5px] ${cover === c.id ? 'border-ink ring-2 ring-sage ring-offset-2' : 'border-ink/40'}`}
                style={c.style}
              />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">نوع الورق</legend>
          <div className="flex flex-wrap gap-2">
            {PAPERS.map((p) => (
              <button key={p.kind} type="button" aria-pressed={paper === p.kind} onClick={() => setPaper(p.kind)} className={`min-h-10 rounded-full px-4 text-sm font-semibold ring-1 ${paper === p.kind ? 'bg-ink text-white ring-ink' : 'bg-white ring-line'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            {PAPER_COLORS.map((c) => (
              <button key={c} type="button" aria-label={`لون الورق ${c}`} aria-pressed={paperColor === c} onClick={() => setPaperColor(c)} className={`size-9 rounded-full border-[1.5px] ${paperColor === c ? 'border-ink ring-2 ring-sage ring-offset-2' : 'border-line'}`} style={{ background: c }} />
            ))}
          </div>
        </fieldset>
        <Button type="submit" size="lg" className="w-full" icon={<Plus size={20} />}>
          اعمل الدفتر
        </Button>
      </form>
    </Sheet>
  )
}

function NotebookMenu({ nb, onClose }: { nb: Notebook | null; onClose: () => void }) {
  const celebrate = useCelebrate()
  const [mode, setMode] = useState<'menu' | 'rename' | 'lock' | 'unlock' | 'delete'>('menu')
  const [title, setTitle] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const close = () => {
    setMode('menu')
    setPw('')
    setPw2('')
    setErr(null)
    onClose()
  }
  if (!nb) return null
  return (
    <>
      <Sheet open={!!nb && mode !== 'delete'} onClose={close} title={nb.title}>
        {mode === 'menu' && (
          <div className="grid gap-2">
            <Button variant="ghost" icon={<Pencil size={18} />} onClick={() => { setTitle(nb.title); setMode('rename') }}>غيّر الاسم والغلاف</Button>
            {nb.lock ? (
              <Button variant="ghost" icon={<LockOpen size={18} />} onClick={() => setMode('unlock')}>شيل القفل</Button>
            ) : (
              <Button variant="ghost" icon={<Lock size={18} />} onClick={() => setMode('lock')}>اقفل الدفتر بكلمة سر</Button>
            )}
            <Button variant="danger" icon={<Trash2 size={18} />} onClick={() => setMode('delete')}>احذف الدفتر</Button>
          </div>
        )}
        {mode === 'rename' && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              await db.notebooks.update(nb.id, { title: title.trim() || nb.title, updatedAt: Date.now() })
              close()
            }}
          >
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="اسم الدفتر" autoFocus />
            <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
              {COVERS.map((c) => (
                <button key={c.id} type="button" aria-label={c.label} onClick={() => db.notebooks.update(nb.id, { cover: c.id })} className={`h-16 w-12 shrink-0 rounded-[3px_8px_8px_3px] border-[1.5px] ${nb.cover === c.id ? 'border-ink ring-2 ring-sage ring-offset-2' : 'border-ink/40'}`} style={c.style} />
              ))}
            </div>
            <Button type="submit" className="w-full">احفظ</Button>
          </form>
        )}
        {(mode === 'lock' || mode === 'unlock') && (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              setErr(null)
              if (mode === 'lock') {
                if (pw.length < 4) return setErr('كلمة السر لازم 4 أحرف على الأقل.')
                if (pw !== pw2) return setErr('كلمتين السر مش متطابقات.')
                setBusy(true)
                await lockNotebook(nb, pw)
                setBusy(false)
                celebrate({ size: 'small', mood: 'happy', title: 'انقفل الدفتر 🔒', message: 'محتواه صار مشفّر.' })
                close()
              } else {
                setBusy(true)
                const ok = await removeLock(nb, pw)
                setBusy(false)
                if (!ok) return setErr('كلمة السر غلط.')
                close()
              }
            }}
          >
            <p className="text-sm text-ink-soft">
              {mode === 'lock'
                ? 'المحتوى رح ينحفظ مشفّر (AES-256) على جهازك وبالحساب. إذا نسيت كلمة السر ما في طريقة نرجّعه — ولا حتى نحن. التسجيلات الصوتية ما بتنشفّر.'
                : 'اكتب كلمة السر عشان نفك التشفير ونشيل القفل.'}
            </p>
            <input className="field" type="password" placeholder="كلمة السر" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus aria-label="كلمة السر" />
            {mode === 'lock' && <input className="field" type="password" placeholder="أكّد كلمة السر" value={pw2} onChange={(e) => setPw2(e.target.value)} aria-label="تأكيد كلمة السر" />}
            {err && <p className="rounded-xl bg-peach px-3 py-2 text-sm" role="alert">{err}</p>}
            <Button type="submit" className="w-full" disabled={busy || !pw}>{mode === 'lock' ? 'اقفل' : 'شيل القفل'}</Button>
          </form>
        )}
      </Sheet>
      <Confirm
        open={mode === 'delete'}
        title="نحذف الدفتر؟"
        message={`«${nb.title}» بكل صفحاته وتسجيلاته رح ينحذف نهائيًا.`}
        confirmLabel="احذفه"
        onCancel={() => setMode('menu')}
        onConfirm={async () => {
          await deleteNotebook(nb)
          close()
        }}
      />
    </>
  )
}
