import { Reorder, useDragControls } from 'motion/react'
import { ArrowDown, ArrowUp, Coffee, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { db, type PlannerTask, type Unit } from '../../lib/db'
import { uid } from '../../lib/id'
import { useTasksOn, useUnits } from '../../hooks/useData'
import { Check } from '../ui/Check'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { Confirm } from '../ui/Confirm'
import { useCelebrate } from '../ui/Celebration'
import { localMinutes, parseHHMM, dayKey } from '../../lib/time'

const UNIT_TINTS = ['#E4EEDC', '#F9E9A7', '#DCEEF4', '#EAE3F6', '#F8D9C6', '#FBE3EA']

export function unitTint(units: Unit[] | undefined, id?: string) {
  const i = units?.findIndex((u) => u.id === id) ?? -1
  return i >= 0 ? UNIT_TINTS[i % UNIT_TINTS.length] : '#F1EEE6'
}

export function Planner({ date }: { date: string }) {
  const tasks = useTasksOn(date)
  const units = useUnits()
  const celebrate = useCelebrate()
  const [items, setItems] = useState<PlannerTask[]>([])
  const [editing, setEditing] = useState<PlannerTask | 'new' | null>(null)

  useEffect(() => {
    if (tasks) setItems(tasks)
  }, [tasks])

  const persistOrder = async (list: PlannerTask[]) => {
    await db.transaction('rw', db.tasks, async () => {
      await Promise.all(list.map((t, i) => (t.order !== i ? db.tasks.update(t.id, { order: i }) : null)))
    })
  }

  const move = async (id: string, dir: -1 | 1) => {
    const i = items.findIndex((t) => t.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    setItems(next)
    await persistOrder(next)
  }

  const toggle = async (t: PlannerTask, v: boolean) => {
    await db.tasks.update(t.id, { done: v, completedAt: v ? Date.now() : undefined })
    if (v) {
      const all = await db.tasks.where('date').equals(date).toArray()
      const left = all.filter((x) => !x.done).length
      if (left === 0) celebrate({ size: 'small', mood: 'excited', title: 'كل مهام اليوم خلصت!', message: 'الدفتر صار كله صحّات ✓' })
      else if (!t.isBreak && Math.random() < 0.5) celebrate({ size: 'small', mood: 'happy', title: 'تمام ✓', message: `ضايل ${left} بالدفتر` })
    }
  }

  const isToday = date === dayKey()
  const nowMin = localMinutes()
  const done = items.filter((t) => t.done).length

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm text-ink-soft">
        <span>
          <span className="num font-bold text-ink">{done}</span> من <span className="num">{items.length}</span> خلصت
        </span>
        <span className="hidden sm:inline">اسحب من المقبض لترتيب المهام</span>
      </div>
      <Reorder.Group axis="y" values={items} onReorder={setItems} className="relative space-y-2">
        {items.map((t) => {
          const current = isToday && t.start && t.end && nowMin >= parseHHMM(t.start) && nowMin < parseHHMM(t.end)
          return (
            <TaskRow
              key={t.id}
              task={t}
              units={units}
              current={!!current}
              onToggle={(v) => toggle(t, v)}
              onEdit={() => setEditing(t)}
              onDragEnd={() => persistOrder(items)}
            />
          )
        })}
      </Reorder.Group>
      {items.length === 0 && (
        <p className="rounded-2xl border-[1.5px] border-dashed border-line p-6 text-center text-ink-soft">الصفحة فاضية. ضيف أول مهمة لهاليوم ✏️</p>
      )}
      <Button variant="soft" className="mt-4 w-full border-[1.5px] border-dashed border-sage/50" icon={<Plus size={20} />} onClick={() => setEditing('new')}>
        ضيف مهمة
      </Button>
      <TaskEditor
        open={!!editing}
        task={editing === 'new' ? null : editing}
        date={date}
        count={items.length}
        units={units}
        onClose={() => setEditing(null)}
        onMove={(dir) => editing && editing !== 'new' && move(editing.id, dir)}
      />
    </div>
  )
}

function TaskRow({
  task,
  units,
  current,
  onToggle,
  onEdit,
  onDragEnd,
}: {
  task: PlannerTask
  units?: Unit[]
  current: boolean
  onToggle: (v: boolean) => void
  onEdit: () => void
  onDragEnd: () => void
}) {
  const controls = useDragControls()
  const unit = units?.find((u) => u.id === task.unitId)
  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      className={`relative flex items-stretch gap-1 rounded-[20px_16px_22px_14px] border-[1.5px] bg-white pe-1 ${current ? 'border-ink shadow-[3px_3px_0_#27372F]' : 'border-line'}`}
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 30px -10px rgba(39,55,47,.35)' }}
    >
      <div className="w-1.5 shrink-0 rounded-s-[18px]" style={{ background: task.isBreak ? '#F8D9C6' : unitTint(units, task.unitId) }} />
      <div className="flex items-center">
        <Check checked={task.done} onChange={onToggle} label={task.title} />
      </div>
      <button className="min-w-0 flex-1 py-2.5 text-start" onClick={onEdit}>
        <span className="flex items-center gap-2">
          {task.start && (
            <span className="num shrink-0 text-xs font-semibold text-ink-soft">
              {task.start}–{task.end}
            </span>
          )}
          {current && <span className="rounded-full bg-butter px-2 text-[0.7rem] font-bold">هلأ</span>}
        </span>
        <span className="strike mt-0.5 inline font-semibold" data-on={task.done}>
          {task.isBreak && <Coffee size={15} className="mb-0.5 me-1 inline text-[#C07A5C]" />}
          {task.title}
        </span>
        {unit && !task.isBreak && (
          <span className="ms-2 inline-block rounded-full px-2 py-0.5 align-middle text-[0.72rem] font-semibold" style={{ background: unitTint(units, unit.id) }}>
            {unit.name}
          </span>
        )}
      </button>
      <button onClick={onEdit} aria-label={`تعديل ${task.title}`} className="hidden size-11 place-items-center self-center rounded-xl text-ink-faint hover:bg-paper sm:grid">
        <Pencil size={17} />
      </button>
      <button
        aria-label="اسحب لإعادة الترتيب"
        className="grid w-9 shrink-0 cursor-grab touch-none place-items-center text-ink-faint active:cursor-grabbing"
        onPointerDown={(e) => controls.start(e)}
      >
        <GripVertical size={20} />
      </button>
    </Reorder.Item>
  )
}

function TaskEditor({
  open,
  task,
  date,
  count,
  units,
  onClose,
  onMove,
}: {
  open: boolean
  task: PlannerTask | null
  date: string
  count: number
  units?: Unit[]
  onClose: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [unitId, setUnitId] = useState('')
  const [isBreak, setIsBreak] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? '')
    setStart(task?.start ?? '')
    setEnd(task?.end ?? '')
    setUnitId(task?.unitId ?? '')
    setIsBreak(!!task?.isBreak)
  }, [open, task])

  const save = async () => {
    if (!title.trim()) return
    const patch = { title: title.trim(), start: start || undefined, end: end || undefined, unitId: unitId || undefined, isBreak }
    if (task) await db.tasks.update(task.id, patch)
    else await db.tasks.add({ id: uid(), date, order: count, done: false, ...patch })
    onClose()
  }

  return (
    <>
      <Sheet open={open && !confirmDel} onClose={onClose} title={task ? 'تعديل المهمة' : 'مهمة جديدة'}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">شو بدك تعمل؟</span>
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلًا: حل أسئلة الدرس الثاني" autoFocus />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">من</span>
              <input type="time" className="field num" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">لـ</span>
              <input type="time" className="field num" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">الوحدة</span>
            <select className="field" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">— بدون وحدة —</option>
              {units?.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5 accent-[#6F9876]" checked={isBreak} onChange={(e) => setIsBreak(e.target.checked)} />
            <span>هاي استراحة</span>
          </label>
          {task && (
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" icon={<ArrowUp size={16} />} onClick={() => onMove(-1)}>لفوق</Button>
              <Button type="button" variant="ghost" size="sm" icon={<ArrowDown size={16} />} onClick={() => onMove(1)}>لتحت</Button>
              <div className="flex-1" />
              <Button type="button" variant="danger" size="sm" icon={<Trash2 size={16} />} onClick={() => setConfirmDel(true)}>احذف</Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
            <Button type="submit" disabled={!title.trim()}>احفظ</Button>
          </div>
        </form>
      </Sheet>
      <Confirm
        open={confirmDel}
        title="نحذف المهمة؟"
        message={`«${task?.title}» رح تنحذف من الدفتر.`}
        confirmLabel="احذفها"
        onCancel={() => setConfirmDel(false)}
        onConfirm={async () => {
          if (task) await db.tasks.delete(task.id)
          setConfirmDel(false)
          onClose()
        }}
      />
    </>
  )
}
