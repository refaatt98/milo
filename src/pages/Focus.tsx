import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { StudyTimer } from '../components/timer/StudyTimer'
import { PageHeader } from '../components/ui/PageHeader'
import { Confirm } from '../components/ui/Confirm'
import { useStudyStats } from '../hooks/useStudyStats'
import { useTopics, useUnits } from '../hooks/useData'
import { sessionsOnDay } from '../lib/stats'
import { dayKey, formatClock, formatDuration } from '../lib/time'
import { SessionLessons } from '../components/timer/SessionLessons'
import { db, type StudySession } from '../lib/db'

export default function Focus() {
  const stats = useStudyStats()
  const units = useUnits()
  const topics = useTopics()
  const [del, setDel] = useState<StudySession | null>(null)
  const [lessons, setLessons] = useState<StudySession | null>(null)
  const list = sessionsOnDay(stats.sessions, stats.today).slice().reverse()

  return (
    <div>
      <PageHeader eyebrow="ركن التركيز" title="ساعة الدراسة">
        الوقت بينحسب من الطوابع الزمنية، فحتى لو سكّرت الصفحة أو قفلت الشاشة، رح تلاقيه مضبوط لما ترجع.
      </PageHeader>
      <StudyTimer />
      <section className="mt-10">
        <h2 className="mb-3 text-xl font-bold">جلسات اليوم</h2>
        {list.length === 0 ? (
          <p className="rounded-3xl border-[1.5px] border-dashed border-line p-6 text-center text-ink-soft">لسا ما في جلسات مسجّلة اليوم. أول وحدة بتبلّش هلأ؟</p>
        ) : (
          <ul className="space-y-2">
            {list.map((s) => (
              <li key={s.id} className="sheet flex items-center gap-3 px-4 py-3">
                <span className={`grid size-10 shrink-0 place-items-center rounded-2xl font-display font-bold ${s.kind === 'exam' ? 'bg-lavender' : 'bg-mint'}`}>
                  {s.kind === 'exam' ? '🎓' : '📖'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {units?.find((u) => u.id === s.unitId)?.name ?? (s.kind === 'exam' ? 'امتحان تجريبي' : 'دراسة عامة')}
                    {s.topicId && <span className="text-ink-soft"> · {topics?.find((t) => t.id === s.topicId)?.title}</span>}
                  </p>
                  <p className="text-xs text-ink-soft">
                    من <span className="num">{formatClock(s.startedAt)}</span> لـ <span className="num">{formatClock(s.endedAt)}</span>
                    {dayKey(s.startedAt) !== dayKey(s.endedAt) && ' (كمّلت بعد نص الليل)'}
                    {s.endedAt - s.startedAt - s.duration > 60e3 && <> · استراحات {formatDuration(s.endedAt - s.startedAt - s.duration)}</>}
                  </p>
                  {s.kind === 'study' && (
                    <button onClick={() => setLessons(s)} className="mt-1 rounded-full bg-mint/70 px-2.5 py-0.5 text-xs font-semibold text-sage-deep hover:bg-mint">
                      {s.topicIds?.length ? `خلّصت ${s.topicIds.length === 1 ? 'درس' : `${s.topicIds.length} دروس`} ✓ · تعديل` : '+ علّم الدروس اللي خلّصتها'}
                    </button>
                  )}
                </div>
                <span className="font-bold">{formatDuration(s.duration)}</span>
                <button aria-label="احذف الجلسة" onClick={() => setDel(s)} className="grid size-10 place-items-center rounded-xl text-ink-faint hover:bg-peach hover:text-ink">
                  <Trash2 size={17} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <SessionLessons session={lessons} onClose={() => setLessons(null)} />
      <Confirm
        open={!!del}
        title="نحذف الجلسة؟"
        message={`جلسة ${del ? formatDuration(del.duration) : ''} رح تنشال من الإحصائيات. استعمل هاد بس إذا سجّلتها بالغلط.`}
        confirmLabel="احذفها"
        onCancel={() => setDel(null)}
        onConfirm={async () => {
          if (del) await db.sessions.delete(del.id)
          setDel(null)
        }}
      />
    </div>
  )
}
