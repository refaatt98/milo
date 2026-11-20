import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes, Link } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { Layout } from './components/ui/Layout'
import { CelebrationProvider } from './components/ui/Celebration'
import { TimerWatcher } from './components/timer/TimerWatcher'
import Milo from './components/character/Milo'
import Today from './pages/Today'
import Focus from './pages/Focus'
import MapPage from './pages/MapPage'
import GardenPage from './pages/GardenPage'
import PlannerPage from './pages/PlannerPage'

const ExamsPage = lazy(() => import('./pages/ExamsPage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Milo mood="studying" size={110} />
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

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
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
                <Route path="/exams" element={<ExamsPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Layout>
        </CelebrationProvider>
      </BrowserRouter>
    </MotionConfig>
  )
}
