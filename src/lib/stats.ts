import type { ActiveTimer, ChallengeDay, Segment, StudySession, Topic, Unit } from './db'
import { dayKey, nextLocalMidnight, addDays } from './time'
import { timerSegments } from './timer'

/** Split a segment at Asia/Hebron midnights and add ms per day. */
export function addSegmentToDays(seg: Segment, acc: Map<string, number>) {
  let s = seg.start
  while (s < seg.end) {
    const boundary = nextLocalMidnight(s)
    const e = Math.min(seg.end, boundary)
    const k = dayKey(s)
    acc.set(k, (acc.get(k) ?? 0) + (e - s))
    s = e
  }
}

export function msByDay(sessions: StudySession[], timers: ActiveTimer[] = [], now = Date.now()): Map<string, number> {
  const acc = new Map<string, number>()
  for (const s of sessions) {
    const segs = s.segments?.length ? s.segments : [{ start: s.startedAt, end: s.startedAt + s.duration }]
    for (const seg of segs) addSegmentToDays(seg, acc)
  }
  for (const t of timers) for (const seg of timerSegments(t, now)) addSegmentToDays(seg, acc)
  return acc
}

export function msOnDay(sessions: StudySession[], key: string, timers: ActiveTimer[] = [], now = Date.now()) {
  return msByDay(sessions, timers, now).get(key) ?? 0
}

export function sessionsOnDay(sessions: StudySession[], key: string) {
  return sessions.filter((s) => {
    const segs = s.segments?.length ? s.segments : [{ start: s.startedAt, end: s.endedAt }]
    return segs.some((seg) => dayKey(seg.start) === key || dayKey(seg.end - 1) === key)
  })
}

export function msByUnit(sessions: StudySession[], timers: ActiveTimer[] = [], now = Date.now()) {
  const acc = new Map<string, number>()
  for (const s of sessions) if (s.unitId) acc.set(s.unitId, (acc.get(s.unitId) ?? 0) + s.duration)
  for (const t of timers) {
    if (!t.unitId) continue
    const ms = timerSegments(t, now).reduce((a, g) => a + (g.end - g.start), 0)
    acc.set(t.unitId, (acc.get(t.unitId) ?? 0) + ms)
  }
  return acc
}

export interface UnitProgress {
  unit: Unit
  total: number
  done: number
  remaining: number
  percent: number
  hasTopics: boolean
}

export function unitProgress(unit: Unit, topics: Topic[]): UnitProgress {
  const mine = topics.filter((t) => t.unitId === unit.id)
  const done = mine.filter((t) => t.done).length
  const hasTopics = mine.length > 0
  const percent = hasTopics ? Math.round((done / mine.length) * 100) : Math.round(unit.manualProgress)
  return { unit, total: mine.length, done, remaining: mine.length - done, percent, hasTopics }
}

/** 0 seed · 1 sprout · 2 leaves · 3 flowering · 4 full */
export function plantStage(percent: number): 0 | 1 | 2 | 3 | 4 {
  if (percent >= 100) return 4
  if (percent >= 75) return 3
  if (percent >= 50) return 2
  if (percent >= 25) return 1
  return 0
}

export function isDayComplete(day: ChallengeDay, progress: Map<string, UnitProgress>) {
  if (day.completed) return true
  if (day.kind === 'study' && day.unitIds.length) {
    return day.unitIds.every((id) => (progress.get(id)?.percent ?? 0) >= 100)
  }
  return false
}

/** Consecutive days (ending today, or yesterday if today is still empty) with ≥ 15 min. */
export function streak(byDay: Map<string, number>, today: string, threshold = 15 * 60e3) {
  let d = (byDay.get(today) ?? 0) >= threshold ? today : addDays(today, -1)
  let n = 0
  while ((byDay.get(d) ?? 0) >= threshold) {
    n++
    d = addDays(d, -1)
  }
  return n
}

export function longestStreak(byDay: Map<string, number>, threshold = 15 * 60e3) {
  const keys = [...byDay.entries()].filter(([, v]) => v >= threshold).map(([k]) => k).sort()
  let best = 0
  let cur = 0
  let prev: string | null = null
  for (const k of keys) {
    cur = prev && addDays(prev, 1) === k ? cur + 1 : 1
    best = Math.max(best, cur)
    prev = k
  }
  return best
}
