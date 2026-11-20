import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Milo from '../components/character/Milo'
import { PageHeader, SectionTitle } from '../components/ui/PageHeader'
import { ProgressBar } from '../components/ui/Progress'
import { useAllTasks, useDays, useExams, useSettings, useUnitProgress } from '../hooks/useData'
import { useStudyStats } from '../hooks/useStudyStats'
import { isDayComplete, longestStreak, msByUnit, streak } from '../lib/stats'
import { formatDuration } from '../lib/time'

const TINTS = ['#8DB592', '#E9CF6A', '#9CCBDA', '#B9A6DE', '#EDB394', '#E9A6B9']
const tooltipStyle = { borderRadius: 14, border: '1.5px solid #27372F', fontFamily: 'IBM Plex Sans Arabic', direction: 'rtl' as const }

export default function StatsPage() {
  const stats = useStudyStats()
  const days = useDays()
  const progress = useUnitProgress()
  const exams = useExams()
  const tasks = useAllTasks()
  const settings = useSettings()

  const daily = useMemo(
    () => (days ?? []).map((d, i) => ({ name: `${i + 1}`, date: d.date, h: +((stats.byDay.get(d.date) ?? 0) / 3600e3).toFixed(2), today: d.date === stats.today })),
    [days, stats.byDay, stats.today],
  )
  const byUnit = msByUnit(stats.sessions, stats.timers, stats.now)
  const unitData = (progress?.list ?? []).map((p, i) => ({ name: p.unit.name, h: +((byUnit.get(p.unit.id) ?? 0) / 3600e3).toFixed(2), c: TINTS[i % TINTS.length] }))
  const challengeMs = (days ?? []).reduce((a, d) => a + (stats.byDay.get(d.date) ?? 0), 0)
  const allMs = [...stats.byDay.values()].reduce((a, b) => a + b, 0)
  const completedDays = (days ?? []).filter((d) => progress && isDayComplete(d, progress.map)).length
  const topicsDone = progress?.list.reduce((a, p) => a + p.done, 0) ?? 0
  const topicsTotal = progress?.list.reduce((a, p) => a + p.total, 0) ?? 0
  const tasksDone = tasks?.filter((t) => t.done).length ?? 0
  const cur = streak(stats.byDay, stats.today)
  const best = longestStreak(stats.byDay)
  const scored = (exams ?? []).filter((e) => e.score != null && e.maxScore).sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0))
  const examData = scored.map((e, i) => ({ name: `${i + 1}`, pct: Math.round(((e.score ?? 0) / (e.maxScore ?? 100)) * 100), title: e.title }))
  const goalDays = (days ?? []).filter((d) => (stats.byDay.get(d.date) ?? 0) >= settings.dailyGoalHours * 3600e3).length
  const empty = allMs === 0

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="أرقام حقيقية من جلساتك" title="الإحصائيات" art={<Milo mood={empty ? 'encouraging' : 'happy'} size={96} />}>
        {empty ? 'لما تسجّل أول جلسة رح تبلّش الأرقام تحكي قصتك هون.' : 'كل رقم هون محسوب من الجلسات والمهام اللي سجّلتها فعلًا.'}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="ساعات التحدي" value={(challengeMs / 3600e3).toFixed(1)} sub={formatDuration(challengeMs)} bg="bg-mint" />
        <Tile label="اليوم" value={(stats.todayMs / 3600e3).toFixed(1)} sub={`من ${settings.dailyGoalHours} س`} bg="bg-butter" />
        <Tile label="سلسلة الأيام" value={String(cur)} sub={`أطول سلسلة: ${best}`} bg="bg-peach" />
        <Tile label="أيام وصلت الهدف" value={`${goalDays}`} sub={`من ${days?.length ?? 9}`} bg="bg-sky" />
      </div>

      <section className="sheet p-4 sm:p-5">
        <SectionTitle>ساعات الدراسة كل يوم</SectionTitle>
        <div className="h-60" dir="ltr">
          <ResponsiveContainer>
            <BarChart data={daily} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid stroke="#EFECE3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#8A978F', fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#8A978F', fontSize: 12 }} domain={[0, Math.max(settings.dailyGoalHours, ...daily.map((d) => d.h))]} />
              <Tooltip cursor={{ fill: '#F4F1E8' }} contentStyle={tooltipStyle} formatter={(v) => [`${v} س`, 'دراسة']} labelFormatter={(l) => `اليوم ${l}`} />
              <ReferenceLine y={settings.dailyGoalHours} stroke="#27372F" strokeDasharray="4 4" label={{ value: 'الهدف', position: 'insideTopRight', fill: '#55665C', fontSize: 11 }} />
              <Bar dataKey="h" radius={[10, 10, 4, 4]} stroke="#27372F" strokeWidth={1.2}>
                {daily.map((d) => (
                  <Cell key={d.date} fill={d.today ? '#F9E9A7' : '#8DB592'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-ink-soft">الأرقام تحت هي أيام التحدي (1–9). العمود الأصفر هو اليوم.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="sheet p-4 sm:p-5">
          <SectionTitle>الوقت لكل وحدة</SectionTitle>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer>
              <BarChart data={unitData} layout="vertical" margin={{ top: 0, right: 12, left: 10, bottom: 0 }}>
                <CartesianGrid stroke="#EFECE3" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: '#8A978F', fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={70} tickLine={false} axisLine={false} tick={{ fill: '#27372F', fontSize: 12 }} orientation="right" />
                <Tooltip cursor={{ fill: '#F4F1E8' }} contentStyle={tooltipStyle} formatter={(v) => [`${v} س`, 'دراسة']} />
                <Bar dataKey="h" radius={[4, 10, 10, 4]} stroke="#27372F" strokeWidth={1.2}>
                  {unitData.map((u) => (
                    <Cell key={u.name} fill={u.c} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="sheet p-4 sm:p-5">
          <SectionTitle>
            تقدم الوحدات <span className="num text-base font-semibold text-ink-soft">{topicsDone}/{topicsTotal} درس</span>
          </SectionTitle>
          <ul className="space-y-3">
            {progress?.list.map((p, i) => (
              <li key={p.unit.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-semibold">{p.unit.name}</span>
                  <span className="num text-ink-soft">{p.done}/{p.total} · {p.percent}%</span>
                </div>
                <ProgressBar value={p.percent} label={p.unit.name} color={TINTS[i % TINTS.length]} />
              </li>
            ))}
          </ul>
        </section>

        <section className="sheet p-4 sm:p-5">
          <SectionTitle>التحدي</SectionTitle>
          <div className="flex items-center gap-4">
            <Ring value={days?.length ? completedDays / days.length : 0} />
            <dl className="flex-1 space-y-2 text-sm">
              <Line2 k="محطات مكتملة" v={`${completedDays}/${days?.length ?? 9}`} />
              <Line2 k="مهام الدفتر المنجزة" v={`${tasksDone}/${tasks?.length ?? 0}`} />
              <Line2 k="عدد الجلسات" v={String(stats.sessions.length)} />
              <Line2 k="كل وقت الدراسة" v={formatDuration(allMs)} />
            </dl>
          </div>
        </section>

        <section className="sheet p-4 sm:p-5">
          <SectionTitle>علامات الامتحانات</SectionTitle>
          {examData.length ? (
            <div className="h-48" dir="ltr">
              <ResponsiveContainer>
                <LineChart data={examData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#EFECE3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#8A978F', fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#8A978F', fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'العلامة']} labelFormatter={(_, p) => p?.[0]?.payload?.title ?? ''} />
                  <Line type="monotone" dataKey="pct" stroke="#6F9876" strokeWidth={3} dot={{ r: 5, fill: '#F9E9A7', stroke: '#27372F', strokeWidth: 1.5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">لسا ما في علامات مسجّلة. بتظهر هون بعد أول امتحان تجريبي.</p>
          )}
        </section>
      </div>
    </div>
  )
}

function Tile({ label, value, sub, bg }: { label: string; value: string; sub: string; bg: string }) {
  return (
    <div className={`rounded-[24px_20px_26px_18px] border-[1.5px] border-ink p-4 shadow-[3px_3px_0_#27372F] ${bg}`}>
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <p className="num mt-1 text-3xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-xs text-ink-soft">{sub}</p>
    </div>
  )
}

function Line2({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-dashed border-line pb-1">
      <dt className="text-ink-soft">{k}</dt>
      <dd className="num font-bold">{v}</dd>
    </div>
  )
}

function Ring({ value }: { value: number }) {
  const r = 40
  const c = 2 * Math.PI * r
  return (
    <svg width="110" height="110" viewBox="0 0 110 110" role="img" aria-label={`اكتمال التحدي ${Math.round(value * 100)}٪`}>
      <circle cx="55" cy="55" r={r} fill="none" stroke="#EFECE3" strokeWidth="12" />
      <circle cx="55" cy="55" r={r} fill="none" stroke="#6F9876" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} transform="rotate(-90 55 55)" />
      <text x="55" y="61" textAnchor="middle" fontFamily="Fraunces, serif" fontWeight="700" fontSize="20" fill="#27372F">
        {Math.round(value * 100)}%
      </text>
    </svg>
  )
}
