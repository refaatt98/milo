import { motion } from 'motion/react'

/** Hand-drawn checkbox with an ink tick that draws itself. */
export function Check({ checked, onChange, label, color = '#6F9876' }: { checked: boolean; onChange: (v: boolean) => void; label: string; color?: string }) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      whileTap={{ scale: 0.85 }}
      className="grid size-11 shrink-0 place-items-center"
    >
      <svg width="30" height="30" viewBox="0 0 30 30" className="check-draw" data-on={checked}>
        <path
          d="M5 7C5 5 6 4 8 4H22C25 4 26 5 26 8V22C26 25 25 26 22 26H8C5 26 4 25 4 22Z"
          fill={checked ? color : '#fff'}
          stroke="#27372F"
          strokeWidth="1.8"
          style={{ strokeDasharray: 'none', strokeDashoffset: 0, transition: 'fill .25s' }}
        />
        <path d="M9 15.5L13.5 20L21.5 10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.button>
  )
}
