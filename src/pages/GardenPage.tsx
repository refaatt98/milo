import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Garden, STAGE_NAMES } from '../components/garden/Garden'
import { Plant } from '../components/garden/Plant'
import { PageHeader } from '../components/ui/PageHeader'
import { ProgressBar } from '../components/ui/Progress'
import { Check } from '../components/ui/Check'
import { Button } from '../components/ui/Button'
import { Confirm } from '../components/ui/Confirm'
import { useCelebrate } from '../components/ui/Celebration'
import Milo from '../components/character/Milo'
import { useTopics, useUnitProgress } from '../hooks/useData'
import { useStudyStats } from '../hooks/useStudyStats'
import { msByUnit, plantStage, type UnitProgress } from '../lib/stats'
import { db, type Topic } from '../lib/db'
import { uid } from '../lib/id'
import { toggleTopic } from '../lib/actions'
import { formatDuration } from '../lib/time'

export default function GardenPage() {
  const progress = useUnitProgress()
  const topics = useTopics()
  const stats = useStudyStats()
  const [open, setOpen] = useState<string | null>(null)
  const loc = useLocation()
  const byUnit = msByUnit(stats.sessions, stats.timers, stats.now)

  useEffect(() => {
    if (loc.hash === '#units') document.getElementById('units')?.scrollIntoView({ behavior: 'smooth' })
  }, [loc.hash])

  const select = (id: string) => {
    setOpen(id)
    setTimeout(() => document.getElementById(`unit-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  const totalDone = progress?.list.reduce((a, p) => a + p.done, 0) ?? 0
  const totalTopics = progress?.list.reduce((a, p) => a + p.total, 0) ?? 0

  return (
    <div>
      <PageHeader eyebrow="كل وحدة نبتة" title="حديقة الدراسة">
        كل ما تخلّص درس، نبتة وحدته بتكبر: بذرة، برعم، أوراق، زهر، وبعدين نبتة كاملة. اضغط على أي نبتة تشوف دروسها.
      </PageHeader>
      {progress && topics && <Garden progress={progress.list} topics={topics} onSelect={select} />}
      <p className="mt-3 text-center text-sm text-ink-soft">
        <span className="num font-bold text-ink">{totalDone}</span> من <span className="num">{totalTopics}</span> درس خلصوا بكل الوحدات
      </p>

      <section id="units" className="mt-10 scroll-mt-6">
        <h2 className="mb-4 text-2xl font-extrabold">الوحدات والدروس</h2>
        <div className="space-y-3">
          {progress?.list.map((p) => (
            <UnitCard
              key={p.unit.id}
              p={p}
              topics={(topics ?? []).filter((t) => t.unitId === p.unit.id)}
              timeMs={byUnit.get(p.unit.id) ?? 0}
              open={open === p.unit.id}
              onToggle={() => setOpen(open === p.unit.id ? null : p.unit.id)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function UnitCard({ p, topics, timeMs, open, onToggle }: { p: UnitProgress; topics: Topic[]; timeMs: number; open: boolean; onToggle: () => void }) {
  const celebrate = useCelebrate()
  const [newTopic, setNewTopic] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(p.unit.name)
  const [editTopic, setEditTopic] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [delTopic, setDelTopic] = useState<Topic | null>(null)
  const stage = plantStage(p.percent)

  const addTopic = async () => {
    const title = newTopic.trim()
    if (!title) return
    await db.topics.add({ id: uid(), unitId: p.unit.id, title, order: topics.length ? Math.max(...topics.map((t) => t.order)) + 1 : 0, done: false })
    setNewTopic('')
  }

  return (
    <article id={`unit-${p.unit.id}`} className="sheet scroll-mt-6 overflow-hidden">
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-start">
        <div className="grid size-16 shrink-0 place-items-end justify-center overflow-hidden rounded-2xl bg-mint/60">
          <Plant kind={p.unit.plant} stage={stage} size={52} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-lg font-bold">{p.unit.name}</h3>
            <span className="num text-lg font-bold">{p.percent}%</span>
          </div>
          <ProgressBar value={p.percent} label={`تقدم ${p.unit.name}`} height={9} />
          <p className="mt-1 text-xs text-ink-soft">
            <span className="num">{p.done}/{p.total}</span> دروس · ضايل <span className="num">{p.remaining}</span> · {formatDuration(timeMs)} دراسة · {STAGE_NAMES[stage]}
          </p>
        </div>
        <ChevronDown size={20} className={`shrink-0 text-ink-faint transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="border-t border-dashed border-line px-4 pb-4 pt-3">
              {renaming ? (
                <form
                  className="mb-3 flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (name.trim()) await db.units.update(p.unit.id, { name: name.trim() })
                    setRenaming(false)
                  }}
                >
                  <input className="field" value={name} onChange={(e) => setName(e.target.value)} aria-label="اسم الوحدة" autoFocus />
                  <Button type="submit">احفظ</Button>
                </form>
              ) : (
                <button onClick={() => setRenaming(true)} className="mb-2 flex min-h-10 items-center gap-1 text-sm font-semibold text-sage">
                  <Pencil size={15} /> غيّر اسم الوحدة
                </button>
              )}

              <ul className="ruled">
                {topics.map((t) => (
                  <li key={t.id} className="flex min-h-10 items-center gap-1">
                    <Check checked={t.done} label={t.title} onChange={(v) => toggleTopic(t.id, v, celebrate)} />
                    {editTopic === t.id ? (
                      <form
                        className="flex flex-1 gap-2 py-1"
                        onSubmit={async (e) => {
                          e.preventDefault()
                          if (editText.trim()) await db.topics.update(t.id, { title: editText.trim() })
                          setEditTopic(null)
                        }}
                      >
                        <input className="field min-h-10 py-1" value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus aria-label="اسم الدرس" />
                        <Button size="sm" type="submit">تم</Button>
                      </form>
                    ) : (
                      <>
                        <span className="flex-1 font-semibold"><span className="strike" data-on={t.done}>{t.title}</span></span>
                        {t.weak && <span className="rounded-full bg-peach px-2 text-[0.7rem] font-bold">ضعيف</span>}
                        <button
                          aria-label={`تعديل ${t.title}`}
                          className="grid size-10 place-items-center rounded-xl text-ink-faint hover:bg-paper"
                          onClick={() => {
                            setEditTopic(t.id)
                            setEditText(t.title)
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                        <button aria-label={`حذف ${t.title}`} className="grid size-10 place-items-center rounded-xl text-ink-faint hover:bg-peach" onClick={() => setDelTopic(t)}>
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void addTopic()
                }}
              >
                <input className="field" placeholder="ضيف درس جديد…" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} aria-label="درس جديد" />
                <Button type="submit" variant="soft" icon={<Plus size={18} />} disabled={!newTopic.trim()}>
                  ضيف
                </Button>
              </form>

              {!p.hasTopics && (
                <div className="mt-4 rounded-2xl bg-butter/50 p-3">
                  <label className="mb-1 flex justify-between text-sm font-semibold">
                    <span>ما في دروس — عدّل التقدم يدويًا</span>
                    <span className="num">{p.unit.manualProgress}%</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={p.unit.manualProgress}
                    onChange={(e) => db.units.update(p.unit.id, { manualProgress: Number(e.target.value) })}
                    className="w-full accent-[#6F9876]"
                    aria-label="التقدم اليدوي"
                  />
                </div>
              )}
              {p.percent >= 100 && (
                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-mint p-3">
                  <Milo mood="happy" size={56} still />
                  <p className="font-display font-bold">هيك الشغل! هاي الوحدة خلصت كاملة 🌸</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Confirm
        open={!!delTopic}
        title="نحذف الدرس؟"
        message={`«${delTopic?.title}» رح ينحذف من ${p.unit.name}، ونسبة الوحدة رح تتغير.`}
        confirmLabel="احذفه"
        onCancel={() => setDelTopic(null)}
        onConfirm={async () => {
          if (delTopic) await db.topics.delete(delTopic.id)
          setDelTopic(null)
        }}
      />
    </article>
  )
}
