import { useMemo, useState } from 'react'
import Milo from '../components/character/Milo'
import { AdventureMap } from '../components/map/AdventureMap'
import { DaySheet } from '../components/map/DaySheet'
import { PageHeader } from '../components/ui/PageHeader'
import { ProgressBar } from '../components/ui/Progress'
import { useDays, useToday, useUnitProgress } from '../hooks/useData'
import { isDayComplete } from '../lib/stats'
import type { ChallengeDay } from '../lib/db'
import { formatDayShort } from '../lib/time'

export default function MapPage() {
  const days = useDays()
  const today = useToday()
  const progress = useUnitProgress()
  const [sel, setSel] = useState<string | null>(null)
  const check = useMemo(() => (d: ChallengeDay) => (progress ? isDayComplete(d, progress.map) : d.completed), [progress])
  const doneCount = days?.filter(check).length ?? 0
  const selected = days?.find((d) => d.id === sel) ?? null
  const allDone = !!days?.length && doneCount === days.length

  return (
    <div>
      <PageHeader
        eyebrow="مغامرة التسع أيام"
        title="خريطة الرحلة"
        art={<Milo mood={allDone ? 'champion' : 'idle'} size={96} />}
      >
        {days && days.length > 0 && (
          <>
            من {formatDayShort(days[0].date)} لـ {formatDayShort(days[days.length - 1].date)}. كل محطة يوم، اضغط عليها تشوف مهامها وتعدّلها.
          </>
        )}
      </PageHeader>
      <div className="sheet mb-6 flex items-center gap-4 p-4">
        <div className="flex-1">
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="font-semibold">المحطات المكتملة</span>
            <span className="num font-bold">{doneCount}/{days?.length ?? 9}</span>
          </div>
          <ProgressBar value={days?.length ? (doneCount / days.length) * 100 : 0} label="تقدم التحدي" />
        </div>
      </div>
      {allDone && (
        <div className="mb-6 rounded-[28px] border-[1.5px] border-ink bg-butter p-4 text-center font-display text-lg font-bold shadow-[3px_3px_0_#27372F]">
          🏆 كل المحطات خلصت! إنت خلصت التحدي كامل.
        </div>
      )}
      {days && <AdventureMap days={days} today={today} isComplete={check} onSelect={(d) => setSel(d.id)} />}
      <DaySheet day={selected} index={days?.findIndex((d) => d.id === sel) ?? 0} onClose={() => setSel(null)} />
    </div>
  )
}
