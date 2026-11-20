import Dexie, { type EntityTable } from 'dexie'
import { seedDatabase } from '../data/seed'

export type PlantKind = 'tulip' | 'sunflower' | 'fern' | 'lavender' | 'cactus' | 'blossom'

export interface Unit {
  id: string
  name: string
  order: number
  plant: PlantKind
  /** Only used when the unit has no topics (0–100). */
  manualProgress: number
}

export interface Topic {
  id: string
  unitId: string
  title: string
  order: number
  done: boolean
  completedAt?: number
  /** user flagged as weak during exam prep */
  weak?: boolean
}

export type DayKind = 'study' | 'exam'
export type Destination =
  | 'desk'
  | 'garden'
  | 'library'
  | 'hill'
  | 'cottage'
  | 'station'
  | 'workshop'
  | 'checkpoint'
  | 'celebration'

export interface ChallengeDay {
  id: string
  order: number
  date: string // YYYY-MM-DD (Asia/Hebron)
  title: string
  kind: DayKind
  unitIds: string[]
  destination: Destination
  notes: string
  /** user explicitly marked the day as finished */
  completed: boolean
}

export interface PlannerTask {
  id: string
  date: string
  order: number
  title: string
  start?: string // HH:MM
  end?: string
  unitId?: string
  done: boolean
  completedAt?: number
  isBreak?: boolean
}

export interface Segment {
  start: number
  end: number
}

export type SessionKind = 'study' | 'exam'

export interface StudySession {
  id: string
  kind: SessionKind
  startedAt: number
  endedAt: number
  /** elapsed active ms (pauses excluded) */
  duration: number
  segments: Segment[]
  unitId?: string
  topicId?: string
  examId?: string
}

export interface ActiveTimer {
  key: 'timer:study' | 'timer:exam'
  id: string // future session id → finishing twice can never duplicate
  kind: SessionKind
  status: 'running' | 'paused' | 'break'
  createdAt: number
  /** closed active segments */
  segments: Segment[]
  /** start of the open segment while running */
  runningSince?: number
  unitId?: string
  topicId?: string
  examId?: string
  pomodoro: boolean
  /** active ms at which the current pomodoro focus block started */
  blockStartActive: number
  breakEndsAt?: number
  pausedAt?: number
}

export interface Exam {
  id: string
  title: string
  date: string
  unitIds: string[]
  plannedMinutes: number
  score?: number
  maxScore?: number
  durationMs?: number
  startedAt?: number
  endedAt?: number
  notes: string
  status: 'planned' | 'done'
}

export interface Mistake {
  id: string
  unitId?: string
  topicId?: string
  examId?: string
  text: string
  fix: string
  resolved: boolean
  createdAt: number
}

export interface ChecklistItem {
  id: string
  order: number
  text: string
  done: boolean
}

export interface KV {
  key: string
  value: unknown
}

export interface Settings {
  dailyGoalHours: number
  pomodoroDefault: boolean
  name: string
  examDateTime: string // "YYYY-MM-DDTHH:MM" local Hebron
}

export const DEFAULT_SETTINGS: Settings = {
  dailyGoalHours: 9,
  pomodoroDefault: false,
  name: '',
  examDateTime: '2026-11-28T09:00',
}

class MiloDB extends Dexie {
  units!: EntityTable<Unit, 'id'>
  topics!: EntityTable<Topic, 'id'>
  days!: EntityTable<ChallengeDay, 'id'>
  tasks!: EntityTable<PlannerTask, 'id'>
  sessions!: EntityTable<StudySession, 'id'>
  timers!: EntityTable<ActiveTimer, 'key'>
  exams!: EntityTable<Exam, 'id'>
  mistakes!: EntityTable<Mistake, 'id'>
  checklist!: EntityTable<ChecklistItem, 'id'>
  kv!: EntityTable<KV, 'key'>

  constructor() {
    super('milo-study')
    this.version(1).stores({
      units: 'id, order',
      topics: 'id, unitId, order',
      days: 'id, date, order',
      tasks: 'id, date, order, unitId',
      sessions: 'id, kind, startedAt, unitId, topicId, examId',
      timers: 'key',
      exams: 'id, date, status',
      mistakes: 'id, unitId, topicId, createdAt',
      checklist: 'id, order',
      kv: 'key',
    })
    this.on('populate', (tx) => seedDatabase(tx))
  }
}

export const db = new MiloDB()

export const TABLES = [
  'units',
  'topics',
  'days',
  'tasks',
  'sessions',
  'timers',
  'exams',
  'mistakes',
  'checklist',
  'kv',
] as const

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings')
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) }
}

export async function saveSettings(patch: Partial<Settings>) {
  const cur = await getSettings()
  await db.kv.put({ key: 'settings', value: { ...cur, ...patch } })
}
