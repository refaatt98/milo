import { db } from './db'
import type { CelebrationEvent } from '../components/ui/Celebration'
import { unitProgress, isDayComplete } from './stats'

/** Toggle a topic and celebrate real milestones (unit finished, challenge finished). */
export async function toggleTopic(topicId: string, done: boolean, celebrate: (e: CelebrationEvent) => void) {
  const topic = await db.topics.get(topicId)
  if (!topic) return
  await db.topics.update(topicId, { done, completedAt: done ? Date.now() : undefined })
  if (!done) return
  const unit = await db.units.get(topic.unitId)
  if (!unit) return
  const topics = await db.topics.where('unitId').equals(unit.id).toArray()
  const p = unitProgress(unit, topics)
  if (p.percent >= 100) {
    celebrate({ size: 'big', mood: 'excited', title: `هيك الشغل! خلصت ${unit.name} كاملة.`, message: 'نبتتها بالجنينة فتّحت 🌷' })
    await checkChallenge(celebrate)
  } else {
    celebrate({ size: 'small', mood: 'happy', title: 'درس كمان خلص ✓', message: `${unit.name}: ${p.done}/${p.total} · نبتتك كبرت شوي` })
  }
}

export async function checkChallenge(celebrate: (e: CelebrationEvent) => void) {
  const [days, units, topics] = await Promise.all([db.days.toArray(), db.units.toArray(), db.topics.toArray()])
  const map = new Map(units.map((u) => [u.id, unitProgress(u, topics)]))
  if (days.length && days.every((d) => isDayComplete(d, map))) {
    const flag = await db.kv.get('challenge-celebrated')
    if (flag) return
    await db.kv.put({ key: 'challenge-celebrated', value: Date.now() })
    setTimeout(
      () => celebrate({ size: 'big', mood: 'champion', title: 'خلّصت التحدي كامل! 🏆', message: 'تسع أيام، كل محطة على الخريطة صارت إلك.' }),
      5400,
    )
  }
}
