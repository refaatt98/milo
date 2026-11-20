import { motion, AnimatePresence } from 'motion/react'
import { useMemo } from 'react'

const INK = '#27372F'
const COLORS = ['#F9E9A7', '#F8D9C6', '#EAE3F6', '#DCEEF4', '#E4EEDC']
export const STARS_TOTAL = 27 // one star ≈ 20 minutes of a 9h goal

function starPath(cx: number, cy: number, r: number) {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.48 : r
    const a = (Math.PI / 5) * i - Math.PI / 2
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`)
  }
  return `M${pts.join('L')}Z`
}

/** A little glass jar Milo fills with paper stars as today's study time grows. */
export function StarJar({ percent, size = 170 }: { percent: number; size?: number }) {
  const filled = Math.min(STARS_TOTAL, Math.floor((percent / 100) * STARS_TOTAL))
  const full = percent >= 100
  const slots = useMemo(() => {
    // stack stars bottom-up in rows inside the jar body (x 30–110, y 160→70)
    const out: { x: number; y: number; r: number; rot: number; c: string }[] = []
    let row = 0
    while (out.length < STARS_TOTAL) {
      const n = row % 2 ? 4 : 5
      for (let i = 0; i < n && out.length < STARS_TOTAL; i++) {
        const x = 38 + (row % 2 ? 9 : 0) + i * 17 + ((i * 7 + row * 3) % 5) - 2
        const y = 158 - row * 15 + ((i * 5 + row) % 4) - 2
        out.push({ x, y, r: 8 + ((i + row) % 3), rot: (i * 37 + row * 23) % 60 - 30, c: COLORS[(i + row * 2) % COLORS.length] })
      }
      row++
    }
    return out
  }, [])

  return (
    <svg viewBox="0 0 140 190" width={size} height={size * (190 / 140)} role="img" aria-label={`جرة النجوم: ${Math.round(percent)}٪ من هدف اليوم`}>
      <defs>
        <clipPath id="jar-clip">
          <path d="M30 62C22 70 20 82 20 100V160C20 172 30 180 44 180H96C110 180 120 172 120 160V100C120 82 118 70 110 62Z" />
        </clipPath>
      </defs>
      {full && (
        <motion.circle cx={70} cy={115} r={78} fill="#F9E9A7" initial={{ opacity: 0 }} animate={{ opacity: [0.25, 0.5, 0.25] }} transition={{ duration: 2.4, repeat: Infinity }} />
      )}
      <ellipse cx={70} cy={182} rx={52} ry={6} fill={INK} opacity={0.08} />
      <g clipPath="url(#jar-clip)">
        <rect x={0} y={0} width={140} height={190} fill="#F5FAF9" />
        <AnimatePresence>
          {slots.slice(0, filled).map((s, i) => (
            <motion.path
              key={i}
              d={starPath(s.x, s.y, s.r)}
              fill={s.c}
              stroke={INK}
              strokeWidth={1.4}
              strokeLinejoin="round"
              initial={{ y: -120, opacity: 0, rotate: s.rot - 90 }}
              animate={{ y: 0, opacity: 1, rotate: s.rot }}
              transition={{ type: 'spring', damping: 13, stiffness: 120, delay: Math.min(i, 10) * 0.03 }}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            />
          ))}
        </AnimatePresence>
      </g>
      {/* glass */}
      <path d="M30 62C22 70 20 82 20 100V160C20 172 30 180 44 180H96C110 180 120 172 120 160V100C120 82 118 70 110 62Z" fill="none" stroke={INK} strokeWidth={2.4} />
      <path d="M32 96V150" stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={0.85} />
      <path d="M32 160V164" stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={0.85} />
      {/* neck + lid */}
      <path d="M32 50H108V62H32Z" fill="#FAF9F6" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M26 34C26 30 30 28 34 28H106C110 28 114 30 114 34V46C114 49 112 50 108 50H32C28 50 26 49 26 46Z" fill="#F8D9C6" stroke={INK} strokeWidth={2.2} />
      <path d="M34 36H106" stroke="#fff" strokeWidth={2} opacity={0.7} strokeLinecap="round" strokeDasharray="1 6" />
      {/* ribbon tag */}
      <path d="M108 56C118 58 124 66 124 76" stroke={INK} strokeWidth={1.5} fill="none" />
      <g transform="rotate(12 126 86)">
        <rect x={114} y={76} width={24} height={18} rx={3} fill="#fff" stroke={INK} strokeWidth={1.5} />
        <text x={126} y={89} textAnchor="middle" fontSize={9} fontFamily="Fraunces, serif" fontWeight={700} fill={INK}>
          {Math.round(percent)}%
        </text>
      </g>
      {full && (
        <motion.path
          d={starPath(70, 18, 10)}
          fill="#F9E9A7"
          stroke={INK}
          strokeWidth={1.5}
          animate={{ rotate: [0, 18, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
      )}
    </svg>
  )
}
