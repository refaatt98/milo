import { CheckCheck, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { Check } from '../ui/Check'
import { useCelebrate } from '../ui/Celebration'
import { useTopics, useUnits } from '../../hooks/useData'
import { db, type StudySession } from '../../lib/db'
import { unitProgress } from '../../lib/stats'
import { formatDuration } from '../../lib/time'
import { checkChallenge } from '../../lib/actions'

/**
 * "What did you finish in this session?" — tick any number of lessons (or all).
 * Un-ticking a lesson that was marked done by mistake un-marks it.
 */
export function SessionLessons({ session, onClose }: { session: StudySession | null; onClose: () => void }) {
  const units = useUnits()
  const topics = useTopics()
  const celebrate = useCelebrate()
  const [unitId, setUnitId] = useState<string | undefined>(undefined)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  // initialise when a session is opened
  useEffect(() => {
    if (!session || !topics) return
    const u = session.unitId ?? units?.[0]?.id
    setUnitId(u)
    setChecked(new Set(topics.filter((t) => t.unitId === u && t.done).map((t) => t.id)))
  }, [session?.id, topics === undefined]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => (topics ?? []).filter((t) => t.unitId === unitId), [topics, unitId])
  const unit = units?.find((u) => u.id === unitId)
  const newly = list.filter((t) => checked.has(t.id) && !t.done)
  const undone = list.filter((t) => !checked.has(t.id) && t.done)

  const switchUnit = (id: string) => {
    setUnitId(id)
    setChecked(new Set((topics ?? []).filter((t) => t.unitId === id && t.done).map((t) => t.id)))
  }

  const save = async () => {
    if (!session || !unit) return onClose()
    setBusy(true)
    const now = Date.now()
    await db.transaction('rw', db.topics, db.sessions, async () => {
      for (const t of newly) await db.topics.update(t.id, { done: true, completedAt: now })
      for (const t of undone) await db.topics.update(t.id, { done: false, completedAt: undefined })
      const prev = (await db.sessions.get(session.id))?.topicIds ?? []
      const ids = [...new Set([...prev.filter((id) => !undone.some((u) => u.id === id)), ...newly.map((t) => t.id)])]
      await db.sessions.update(session.id, { topicIds: ids, ...(session.unitId ? {} : { unitId: unit.id }) })
    })
    setBusy(false)
    onClose()
    const after = unitProgress(unit, await db.topics.where('unitId').equals(unit.id).toArray())
    if (newly.length && after.percent >= 100) {
      celebrate({ size: 'big', mood: 'excited', title: `هيك الشغل! خلصت ${unit.name} كاملة.`, message: 'نبتتها بالجنينة فتّحت 🌷' })
      await checkChallenge(celebrate)
    } else if (newly.length) {
      celebrate({ size: 'small', mood: 'happy', title: newly.length === 1 ? 'درس خلص ✓' : `خلّصت ${newly.length} دروس ✓`, message: `${unit.name}: ${after.done}/${after.total}` })
    }
  }

  return (
    <Sheet open={!!session} onClose={onClose} title="شو خلّصت بهالجلسة؟">
      {session && (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            جلسة {formatDuration(session.duration)}. علّم الدروس اللي خلّصتها — درس، كم درس، أو كلهم. وإذا في درس معلّم بالغلط، شيل علامته.
          </p>
          {units && units.length > 1 && (
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="الوحدة">
              {units.map((u) => (
                <button
                  key={u.id}
                  role="radio"
                  aria-checked={u.id === unitId}
                  onClick={() => switchUnit(u.id)}
                  className={`btn-press min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ring-1 ${u.id === unitId ? 'bg-ink text-white ring-ink' : 'bg-white ring-line'}`}
                >
                  {u.name}
                </button>
              ))}
            </div>
          )}
          {list.length ? (
            <>
              <div className="flex gap-2">
                <Button size="sm" variant="soft" icon={<CheckCheck size={16} />} onClick={() => setChecked(new Set(list.map((t) => t.id)))}>
                  خلّصت كلهم
                </Button>
                <Button size="sm" variant="ghost" icon={<X size={16} />} onClick={() => setChecked(new Set())}>
                  شيل الكل
                </Button>
              </div>
              <ul className="max-h-[42vh] divide-y divide-dashed divide-line overflow-y-auto rounded-2xl bg-white px-2 ring-1 ring-line">
                {list.map((t) => {
                  const on = checked.has(t.id)
                  return (
                    <li key={t.id} className="flex items-center gap-1">
                      <Check
                        checked={on}
                        label={t.title}
                        onChange={(v) => {
                          const next = new Set(checked)
                          if (v) next.add(t.id)
                          else next.delete(t.id)
                          setChecked(next)
                        }}
                      />
                      <span className="flex-1 py-2 font-semibold">{t.title}</span>
                      {t.done && on && <span className="text-xs text-ink-faint">من قبل</span>}
                      {t.done && !on && <span className="rounded-full bg-peach px-2 text-xs font-semibold">رح ينشال</span>}
                      {!t.done && on && <span className="rounded-full bg-mint px-2 text-xs font-semibold">جديد ✓</span>}
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <p className="rounded-2xl bg-paper p-4 text-sm text-ink-soft">هالوحدة ما فيها دروس. ضيف دروسها من «خطتي» أو الحديقة.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" onClick={onClose}>
              ما خلّصت ولا درس
            </Button>
            <Button onClick={save} disabled={busy}>
              {newly.length || undone.length ? `احفظ${newly.length ? ` (+${newly.length})` : ''}${undone.length ? ` (−${undone.length})` : ''}` : 'تمام'}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
