import { Flag, Pause, Play, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/Button'
import { Confirm } from '../ui/Confirm'
import { Sheet } from '../ui/Sheet'
import { TimerDial } from '../timer/TimerDial'
import { useCelebrate } from '../ui/Celebration'
import Milo from '../character/Milo'
import { useExams, useTimer, useUnits, useToday } from '../../hooks/useData'
import { useNow } from '../../hooks/useNow'
import { finishTimer, pauseTimer, resetTimer, resumeTimer, startTimer, viewTimer } from '../../lib/timer'
import { db, type Exam } from '../../lib/db'
import { uid } from '../../lib/id'
import { formatDuration, formatHMS } from '../../lib/time'
import { chime } from '../../lib/sound'

const PRESETS = [45, 60, 90, 120, 180]

export function ExamTimer() {
  const timer = useTimer('exam')
  const studyTimer = useTimer('study')
  const exams = useExams()
  const units = useUnits()
  const today = useToday()
  const celebrate = useCelebrate()
  const now = useNow(!!timer && timer.status === 'running', 500)
  const [title, setTitle] = useState('امتحان تجريبي')
  const [unitIds, setUnitIds] = useState<string[]>([])
  const [minutes, setMinutes] = useState(90)
  const [scoreFor, setScoreFor] = useState<Exam | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState(false)

  const exam = exams?.find((e) => e.id === timer?.examId)
  const view = timer ? viewTimer(timer, now) : null
  const planned = (exam?.plannedMinutes ?? minutes) * 60e3
  const remaining = planned - (view?.elapsed ?? 0)
  const over = remaining < 0

  const start = async () => {
    if (busy) return
    setBusy(true)
    const e: Exam = { id: uid(), title: title.trim() || 'امتحان تجريبي', date: today, unitIds, plannedMinutes: minutes, notes: '', status: 'planned', startedAt: Date.now() }
    await db.exams.add(e)
    await startTimer('exam', { examId: e.id, unitId: unitIds.length === 1 ? unitIds[0] : undefined })
    chime('start')
    setBusy(false)
  }

  const finish = async () => {
    if (busy) return
    setBusy(true)
    const s = await finishTimer('exam')
    setBusy(false)
    chime('done')
    const ex = s?.examId ? await db.exams.get(s.examId) : exam
    if (ex) setScoreFor(ex)
  }

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,320px)_1fr] md:items-center">
      <TimerDial progress={view ? Math.min(1, view.elapsed / planned) : 0} status={view ? (view.status === 'running' ? 'running' : 'paused') : 'idle'} size={320}>
        <div className="text-center">
          <p className="text-sm font-semibold text-ink-soft">{view ? (over ? 'الوقت خلص' : 'ضايل') : 'مدة الامتحان'}</p>
          <p className={`num text-[2.8rem] font-bold leading-none ${over ? 'text-[#C0603F]' : ''}`}>
            {view ? (over ? '+' : '') + formatHMS(Math.abs(remaining)) : formatHMS(minutes * 60e3)}
          </p>
          {view && <p className="mt-1 text-sm text-ink-soft">مضى {formatHMS(view.elapsed)}</p>}
        </div>
      </TimerDial>

      <div className="space-y-4">
        {studyTimer?.status === 'running' && !timer && (
          <p className="rounded-2xl bg-butter/60 px-3 py-2 text-sm">مؤقت الدراسة شغّال — لما تبلّش الامتحان رح يتوقف تلقائيًا عشان ما ينحسب الوقت مرتين.</p>
        )}
        {!timer ? (
          <>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">اسم الامتحان</span>
              <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
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
                      className={`btn-press min-h-10 rounded-full px-3 text-sm font-semibold ring-1 ${on ? 'bg-ink text-white ring-ink' : 'bg-white ring-line'}`}
                    >
                      {u.name}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-sm font-semibold">المدة (دقيقة)</legend>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={minutes === m}
                    onClick={() => setMinutes(m)}
                    className={`num btn-press min-h-10 min-w-14 rounded-full px-3 text-sm font-bold ring-1 ${minutes === m ? 'bg-lavender ring-ink' : 'bg-white ring-line'}`}
                  >
                    {m}
                  </button>
                ))}
                <input
                  type="number"
                  min={5}
                  max={480}
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(5, Math.min(480, Number(e.target.value) || 5)))}
                  className="field num min-h-10 w-24 py-1"
                  aria-label="مدة مخصصة"
                />
              </div>
            </fieldset>
            <Button size="lg" className="w-full" onClick={start} disabled={busy} icon={<Play size={20} fill="currentColor" />}>
              ابدأ الامتحان
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Milo mood={view?.status === 'running' ? 'focused' : 'break'} cap size={80} />
              <div>
                <p className="font-display text-xl font-bold">{exam?.title}</p>
                <p className="text-sm text-ink-soft">
                  {exam?.unitIds.map((id) => units?.find((u) => u.id === id)?.name).filter(Boolean).join('، ') || 'كل الوحدات'} · <span className="num">{exam?.plannedMinutes}</span> دقيقة
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {view?.status === 'running' ? (
                <Button size="lg" variant="butter" onClick={() => pauseTimer('exam')} icon={<Pause size={20} fill="currentColor" />}>
                  وقّف
                </Button>
              ) : (
                <Button size="lg" onClick={() => resumeTimer('exam')} icon={<Play size={20} fill="currentColor" />}>
                  كمّل
                </Button>
              )}
              <Button size="lg" variant={view?.status === 'running' ? 'primary' : 'soft'} onClick={finish} disabled={busy} icon={<Flag size={20} />}>
                سلّمت
              </Button>
            </div>
            <Button variant="ghost" className="w-full text-ink-soft" onClick={() => setConfirmReset(true)} icon={<RotateCcw size={18} />}>
              إلغاء الامتحان
            </Button>
          </>
        )}
      </div>

      <Confirm
        open={confirmReset}
        title="نلغي الامتحان؟"
        message="المؤقت رح يتصفّر وما رح ينحفظ وقت هالمحاولة."
        confirmLabel="ألغيه"
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          setConfirmReset(false)
          const id = timer?.examId
          await resetTimer('exam')
          if (id) await db.exams.delete(id)
        }}
      />
      <ScoreSheet
        exam={scoreFor}
        onClose={() => setScoreFor(null)}
        onSaved={(pct) =>
          celebrate({
            size: pct >= 85 ? 'big' : 'small',
            mood: pct >= 85 ? 'excited' : 'happy',
            title: pct >= 85 ? `علامة ${pct}%! واو 🎓` : `انحفظت العلامة: ${pct}%`,
            message: pct >= 85 ? 'هيك التحضير ولا بلاش.' : 'سجّل أخطاءك تحت عشان نرجعلها.',
          })
        }
      />
    </div>
  )
}

export function ScoreSheet({ exam, onClose, onSaved }: { exam: Exam | null; onClose: () => void; onSaved?: (pct: number) => void }) {
  const [score, setScore] = useState('')
  const [max, setMax] = useState('100')
  const [notes, setNotes] = useState('')
  return (
    <Sheet open={!!exam} onClose={onClose} title="كيف كانت العلامة؟">
      {exam && (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            const sc = Number(score)
            const mx = Number(max) || 100
            if (!Number.isFinite(sc)) return
            await db.exams.update(exam.id, { score: sc, maxScore: mx, notes, status: 'done', endedAt: exam.endedAt ?? Date.now() })
            setScore('')
            setNotes('')
            onClose()
            onSaved?.(Math.round((sc / mx) * 100))
          }}
        >
          <p className="text-sm text-ink-soft">
            {exam.title}
            {exam.durationMs ? ` · ${formatDuration(exam.durationMs)}` : ''}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-sm font-semibold">علامتك</span>
              <input type="number" inputMode="decimal" step="any" min={0} className="field num" value={score} onChange={(e) => setScore(e.target.value)} required autoFocus />
            </label>
            <label>
              <span className="mb-1 block text-sm font-semibold">من</span>
              <input type="number" inputMode="decimal" step="any" min={1} className="field num" value={max} onChange={(e) => setMax(e.target.value)} required />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">ملاحظات</span>
            <textarea className="field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="شو كان صعب؟" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>بعدين</Button>
            <Button type="submit" disabled={score === ''}>احفظ العلامة</Button>
          </div>
        </form>
      )}
    </Sheet>
  )
}
