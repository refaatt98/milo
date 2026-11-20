import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  wide?: boolean
}

/** Bottom sheet on phones, centered notebook page on larger screens. */
export function Sheet({ open, onClose, title, children, wide }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={`relative max-h-[88dvh] w-full overflow-y-auto rounded-t-[30px] border-[1.5px] border-line bg-paper px-5 pt-3 shadow-2xl sm:rounded-[30px] sm:pb-6 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
            style={{ paddingBottom: 'calc(24px + var(--safe-bottom))' }}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line sm:hidden" />
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold">{title}</h2>
              <button
                onClick={onClose}
                aria-label="إغلاق"
                className="btn-press -mt-1 grid size-11 shrink-0 place-items-center rounded-full bg-white text-ink-soft ring-1 ring-line hover:bg-mint"
              >
                <X size={20} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
