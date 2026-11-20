import { AnimatePresence, motion } from 'motion/react'
import { Eye, EyeOff, Loader2, LogIn, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import Milo from '../components/character/Milo'
import { Button } from '../components/ui/Button'
import { signIn, signUp } from '../lib/supabase'
import { Wordmark } from '../components/ui/Wordmark'

export default function AuthPage() {
  const [tab, setTab] = useState<'in' | 'up'>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (tab === 'up' && password.length < 8) return setError('كلمة السر لازم تكون 8 أحرف على الأقل.')
    setBusy(true)
    try {
      if (tab === 'in') await signIn(email, password)
      else await signUp(name.trim(), email.trim(), password)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pt-safe grid min-h-dvh lg:grid-cols-2">
      {/* brand side */}
      <div className="dotgrid relative hidden flex-col justify-between overflow-hidden border-e-[1.5px] border-line bg-mint/50 p-10 lg:flex">
        <Wordmark big />
        <div className="relative mx-auto">
          <div className="absolute -left-10 top-6 h-40 w-32 rotate-[-8deg] rounded-[18px] border-[1.5px] border-ink bg-white shadow-[4px_4px_0_#27372F] playful-only">
            <div className="m-3 h-2 w-16 rounded bg-sage/50" />
            <div className="m-3 h-2 w-20 rounded bg-line" />
            <div className="m-3 h-2 w-12 rounded bg-line" />
          </div>
          <div className="absolute -right-12 bottom-4 h-36 w-28 rotate-[7deg] rounded-[18px] border-[1.5px] border-ink bg-butter shadow-[4px_4px_0_#27372F] playful-only" />
          <Milo mood="studying" size={260} />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold">دفترك، جدولك، ورفيقك الصغير.</h2>
          <p className="mt-2 max-w-md text-ink-soft">خطة دراسة على شكل خريطة، مؤقت دقيق، حديقة بتكبر مع كل درس، ودفاتر بتكتب فيها بخط إيدك — كله محفوظ بحسابك.</p>
        </div>
      </div>

      {/* form side */}
      <div className="flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <Milo mood="idle" size={120} />
            <Wordmark big />
          </div>
          <h1 className="text-3xl font-extrabold">{tab === 'in' ? 'أهلين من جديد 👋' : 'يلا نعمل حساب'}</h1>
          <p className="mt-1 text-ink-soft">{tab === 'in' ? 'سجّل دخول وكمّل من وين وقفت.' : 'حسابك بحفظ جدولك ودفاترك على كل أجهزتك.'}</p>

          <div className="mt-6 grid grid-cols-2 rounded-2xl bg-white p-1 ring-1 ring-line" role="tablist">
            {(['in', 'up'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t)
                  setError(null)
                }}
                className={`relative min-h-11 rounded-xl font-semibold transition ${tab === t ? 'text-white' : 'text-ink-soft'}`}
              >
                {tab === t && <motion.span layoutId="auth-tab" className="absolute inset-0 rounded-xl bg-ink" transition={{ type: 'spring', damping: 26, stiffness: 320 }} />}
                <span className="relative">{t === 'in' ? 'تسجيل الدخول' : 'حساب جديد'}</span>
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            <AnimatePresence initial={false}>
              {tab === 'up' && (
                <motion.label initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="block overflow-hidden">
                  <span className="mb-1 block text-sm font-semibold">الاسم</span>
                  <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={60} placeholder="شو اسمك؟" />
                </motion.label>
              )}
            </AnimatePresence>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">الإيميل</span>
              <input className="field" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required inputMode="email" placeholder="name@example.com" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">كلمة السر</span>
              <div className="relative">
                <input
                  className="field pe-12"
                  type={show ? 'text' : 'password'}
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={tab === 'in' ? 'current-password' : 'new-password'}
                  required
                  minLength={tab === 'up' ? 8 : undefined}
                />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'خبّي كلمة السر' : 'اعرض كلمة السر'} className="absolute inset-y-0 end-1 grid w-10 place-items-center text-ink-faint">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {tab === 'up' && <span className="mt-1 block text-xs text-ink-faint">8 أحرف على الأقل</span>}
            </label>
            {error && (
              <p role="alert" className="rounded-2xl bg-peach px-3 py-2 text-sm">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy || !email || !password || (tab === 'up' && !name.trim())} icon={busy ? <Loader2 className="animate-spin" size={20} /> : tab === 'in' ? <LogIn size={20} /> : <UserPlus size={20} />}>
              {tab === 'in' ? 'ادخل' : 'اعمل الحساب'}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-ink-faint">كلمة السر بتنحفظ مشفّرة، وما حدا بقدر يشوفها — ولا حتى الإدارة.</p>
        </div>
      </div>
    </div>
  )
}
