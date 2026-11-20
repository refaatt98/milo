import { motion } from 'motion/react'

export function ProgressBar({ value, color = '#6F9876', label, height = 12 }: { value: number; color?: string; label: string; height?: number }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="relative w-full overflow-hidden rounded-full bg-[#efece3]"
      style={{ height }}
    >
      <motion.div
        className="absolute inset-y-0 right-0 rounded-full"
        style={{ background: color }}
        initial={false}
        animate={{ width: `${v}%` }}
        transition={{ type: 'spring', damping: 26, stiffness: 140 }}
      />
      <div className="pointer-events-none absolute inset-0 rounded-full" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, rgba(255,255,255,.22) 0 6px, transparent 6px 12px)' }} />
    </div>
  )
}
