import type { MiloDB, ChallengeDay, ChecklistItem, PlannerTask, Topic, Unit, PlantKind, Destination, DayKind } from '../lib/db'
import { uid } from '../lib/id'

export const CHALLENGE_START = '2026-11-20'

const PLANTS: PlantKind[] = ['tulip', 'sunflower', 'fern', 'lavender', 'cactus', 'blossom']
const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع']

export function buildUnits(): { units: Unit[]; topics: Topic[] } {
  const units: Unit[] = []
  const topics: Topic[] = []
  for (let i = 0; i < 6; i++) {
    const id = `unit-${i + 1}`
    units.push({ id, name: `الوحدة ${i + 1}`, order: i, plant: PLANTS[i], manualProgress: 0 })
    for (let t = 0; t < 4; t++) {
      topics.push({ id: uid(), unitId: id, title: `الدرس ${ORDINALS[t]}`, order: t, done: false })
    }
  }
  return { units, topics }
}

interface DayDef {
  date: string
  title: string
  kind: DayKind
  units: number[]
  destination: Destination
}

export const DAY_DEFS: DayDef[] = [
  { date: '2026-11-20', title: 'الوحدة 1', kind: 'study', units: [1], destination: 'desk' },
  { date: '2026-11-21', title: 'الوحدة 2', kind: 'study', units: [2], destination: 'garden' },
  { date: '2026-11-22', title: 'الوحدة 3', kind: 'study', units: [3], destination: 'library' },
  { date: '2026-11-23', title: 'الوحدة 4', kind: 'study', units: [4], destination: 'hill' },
  { date: '2026-11-24', title: 'الوحدتين 5 و 6', kind: 'study', units: [5, 6], destination: 'cottage' },
  { date: '2026-11-25', title: 'امتحانات تجريبية: الوحدات 1، 2، 3', kind: 'exam', units: [1, 2, 3], destination: 'station' },
  { date: '2026-11-26', title: 'امتحانات تجريبية: الوحدات 4، 5، 6', kind: 'exam', units: [4, 5, 6], destination: 'workshop' },
  { date: '2026-11-27', title: 'امتحان شامل ومراجعة الأخطاء', kind: 'exam', units: [1, 2, 3, 4, 5, 6], destination: 'checkpoint' },
  { date: '2026-11-28', title: 'الامتحان التجريبي النهائي والمراجعة', kind: 'exam', units: [1, 2, 3, 4, 5, 6], destination: 'celebration' },
]

export function buildDays(): ChallengeDay[] {
  return DAY_DEFS.map((d, i) => ({
    id: `day-${i + 1}`,
    order: i,
    date: d.date,
    title: d.title,
    kind: d.kind,
    unitIds: d.units.map((n) => `unit-${n}`),
    destination: d.destination,
    notes: '',
    completed: false,
  }))
}

export const SCHEDULE_TEMPLATE: { start: string; end: string; title: string; isBreak?: boolean }[] = [
  { start: '08:00', end: '10:00', title: 'دراسة وفهم' },
  { start: '10:00', end: '10:30', title: 'استراحة', isBreak: true },
  { start: '10:30', end: '12:30', title: 'نكمّل دراسة' },
  { start: '12:30', end: '14:00', title: 'غدا وراحة', isBreak: true },
  { start: '14:00', end: '16:00', title: 'حل أسئلة تدريبية' },
  { start: '16:00', end: '17:00', title: 'استراحة', isBreak: true },
  { start: '17:00', end: '19:00', title: 'أسئلة سنوات سابقة' },
  { start: '20:00', end: '21:00', title: 'مراجعة' },
]

export function buildTasksForDay(date: string, unitIds: string[]): PlannerTask[] {
  return SCHEDULE_TEMPLATE.map((t, i) => ({
    id: uid(),
    date,
    order: i,
    title: t.title,
    start: t.start,
    end: t.end,
    isBreak: t.isBreak,
    unitId: t.isBreak ? undefined : unitIds[0],
    done: false,
  }))
}

export function buildChecklist(): ChecklistItem[] {
  return [
    'راجعت ملخص كل وحدة',
    'حليت امتحان تجريبي لكل وحدة',
    'رجعت على كل أخطائي وصلحتها',
    'راجعت القوانين والتعريفات المهمة',
    'جهزت أغراض يوم الامتحان',
    'نمت منيح قبل الامتحان',
  ].map((text, i) => ({ id: uid(), order: i, text, done: false }))
}

/** The original nine-day plan (admin account). */
export async function seedFullPlan(db: MiloDB) {
  const { units, topics } = buildUnits()
  const days = buildDays()
  const tasks = days.flatMap((d) => buildTasksForDay(d.date, d.unitIds))
  await db.transaction('rw', [db.units, db.topics, db.days, db.tasks, db.checklist, db.kv], async () => {
    await db.units.bulkAdd(units)
    await db.topics.bulkAdd(topics)
    await db.days.bulkAdd(days)
    await db.tasks.bulkAdd(tasks)
    await db.checklist.bulkAdd(buildChecklist())
    await db.kv.put({ key: 'seeded', value: 'full' })
  })
}

/** New accounts start empty and build their own plan. */
export async function seedEmpty(db: MiloDB) {
  await db.transaction('rw', [db.checklist, db.kv], async () => {
    await db.checklist.bulkAdd(buildChecklist())
    await db.kv.put({ key: 'seeded', value: 'empty' })
  })
}
