import { AnimatePresence, motion } from 'motion/react'
import { Coffee, Flag, Pause, Play, RotateCcw, Timer as TimerIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Milo from '../character/Milo'
import { Bubble } from '../ui/Bubble'
import { Button } from '../ui/Button'
import { Confirm } from '../ui/Confirm'
import { useCelebrate } from '../ui/Celebration'
import { TimerDial } from './TimerDial'
import { useSettings, useTimer, useTopics, useUnits, useDays } from '../../hooks/useData'
import { useNow } from '../../hooks/useNow'
import { useStudyStats } from '../../hooks/useStudyStats'
import { finishTimer, pauseTimer, resetTimer, resumeTimer, startTimer, updateTimerMeta, viewTimer, POMO_FOCUS, POMO_BREAK } from '../../lib/timer'
import { formatDuration, formatHMS } from '../../lib/time'
import { miloLine } from '../../lib/messages'
import { challengePhase, todayChallengeDay } from '../../lib/phase'
import { chime } from '../../lib/sound'
import type { StudySession } from '../../lib/db'
import { SessionLessons } from './SessionLessons'

export function StudyTimer() {
  const timer = useTimer('study')
  const examTimer = useTimer('exam')
  const units = useUnits()
  const topics = useTopics()
  const days = useDays()
  const settings = useSettings()
  const stats = useStudyStats()
  const celebrate = useCelebrate()
  const now = useNow(!!timer && timer.status !== 'paused', 500)
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [finished, setFinished] = useState<StudySession | null>(null)

  const todayDay = todayChallengeDay(days, stats.today)
  const [unitId, setUnitId] = useState<string | undefined>(undefined)
  const [topicId, setTopicId] = useState<string | undefined>(undefined)
  const [pomodoro, setPomodoro] = useState<boolean | undefined>(undefined)

  // default the picker to today's unit
  useEffect(() => {
    if (unitId === undefined && units?.length) setUnitId(todayDay?.unitIds[0] ?? units[0].id)
  }, [units, todayDay, unitId])

  const activeUnit = timer ? timer.unitId : unitId
  const activeTopic = timer ? timer.topicId : topicId
  const usePomo = timer ? timer.pomodoro : (pomodoro ?? settings.pomodoroDefault)
  const unitTopics = useMemo(() => (topics ?? []).filter((t) => t.unitId === activeUnit), [topics, activeUnit])

  const view = timer ? viewTimer(timer, now) : null
  const status = view?.status ?? 'idle'

  // chime once when a pomodoro block ends while the page is open
  const [lastStatus, setLastStatus] = useState(status)
  useEffect(() => {
    if (status !== lastStatus) {
      if (status === 'break') chime('break')
      setLastStatus(status)
    }
  }, [status, lastStatus])

  const line = miloLine({
    todayMs: stats.todayMs,
    goalMs: stats.goalMs,
    yesterdayMs: stats.yesterdayMs,
    timerStatus: timer ? (status as 'running' | 'paused' | 'break') : undefined,
    sessionMs: view?.elapsed ?? 0,
    pomodoro: usePomo,
    sessionsToday: stats.sessionsToday,
    phase: challengePhase(days, stats.today),
    now,
    unitsDone: 0,
  })

  const progress = !view
    ? 0
    : usePomo
      ? status === 'break'
        ? 1 - (view.breakRemaining ?? 0) / POMO_BREAK
        : 1 - (view.blockRemaining ?? POMO_FOCUS) / POMO_FOCUS
      : (view.elapsed % 3600e3) / 3600e3

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  const onStart = () =>
    run(async () => {
      await startTimer('study', { unitId, topicId, pomodoro: usePomo })
      chime('start')
    })

  const onFinish = () =>
    run(async () => {
      const s = await finishTimer('study')
      if (!s) return
      chime('done')
      const unit = units?.find((u) => u.id === s.unitId)
      celebrate({
        size: 'small',
        mood: 'happy',
        title: `خلصت جلسة ${formatDuration(s.duration)} 🎉`,
        message: unit ? `انحسبت على ${unit.name}` : 'انحفظت بسجلّك',
      })
      // always ask which lessons were finished in this session
      setTimeout(() => setFinished(s), 700)
    })

  const unitName = (id?: string) => units?.find((u) => u.id === id)?.name ?? 'بدون وحدة'

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
      {/* dial + Milo */}
      <div className="relative">
        <TimerDial progress={progress} status={status} leaves={view ? Math.floor(view.elapsed / 3600e3) : 0}>
          <div className="text-center">
            <p className="mb-1 text-sm font-semibold text-ink-soft">
              {status === 'idle' && 'جلسة جديدة'}
              {status === 'running' && (usePomo ? 'تركيز · بومودورو' : 'عم تدرس')}
              {status === 'paused' && 'متوقف مؤقتًا'}
              {status === 'break' && 'استراحة'}
            </p>
            <p className="num text-[3.4rem] font-bold leading-none tracking-tight sm:text-[4rem]" aria-live="off">
              {status === 'break' ? formatHMS(view?.breakRemaining ?? 0).slice(3) : formatHMS(view?.elapsed ?? 0)}
            </p>
            {usePomo && view && status !== 'break' && (
              <p className="mt-2 text-sm text-ink-soft">
                ضايل <span className="num">{formatHMS(view.blockRemaining ?? 0).slice(3)}</span> للاستراحة
              </p>
            )}
            {status === 'break' && <p className="mt-2 text-sm text-ink-soft">{view?.breakOver ? 'خلصت الاستراحة، يلا نرجع' : 'مدة الجلسة ' + formatHMS(view?.elapsed ?? 0)}</p>}
            {!view && <p className="mt-2 text-sm text-ink-soft">اليوم: {formatDuration(stats.todayMs)}</p>}
          </div>
        </TimerDial>
        <div className="relative z-10 -mt-14 flex items-end justify-between gap-1">
          <div className="mb-12 min-w-0 flex-1">
            <Bubble k={line.text} tail="left" className="me-3 max-w-[270px] text-[0.98rem]">
              {line.text}
            </Bubble>
          </div>
          <Milo mood={line.mood} size={132} className="shrink-0" />
        </div>
      </div>

      {/* controls */}
      <div className="sheet relative p-5">
        <div className="tape -top-3 left-8 rotate-[-4deg]" />
        {examTimer && examTimer.status === 'running' && (
          <p className="mb-3 rounded-2xl bg-lavender px-3 py-2 text-sm">
            مؤقت الامتحان شغّال. إذا بلّشت هون رح يتوقف تلقائيًا عشان ما ينحسب الوقت مرتين.
          </p>
        )}
        <label className="mb-1 block text-sm font-semibold text-ink-soft" htmlFor="unit">الوحدة</label>
        <div className="no-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" id="unit" role="radiogroup" aria-label="اختر الوحدة">
          {units?.map((u) => {
            const on = activeUnit === u.id
            return (
              <button
                key={u.id}
                role="radio"
                aria-checked={on}
                onClick={() => {
                  if (timer) updateTimerMeta('study', { unitId: u.id, topicId: undefined })
                  else {
                    setUnitId(u.id)
                    setTopicId(undefined)
                  }
                }}
                className={`btn-press min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ring-1 ${on ? 'bg-ink text-white ring-ink' : 'bg-paper ring-line hover:bg-mint'}`}
              >
                {u.name}
              </button>
            )
          })}
        </div>
        <label className="mb-1 block text-sm font-semibold text-ink-soft" htmlFor="topic">الدرس</label>
        <select
          id="topic"
          className="field mb-4"
          value={activeTopic ?? ''}
          onChange={(e) => {
            const v = e.target.value || undefined
            if (timer) updateTimerMeta('study', { topicId: v })
            else setTopicId(v)
          }}
        >
          <option value="">— بدون درس محدد —</option>
          {unitTopics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.done ? '✓ ' : ''}
              {t.title}
            </option>
          ))}
        </select>

        <label className="mb-5 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-2xl bg-paper px-4 py-2 ring-1 ring-line">
          <span>
            <span className="flex items-center gap-2 font-semibold">
              <TimerIcon size={18} className="text-sage" /> وضع بومودورو 50/10
            </span>
            <span className="block text-xs text-ink-soft">50 دقيقة تركيز، بعدها 10 دقايق راحة ما بتنحسب</span>
          </span>
          <input
            type="checkbox"
            className="peer sr-only"
            checked={usePomo}
            onChange={(e) => (timer ? updateTimerMeta('study', { pomodoro: e.target.checked }) : setPomodoro(e.target.checked))}
          />
          <span className="relative h-7 w-12 shrink-0 rounded-full bg-line transition peer-checked:bg-sage peer-focus-visible:ring-2 peer-focus-visible:ring-sage after:absolute after:right-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:-translate-x-5" />
        </label>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={status} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            {status === 'idle' && (
              <Button size="lg" className="w-full" onClick={onStart} disabled={busy} icon={<Play size={22} fill="currentColor" />}>
                يلا نبلّش
              </Button>
            )}
            {status === 'running' && (
              <div className="grid grid-cols-2 gap-3">
                <Button size="lg" variant="butter" onClick={() => run(() => pauseTimer('study'))} disabled={busy} icon={<Pause size={20} fill="currentColor" />}>
                  وقّف شوي
                </Button>
                <Button size="lg" onClick={onFinish} disabled={busy} icon={<Flag size={20} />}>
                  خلصت
                </Button>
              </div>
            )}
            {(status === 'paused' || status === 'break') && (
              <div className="grid grid-cols-2 gap-3">
                <Button size="lg" onClick={() => run(() => resumeTimer('study'))} disabled={busy} icon={status === 'break' ? <Coffee size={20} /> : <Play size={20} fill="currentColor" />}>
                  {status === 'break' ? 'رجعت، كمّل' : 'كمّل'}
                </Button>
                <Button size="lg" variant="soft" onClick={onFinish} disabled={busy} icon={<Flag size={20} />}>
                  خلصت
                </Button>
                <Button variant="ghost" className="col-span-2 text-ink-soft" onClick={() => setConfirmReset(true)} icon={<RotateCcw size={18} />}>
                  إلغاء الجلسة بدون حفظ
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-dashed border-line pt-4 text-center">
          <div>
            <dt className="text-xs text-ink-soft">الجلسة</dt>
            <dd className="num text-lg font-bold">{formatHMS(view?.elapsed ?? 0).slice(0, 5)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">اليوم</dt>
            <dd className="num text-lg font-bold">{formatHMS(stats.todayMs).slice(0, 5)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">جلسات اليوم</dt>
            <dd className="num text-lg font-bold">{stats.sessionsToday}</dd>
          </div>
        </dl>
        {timer && <p className="mt-3 text-center text-xs text-ink-faint">الجلسة الحالية: {unitName(timer.unitId)} · الوقت محفوظ حتى لو سكّرت الصفحة</p>}
      </div>

      <Confirm
        open={confirmReset}
        title="نلغي الجلسة؟"
        message="الوقت اللي بهاي الجلسة ما رح ينحفظ. متأكد؟"
        confirmLabel="ألغيها"
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          setConfirmReset(false)
          await resetTimer('study')
        }}
      />
      <SessionLessons session={finished} onClose={() => setFinished(null)} />
    </div>
  )
}
