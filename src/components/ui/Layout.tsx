import { AnimatePresence, motion } from 'motion/react'
import {
  BarChart3,
  BookOpen,
  CalendarRange,
  Flower2,
  GraduationCap,
  Home,
  LogOut,
  Map,
  MoreHorizontal,
  NotebookPen,
  Settings,
  ShieldCheck,
  Timer,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Sheet } from './Sheet'
import { Wordmark } from './Wordmark'
import { ModeToggle } from './ModeToggle'
import { SyncBadge } from './SyncBadge'
import Milo from '../character/Milo'
import { useTimers } from '../../hooks/useData'
import { useNow } from '../../hooks/useNow'
import { viewTimer } from '../../lib/timer'
import { formatHMS } from '../../lib/time'
import { useAuth } from '../../lib/auth'

interface Item {
  to: string
  label: string
  icon: typeof Home
  admin?: boolean
}

const ALL: Item[] = [
  { to: '/', label: 'اليوم', icon: Home },
  { to: '/focus', label: 'المؤقت', icon: Timer },
  { to: '/notes', label: 'الدفاتر', icon: BookOpen },
  { to: '/map', label: 'الخريطة', icon: Map },
  { to: '/garden', label: 'الحديقة والوحدات', icon: Flower2 },
  { to: '/planner', label: 'الجدول اليومي', icon: NotebookPen },
  { to: '/plan', label: 'خطتي', icon: CalendarRange },
  { to: '/exams', label: 'الامتحانات', icon: GraduationCap },
  { to: '/stats', label: 'الإحصائيات', icon: BarChart3 },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
  { to: '/admin', label: 'لوحة الإدارة', icon: ShieldCheck, admin: true },
]
const MORE_TINTS = ['bg-mint', 'bg-butter', 'bg-lavender', 'bg-sky', 'bg-peach', 'bg-mint', 'bg-butter']

function useActiveTimer() {
  const timers = useTimers()
  const t = timers?.find((x) => x.status === 'running') ?? timers?.find((x) => x.status !== 'running')
  const now = useNow(!!t && t.status === 'running', 1000)
  return t ? { t, v: viewTimer(t, now) } : null
}

export function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation()
  const nav = useNavigate()
  const { profile, isAdmin, signOut } = useAuth()
  const [more, setMore] = useState(false)
  const active = useActiveTimer()
  const items = ALL.filter((i) => !i.admin || isAdmin)
  const moreItems = items.filter((i) => !['/', '/focus', '/notes', '/map'].includes(i.to))
  const moreActive = moreItems.some((i) => loc.pathname.startsWith(i.to))
  // the notebook editor wants the whole screen
  const immersive = /^\/notes\/[^/]+/.test(loc.pathname)

  return (
    <div className="min-h-dvh lg:flex">
      {/* desktop rail */}
      <aside className={`sticky top-0 h-dvh w-64 shrink-0 flex-col border-e-[1.5px] border-line bg-paper/70 px-4 py-6 ${immersive ? 'hidden' : 'hidden lg:flex'}`}>
        <div className="mb-6 flex items-center gap-2 px-2">
          <Milo size={44} still />
          <Wordmark />
        </div>
        <nav className="no-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="التنقل الرئيسي">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `btn-press flex min-h-11 items-center gap-3 rounded-2xl px-4 font-semibold ${isActive ? 'bg-ink text-white' : 'text-ink-soft hover:bg-mint hover:text-ink'}`
              }
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        {active && (
          <button onClick={() => nav(active.t.kind === 'exam' ? '/exams' : '/focus')} className="sheet my-3 flex items-center gap-2 p-3 text-start">
            <Milo mood={active.v.status === 'running' ? 'focused' : 'break'} size={44} still />
            <span>
              <span className="block text-xs text-ink-soft">
                {active.t.kind === 'exam' ? 'امتحان' : 'جلسة'} {active.v.status === 'running' ? 'شغّالة' : 'متوقفة'}
              </span>
              <span className="num font-bold">{formatHMS(active.v.elapsed)}</span>
            </span>
          </button>
        )}
        <div className="space-y-2 border-t border-dashed border-line pt-3">
          <ModeToggle full />
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{profile?.name}</p>
              <p className="truncate text-xs text-ink-faint" dir="ltr">{profile?.email}</p>
            </div>
            <SyncBadge />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* mobile top bar */}
        {!immersive && (
          <div className="pt-safe flex items-center justify-between gap-2 px-4 pb-1 lg:hidden">
            <Wordmark />
            <div className="flex items-center gap-1">
              {active && (
                <button
                  onClick={() => nav(active.t.kind === 'exam' ? '/exams' : '/focus')}
                  className="btn-press flex min-h-10 items-center gap-2 rounded-full bg-white px-3 text-sm ring-1 ring-line"
                >
                  <span className={`size-2 rounded-full ${active.v.status === 'running' ? 'animate-pulse bg-sage' : 'bg-butter ring-1 ring-ink/30'}`} />
                  <span className="num font-bold">{formatHMS(active.v.elapsed)}</span>
                </button>
              )}
              <SyncBadge />
              <ModeToggle />
            </div>
          </div>
        )}
        <main className={immersive ? '' : 'pb-nav mx-auto w-full max-w-5xl px-4 pt-2 sm:px-6 lg:px-10 lg:pt-8'}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={loc.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.3, 0.7, 0.4, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* mobile bottom nav */}
      {!immersive && (
        <nav aria-label="التنقل الرئيسي" className="fixed inset-x-0 bottom-0 z-40 lg:hidden" style={{ paddingBottom: 'max(var(--safe-bottom), 10px)' }}>
          <div className="mx-3 flex items-end justify-between rounded-[28px_24px_30px_22px] border-[1.5px] border-ink bg-white px-2 pb-1.5 pt-1.5 shadow-[0_4px_0_#27372F]">
            <Tab to="/" label="اليوم" icon={<Home size={22} />} />
            <Tab to="/map" label="الخريطة" icon={<Map size={22} />} />
            <NavLink to="/focus" aria-label="المؤقت" className="-mt-7 flex flex-col items-center">
              {({ isActive }) => (
                <>
                  <span
                    className={`btn-press grid size-[62px] place-items-center rounded-[24px_20px_26px_18px] border-[1.5px] border-ink shadow-[0_3px_0_#27372F] ${isActive ? 'bg-ink text-white' : 'bg-butter text-ink'}`}
                  >
                    {active && active.t.kind === 'study' ? <span className="num text-[0.78rem] font-bold">{formatHMS(active.v.elapsed).slice(0, 5)}</span> : <Timer size={26} />}
                  </span>
                  <span className="mt-0.5 text-[0.7rem] font-semibold">المؤقت</span>
                </>
              )}
            </NavLink>
            <Tab to="/notes" label="الدفاتر" icon={<BookOpen size={22} />} />
            <button
              onClick={() => setMore(true)}
              className={`flex min-h-14 min-w-14 flex-col items-center justify-end rounded-2xl px-1 text-[0.7rem] font-semibold ${moreActive ? 'text-ink' : 'text-ink-faint'}`}
              aria-haspopup="dialog"
            >
              <span className={`grid h-8 w-12 place-items-center rounded-full ${moreActive ? 'bg-mint' : ''}`}>
                <MoreHorizontal size={22} />
              </span>
              المزيد
            </button>
          </div>
        </nav>
      )}

      <Sheet open={more} onClose={() => setMore(false)} title="شو بدك تفتح؟">
        <div className="grid grid-cols-2 gap-3">
          {moreItems.map(({ to, label, icon: Icon }, i) => (
            <button
              key={to}
              onClick={() => {
                setMore(false)
                nav(to)
              }}
              className={`btn-press flex min-h-24 flex-col items-start justify-between rounded-[22px_18px_24px_16px] border-[1.5px] border-ink p-4 text-start font-display text-lg font-bold shadow-[3px_3px_0_#27372F] ${MORE_TINTS[i % MORE_TINTS.length]}`}
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>
        <div className="mt-5 space-y-3 border-t border-dashed border-line pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{profile?.name}</p>
              <p className="truncate text-xs text-ink-faint" dir="ltr">{profile?.email}</p>
            </div>
            <ModeToggle />
          </div>
          <SyncBadge withLabel />
          <button
            onClick={() => {
              setMore(false)
              void signOut()
            }}
            className="btn-press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white font-semibold text-[#8a3b22] ring-1 ring-line"
          >
            <LogOut size={18} /> تسجيل الخروج
          </button>
        </div>
      </Sheet>
    </div>
  )
}

function Tab({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => `flex min-h-14 min-w-14 flex-col items-center justify-end rounded-2xl px-1 text-[0.7rem] font-semibold ${isActive ? 'text-ink' : 'text-ink-faint'}`}
    >
      {({ isActive }) => (
        <>
          <span className={`grid h-8 w-12 place-items-center rounded-full transition ${isActive ? 'bg-mint' : ''}`}>{icon}</span>
          {label}
        </>
      )}
    </NavLink>
  )
}
