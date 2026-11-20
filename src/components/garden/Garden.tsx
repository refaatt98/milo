import { motion } from 'motion/react'
import Milo from '../character/Milo'
import { Plant } from './Plant'
import { plantStage, type UnitProgress } from '../../lib/stats'
import type { Topic } from '../../lib/db'
import './garden.css'
import { useUiMode } from '../../lib/mode'
import { ProgressBar } from '../ui/Progress'

const STAGE_NAMES = ['بذرة', 'برعم صغير', 'أوراق', 'بلّشت تزهّر', 'نبتة كاملة']

interface Props {
  progress: UnitProgress[]
  topics: Topic[]
  onSelect?: (unitId: string) => void
  compact?: boolean
}

/** The study garden: one plant per unit, grown from real topic completion. */
export function Garden({ progress, topics, onSelect, compact }: Props) {
  const mode = useUiMode()
  if (mode === 'serious') return <ProgressTable progress={progress} onSelect={onSelect} />
  if (!progress.length)
    return (
      <div className="garden-scene grid min-h-40 place-items-center rounded-[34px_28px_36px_30px] border-[1.5px] border-dashed border-line p-6 text-center text-ink-soft">
        الحديقة فاضية. ضيف وحداتك من «خطتي» وكل وحدة رح تصير نبتة 🌱
      </div>
    )
  // Milo stands beside the most recently completed unit's plant.
  const completed = progress.filter((p) => p.percent >= 100)
  const lastDone = completed
    .map((p) => ({ p, at: Math.max(0, ...topics.filter((t) => t.unitId === p.unit.id && t.completedAt).map((t) => t.completedAt!)) }))
    .sort((a, b) => b.at - a.at)[0]?.p.unit.id

  return (
    <div className="garden-scene relative overflow-hidden rounded-[34px_28px_36px_30px] border-[1.5px] border-line">
      {/* sky */}
      <svg className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 300" aria-hidden>
        <rect width="400" height="300" fill="#EEF6F4" />
        <g className="garden-cloud">
          <path d="M40 60C40 48 56 44 64 52C68 40 90 40 92 56C104 54 108 70 96 72H46C38 72 36 64 40 60Z" fill="#fff" stroke="#27372F" strokeWidth="1.2" opacity="0.9" />
        </g>
        <g className="garden-cloud garden-cloud-2">
          <path d="M260 40C260 30 274 28 280 34C284 24 302 26 302 38C312 38 314 50 304 52H264C258 52 256 46 260 40Z" fill="#fff" stroke="#27372F" strokeWidth="1.2" opacity="0.9" />
        </g>
        <circle cx="350" cy="52" r="20" fill="#F9E9A7" stroke="#27372F" strokeWidth="1.4" />
        <path d="M0 150C60 120 120 128 180 140C250 154 320 120 400 134V300H0Z" fill="#E4EEDC" />
        <path d="M0 176C80 156 160 170 220 168C300 166 340 150 400 160V300H0Z" fill="#D6E7CB" />
      </svg>

      {!lastDone && (
        <div className={`pointer-events-none absolute z-10 ${compact ? 'left-3 top-1' : 'left-4 top-3 sm:left-8'}`}>
          <Milo mood={progress.some((p) => p.percent > 0) ? 'happy' : 'idle'} size={compact ? 56 : 76} />
        </div>
      )}
      <div className={`relative grid grid-cols-3 gap-x-1 gap-y-2 px-2 ${compact ? 'pb-3 pt-10' : 'pb-5 pt-16 sm:grid-cols-6 sm:px-4'}`}>
        {progress.map((p, i) => {
          const stage = plantStage(p.percent)
          const here = p.unit.id === lastDone
          return (
            <motion.button
              key={p.unit.id}
              type="button"
              onClick={() => onSelect?.(p.unit.id)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.96 }}
              className="group relative flex flex-col items-center rounded-3xl pt-2 text-center outline-offset-2"
              aria-label={`${p.unit.name}: ${p.percent}٪ — ${STAGE_NAMES[stage]}`}
            >
              <div className="relative flex h-[140px] items-end justify-center sm:h-[150px]">
                <Plant kind={p.unit.plant} stage={stage} size={compact ? 88 : 100} />
                {here && (
                  <div className="absolute -bottom-1 -left-6 sm:-left-8">
                    <Milo mood="happy" size={compact ? 52 : 62} />
                  </div>
                )}
              </div>
              {stage < 2 && (
                <svg viewBox="0 0 120 30" className="absolute bottom-[58px] w-[90%]" aria-hidden>
                  <path d="M14 28C14 20 12 14 9 10M18 28C19 21 22 17 25 15M100 28C100 21 98 17 95 14M105 28C106 22 109 18 112 17" stroke="#8DB592" strokeWidth="2" strokeLinecap="round" fill="none" />
                </svg>
              )}
              {/* soil mound */}
              <svg viewBox="0 0 120 26" className="-mt-3 w-[92%]" aria-hidden>
                <path d="M4 18C14 6 40 2 60 2C80 2 106 6 116 18C110 24 10 24 4 18Z" fill="#C9B79C" stroke="#27372F" strokeWidth="1.5" />
                <path d="M30 12l4-2M70 10l5 1M90 14l3-2" stroke="#27372F" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
              </svg>
              {/* wooden sign */}
              <div className={`-mt-1 rounded-xl border-[1.5px] border-ink bg-white px-2.5 py-0.5 shadow-[2px_2px_0_#27372F] ${i % 2 ? 'rotate-[2deg]' : 'rotate-[-2deg]'}`}>
                <span className="block font-display text-sm font-bold leading-tight">{p.unit.name}</span>
                <span className="num block text-xs text-ink-soft">{p.percent}%</span>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

export { STAGE_NAMES }

function ProgressTable({ progress, onSelect }: { progress: UnitProgress[]; onSelect?: (unitId: string) => void }) {
  if (!progress.length) return <div className="sheet p-6 text-center text-ink-soft">لا توجد وحدات بعد. أضف وحداتك من صفحة «خطتي».</div>
  return (
    <div className="sheet divide-y divide-line">
      {progress.map((p) => (
        <button key={p.unit.id} onClick={() => onSelect?.(p.unit.id)} className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 text-start hover:bg-paper">
          <span className="font-semibold">{p.unit.name}</span>
          <span className="num text-sm text-ink-soft">
            {p.done}/{p.total} · {p.percent}%
          </span>
          <span className="col-span-2">
            <ProgressBar value={p.percent} label={p.unit.name} height={6} />
          </span>
        </button>
      ))}
    </div>
  )
}
