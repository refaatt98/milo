import { useMemo } from 'react'
import { useSessions, useSettings, useTimers, useToday } from './useData'
import { useNow } from './useNow'
import { msByDay, sessionsOnDay } from '../lib/stats'
import { addDays } from '../lib/time'

/** Live study numbers for today, including any running timer. */
export function useStudyStats() {
  const sessions = useSessions()
  const timers = useTimers()
  const settings = useSettings()
  const today = useToday()
  const running = !!timers?.some((t) => t.status === 'running')
  const now = useNow(running, 1000)
  return useMemo(() => {
    const byDay = msByDay(sessions ?? [], timers ?? [], now)
    const todayMs = byDay.get(today) ?? 0
    const goalMs = settings.dailyGoalHours * 3600e3
    return {
      ready: !!sessions && !!timers,
      now,
      today,
      byDay,
      todayMs,
      yesterdayMs: byDay.get(addDays(today, -1)) ?? 0,
      goalMs,
      remainingMs: Math.max(0, goalMs - todayMs),
      percent: goalMs ? Math.min(100, (todayMs / goalMs) * 100) : 0,
      sessionsToday: sessionsOnDay(sessions ?? [], today).filter((s) => s.kind === 'study' || s.kind === 'exam').length,
      sessions: sessions ?? [],
      timers: timers ?? [],
    }
  }, [sessions, timers, settings.dailyGoalHours, today, now])
}
