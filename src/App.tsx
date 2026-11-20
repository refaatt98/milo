import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes, Link } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Layout } from './components/ui/Layout'
import { CelebrationProvider } from './components/ui/Celebration'
import { TimerWatcher } from './components/timer/TimerWatcher'
import { Wordmark } from './components/ui/Wordmark'
import { Button } from './components/ui/Button'
import Milo from './components/character/Milo'
import { AuthProvider, useAuth } from './lib/auth'
import Today from './pages/Today'
import Focus from './pages/Focus'
import MapPage from './pages/MapPage'
import GardenPage from './pages/GardenPage'
import PlannerPage from './pages/PlannerPage'
import AuthPage from './pages/AuthPage'

const ExamsPage = lazy(() => import('./pages/ExamsPage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const PlanPage = lazy(() => import('./pages/PlanPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const NotesPage = lazy(() => import('./pages/NotesPage'))
const NotebookPage = lazy(() => import('./pages/NotebookPage'))

function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Milo mood="studying" size={110} />
      <Loader2 className="serious-only animate-spin text-ink-faint" />
    </div>
  )
}

function Splash({ text }: { text: string }) {
  return (
    <div className="grid min-h-dvh place-items-center text-center">
      <div className="flex flex-col items-center gap-3">
        <Milo mood="studying" size={140} />
        <Wordmark big />
        <p className="flex items-center gap-2 text-ink-soft">
          <Loader2 size={16} className="animate-spin" /> {text}
        </p>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <Milo mood="encouraging" size={150} />
        <h1 className="mt-2 text-3xl font-extrabold">ضيّعنا الطريق!</h1>
        <p className="mt-1 text-ink-soft">هالصفحة مش موجودة على الخريطة.</p>
        <Link to="/" className="mt-4 inline-block rounded-2xl bg-sage px-5 py-3 font-semibold text-white">ارجع لليوم</Link>
      </div>
    </div>
  )
}

function Gate() {
  const { status, session, retry, signOut } = useAuth()
  if (status === 'loading') return <Splash text="لحظة…" />
  if (status === 'signedOut') return <AuthPage />
  if (status === 'preparing') return <Splash text="ميلو عم يجهّز دفاترك…" />
  if (status === 'error')
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-3">
          <Milo mood="encouraging" size={130} />
          <h1 className="text-2xl font-extrabold">ما قدرنا نجيب حسابك</h1>
          <p className="text-ink-soft">أول مرة بتفتح الحساب على هاد الجهاز لازم إنترنت. تأكد من الاتصال وجرّب كمان مرة.</p>
          <Button onClick={retry} icon={<RefreshCw size={18} />}>جرّب كمان مرة</Button>
          <button onClick={() => void signOut()} className="text-sm text-ink-soft underline">تسجيل الخروج</button>
        </div>
      </div>
    )
  return (
    // keyed by account: every live query rebinds to this account's database
    <BrowserRouterInner key={session!.user.id} />
  )
}

function BrowserRouterInner() {
  return (
    <CelebrationProvider>
      <TimerWatcher />
      <Layout>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/focus" element={<Focus />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/garden" element={<GardenPage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/notes/:id" element={<NotebookPage />} />
            <Route path="/exams" element={<ExamsPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
    </CelebrationProvider>
  )
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </BrowserRouter>
    </MotionConfig>
  )
}
