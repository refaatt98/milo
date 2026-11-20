import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import Milo from '../character/Milo'
import { DestinationArt, DESTINATION_NAMES } from './Destinations'
import type { ChallengeDay } from '../../lib/db'
import { formatDayShort, weekdayName } from '../../lib/time'

const XS = [30, 70, 32, 68, 30, 70, 34, 66, 50]
const ROW = 168

interface Props {
  days: ChallengeDay[]
  today: string
  isComplete: (d: ChallengeDay) => boolean
  onSelect: (d: ChallengeDay) => void
}

function pathThrough(points: [number, number][]) {
  if (!points.length) return ''
  let d = `M${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const my = (y0 + y1) / 2
    d += ` C${x0} ${my} ${x1} ${my} ${x1} ${y1}`
  }
  return d
}

export function AdventureMap({ days, today, isComplete, onSelect }: Props) {
  const height = days.length * ROW + 90
  const pts: [number, number][] = days.map((_, i) => [XS[i % XS.length], 70 + i * ROW])
  const full = pathThrough(pts)
  const reachIdx = Math.max(
    -1,
    ...days.map((d, i) => (d.date <= today || isComplete(d) ? i : -1)),
  )
  const reached = pathThrough(pts.slice(0, reachIdx + 1))
  const examStart = days.findIndex((d) => d.kind === 'exam')

  return (
    <div className="dotgrid relative mx-auto w-full max-w-xl rounded-[36px_30px_38px_32px] border-[1.5px] border-line bg-[#FCFBF7] px-2" style={{ height }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        <path d={full} fill="none" stroke="#D9D3C3" strokeWidth={10} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d={full} fill="none" stroke="#FCFBF7" strokeWidth={3} strokeDasharray="2 10" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {reachIdx > 0 && (
          <motion.path
            d={reached}
            fill="none"
            stroke="#8DB592"
            strokeWidth={10}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: 'easeInOut' }}
          />
        )}
      </svg>

      {examStart > 0 && (
        <div className="absolute inset-x-0 flex justify-center" style={{ top: 70 + (examStart - 0.5) * ROW - 18 }}>
          <div className="rotate-[-2deg] rounded-xl border-[1.5px] border-ink bg-lavender px-3 py-1 font-display text-sm font-bold shadow-[2px_2px_0_#27372F]">
            🎓 من هون بتبلّش مرحلة الامتحانات
          </div>
        </div>
      )}

      {days.map((d, i) => {
        const [x, y] = pts[i]
        const done = isComplete(d)
        const isToday = d.date === today
        const past = d.date < today
        const right = x > 50
        const center = x === 50
        return (
          <motion.div
            key={d.id}
            className="absolute"
            style={{ left: `${x}%`, top: y, translate: '-50% -50%' }}
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ type: 'spring', damping: 18, stiffness: 180, delay: 0.04 * i }}
          >
            <button
              onClick={() => onSelect(d)}
              className={`btn-press group relative flex flex-col items-center ${isToday ? 'map-pulse rounded-[30px]' : ''}`}
              aria-label={`اليوم ${i + 1}، ${formatDayShort(d.date)}: ${d.title}${done ? '، مكتمل' : isToday ? '، اليوم' : ''}`}
            >
              <div
                className={`relative grid size-[112px] place-items-center rounded-[30px_26px_32px_24px] border-[1.5px] bg-white transition group-hover:-translate-y-1 ${
                  isToday ? 'border-ink shadow-[4px_4px_0_#27372F]' : done ? 'border-sage shadow-[3px_3px_0_#6F9876]' : 'border-line'
                }`}
              >
                <DestinationArt kind={d.destination} size={92} dim={!done && !isToday && !past} />
                <span className="num absolute -top-3 right-3 grid size-8 place-items-center rounded-full border-[1.5px] border-ink bg-butter text-sm font-bold">
                  {i + 1}
                </span>
                {done && (
                  <motion.span
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: -12 }}
                    className="absolute -bottom-2 -left-2 grid size-9 place-items-center rounded-full border-[1.5px] border-ink bg-sage text-white"
                  >
                    <Check size={18} strokeWidth={3} />
                  </motion.span>
                )}
              </div>
              <div
                className={`absolute w-[150px] ${
                  center ? 'left-1/2 top-full mt-3 -translate-x-1/2 text-center' : `top-1/2 -translate-y-1/2 ${right ? 'right-[124px] text-left' : 'left-[124px] text-right'}`
                }`}
              >
                <p className="text-xs font-semibold text-ink-soft">
                  {weekdayName(d.date)} · {formatDayShort(d.date)}
                </p>
                <p className="font-display text-[0.98rem] font-bold leading-tight">{d.title}</p>
                <p className="text-xs text-ink-faint">{DESTINATION_NAMES[d.destination]}</p>
                {isToday && <p className="mt-1 inline-block rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-white">إنت هون اليوم</p>}
              </div>
            </button>
            {isToday && (
              <div className={`pointer-events-none absolute -top-16 ${right ? '-left-10' : '-right-10'}`}>
                <Milo mood="idle" size={78} cap={d.kind === 'exam'} />
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
