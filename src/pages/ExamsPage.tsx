import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Milo from '../components/character/Milo'
import { ExamTimer, ScoreSheet } from '../components/exams/ExamTimer'
import { PageHeader, SectionTitle } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Check } from '../components/ui/Check'
import { Sheet } from '../components/ui/Sheet'
import { Countdown } from './Today'
import { useChecklist, useDays, useExams, useMistakes, useSettings, useToday, useTopics, useUnits } from '../hooks/useData'
import { db, saveSettings, type Exam } from '../lib/db'
import { uid } from '../lib/id'
import { challengePhase } from '../lib/phase'
import { formatDayShort, formatDuration, localTimeOn } from '../lib/time'

export default function ExamsPage() {
  const settings = useSettings()
  const days = useDays()
  const today = useToday()
  const exams = useExams()
  const phase = challengePhase(days, today)
  const [scoreFor, setScoreFor] = useState<Exam | null>(null)
  const [manual, setManual] = useState(false)

  const [d, t] = settings.examDateTime.split('T')
  const [hh, mm] = (t ?? '09:00').split(':').map(Number)
  const examAt = localTimeOn(d, hh, mm)
  const done = (exams ?? []).filter((e) => e.status === 'done' && e.score != null && e.maxScore)
  const chart = done
    .slice()
    .sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0))
    .map((e, i) => ({ name: `${i + 1}`, pct: Math.round(((e.score ?? 0) / (e.maxScore ?? 100)) * 100), title: e.title }))
  const avg = chart.length ? Math.round(chart.reduce((a, c) => a + c.pct, 0) / chart.length) : null

  return (
    <div className="space-y-10">
      <PageHeader eyebrow={phase === 'exam' ? 'مرحلة الامتحانات بلّشت' : 'آخر أربع أيام بالتحدي'} title="تحضير الامتحانات" art={<Milo mood="idle" cap size={104} />}>
        امتحانات تجريبية بمؤقت منفصل، علامات، أخطاء، ونقاط ضعف — كله بمكان واحد.
      </PageHeader>

      <section className="rounded-[30px_24px_32px_26px] border-[1.5px] border-ink bg-lavender p-5 shadow-[4px_4px_0_#27372F]">
        <p className="text-sm font-semibold">العد التنازلي للامتحان</p>
        <Countdown to={examAt} />
        <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span>موعد الامتحان:</span>
          <input
            type="datetime-local"
            className="field num w-auto min-h-10 bg-white py-1"
            value={settings.examDateTime}
            onChange={(e) => e.target.value && saveSettings({ examDateTime: e.target.value })}
          />
          <span className="text-xs text-ink-soft">(بتوقيت فلسطين)</span>
        </label>
      </section>

      <section>
        <SectionTitle>امتحان تجريبي بوقت</SectionTitle>
        <div className="sheet p-5">
          <ExamTimer />
        </div>
      </section>

      <section>
        <SectionTitle action={<Button size="sm" variant="ghost" icon={<Plus size={16} />} onClick={() => setManual(true)}>سجّل علامة</Button>}>
          العلامات والتقدم
        </SectionTitle>
        {chart.length > 1 && (
          <div className="sheet mb-4 p-4">
            <p className="mb-2 text-sm text-ink-soft">
              المعدل: <span className="num font-bold text-ink">{avg}%</span>
            </p>
            <div className="h-48" dir="ltr">
              <ResponsiveContainer>
                <LineChart data={chart} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#EFECE3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#8A978F', fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#8A978F', fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`${v}%`, 'العلامة']} labelFormatter={(_, p) => p?.[0]?.payload?.title ?? ''} contentStyle={{ borderRadius: 14, border: '1.5px solid #27372F', fontFamily: 'IBM Plex Sans Arabic' }} />
                  <Line type="monotone" dataKey="pct" stroke="#6F9876" strokeWidth={3} dot={{ r: 5, fill: '#F9E9A7', stroke: '#27372F', strokeWidth: 1.5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <ul className="space-y-2">
          {(exams ?? [])
            .slice()
            .reverse()
            .map((e) => {
              const pct = e.score != null && e.maxScore ? Math.round((e.score / e.maxScore) * 100) : null
              return (
                <li key={e.id} className="sheet flex items-center gap-3 px-4 py-3">
                  <div className={`grid size-12 shrink-0 place-items-center rounded-2xl font-bold ${pct == null ? 'bg-paper' : pct >= 85 ? 'bg-mint' : pct >= 65 ? 'bg-butter' : 'bg-peach'}`}>
                    <span className="num">{pct == null ? '—' : `${pct}%`}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.title}</p>
                    <p className="text-xs text-ink-soft">
                      {formatDayShort(e.date)}
                      {e.durationMs ? ` · ${formatDuration(e.durationMs)}` : ''}
                      {e.score != null && <> · <span className="num">{e.score}/{e.maxScore}</span></>}
                    </p>
                  </div>
                  {pct == null && e.status !== 'done' && (
                    <Button size="sm" variant="soft" onClick={() => setScoreFor(e)}>
                      سجّل العلامة
                    </Button>
                  )}
                  <button aria-label="احذف" onClick={() => db.exams.delete(e.id)} className="grid size-10 place-items-center rounded-xl text-ink-faint hover:bg-peach">
                    <Trash2 size={16} />
                  </button>
                </li>
              )
            })}
          {!exams?.length && <li className="rounded-3xl border-[1.5px] border-dashed border-line p-6 text-center text-ink-soft">لسا ما في امتحانات. أول واحد بيكشف وين لازم نركّز.</li>}
        </ul>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <WeakTopics />
        <Checklist />
      </div>
      <Mistakes />

      <ScoreSheet exam={scoreFor} onClose={() => setScoreFor(null)} />
      <ManualExam open={manual} onClose={() => setManual(false)} today={today} />
    </div>
  )
}

function ManualExam({ open, onClose, today }: { open: boolean; onClose: () => void; today: string }) {
  const [title, setTitle] = useState('امتحان')
  const [score, setScore] = useState('')
  const [max, setMax] = useState('100')
  const [date, setDate] = useState(today)
  return (
    <Sheet open={open} onClose={onClose} title="سجّل علامة امتحان">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          await db.exams.add({ id: uid(), title: title.trim() || 'امتحان', date, unitIds: [], plannedMinutes: 0, score: Number(score), maxScore: Number(max) || 100, notes: '', status: 'done', endedAt: Date.now() })
          setScore('')
          onClose()
        }}
      >
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="اسم الامتحان" />
        <div className="grid grid-cols-3 gap-3">
          <input type="number" step="any" className="field num" placeholder="العلامة" value={score} onChange={(e) => setScore(e.target.value)} required aria-label="العلامة" />
          <input type="number" step="any" className="field num" value={max} onChange={(e) => setMax(e.target.value)} aria-label="من" />
          <input type="date" className="field num" value={date} onChange={(e) => setDate(e.target.value)} aria-label="التاريخ" />
        </div>
        <Button type="submit" className="w-full" disabled={score === ''}>احفظ</Button>
      </form>
    </Sheet>
  )
}

function WeakTopics() {
  const topics = useTopics()
  const units = useUnits()
  const mistakes = useMistakes()
  const [unitId, setUnitId] = useState('')
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of mistakes ?? []) if (!x.resolved && x.topicId) m.set(x.topicId, (m.get(x.topicId) ?? 0) + 1)
    return m
  }, [mistakes])
  const weak = (topics ?? [])
    .filter((t) => t.weak || counts.has(t.id))
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
  const candidates = (topics ?? []).filter((t) => (!unitId || t.unitId === unitId) && !t.weak)

  return (
    <section>
      <SectionTitle>نقاط الضعف</SectionTitle>
      <div className="sheet p-4">
        {weak.length === 0 ? (
          <p className="text-sm text-ink-soft">ما في دروس معلّمة كضعيفة. علّم الدروس اللي محتاجة مراجعة، أو سجّل خطأ ومربوط بدرس.</p>
        ) : (
          <ul className="space-y-2">
            {weak.map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-2xl bg-peach/50 px-3 py-2">
                <span className="flex-1">
                  <span className="font-semibold">{t.title}</span>
                  <span className="text-xs text-ink-soft"> · {units?.find((u) => u.id === t.unitId)?.name}</span>
                </span>
                {counts.get(t.id) ? <span className="num rounded-full bg-white px-2 text-xs font-bold">{counts.get(t.id)} أخطاء</span> : null}
                {t.weak && (
                  <button className="min-h-9 rounded-xl px-2 text-xs font-semibold text-sage-deep hover:bg-white" onClick={() => db.topics.update(t.id, { weak: false })}>
                    صار تمام
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex gap-2 border-t border-dashed border-line pt-3">
          <select className="field" value={unitId} onChange={(e) => setUnitId(e.target.value)} aria-label="الوحدة">
            <option value="">كل الوحدات</option>
            {units?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select className="field" value="" onChange={(e) => e.target.value && db.topics.update(e.target.value, { weak: true })} aria-label="علّم درس كضعيف">
            <option value="">+ علّم درس كضعيف</option>
            {candidates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
      </div>
    </section>
  )
}

function Checklist() {
  const items = useChecklist()
  const [text, setText] = useState('')
  const done = items?.filter((i) => i.done).length ?? 0
  return (
    <section>
      <SectionTitle>
        قائمة المراجعة <span className="num text-base font-semibold text-ink-soft">{done}/{items?.length ?? 0}</span>
      </SectionTitle>
      <div className="sheet ruled relative p-4">
        <div className="tape tape-peach -top-2 left-8 rotate-[5deg]" />
        <ul>
          {items?.map((i) => (
            <li key={i.id} className="flex min-h-10 items-center gap-1">
              <Check checked={i.done} label={i.text} onChange={(v) => db.checklist.update(i.id, { done: v })} />
              <span className="flex-1 font-semibold"><span className="strike" data-on={i.done}>{i.text}</span></span>
              <button aria-label="احذف" onClick={() => db.checklist.delete(i.id)} className="grid size-10 place-items-center rounded-xl text-ink-faint hover:bg-peach">
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!text.trim()) return
            await db.checklist.add({ id: uid(), order: items?.length ?? 0, text: text.trim(), done: false })
            setText('')
          }}
        >
          <input className="field" placeholder="ضيف بند…" value={text} onChange={(e) => setText(e.target.value)} aria-label="بند جديد" />
          <Button type="submit" variant="soft" disabled={!text.trim()} icon={<Plus size={18} />}>ضيف</Button>
        </form>
      </div>
    </section>
  )
}

function Mistakes() {
  const mistakes = useMistakes()
  const units = useUnits()
  const topics = useTopics()
  const exams = useExams()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [form, setForm] = useState({ text: '', fix: '', unitId: '', topicId: '', examId: '' })
  const list = (mistakes ?? []).filter((m) => filter === 'all' || !m.resolved)
  const unresolved = mistakes?.filter((m) => !m.resolved).length ?? 0

  return (
    <section>
      <SectionTitle action={<Button size="sm" icon={<Plus size={16} />} onClick={() => setOpen(true)}>سجّل خطأ</Button>}>
        دفتر الأخطاء <span className="num text-base font-semibold text-ink-soft">{unresolved} مفتوح</span>
      </SectionTitle>
      <div className="mb-3 flex gap-2">
        {(['open', 'all'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={`min-h-10 rounded-full px-4 text-sm font-semibold ring-1 ${filter === f ? 'bg-ink text-white ring-ink' : 'bg-white ring-line'}`}>
            {f === 'open' ? 'اللي لسا' : 'الكل'}
          </button>
        ))}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {list.map((m) => (
          <li key={m.id} className={`sheet p-4 ${m.resolved ? 'opacity-70' : ''}`}>
            <div className="flex items-start gap-2">
              <button
                aria-label={m.resolved ? 'رجّعه مفتوح' : 'علّم كمحلول'}
                onClick={() => db.mistakes.update(m.id, { resolved: !m.resolved })}
                className="grid size-10 shrink-0 place-items-center text-sage"
              >
                {m.resolved ? <CheckCircle2 size={24} /> : <Circle size={24} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${m.resolved ? 'line-through' : ''}`}>{m.text}</p>
                {m.fix && <p className="mt-1 rounded-xl bg-mint/60 px-2 py-1 text-sm">✓ {m.fix}</p>}
                <p className="mt-1 text-xs text-ink-soft">
                  {[units?.find((u) => u.id === m.unitId)?.name, topics?.find((t) => t.id === m.topicId)?.title, exams?.find((e) => e.id === m.examId)?.title].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button aria-label="احذف" onClick={() => db.mistakes.delete(m.id)} className="grid size-10 place-items-center rounded-xl text-ink-faint hover:bg-peach">
                <Trash2 size={15} />
              </button>
            </div>
          </li>
        ))}
        {list.length === 0 && (
          <li className="flex items-center gap-3 rounded-3xl border-[1.5px] border-dashed border-line p-5 text-ink-soft sm:col-span-2">
            <Milo mood="happy" size={56} still />
            {mistakes?.length ? 'كل الأخطاء انحلّت! ممتاز.' : 'كل خطأ بتسجّله هون هو علامة بتكسبها بالامتحان.'}
          </li>
        )}
      </ul>
      <Sheet open={open} onClose={() => setOpen(false)} title="خطأ جديد">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!form.text.trim()) return
            await db.mistakes.add({ id: uid(), text: form.text.trim(), fix: form.fix.trim(), unitId: form.unitId || undefined, topicId: form.topicId || undefined, examId: form.examId || undefined, resolved: false, createdAt: Date.now() })
            setForm({ text: '', fix: '', unitId: form.unitId, topicId: '', examId: form.examId })
            setOpen(false)
          }}
        >
          <textarea className="field min-h-20" placeholder="شو الغلط؟" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} aria-label="الخطأ" required autoFocus />
          <textarea className="field min-h-16" placeholder="الصح / كيف أتجنبه" value={form.fix} onChange={(e) => setForm({ ...form, fix: e.target.value })} aria-label="التصحيح" />
          <div className="grid grid-cols-2 gap-3">
            <select className="field" value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value, topicId: '' })} aria-label="الوحدة">
              <option value="">الوحدة</option>
              {units?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select className="field" value={form.topicId} onChange={(e) => setForm({ ...form, topicId: e.target.value })} aria-label="الدرس" disabled={!form.unitId}>
              <option value="">الدرس</option>
              {topics?.filter((t) => t.unitId === form.unitId).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <select className="field" value={form.examId} onChange={(e) => setForm({ ...form, examId: e.target.value })} aria-label="الامتحان">
            <option value="">من أي امتحان؟ (اختياري)</option>
            {exams?.map((x) => <option key={x.id} value={x.id}>{x.title} · {formatDayShort(x.date)}</option>)}
          </select>
          <Button type="submit" className="w-full" disabled={!form.text.trim()}>احفظ الخطأ</Button>
        </form>
      </Sheet>
    </section>
  )
}
