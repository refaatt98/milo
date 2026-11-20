import { motion } from 'motion/react'
import { ArrowLeft, Play } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Milo from '../components/character/Milo'
import { Bubble } from '../components/ui/Bubble'
import { Button } from '../components/ui/Button'
import { ProgressBar } from '../components/ui/Progress'
import { Check } from '../components/ui/Check'
import { StarJar } from '../components/timer/StarJar'
import { Garden } from '../components/garden/Garden'
import { DestinationArt, DESTINATION_NAMES } from '../components/map/Destinations'
import { useDays, useSettings, useTasksOn, useTimer, useTopics, useUnitProgress } from '../hooks/useData'
import { useStudyStats } from '../hooks/useStudyStats'
import { miloLine } from '../lib/messages'
import { challengePhase } from '../lib/phase'
import { daysBetween, formatDayLong, formatDuration, formatHMS, hours, localMinutes, parseHHMM, localTimeOn } from '../lib/time'
import { startTimer, viewTimer } from '../lib/timer'
import { db } from '../lib/db'
import { useNow } from '../hooks/useNow'

export default function Today() {
  const stats = useStudyStats()
  const days = useDays()
  const progress = useUnitProgress()
  const topics = useTopics()
  const tasks = useTasksOn(stats.today)
  const timer = useTimer('study')
  const settings = useSettings()
  const nav = useNavigate()

  const phase = challengePhase(days, stats.today)
  const dayIdx = days?.findIndex((d) => d.date === stats.today) ?? -1
  const day = dayIdx >= 0 ? days![dayIdx] : undefined
  const view = timer ? viewTimer(timer, stats.now) : null
  const line = miloLine({
    todayMs: stats.todayMs,
    goalMs: stats.goalMs,
    yesterdayMs: stats.yesterdayMs,
    timerStatus: view?.status,
    sessionMs: view?.elapsed ?? 0,
    pomodoro: timer?.pomodoro,
    sessionsToday: stats.sessionsToday,
    phase,
    now: stats.now,
    unitsDone: progress?.list.filter((p) => p.percent >= 100).length ?? 0,
  })
  const doneTasks = tasks?.filter((t) => t.done).length ?? 0
  const nowMin = localMinutes(stats.now)
  const upcoming = (tasks ?? []).filter((t) => !t.done && (!t.end || parseHHMM(t.end) > nowMin)).slice(0, 4)
  const examAt = (() => {
    const [d, t] = settings.examDateTime.split('T')
    const [h, m] = (t ?? '09:00').split(':').map(Number)
    return localTimeOn(d, h, m)
  })()
  const firstDay = days?.[0]?.date
  const noPlan = days !== undefined && days.length === 0 && progress !== undefined && progress.list.length === 0

  return (
    <div className="space-y-6">
      {/* hero */}
      <section className="relative grid items-end gap-2 pt-2 sm:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm font-semibold text-sage">{formatDayLong(stats.today)}</p>
          {day ? (
            <h1 className="mt-1 text-[2.1rem] font-extrabold leading-[1.15] sm:text-5xl">
              <span className="squiggle-under">اليوم {dayIdx + 1}</span> من {days!.length}:
              <br />
              {day.title}
            </h1>
          ) : phase === 'before' && firstDay ? (
            <h1 className="mt-1 text-[2.1rem] font-extrabold leading-tight sm:text-5xl">
              ضايل <span className="num">{daysBetween(stats.today, firstDay)}</span> يوم على المغامرة
            </h1>
          ) : (
            <h1 className="mt-1 text-[2.1rem] font-extrabold leading-tight sm:text-5xl">{phase === 'after' ? 'المغامرة خلصت 🌸' : 'أهلا فيك'}</h1>
          )}
        </div>
        <div className="flex items-end gap-1 sm:flex-col sm:items-center">
          <div className="order-2 sm:order-1">
            <Bubble k={line.text} tail="left" className="mb-6 max-w-[230px] sm:mb-0">
              {line.text}
            </Bubble>
          </div>
          <Milo mood={line.mood} size={150} cap={phase === 'exam'} className="order-1 -mb-2 shrink-0 sm:order-2" />
        </div>
      </section>

      {noPlan && (
        <section className="relative overflow-hidden rounded-[30px_24px_32px_26px] border-[1.5px] border-ink bg-butter p-6 shadow-[4px_4px_0_#27372F]">
          <h2 className="text-2xl font-extrabold">يلا نبني خطتك 🗺️</h2>
          <p className="mt-1 max-w-lg text-ink-soft">حسابك جديد وفاضي. ضيف وحداتك وأيامك، ورح تصير عندك خريطة مغامرة، حديقة، وجدول يومي — كلهم إلك.</p>
          <Button className="mt-4" onClick={() => nav('/plan')}>ابني جدولي</Button>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        {/* goal jar */}
        <section className="sheet sheet-tilt-l relative overflow-hidden p-5 lg:col-span-7" aria-labelledby="goal-h">
          <div className="tape -top-2 right-12 rotate-[-5deg]" />
          <div className="flex gap-4">
            <div className="playful-only shrink-0">
              <StarJar percent={stats.percent} size={128} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="goal-h" className="text-lg font-bold">هدف اليوم: <span className="num">{settings.dailyGoalHours}</span> ساعات</h2>
              <p className="num mt-1 text-[2.6rem] font-bold leading-none">
                {hours(stats.todayMs)}
                <span className="font-sans text-base font-semibold text-ink-soft"> / {settings.dailyGoalHours} س</span>
              </p>
              <div className="mt-3">
                <ProgressBar value={stats.percent} label="تقدم هدف اليوم" />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <Row k="ضايل" v={formatDuration(stats.remainingMs)} />
                <Row k="التقدم" v={`${stats.percent.toFixed(0)}%`} />
                <Row k="الجلسة الحالية" v={view ? formatHMS(view.elapsed) : '—'} />
                <Row k="الجلسات" v={String(stats.sessionsToday)} />
                <Row k="المهام" v={`${doneTasks}/${tasks?.length ?? 0}`} />
                <Row k="نجوم بالجرة" v={String(Math.min(27, Math.floor((stats.percent / 100) * 27)))} />
              </dl>
            </div>
          </div>
        </section>

        {/* quick timer */}
        <section className="relative flex flex-col justify-between overflow-hidden rounded-[30px_24px_32px_26px] border-[1.5px] border-ink bg-mint p-5 shadow-[4px_4px_0_#27372F] lg:col-span-5">
          <div>
            <p className="text-sm font-semibold text-sage-deep">مؤقت الدراسة</p>
            <p className="num mt-1 text-5xl font-bold">{formatHMS(view?.elapsed ?? 0)}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {!view && 'ما في جلسة شغّالة'}
              {view?.status === 'running' && 'عم تدرس هلأ… ركّز'}
              {view?.status === 'paused' && 'الجلسة متوقفة'}
              {view?.status === 'break' && 'استراحة بومودورو'}
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            {!view ? (
              <Button
                className="flex-1"
                icon={<Play size={20} fill="currentColor" />}
                onClick={async () => {
                  await startTimer('study', { unitId: day?.unitIds[0], pomodoro: settings.pomodoroDefault })
                  nav('/focus')
                }}
              >
                يلا نبلّش؟
              </Button>
            ) : (
              <Button className="flex-1" onClick={() => nav('/focus')}>افتح المؤقت</Button>
            )}
          </div>
          <svg className="playful-only pointer-events-none absolute -bottom-6 -left-6 opacity-60" width="120" height="120" viewBox="0 0 120 120" aria-hidden>
            <circle cx="60" cy="60" r="44" fill="none" stroke="#6F9876" strokeWidth="2" strokeDasharray="3 7" />
            <circle cx="60" cy="60" r="28" fill="none" stroke="#6F9876" strokeWidth="2" />
          </svg>
        </section>

        {/* today's destination */}
        {day && (
          <section className="sheet sheet-tilt-r p-5 lg:col-span-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">محطة اليوم</h2>
              <Link to="/map" className="flex items-center gap-1 text-sm font-semibold text-sage">الخريطة <ArrowLeft size={16} /></Link>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <DestinationArt kind={day.destination} size={96} />
              <div>
                <p className="font-display text-lg font-bold">{DESTINATION_NAMES[day.destination]}</p>
                <p className="text-sm text-ink-soft">{day.kind === 'exam' ? 'يوم تحضير امتحانات' : 'يوم دراسة'}</p>
              </div>
            </div>
            <ul className="mt-3 space-y-3">
              {day.unitIds.map((id) => {
                const p = progress?.map.get(id)
                if (!p) return null
                return (
                  <li key={id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-semibold">{p.unit.name}</span>
                      <span className="num text-ink-soft">{p.done}/{p.total} دروس</span>
                    </div>
                    <ProgressBar value={p.percent} label={p.unit.name} height={10} />
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* planner snippet */}
        <section className={`sheet relative p-5 ${day ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          <div className="tape tape-lav -top-2 left-10 rotate-[4deg]" />
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-bold">جاي بالدفتر</h2>
            <Link to="/planner" className="flex items-center gap-1 text-sm font-semibold text-sage">كل المهام <ArrowLeft size={16} /></Link>
          </div>
          <ul className="ruled">
            {upcoming.map((t) => (
              <motion.li layout key={t.id} className="flex h-10 items-center gap-1">
                <Check checked={t.done} label={t.title} onChange={(v) => db.tasks.update(t.id, { done: v, completedAt: v ? Date.now() : undefined })} />
                <span className="flex-1 truncate font-semibold">{t.title}</span>
                {t.start && <span className="num text-xs text-ink-soft">{t.start}</span>}
              </motion.li>
            ))}
            {upcoming.length === 0 && (
              <li className="flex h-20 items-center gap-3 text-ink-soft">
                <Milo mood={tasks?.length ? 'happy' : 'idle'} size={56} still />
                {tasks?.length ? 'خلصت كل اللي ضايل بالدفتر لليوم!' : 'ما في مهام لهاليوم.'}
              </li>
            )}
          </ul>
        </section>

        {phase === 'exam' && (
          <section className="rounded-[28px_22px_30px_24px] border-[1.5px] border-ink bg-lavender p-5 shadow-[4px_4px_0_#27372F] lg:col-span-12">
            <div className="flex items-center gap-4">
              <Milo mood="idle" cap size={84} still />
              <div className="flex-1">
                <p className="text-sm font-semibold">العد التنازلي للامتحان</p>
                <Countdown to={examAt} now={stats.now} />
              </div>
              <Button variant="ghost" onClick={() => nav('/exams')}>التحضير</Button>
            </div>
          </section>
        )}

        {/* mini garden */}
        <section className="lg:col-span-12">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-bold">الحديقة</h2>
            <Link to="/garden" className="flex items-center gap-1 text-sm font-semibold text-sage">الوحدات <ArrowLeft size={16} /></Link>
          </div>
          {progress && topics && <Garden progress={progress.list} topics={topics} compact onSelect={() => nav('/garden')} />}
        </section>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-line pb-1">
      <dt className="text-ink-soft">{k}</dt>
      <dd className="num font-bold">{v}</dd>
    </div>
  )
}

export function Countdown({ to }: { to: number; now?: number }) {
  const now = useNow(true, 15000)
  const ms = Math.max(0, to - now)
  const d = Math.floor(ms / 86400e3)
  const h = Math.floor((ms % 86400e3) / 3600e3)
  const m = Math.floor((ms % 3600e3) / 60e3)
  if (ms === 0) return <p className="font-display text-2xl font-bold">وصل اليوم الكبير. بالتوفيق! 🍀</p>
  return (
    <p className="font-display text-2xl font-bold">
      <span className="num">{d}</span> يوم · <span className="num">{h}</span> ساعة · <span className="num">{m}</span> دقيقة
    </p>
  )
}
