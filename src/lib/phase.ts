import type { ChallengeDay } from './db'

export type Phase = 'before' | 'study' | 'exam' | 'after'

export function challengePhase(days: ChallengeDay[] | undefined, today: string): Phase {
  if (!days?.length) return 'study'
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  if (today < sorted[0].date) return 'before'
  if (today > sorted[sorted.length - 1].date) return 'after'
  const d = sorted.find((x) => x.date === today)
  return d?.kind === 'exam' ? 'exam' : 'study'
}

export function todayChallengeDay(days: ChallengeDay[] | undefined, today: string) {
  return days?.find((d) => d.date === today)
}
