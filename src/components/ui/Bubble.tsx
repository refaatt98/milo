import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { useUiMode } from '../../lib/mode'

/** Hand-drawn speech bubble. `tail` = which side the tail points to. */
export function Bubble({ children, tail = 'right', className = '', k }: { children: ReactNode; tail?: 'right' | 'left' | 'bottom'; className?: string; k?: string }) {
  if (useUiMode() === 'serious') return null
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={k}
        initial={{ opacity: 0, y: 6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.98 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className={`relative rounded-[22px_18px_22px_16px] border-[1.5px] border-ink bg-white px-4 py-2.5 font-display text-[1.05rem] font-semibold leading-snug shadow-[3px_3px_0_#27372F] ${className}`}
      >
        {children}
        <svg
          aria-hidden
          width="22"
          height="18"
          viewBox="0 0 22 18"
          className={`absolute ${tail === 'right' ? '-right-[15px] top-4' : tail === 'left' ? '-left-[15px] top-4 -scale-x-100' : 'bottom-[-15px] right-8 rotate-90'}`}
        >
          <path d="M0 2C8 4 14 6 20 14C14 12 6 11 0 12" fill="#fff" stroke="#27372F" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </motion.div>
    </AnimatePresence>
  )
}
