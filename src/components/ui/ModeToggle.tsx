import { motion } from 'motion/react'
import { Briefcase, Sparkles } from 'lucide-react'
import { useAuth } from '../../lib/auth'

/** Switches the whole app between the playful Milo world and a calm, serious look. Saved to the account. */
export function ModeToggle({ full = false }: { full?: boolean }) {
  const { mode, setMode } = useAuth()
  const serious = mode === 'serious'
  return (
    <button
      onClick={() => setMode(serious ? 'playful' : 'serious')}
      role="switch"
      aria-checked={serious}
      aria-label={serious ? 'رجّع الشكل المرح' : 'حوّل للشكل الجدّي'}
      title={serious ? 'الشكل المرح' : 'الشكل الجدّي'}
      className={`btn-press flex min-h-10 items-center gap-2 rounded-full bg-white ps-1 pe-3 text-sm font-semibold ring-1 ring-line ${full ? 'w-full justify-between' : ''}`}
    >
      <span className="relative flex h-8 w-14 items-center rounded-full bg-paper ring-1 ring-line">
        <motion.span
          layout
          transition={{ type: 'spring', damping: 24, stiffness: 400 }}
          className={`absolute grid size-7 place-items-center rounded-full text-white ${serious ? 'left-0.5 bg-[#2f4a3c]' : 'right-0.5 bg-sage'}`}
        >
          {serious ? <Briefcase size={14} /> : <Sparkles size={14} />}
        </motion.span>
      </span>
      <span>{serious ? 'جدّي' : 'مرح'}</span>
    </button>
  )
}
