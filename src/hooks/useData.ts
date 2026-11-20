import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, DEFAULT_SETTINGS, type Settings } from '../lib/db'
import { unitProgress, type UnitProgress } from '../lib/stats'
import { dayKey } from '../lib/time'
import { useNow } from './useNow'

export const useUnits = () => useLiveQuery(() => db.units.orderBy('order').toArray(), [], undefined)
export const useTopics = () => useLiveQuery(() => db.topics.orderBy('order').toArray(), [], undefined)
export const useDays = () => useLiveQuery(() => db.days.orderBy('order').toArray(), [], undefined)
export const useSessions = () => useLiveQuery(() => db.sessions.orderBy('startedAt').toArray(), [], undefined)
export const useTimers = () => useLiveQuery(() => db.timers.toArray(), [], undefined)
export const useExams = () => useLiveQuery(() => db.exams.orderBy('date').toArray(), [], undefined)
export const useMistakes = () => useLiveQuery(() => db.mistakes.orderBy('createdAt').reverse().toArray(), [], undefined)
export const useChecklist = () => useLiveQuery(() => db.checklist.orderBy('order').toArray(), [], undefined)
export const useTasksOn = (date: string) =>
  useLiveQuery(() => db.tasks.where('date').equals(date).sortBy('order'), [date], undefined)
export const useAllTasks = () => useLiveQuery(() => db.tasks.toArray(), [], undefined)

export function useSettings(): Settings {
  const row = useLiveQuery(() => db.kv.get('settings'), [], undefined)
  return useMemo(() => ({ ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) }), [row])
}

export function useTimer(kind: 'study' | 'exam') {
  return useLiveQuery(() => db.timers.get(kind === 'study' ? 'timer:study' : 'timer:exam'), [kind], undefined)
}

/** Today's key in Asia/Hebron; refreshes itself every 30s so midnight rolls over. */
export function useToday() {
  const now = useNow(true, 30_000)
  return dayKey(now)
}

export function useUnitProgress(): { list: UnitProgress[]; map: Map<string, UnitProgress> } | undefined {
  const units = useUnits()
  const topics = useTopics()
  return useMemo(() => {
    if (!units || !topics) return undefined
    const list = units.map((u) => unitProgress(u, topics))
    return { list, map: new Map(list.map((p) => [p.unit.id, p])) }
  }, [units, topics])
}
