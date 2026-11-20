import Dexie, { type EntityTable } from 'dexie'

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

/* ---------- notebooks (MiloNote) ---------- */

export type PaperKind = 'blank' | 'lined' | 'grid' | 'dots' | 'cornell'
export type PenKind = 'ballpoint' | 'fountain' | 'marker' | 'pencil' | 'brush' | 'highlighter'

export interface Stroke {
  id: string
  pen: PenKind
  color: string
  width: number
  /** flat [x, y, pressure, x, y, pressure…] in page units (1000 × 1414) */
  pts: number[]
}

export interface TextBox {
  id: string
  x: number
  y: number
  w: number
  text: string
  size: number
  color: string
}

export interface StickerEl {
  id: string
  kind: string
  x: number
  y: number
  s: number
  r: number
}

/** A photo placed on the page (below the ink, so you can write over it). */
export interface ImageEl {
  id: string
  fileId: string
  x: number
  y: number
  w: number
  /** height / width */
  ratio: number
  r: number
}

export interface PageContent {
  strokes: Stroke[]
  texts: TextBox[]
  stickers: StickerEl[]
  images?: ImageEl[]
}

export interface Notebook {
  id: string
  title: string
  cover: string
  paper: PaperKind
  paperColor: string
  order: number
  createdAt: number
  updatedAt: number
  unitId?: string
  /** password lock: AES-GCM key derived with PBKDF2 from the user's password */
  lock?: { salt: string; check: string; iv: string }
}

/** What a page is drawn on top of: a page of an imported PDF, or a photo. */
export type PageBg = { kind: 'pdf'; fileId: string; page: number } | { kind: 'image'; fileId: string }

/** Imported file (PDF / image). Metadata syncs; the bytes live in Storage + a local cache. */
export interface FileMeta {
  id: string
  notebookId: string
  name: string
  mime: string
  size: number
  pageCount?: number
  createdAt: number
  path?: string // storage path once uploaded
}

export interface FileBlob {
  id: string
  blob: Blob
}

export interface NotePage {
  id: string
  notebookId: string
  order: number
  bg?: PageBg
  paper?: PaperKind
  content?: PageContent
  /** when the notebook is locked the content is stored only encrypted */
  enc?: { iv: string; data: string }
  updatedAt: number
}

export interface AudioClip {
  id: string
  notebookId: string
  pageId: string
  title: string
  durationMs: number
  createdAt: number
  mime: string
  path?: string // storage path once uploaded
}

export interface AudioBlob {
  id: string
  blob: Blob
}

export class MiloDB extends Dexie {
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
  notebooks!: EntityTable<Notebook, 'id'>
  pages!: EntityTable<NotePage, 'id'>
  audio!: EntityTable<AudioClip, 'id'>
  audioBlobs!: EntityTable<AudioBlob, 'id'>
  files!: EntityTable<FileMeta, 'id'>
  fileBlobs!: EntityTable<FileBlob, 'id'>

  constructor(name: string) {
    super(name)
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
    this.version(2).stores({
      notebooks: 'id, order, updatedAt',
      pages: 'id, notebookId, order',
      audio: 'id, notebookId, pageId, createdAt',
      audioBlobs: 'id',
    })
    this.version(3).stores({
      files: 'id, notebookId, createdAt',
      fileBlobs: 'id',
    })
  }
}

/**
 * One local database per account. `db` is a live ES-module binding, so every
 * importer sees the account's database after openUserDb() swaps it.
 */
export let db = new MiloDB('milonote-guest')

export function openUserDb(userId: string) {
  // always a fresh instance so sync hooks are attached exactly once
  db.close()
  db = new MiloDB(`milonote-${userId}`)
  return db
}

/** Tables mirrored to the account in the cloud (audio blobs go to Storage instead). */
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
  'notebooks',
  'pages',
  'audio',
  'files',
] as const
export type SyncTable = (typeof TABLES)[number]

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings')
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) }
}

export async function saveSettings(patch: Partial<Settings>) {
  const cur = await getSettings()
  await db.kv.put({ key: 'settings', value: { ...cur, ...patch } })
}
