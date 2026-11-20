import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, NotebookPen, Pencil } from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { ProgressBar } from '../ui/Progress'
import { Check } from '../ui/Check'
import { DestinationArt, DESTINATION_NAMES } from './Destinations'
import { db, type ChallengeDay, type Destination } from '../../lib/db'
import { useSessions, useTasksOn, useUnits, useUnitProgress, useTimers } from '../../hooks/useData'
import { msByUnit, msOnDay, sessionsOnDay } from '../../lib/stats'
import { dayKey, formatClock, formatDayLong, formatDuration } from '../../lib/time'
import { useCelebrate } from '../ui/Celebration'
import { checkChallenge } from '../../lib/actions'

export function DaySheet({ day, index, onClose }: { day: ChallengeDay | null; index: number; onClose: () => void }) {
  const [editing, setEditing] = useState(false)
  useEffect(() => setEditing(false), [day?.id])
  return (
    <Sheet open={!!day} onClose={onClose} title={day ? `اليوم ${index + 1} · ${formatDayLong(day.date)}` : ''} wide>
      {day && (editing ? <DayEditor day={day} onDone={() => setEditing(false)} /> : <DayView day={day} onEdit={() => setEditing(true)} />)}
    </Sheet>
  )
}

function DayView({ day, onEdit }: { day: ChallengeDay; onEdit: () => void }) {
  const tasks = useTasksOn(day.date)
  const sessions = useSessions()
  const timers = useTimers()
  const progress = useUnitProgress()
  const celebrate = useCelebrate()
  const studied = msOnDay(sessions ?? [], day.date, timers ?? [])
  const daySessions = sessionsOnDay(sessions ?? [], day.date)
  const doneTasks = tasks?.filter((t) => t.done).length ?? 0
  const byUnit = msByUnit(sessions ?? [], timers ?? [])
  const unitMs = day.unitIds.reduce((a, id) => a + (byUnit.get(id) ?? 0), 0)
  const crossesMidnight = daySessions.some((x) => dayKey(x.startedAt) !== dayKey(x.endedAt))

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="grid size-24 shrink-0 place-items-center rounded-3xl bg-white ring-1 ring-line">
          <DestinationArt kind={day.destination} size={84} />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-sage">{DESTINATION_NAMES[day.destination]} · {day.kind === 'exam' ? 'تحضير امتحانات' : 'دراسة'}</p>
          <h3 className="text-2xl font-extrabold leading-tight">{day.title}</h3>
          {day.notes && <p className="mt-1 text-sm text-ink-soft">{day.notes}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="درست بهاليوم" value={formatDuration(studied)} />
        <Stat label="المهام" value={`${doneTasks}/${tasks?.length ?? 0}`} />
        <Stat label="الجلسات" value={String(daySessions.length)} />
      </div>

      {day.unitIds.length > 0 && (
        <p className="rounded-2xl bg-mint/60 px-3 py-2 text-sm">
          كل وقتك على {day.unitIds.length > 1 ? 'وحدات هاليوم' : 'هالوحدة'}: <strong>{formatDuration(unitMs)}</strong>
          {crossesMidnight && (
            <span className="block text-xs text-ink-soft">جلسة كمّلت بعد نص الليل: الوقت بعد 12:00 بينحسب بهدف اليوم اللي بعده، بس بضل محسوب كامل على الوحدة.</span>
          )}
        </p>
      )}

      <section>
        <h4 className="mb-2 font-bold">وحدات اليوم</h4>
        <ul className="space-y-3">
          {day.unitIds.map((id) => {
            const p = progress?.map.get(id)
            if (!p) return null
            return (
              <li key={id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-semibold">{p.unit.name}</span>
                  <span className="text-ink-soft">
                    <span className="num">{p.done}/{p.total} · {p.percent}%</span> · {formatDuration(byUnit.get(id) ?? 0)}
                  </span>
                </div>
                <ProgressBar value={p.percent} label={p.unit.name} />
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between">
          <h4 className="font-bold">مهام الدفتر</h4>
          <Link to={`/planner?date=${day.date}`} className="text-sm font-semibold text-sage underline-offset-4 hover:underline">
            افتح الدفتر ←
          </Link>
        </div>
        <ul className="divide-y divide-dashed divide-line rounded-2xl bg-white px-2 ring-1 ring-line">
          {tasks?.map((t) => (
            <li key={t.id} className="flex items-center gap-1">
              <Check checked={t.done} label={t.title} onChange={(v) => db.tasks.update(t.id, { done: v, completedAt: v ? Date.now() : undefined })} />
              <span className="flex-1 py-2 text-[0.95rem]"><span className="strike" data-on={t.done}>{t.title}</span></span>
              {t.start && <span className="num text-xs text-ink-faint">{t.start}</span>}
            </li>
          ))}
          {tasks?.length === 0 && <li className="p-3 text-sm text-ink-soft">ما في مهام لهاليوم.</li>}
        </ul>
      </section>

      {daySessions.length > 0 && (
        <section>
          <h4 className="mb-2 font-bold">الجلسات المسجّلة</h4>
          <ul className="space-y-1.5 text-sm">
            {daySessions.map((s) => (
              <li key={s.id} className="flex justify-between rounded-xl bg-mint/60 px-3 py-2">
                <span>{s.kind === 'exam' ? 'امتحان تجريبي' : progress?.map.get(s.unitId ?? '')?.unit.name ?? 'دراسة'}</span>
                <span className="text-ink-soft">
                  <span className="num">{formatClock(s.startedAt)}</span> ← <span className="num">{formatClock(s.endedAt)}</span> · {formatDuration(s.duration)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant={day.completed ? 'ghost' : 'primary'}
          onClick={async () => {
            await db.days.update(day.id, { completed: !day.completed })
            if (!day.completed) {
              celebrate({ size: 'small', mood: 'happy', title: 'محطة جديدة خلصت ✓', message: day.title })
              await checkChallenge(celebrate)
            }
          }}
        >
          {day.completed ? 'رجّعه مش مكتمل' : 'علّم اليوم كمكتمل'}
        </Button>
        <Button variant="ghost" onClick={onEdit} icon={<Pencil size={18} />}>
          عدّل اليوم
        </Button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-2 py-3 ring-1 ring-line">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="num mt-0.5 font-bold">{value}</p>
    </div>
  )
}

function DayEditor({ day, onDone }: { day: ChallengeDay; onDone: () => void }) {
  const units = useUnits()
  const [title, setTitle] = useState(day.title)
  const [date, setDate] = useState(day.date)
  const [kind, setKind] = useState(day.kind)
  const [unitIds, setUnitIds] = useState(day.unitIds)
  const [destination, setDestination] = useState<Destination>(day.destination)
  const [notes, setNotes] = useState(day.notes)
  const dests = useMemo(() => Object.keys(DESTINATION_NAMES) as Destination[], [])

  const save = async () => {
    await db.transaction('rw', db.days, db.tasks, async () => {
      if (date !== day.date) {
        // tasks travel with their day
        await db.tasks.where('date').equals(day.date).modify({ date })
      }
      await db.days.update(day.id, { title: title.trim() || day.title, date, kind, unitIds, destination, notes })
    })
    onDone()
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">العنوان</span>
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 flex items-center gap-1 text-sm font-semibold"><CalendarDays size={16} /> التاريخ</span>
          <input type="date" className="field" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">النوع</span>
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value as ChallengeDay['kind'])}>
            <option value="study">دراسة</option>
            <option value="exam">تحضير امتحانات</option>
          </select>
        </label>
      </div>
      {date !== day.date && <p className="text-xs text-ink-soft">مهام الدفتر لهاليوم رح تنتقل معه للتاريخ الجديد.</p>}
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">الوحدات</legend>
        <div className="flex flex-wrap gap-2">
          {units?.map((u) => {
            const on = unitIds.includes(u.id)
            return (
              <button
                key={u.id}
                type="button"
                aria-pressed={on}
                onClick={() => setUnitIds(on ? unitIds.filter((x) => x !== u.id) : [...unitIds, u.id])}
                className={`btn-press min-h-11 rounded-full px-4 text-sm font-semibold ring-1 ${on ? 'bg-sage text-white ring-sage' : 'bg-white ring-line'}`}
              >
                {u.name}
              </button>
            )
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">المحطة على الخريطة</legend>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {dests.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={destination === d}
              aria-label={DESTINATION_NAMES[d]}
              onClick={() => setDestination(d)}
              className={`grid size-20 shrink-0 place-items-center rounded-2xl bg-white ring-1 ${destination === d ? 'ring-2 ring-ink' : 'ring-line'}`}
            >
              <DestinationArt kind={d} size={64} />
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-1 flex items-center gap-1 text-sm font-semibold"><NotebookPen size={16} /> ملاحظات</span>
        <textarea className="field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="ghost" onClick={onDone}>إلغاء</Button>
        <Button onClick={save}>احفظ</Button>
      </div>
    </div>
  )
}
