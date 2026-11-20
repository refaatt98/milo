import { useEffect } from 'react'
import { useTimers } from '../../hooks/useData'
import { useStudyStats } from '../../hooks/useStudyStats'
import { normalizeTimer, syncTimer } from '../../lib/timer'
import { db } from '../../lib/db'
import { useCelebrate } from '../ui/Celebration'
import { formatDuration } from '../../lib/time'

/**
 * Runs app-wide: persists pomodoro boundaries that passed while the app
 * was hidden, and celebrates the daily goal exactly once per day.
 */
export function TimerWatcher() {
  const timers = useTimers()
  const stats = useStudyStats()
  const celebrate = useCelebrate()

  useEffect(() => {
    if (!timers) return
    for (const t of timers) if (normalizeTimer(t, stats.now) !== t) void syncTimer(t.kind)
  }, [timers, stats.now])

  useEffect(() => {
    if (!stats.ready || stats.goalMs <= 0 || stats.todayMs < stats.goalMs) return
    const key = `goal-celebrated:${stats.today}`
    void db.kv.get(key).then(async (row) => {
      if (row) return
      await db.kv.put({ key, value: Date.now() })
      celebrate({
        size: 'big',
        mood: 'excited',
        title: 'جرة النجوم امتلت! ⭐',
        message: `درست ${formatDuration(stats.todayMs)} اليوم ووصلت هدفك. فخور فيك.`,
      })
    })
  }, [stats.ready, stats.todayMs, stats.goalMs, stats.today, celebrate])

  // Keep the document title useful while a session runs in a background tab
  useEffect(() => {
    const running = timers?.find((t) => t.status === 'running')
    document.title = running ? `● ${formatDuration(stats.todayMs)} · MiloNote` : 'MiloNote — دفترك ورفيق دراستك'
  }, [timers, stats.todayMs])

  return null
}
