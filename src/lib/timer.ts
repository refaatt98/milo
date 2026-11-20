import { db, type ActiveTimer, type SessionKind, type StudySession, type Segment } from './db'
import { uid } from './id'

export const POMO_FOCUS = 50 * 60e3
export const POMO_BREAK = 10 * 60e3

type TimerKey = ActiveTimer['key']
export const keyOf = (kind: SessionKind): TimerKey => (kind === 'study' ? 'timer:study' : 'timer:exam')

function closedMs(segments: Segment[]) {
  return segments.reduce((a, s) => a + Math.max(0, s.end - s.start), 0)
}

/**
 * Pure: returns the timer as it should be at `now`. If a pomodoro focus block
 * ran out while the tab was hidden or closed, the open segment is closed at the
 * exact boundary instant and the timer enters its break — so time that passed
 * during the break is never counted.
 */
export function normalizeTimer(t: ActiveTimer, now: number): ActiveTimer {
  if (t.status !== 'running' || !t.pomodoro || t.runningSince == null) return t
  const closed = closedMs(t.segments)
  const boundaryActive = t.blockStartActive + POMO_FOCUS
  const remaining = boundaryActive - closed
  const boundaryAt = t.runningSince + remaining
  if (now < boundaryAt) return t
  return {
    ...t,
    status: 'break',
    segments: [...t.segments, { start: t.runningSince, end: boundaryAt }],
    runningSince: undefined,
    pausedAt: boundaryAt,
    breakEndsAt: boundaryAt + POMO_BREAK,
  }
}

export interface TimerView {
  status: ActiveTimer['status']
  elapsed: number
  /** ms left in the current pomodoro focus block */
  blockRemaining?: number
  breakRemaining?: number
  breakOver?: boolean
}

export function viewTimer(raw: ActiveTimer, now: number): TimerView {
  const t = normalizeTimer(raw, now)
  const elapsed = closedMs(t.segments) + (t.status === 'running' && t.runningSince != null ? Math.max(0, now - t.runningSince) : 0)
  const v: TimerView = { status: t.status, elapsed }
  if (t.pomodoro) v.blockRemaining = Math.max(0, t.blockStartActive + POMO_FOCUS - elapsed)
  if (t.status === 'break' && t.breakEndsAt) {
    v.breakRemaining = Math.max(0, t.breakEndsAt - now)
    v.breakOver = now >= t.breakEndsAt
  }
  return v
}

/** Active segments, including the open one, up to `now`. */
export function timerSegments(raw: ActiveTimer, now: number): Segment[] {
  const t = normalizeTimer(raw, now)
  const segs = [...t.segments]
  if (t.status === 'running' && t.runningSince != null) segs.push({ start: t.runningSince, end: now })
  return segs
}

function pauseObj(t: ActiveTimer, now: number): ActiveTimer {
  const n = normalizeTimer(t, now)
  if (n.status !== 'running' || n.runningSince == null) return n
  return {
    ...n,
    status: 'paused',
    segments: [...n.segments, { start: n.runningSince, end: now }],
    runningSince: undefined,
    pausedAt: now,
  }
}

async function pauseOther(kind: SessionKind, now: number) {
  const other = await db.timers.get(keyOf(kind === 'study' ? 'exam' : 'study'))
  if (other && other.status === 'running') await db.timers.put(pauseObj(other, now))
}

export async function startTimer(
  kind: SessionKind,
  opts: { unitId?: string; topicId?: string; examId?: string; pomodoro?: boolean } = {},
) {
  const now = Date.now()
  return db.transaction('rw', db.timers, async () => {
    const existing = await db.timers.get(keyOf(kind))
    if (existing) return existing
    await pauseOther(kind, now) // never let two clocks count the same minute
    const t: ActiveTimer = {
      key: keyOf(kind),
      id: uid(),
      kind,
      status: 'running',
      createdAt: now,
      segments: [],
      runningSince: now,
      unitId: opts.unitId,
      topicId: opts.topicId,
      examId: opts.examId,
      pomodoro: !!opts.pomodoro,
      blockStartActive: 0,
    }
    await db.timers.put(t)
    return t
  })
}

export async function pauseTimer(kind: SessionKind) {
  const now = Date.now()
  await db.transaction('rw', db.timers, async () => {
    const t = await db.timers.get(keyOf(kind))
    if (!t) return
    await db.timers.put(pauseObj(t, now))
  })
}

export async function resumeTimer(kind: SessionKind) {
  const now = Date.now()
  await db.transaction('rw', db.timers, async () => {
    const raw = await db.timers.get(keyOf(kind))
    if (!raw) return
    const t = normalizeTimer(raw, now)
    if (t.status === 'running') return
    await pauseOther(kind, now)
    const elapsed = closedMs(t.segments)
    await db.timers.put({
      ...t,
      status: 'running',
      runningSince: now,
      pausedAt: undefined,
      breakEndsAt: undefined,
      // a new pomodoro focus block starts after a break
      blockStartActive: t.status === 'break' ? elapsed : t.blockStartActive,
    })
  })
}

/** Persists a pomodoro boundary transition if one happened. */
export async function syncTimer(kind: SessionKind) {
  const now = Date.now()
  await db.transaction('rw', db.timers, async () => {
    const raw = await db.timers.get(keyOf(kind))
    if (!raw) return
    const n = normalizeTimer(raw, now)
    if (n !== raw) await db.timers.put(n)
  })
}

export async function updateTimerMeta(kind: SessionKind, patch: Partial<Pick<ActiveTimer, 'unitId' | 'topicId' | 'pomodoro'>>) {
  await db.transaction('rw', db.timers, async () => {
    const t = await db.timers.get(keyOf(kind))
    if (!t) return
    const next = { ...t, ...patch }
    if (patch.pomodoro && !t.pomodoro) next.blockStartActive = closedMs(t.segments) + (t.runningSince ? Date.now() - t.runningSince : 0)
    await db.timers.put(next)
  })
}

/**
 * Finishes the session atomically. The session id is fixed at start time and
 * the active timer is removed in the same transaction, so double taps,
 * multiple tabs or retries can never create duplicate sessions.
 */
export async function finishTimer(kind: SessionKind): Promise<StudySession | null> {
  const now = Date.now()
  return db.transaction('rw', db.timers, db.sessions, db.exams, async () => {
    const raw = await db.timers.get(keyOf(kind))
    if (!raw) return null
    const segments = timerSegments(raw, now).filter((s) => s.end > s.start)
    const duration = closedMs(segments)
    await db.timers.delete(keyOf(kind))
    if (duration < 1000) return null
    const session: StudySession = {
      id: raw.id,
      kind,
      startedAt: segments[0]?.start ?? raw.createdAt,
      endedAt: segments[segments.length - 1]?.end ?? now,
      duration,
      segments,
      unitId: raw.unitId,
      topicId: raw.topicId,
      examId: raw.examId,
    }
    const exists = await db.sessions.get(session.id)
    if (!exists) await db.sessions.add(session)
    if (raw.examId) {
      const exam = await db.exams.get(raw.examId)
      if (exam) await db.exams.update(raw.examId, { durationMs: (exam.durationMs ?? 0) + duration, endedAt: session.endedAt })
    }
    return session
  })
}

export async function resetTimer(kind: SessionKind) {
  await db.timers.delete(keyOf(kind))
}
