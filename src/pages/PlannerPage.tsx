import { useSearchParams } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import Milo from '../components/character/Milo'
import { Planner } from '../components/planner/Planner'
import { PageHeader } from '../components/ui/PageHeader'
import { Bubble } from '../components/ui/Bubble'
import { useDays, useTasksOn, useToday } from '../hooks/useData'
import { formatDayLong, weekdayName } from '../lib/time'

export default function PlannerPage() {
  const today = useToday()
  const days = useDays()
  const [params, setParams] = useSearchParams()
  const date = params.get('date') ?? (days?.some((d) => d.date === today) ? today : (days?.[0]?.date ?? today))
  const tasks = useTasksOn(date)
  const day = days?.find((d) => d.date === date)
  const strip = useRef<HTMLDivElement>(null)

  useEffect(() => {
    strip.current?.querySelector('[aria-current="date"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [date, days])

  const left = tasks?.filter((t) => !t.done && !t.isBreak).length ?? 0
  const msg = !tasks?.length
    ? 'صفحة جديدة! خطّط يومك وأنا بذكّرك.'
    : left === 0
      ? 'الدفتر كله صحّات! بتستاهل استراحة حلوة.'
      : left <= 2
        ? `ضايل ${left} بس. قرّبت!`
        : 'خطوة خطوة. علّم كل مهمة لما تخلصها.'

  return (
    <div>
      <PageHeader eyebrow="الدفتر اليومي" title={formatDayLong(date)}>
        {day ? day.title : 'يوم خارج التحدي'}
      </PageHeader>

      <div ref={strip} className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-2" role="tablist" aria-label="اختر اليوم">
        {days?.map((d, i) => {
          const on = d.date === date
          return (
            <button
              key={d.id}
              role="tab"
              aria-selected={on}
              aria-current={on ? 'date' : undefined}
              onClick={() => setParams({ date: d.date })}
              className={`btn-press flex min-w-[68px] shrink-0 flex-col items-center rounded-[20px_16px_22px_14px] border-[1.5px] px-3 py-2 ${
                on ? 'border-ink bg-butter shadow-[3px_3px_0_#27372F]' : d.date === today ? 'border-sage bg-white' : 'border-line bg-white'
              }`}
            >
              <span className="text-[0.7rem] text-ink-soft">{weekdayName(d.date)}</span>
              <span className="num text-xl font-bold">{Number(d.date.slice(8))}</span>
              <span className="text-[0.68rem] font-semibold text-ink-soft">يوم {i + 1}</span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="sheet relative p-4 sm:p-5">
          <div className="tape -top-3 right-1/3 rotate-[-3deg]" />
          <div className="pointer-events-none absolute inset-y-6 start-0 w-px border-s-2 border-dotted border-peach" />
          <Planner date={date} />
        </div>
        <aside className="flex items-end gap-2 lg:sticky lg:top-8 lg:flex-col lg:items-center lg:self-start">
          <Bubble k={msg} tail="left" className="mb-8 lg:mb-0">{msg}</Bubble>
          <Milo mood={left === 0 && tasks?.length ? 'happy' : 'studying'} size={120} className="shrink-0" />
        </aside>
      </div>
    </div>
  )
}
