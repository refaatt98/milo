import { motion } from 'motion/react'
import type { ReactNode } from 'react'

const INK = '#27372F'

interface Props {
  /** 0–1 progress of the ring */
  progress: number
  status: 'idle' | 'running' | 'paused' | 'break'
  children: ReactNode
  /** whole hours to mark as little leaves around the ring */
  leaves?: number
  size?: number
}

/** A paper-sticker clock face with 60 ink ticks and a soft, filling arc. */
export function TimerDial({ progress, status, children, leaves = 0, size = 300 }: Props) {
  const R = 118
  const C = 2 * Math.PI * R
  const p = Math.max(0, Math.min(1, progress))
  const ringColor = status === 'break' ? '#F8D9C6' : status === 'paused' ? '#F9E9A7' : '#6F9876'
  return (
    <div className="relative mx-auto aspect-square w-full" style={{ maxWidth: size }}>
      <svg viewBox="0 0 300 300" className="absolute inset-0 size-full" aria-hidden>
        {/* wobbly paper disc */}
        <path
          d="M150 14C222 12 286 70 287 148C288 226 228 288 150 287C74 286 12 228 13 150C14 74 76 16 150 14Z"
          fill="#fff"
          stroke="#E7E3D8"
          strokeWidth={2}
        />
        <path
          d="M150 14C222 12 286 70 287 148C288 226 228 288 150 287C74 286 12 228 13 150C14 74 76 16 150 14Z"
          fill="none"
          stroke={INK}
          strokeWidth={1}
          opacity={0.12}
          transform="translate(3 4)"
        />
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * Math.PI * 2 - Math.PI / 2
          const big = i % 5 === 0
          const r1 = big ? 134 : 137
          const r2 = 142
          return (
            <line
              key={i}
              x1={150 + Math.cos(a) * r1}
              y1={150 + Math.sin(a) * r1}
              x2={150 + Math.cos(a) * r2}
              y2={150 + Math.sin(a) * r2}
              stroke={INK}
              strokeWidth={big ? 2.2 : 1.1}
              strokeLinecap="round"
              opacity={i / 60 <= p ? 0.9 : 0.25}
            />
          )
        })}
        <circle cx={150} cy={150} r={R} fill="none" stroke="#EFECE3" strokeWidth={14} />
        <motion.circle
          cx={150}
          cy={150}
          r={R}
          fill="none"
          stroke={ringColor}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={C}
          initial={false}
          animate={{ strokeDashoffset: C * (1 - p) }}
          transition={{ type: 'tween', ease: 'linear', duration: 0.9 }}
          transform="rotate(-90 150 150)"
        />
        {/* the little leaf riding the end of the arc */}
        {p > 0.005 && (
          <g transform={`rotate(${p * 360} 150 150)`}>
            <g transform="translate(150 32)">
              <path d="M0 0C-8 -10 -6 -18 0 -22C6 -18 8 -10 0 0Z" fill="#8DB592" stroke={INK} strokeWidth={1.6} transform="rotate(-30)" />
            </g>
          </g>
        )}
        {Array.from({ length: Math.min(leaves, 12) }, (_, i) => {
          const a = ((i + 0.5) / 12) * Math.PI * 2 - Math.PI / 2
          return (
            <circle key={i} cx={150 + Math.cos(a) * 100} cy={150 + Math.sin(a) * 100} r={4} fill="#F9E9A7" stroke={INK} strokeWidth={1.3} />
          )
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}
