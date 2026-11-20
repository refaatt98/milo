import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, CalendarPlus, Check, Pencil, Plus, Trash2, Wand2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Milo from '../components/character/Milo'
import { PageHeader, SectionTitle } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Confirm } from '../components/ui/Confirm'
import { Sheet } from '../components/ui/Sheet'
import { DaySheet } from '../components/map/DaySheet'
import { useCelebrate } from '../components/ui/Celebration'
import { useDays, useSettings, useToday, useTopics, useUnits } from '../hooks/useData'
import { db, saveSettings, type ChallengeDay, type Destination, type PlantKind, type Unit } from '../lib/db'
import { uid } from '../lib/id'
import { addDays, formatDayShort, weekdayName } from '../lib/time'
import { buildTasksForDay } from '../data/seed'
import { NumberField } from '../components/ui/NumberField'

const lessonList = (u?: UnitDraft) => (u?.lessons ?? '').split('\n').map((l) => l.trim()).filter(Boolean)

function UnitRow({ name, info, onName, onInfo, onRemove }: { name: string; info: UnitDraft; onName: (v: string) => void; onInfo: (v: UnitDraft) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false)
  const named = lessonList(info)
  return (
    <li className="rounded-2xl bg-paper p-3 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-2">
        <input className="field min-h-10 flex-1 py-1 font-semibold" value={name} onChange={(e) => onName(e.target.value)} aria-label="اسم الوحدة" style={{ minWidth: 140 }} />
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-soft">دروس</span>
          {named.length ? (
            <span className="num grid h-10 min-w-16 place-items-center rounded-xl bg-white px-3 font-bold ring-1 ring-line" title="العدد من أسماء الدروس">
              {named.length}
            </span>
          ) : (
            <NumberField label={`عدد دروس ${name}`} min={0} max={60} value={info.count} onChange={(v) => onInfo({ ...info, count: v })} stepper />
          )}
        </div>
        <button aria-label={`احذف ${name}`} className="grid size-10 place-items-center rounded-xl text-ink-faint hover:bg-peach" onClick={onRemove}>
          <X size={16} />
        </button>
      </div>
      <button type="button" onClick={() => setOpen(!open)} className="mt-2 text-sm font-semibold text-sage" aria-expanded={open}>
        {open ? 'خبّي أسماء الدروس' : named.length ? `أسماء الدروس (${named.length}) ✎` : '+ اكتب أسماء الدروس (اختياري)'}
      </button>
      {open && (
        <textarea
          className="field mt-2 min-h-28"
          dir="auto"
          value={info.lessons}
          onChange={(e) => onInfo({ ...info, lessons: e.target.value })}
          placeholder={'كل درس بسطر، مثلًا:\nالخلية وتركيبها\nالانقسام المتساوي\nالانقسام المنصّف'}
          aria-label={`أسماء دروس ${name}`}
        />
      )}
    </li>
  )
}

const PLANTS: PlantKind[] = ['tulip', 'sunflower', 'fern', 'lavender', 'cactus', 'blossom']
const STUDY_DEST: Destination[] = ['desk', 'garden', 'library', 'hill', 'cottage']
const EXAM_DEST: Destination[] = ['station', 'workshop', 'checkpoint']

interface UnitDraft {
  count: number
  /** optional real lesson names, one per line — when given, they decide the count */
  lessons: string
}

interface Draft {
  units: string[]
  unitInfo: UnitDraft[]
  start: string
  studyDays: number
  examDays: number
  goal: number
  template: boolean
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? ''
  return names.slice(0, -1).join('، ') + ' و' + names[names.length - 1]
}

/** Spreads units over the study days, then builds exam-prep days. */
export function draftDays(d: Draft): { date: string; title: string; kind: 'study' | 'exam'; unitIdx: number[]; destination: Destination }[] {
  const U = d.units.length
  const out: ReturnType<typeof draftDays> = []
  for (let i = 0; i < d.studyDays; i++) {
    let idx: number[] = []
    if (U) {
      const a = Math.floor((i * U) / d.studyDays)
      const b = Math.floor(((i + 1) * U) / d.studyDays)
      idx = b > a ? Array.from({ length: b - a }, (_, k) => a + k) : [Math.min(U - 1, a)]
    }
    out.push({ date: addDays(d.start, i), title: joinNames(idx.map((k) => d.units[k])) || `يوم دراسة ${i + 1}`, kind: 'study', unitIdx: idx, destination: STUDY_DEST[i % STUDY_DEST.length] })
  }
  const all = Array.from({ length: U }, (_, k) => k)
  const E = d.examDays
  const practice = Math.max(0, E - 2)
  for (let j = 0; j < E; j++) {
    const date = addDays(d.start, d.studyDays + j)
    if (j < practice) {
      const a = Math.floor((j * U) / practice)
      const b = Math.floor(((j + 1) * U) / practice)
      const idx = b > a ? all.slice(a, b) : all.slice(Math.min(U - 1, a), Math.min(U, a + 1))
      out.push({ date, title: `امتحانات تجريبية: ${joinNames(idx.map((k) => d.units[k]))}`, kind: 'exam', unitIdx: idx, destination: EXAM_DEST[j % 2] })
    } else if (j === E - 1) {
      out.push({ date, title: 'الامتحان التجريبي النهائي والمراجعة', kind: 'exam', unitIdx: all, destination: 'celebration' })
    } else {
      out.push({ date, title: 'امتحان شامل ومراجعة الأخطاء', kind: 'exam', unitIdx: all, destination: 'checkpoint' })
    }
  }
  return out
}

export default function PlanPage() {
  const units = useUnits()
  const days = useDays()
  if (!units || !days) return null
  return units.length === 0 && days.length === 0 ? <Wizard /> : <Manage units={units} days={days} />
}

/* ───────────── first-time wizard ───────────── */

function Wizard() {
  const today = useToday()
  const nav = useNavigate()
  const celebrate = useCelebrate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [d, setD] = useState<Draft>({ units: [], unitInfo: [], start: today, studyDays: 5, examDays: 4, goal: 9, template: true })
  const preview = useMemo(() => draftDays(d), [d])
  const [busy, setBusy] = useState(false)

  const addUnit = () => {
    const n = name.trim() || `الوحدة ${d.units.length + 1}`
    // a new unit starts with the same lesson count as the previous one
    const last = d.unitInfo[d.unitInfo.length - 1]
    setD({ ...d, units: [...d.units, n], unitInfo: [...d.unitInfo, { count: last ? lessonList(last).length || last.count : 4, lessons: '' }] })
    setName('')
  }

  const create = async () => {
    setBusy(true)
    const unitRows: Unit[] = d.units.map((n, i) => ({ id: uid(), name: n, order: i, plant: PLANTS[i % PLANTS.length], manualProgress: 0 }))
    const topicRows = unitRows.flatMap((u, i) => {
      const info = d.unitInfo[i]
      const names = lessonList(info)
      const titles = names.length ? names : Array.from({ length: info.count }, (_, t) => `الدرس ${t + 1}`)
      return titles.map((title, t) => ({ id: uid(), unitId: u.id, title, order: t, done: false }))
    })
    const dayRows: ChallengeDay[] = preview.map((p, i) => ({
      id: uid(),
      order: i,
      date: p.date,
      title: p.title,
      kind: p.kind,
      unitIds: p.unitIdx.map((k) => unitRows[k].id),
      destination: p.destination,
      notes: '',
      completed: false,
    }))
    const taskRows = d.template ? dayRows.flatMap((x) => buildTasksForDay(x.date, x.unitIds)) : []
    await db.transaction('rw', [db.units, db.topics, db.days, db.tasks], async () => {
      await db.units.bulkAdd(unitRows)
      await db.topics.bulkAdd(topicRows)
      await db.days.bulkAdd(dayRows)
      if (taskRows.length) await db.tasks.bulkAdd(taskRows)
    })
    const last = dayRows[dayRows.length - 1]?.date
    await saveSettings({ dailyGoalHours: d.goal, ...(last ? { examDateTime: `${last}T09:00` } : {}) })
    celebrate({ size: 'big', mood: 'excited', title: 'خطتك جاهزة! 🗺️', message: `${dayRows.length} يوم و ${unitRows.length} وحدات. يلا نبلّش المغامرة.` })
    nav('/map')
  }

  const steps = ['الوحدات', 'الأيام', 'الهدف']
  const canNext = step === 0 ? d.units.length > 0 : step === 1 ? d.studyDays + d.examDays > 0 : true

  return (
    <div>
      <PageHeader eyebrow="خطة جديدة" title="يلا نبني جدولك" art={<Milo mood="encouraging" size={100} />}>
        ثلاث خطوات صغيرة: شو بدك تدرس، بأي أيام، وقديش بدك تدرس باليوم. كل إشي بتقدر تعدّله بعدين.
      </PageHeader>
      <ol className="mb-6 flex gap-2" aria-label="الخطوات">
        {steps.map((s, i) => (
          <li key={s} className={`flex-1 rounded-full px-3 py-1.5 text-center text-sm font-semibold ${i === step ? 'bg-ink text-white' : i < step ? 'bg-mint' : 'bg-white ring-1 ring-line text-ink-faint'}`}>
            <span className="num">{i + 1}</span> · {s}
          </li>
        ))}
      </ol>

      <div className="sheet p-5">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }}>
            {step === 0 && (
              <div className="space-y-4">
                <SectionTitle>شو الوحدات (أو المواد) اللي بدك تدرسها؟</SectionTitle>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    addUnit()
                  }}
                >
                  <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={`مثلًا: الوحدة ${d.units.length + 1} أو «الكيمياء العضوية»`} aria-label="اسم الوحدة" />
                  <Button type="submit" variant="soft" icon={<Plus size={18} />}>ضيف</Button>
                </form>
                <ul className="space-y-2">
                  {d.units.map((u, i) => (
                    <UnitRow
                      key={i}
                      name={u}
                      info={d.unitInfo[i]}
                      onName={(v) => setD({ ...d, units: d.units.map((x, k) => (k === i ? v : x)) })}
                      onInfo={(v) => setD({ ...d, unitInfo: d.unitInfo.map((x, k) => (k === i ? v : x)) })}
                      onRemove={() => setD({ ...d, units: d.units.filter((_, k) => k !== i), unitInfo: d.unitInfo.filter((_, k) => k !== i) })}
                    />
                  ))}
                  {!d.units.length && <li className="text-sm text-ink-soft">لسا ما ضفت ولا وحدة. كل وحدة رح تصير نبتة بالحديقة 🌱</li>}
                </ul>
                {d.units.length > 0 && (
                  <p className="text-xs text-ink-soft">
                    المجموع: <span className="num font-bold">{d.unitInfo.reduce((a, x) => a + (lessonList(x).length || x.count), 0)}</span> درس · بتقدر تعدّل الدروس بعدين من الحديقة
                  </p>
                )}
              </div>
            )}
            {step === 1 && (
              <div className="space-y-4">
                <SectionTitle>إيمتى بتبلّش، وكم يوم؟</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label>
                    <span className="mb-1 block text-sm font-semibold">تاريخ البداية</span>
                    <input type="date" className="field num" value={d.start} onChange={(e) => e.target.value && setD({ ...d, start: e.target.value })} />
                  </label>
                  <label>
                    <span className="mb-1 block text-sm font-semibold">أيام دراسة</span>
                    <NumberField label="أيام دراسة" min={0} max={60} value={d.studyDays} onChange={(v) => setD({ ...d, studyDays: v })} stepper />
                  </label>
                  <label>
                    <span className="mb-1 block text-sm font-semibold">أيام تحضير امتحانات</span>
                    <NumberField label="أيام تحضير امتحانات" min={0} max={30} value={d.examDays} onChange={(v) => setD({ ...d, examDays: v })} stepper />
                  </label>
                </div>
                <p className="text-sm text-ink-soft">هيك رح تكون خريطتك (بتقدر تعدّل أي يوم بعدين):</p>
                <ol className="max-h-72 divide-y divide-line overflow-y-auto rounded-2xl bg-paper ring-1 ring-line">
                  {preview.map((p, i) => (
                    <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className={`num grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${p.kind === 'exam' ? 'bg-lavender' : 'bg-mint'}`}>{i + 1}</span>
                      <span className="flex-1 font-semibold">{p.title}</span>
                      <span className="text-xs text-ink-soft">
                        {weekdayName(p.date)} {formatDayShort(p.date)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-5">
                <SectionTitle>قديش بدك تدرس باليوم؟</SectionTitle>
                <label className="block">
                  <span className="mb-1 flex justify-between text-sm font-semibold">
                    <span>هدف الساعات اليومي</span>
                    <span className="num">{d.goal} ساعات</span>
                  </span>
                  <input type="range" min={1} max={14} step={0.5} value={d.goal} onChange={(e) => setD({ ...d, goal: Number(e.target.value) })} className="w-full accent-[#6F9876]" />
                </label>
                <label className="flex items-start gap-3 rounded-2xl bg-paper p-4 ring-1 ring-line">
                  <input type="checkbox" className="mt-1 size-5 accent-[#6F9876]" checked={d.template} onChange={(e) => setD({ ...d, template: e.target.checked })} />
                  <span>
                    <span className="block font-semibold">عبّيلي الجدول اليومي بتقسيمة جاهزة</span>
                    <span className="text-sm text-ink-soft">08:00 دراسة · 10:30 نكمّل · 14:00 أسئلة · 17:00 سنوات سابقة · 20:00 مراجعة — مع استراحات بينهم</span>
                  </span>
                </label>
                <div className="flex items-center gap-3 rounded-2xl bg-mint/60 p-4">
                  <Milo mood="happy" size={60} still />
                  <p>
                    <span className="num font-bold">{d.units.length}</span> وحدات · <span className="num font-bold">{preview.length}</span> يوم · من {formatDayShort(d.start)}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="mt-6 flex justify-between gap-3">
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0} icon={<ArrowRight size={18} />}>
            رجوع
          </Button>
          {step < 2 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
              التالي <ArrowLeft size={18} />
            </Button>
          ) : (
            <Button onClick={create} disabled={busy} icon={<Wand2 size={18} />}>
              اعمل الخطة
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ───────────── managing an existing plan ───────────── */

function Manage({ units, days }: { units: Unit[]; days: ChallengeDay[] }) {
  const topics = useTopics()
  const settings = useSettings()
  const [newUnit, setNewUnit] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [delUnit, setDelUnit] = useState<Unit | null>(null)
  const [delDay, setDelDay] = useState<ChallengeDay | null>(null)
  const [editDay, setEditDay] = useState<string | null>(null)
  const [wipe, setWipe] = useState(false)
  const [bulk, setBulk] = useState<Unit | null>(null)
  const [bulkText, setBulkText] = useState('')

  const addLessons = async () => {
    if (!bulk) return
    const names = bulkText.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!names.length) return
    const existing = topics?.filter((t) => t.unitId === bulk.id) ?? []
    const start = existing.length ? Math.max(...existing.map((t) => t.order)) + 1 : 0
    await db.topics.bulkAdd(names.map((title, i) => ({ id: uid(), unitId: bulk.id, title, order: start + i, done: false })))
    setBulk(null)
  }

  const addUnit = async () => {
    const n = newUnit.trim()
    if (!n) return
    const order = units.length ? Math.max(...units.map((u) => u.order)) + 1 : 0
    await db.units.add({ id: uid(), name: n, order, plant: PLANTS[order % PLANTS.length], manualProgress: 0 })
    setNewUnit('')
  }

  const addDay = async (kind: 'study' | 'exam') => {
    const last = days[days.length - 1]?.date
    const date = last ? addDays(last, 1) : new Date().toISOString().slice(0, 10)
    const order = days.length ? Math.max(...days.map((x) => x.order)) + 1 : 0
    const id = uid()
    await db.days.add({
      id,
      order,
      date,
      title: kind === 'exam' ? 'تحضير امتحانات' : 'يوم دراسة',
      kind,
      unitIds: [],
      destination: (kind === 'exam' ? EXAM_DEST : STUDY_DEST)[order % 3],
      notes: '',
      completed: false,
    })
    setEditDay(id)
  }

  const fillTemplate = async () => {
    for (const d of days) {
      const n = await db.tasks.where('date').equals(d.date).count()
      if (!n) await db.tasks.bulkAdd(buildTasksForDay(d.date, d.unitIds))
    }
  }

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="كل إشي قابل للتعديل" title="خطتي" art={<Milo mood="studying" size={96} />}>
        الوحدات، الأيام، والتواريخ. أي تغيير هون بينعكس على الخريطة والحديقة والجدول فورًا.
      </PageHeader>

      <section>
        <SectionTitle>الوحدات</SectionTitle>
        <ul className="sheet divide-y divide-line">
          {units.map((u) => {
            const n = topics?.filter((t) => t.unitId === u.id).length ?? 0
            return (
              <li key={u.id} className="flex items-center gap-2 px-4 py-2">
                {renaming === u.id ? (
                  <form
                    className="flex flex-1 gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (renameText.trim()) await db.units.update(u.id, { name: renameText.trim() })
                      setRenaming(null)
                    }}
                  >
                    <input className="field" value={renameText} onChange={(e) => setRenameText(e.target.value)} autoFocus aria-label="اسم الوحدة" />
                    <Button size="sm" type="submit" icon={<Check size={16} />}>تم</Button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 font-semibold">{u.name}</span>
                    <button onClick={() => { setBulk(u); setBulkText('') }} className="min-h-10 rounded-xl px-2 text-xs font-semibold text-sage hover:bg-mint" aria-label={`ضيف دروس لـ ${u.name}`}>
                      <span className="num">{n}</span> دروس · + ضيف
                    </button>
                    <button aria-label={`تعديل ${u.name}`} onClick={() => { setRenaming(u.id); setRenameText(u.name) }} className="grid size-10 place-items-center rounded-xl text-ink-faint hover:bg-paper">
                      <Pencil size={16} />
                    </button>
                    <button aria-label={`حذف ${u.name}`} onClick={() => setDelUnit(u)} className="grid size-10 place-items-center rounded-xl text-ink-faint hover:bg-peach">
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </li>
            )
          })}
          <li className="p-3">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void addUnit() }}>
              <input className="field" placeholder="وحدة جديدة…" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} aria-label="وحدة جديدة" />
              <Button type="submit" variant="soft" icon={<Plus size={18} />} disabled={!newUnit.trim()}>ضيف</Button>
            </form>
          </li>
        </ul>
        <p className="mt-2 text-xs text-ink-soft">الدروس داخل كل وحدة بتتعدّل من صفحة الحديقة والوحدات.</p>
      </section>

      <section>
        <SectionTitle
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" icon={<CalendarPlus size={16} />} onClick={() => addDay('study')}>يوم دراسة</Button>
              <Button size="sm" variant="ghost" icon={<CalendarPlus size={16} />} onClick={() => addDay('exam')}>يوم امتحانات</Button>
            </div>
          }
        >
          الأيام
        </SectionTitle>
        <ol className="sheet divide-y divide-line">
          {days.map((d, i) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className={`num grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${d.kind === 'exam' ? 'bg-lavender' : 'bg-mint'}`}>{i + 1}</span>
              <button className="min-w-0 flex-1 text-start" onClick={() => setEditDay(d.id)}>
                <span className="block truncate font-semibold">{d.title}</span>
                <span className="text-xs text-ink-soft">
                  {weekdayName(d.date)} {formatDayShort(d.date)} · {d.unitIds.map((id) => units.find((u) => u.id === id)?.name).filter(Boolean).join('، ') || 'بدون وحدات'}
                </span>
              </button>
              <button aria-label="حذف اليوم" onClick={() => setDelDay(d)} className="grid size-10 place-items-center rounded-xl text-ink-faint hover:bg-peach">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
          {!days.length && <li className="p-5 text-center text-sm text-ink-soft">ما في أيام. ضيف أول يوم من فوق.</li>}
        </ol>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Button variant="soft" onClick={fillTemplate} icon={<Wand2 size={18} />}>عبّي الأيام الفاضية بالتقسيمة اليومية</Button>
        <Button variant="danger" onClick={() => setWipe(true)} icon={<Trash2 size={18} />}>امسح الخطة وابدأ من جديد</Button>
      </section>
      <p className="text-xs text-ink-faint">هدف اليوم الحالي: {settings.dailyGoalHours} ساعات (بتغيّره من الإعدادات).</p>

      <Sheet open={!!bulk} onClose={() => setBulk(null)} title={`دروس ${bulk?.name ?? ''}`}>
        <div className="space-y-3">
          {topics && bulk && (
            <ol className="max-h-40 list-inside list-decimal overflow-y-auto rounded-2xl bg-paper px-3 py-2 text-sm ring-1 ring-line">
              {topics.filter((t) => t.unitId === bulk.id).map((t) => (
                <li key={t.id} className={t.done ? 'text-ink-faint line-through' : ''}>{t.title}</li>
              ))}
              {!topics.some((t) => t.unitId === bulk.id) && <li className="list-none text-ink-soft">ما في دروس لسا.</li>}
            </ol>
          )}
          <textarea className="field min-h-32" dir="auto" value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={'ضيف دروس جديدة — كل درس بسطر'} aria-label="دروس جديدة" autoFocus />
          <Button className="w-full" onClick={addLessons} disabled={!bulkText.trim()} icon={<Plus size={18} />}>
            ضيف {bulkText.split('\n').filter((l) => l.trim()).length || ''} دروس
          </Button>
          <p className="text-xs text-ink-soft">لتعديل أو حذف درس، افتح الوحدة من صفحة الحديقة والوحدات.</p>
        </div>
      </Sheet>
      <DaySheet day={days.find((d) => d.id === editDay) ?? null} index={days.findIndex((d) => d.id === editDay)} onClose={() => setEditDay(null)} />
      <Confirm
        open={!!delUnit}
        title="نحذف الوحدة؟"
        message={`«${delUnit?.name}» ودروسها رح ينحذفوا، والجلسات القديمة بتضل بالإحصائيات.`}
        confirmLabel="احذفها"
        onCancel={() => setDelUnit(null)}
        onConfirm={async () => {
          const u = delUnit
          setDelUnit(null)
          if (!u) return
          await db.transaction('rw', [db.units, db.topics, db.days], async () => {
            await db.topics.where('unitId').equals(u.id).delete()
            await db.units.delete(u.id)
            for (const d of days.filter((x) => x.unitIds.includes(u.id))) await db.days.update(d.id, { unitIds: d.unitIds.filter((x) => x !== u.id) })
          })
        }}
      />
      <Confirm
        open={!!delDay}
        title="نحذف اليوم؟"
        message={`يوم ${delDay ? formatDayShort(delDay.date) : ''} ومهامه بالجدول رح ينحذفوا.`}
        confirmLabel="احذفه"
        onCancel={() => setDelDay(null)}
        onConfirm={async () => {
          const d = delDay
          setDelDay(null)
          if (!d) return
          await db.transaction('rw', [db.days, db.tasks], async () => {
            await db.tasks.where('date').equals(d.date).delete()
            await db.days.delete(d.id)
          })
        }}
      />
      <Confirm
        open={wipe}
        title="نمسح الخطة كلها؟"
        message="الوحدات والدروس والأيام ومهام الجدول رح ينمسحوا. الجلسات والدفاتر بيضلّوا."
        confirmLabel="امسح"
        onCancel={() => setWipe(false)}
        onConfirm={async () => {
          setWipe(false)
          await db.transaction('rw', [db.units, db.topics, db.days, db.tasks], async () => {
            for (const t of [db.units, db.topics, db.days, db.tasks]) {
              const keys = await t.toCollection().primaryKeys()
              await t.bulkDelete(keys as string[])
            }
          })
        }}
      />
    </div>
  )
}
