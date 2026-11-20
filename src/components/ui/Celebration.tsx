import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Milo, { type MiloMood } from '../character/Milo'

export interface CelebrationEvent {
  title: string
  message?: string
  mood?: MiloMood
  /** 'small' = toast at the top, 'big' = full overlay with confetti */
  size?: 'small' | 'big'
}

const Ctx = createContext<(e: CelebrationEvent) => void>(() => {})
export const useCelebrate = () => useContext(Ctx)

const COLORS = ['#F9E9A7', '#F8D9C6', '#EAE3F6', '#DCEEF4', '#E4EEDC', '#6F9876']

function Confetti() {
  const reduce = useReducedMotion()
  const bits = useMemo(
    () =>
      Array.from({ length: reduce ? 0 : 42 }, (_, i) => ({
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        rot: Math.random() * 720 - 360,
        dur: 1.8 + Math.random() * 1.6,
        c: COLORS[i % COLORS.length],
        shape: i % 3,
        drift: Math.random() * 80 - 40,
      })),
    [reduce],
  )
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <motion.div
          key={i}
          className="absolute -top-6"
          style={{ left: `${b.x}%` }}
          initial={{ y: -20, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '110vh', x: b.drift, rotate: b.rot, opacity: [1, 1, 0.7] }}
          transition={{ duration: b.dur, delay: b.delay, ease: [0.2, 0.6, 0.4, 1] }}
        >
          {b.shape === 0 ? (
            <div className="h-3 w-2 rounded-[2px] border border-ink/40" style={{ background: b.c }} />
          ) : b.shape === 1 ? (
            <div className="size-3 rounded-full border border-ink/40" style={{ background: b.c }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1L9.5 6.5L15 8L9.5 9.5L8 15L6.5 9.5L1 8L6.5 6.5Z" fill={b.c} stroke="#27372F" strokeWidth="1" /></svg>
          )}
        </motion.div>
      ))}
    </div>
  )
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [ev, setEv] = useState<(CelebrationEvent & { id: number }) | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const celebrate = useCallback((e: CelebrationEvent) => {
    setEv({ ...e, id: Date.now() })
  }, [])
  useEffect(() => {
    if (!ev) return
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setEv(null), ev.size === 'big' ? 5200 : 3400)
    return () => clearTimeout(timer.current)
  }, [ev])

  return (
    <Ctx.Provider value={celebrate}>
      {children}
      <AnimatePresence>
        {ev && ev.size === 'big' && (
          <motion.div
            key={ev.id}
            className="fixed inset-0 z-[60] grid place-items-center bg-paper/80 px-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEv(null)}
            role="status"
            aria-live="polite"
          >
            <Confetti />
            <motion.div
              initial={{ scale: 0.7, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 14, stiffness: 200 }}
              className="sheet relative flex max-w-sm flex-col items-center px-8 pb-8 pt-4 text-center"
            >
              <div className="tape -top-3 right-10 rotate-[-6deg]" />
              <div className="tape tape-peach -top-3 left-10 rotate-[5deg]" />
              <Milo mood={ev.mood ?? 'excited'} size={170} />
              <h2 className="mt-1 text-2xl font-extrabold">{ev.title}</h2>
              {ev.message && <p className="mt-2 text-ink-soft">{ev.message}</p>}
              <p className="mt-4 text-xs text-ink-faint">اضغط بأي مكان للمتابعة</p>
            </motion.div>
          </motion.div>
        )}
        {ev && ev.size !== 'big' && (
          <motion.div
            key={ev.id}
            className="fixed inset-x-0 z-[60] flex justify-center px-4"
            style={{ top: 'calc(var(--safe-top) + 12px)' }}
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            role="status"
            aria-live="polite"
          >
            <button onClick={() => setEv(null)} className="sheet flex items-center gap-3 py-2 pe-5 ps-2 text-start">
              <Milo mood={ev.mood ?? 'happy'} size={58} />
              <span>
                <span className="block font-display text-lg font-bold leading-tight">{ev.title}</span>
                {ev.message && <span className="block text-sm text-ink-soft">{ev.message}</span>}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  )
}
