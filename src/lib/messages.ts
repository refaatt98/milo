import type { MiloMood } from '../components/character/Milo'
import { localMinutes } from './time'

export interface MiloContext {
  todayMs: number
  goalMs: number
  yesterdayMs: number
  timerStatus?: 'running' | 'paused' | 'break'
  sessionMs: number
  pomodoro?: boolean
  sessionsToday: number
  phase: 'before' | 'study' | 'exam' | 'after'
  now: number
  unitsDone: number
}

export interface MiloLine {
  text: string
  mood: MiloMood
}

const pick = <T,>(arr: T[], seed: number) => arr[Math.abs(Math.floor(seed)) % arr.length]

/**
 * Every line is chosen from real recorded numbers — no celebrating
 * things that didn't happen.
 */
export function miloLine(c: MiloContext): MiloLine {
  const min = localMinutes(c.now)
  const slot = Math.floor(c.now / (1000 * 60 * 7)) // rotate gently every ~7 minutes

  if (c.timerStatus === 'break') return { mood: 'break', text: 'خلصت 50 دقيقة تركيز! عشر دقايق راحة إلك، اشرب شي ☕' }
  if (c.timerStatus === 'running') {
    if (!c.pomodoro && c.sessionMs >= 2 * 3600e3)
      return { mood: 'sleepy', text: 'صرلك ساعتين متواصل… خدلك استراحة صغيرة، بتستاهل.' }
    if (c.sessionMs < 60e3) return { mood: 'studying', text: 'يلا، فتحت الكتاب معك. ركّز وأنا جنبك 📖' }
    return {
      mood: 'focused',
      text: pick(['كل دقيقة بتفرق!', 'ماشي منيح، خليك مركّز.', 'شوي شوي بتخلص الدرس.', 'أنا ساكت عشان تركّز… 🤫'], slot),
    }
  }
  if (c.timerStatus === 'paused') return { mood: 'break', text: 'وقفنا شوي. خدلك نفس وارجع لما تكون جاهز.' }

  if (c.phase === 'after') return { mood: 'champion', text: 'خلص التحدي! تسع أيام… فخور فيك كثير.' }
  if (c.phase === 'before') return { mood: 'idle', text: 'التحدي قرّب يبلّش. جهّز دفاترك 🌱' }

  if (c.goalMs > 0 && c.todayMs >= c.goalMs) return { mood: 'happy', text: 'وصلت هدف اليوم كامل! إنت بطل، ارتاح بضمير مرتاح.' }
  const remaining = c.goalMs - c.todayMs
  if (c.todayMs > 0 && remaining <= 60 * 60e3) return { mood: 'happy', text: 'ضايل شوي وبتوصل لهدفك. كمّل!' }
  if (c.yesterdayMs > 0 && c.todayMs > c.yesterdayMs) return { mood: 'happy', text: 'اليوم أنجزت أكثر من مبارح! هيك الشغل.' }

  // Expected progress assumes a 08:00–21:00 study day.
  const expected = c.goalMs * Math.min(1, Math.max(0, (min - 8 * 60) / (13 * 60)))
  if (expected > 90 * 60e3 && c.todayMs < expected * 0.5)
    return {
      mood: 'encouraging',
      text: pick(['ولا يهمك، لسا في وقت. يلا نبدأ بجلسة صغيرة؟', 'حتى 25 دقيقة هلأ بتفرق. أنا معك.', 'مش لازم تكون مثالي، بس ابدأ.'], slot),
    }
  if (c.todayMs === 0) {
    if (min < 12 * 60) return { mood: 'idle', text: 'صباح الخير! يلا نبلّش؟ 🌱' }
    if (min < 18 * 60) return { mood: 'encouraging', text: 'يلا نبلّش؟ أول جلسة هي الأصعب.' }
    return { mood: 'encouraging', text: 'لسا في وقت لجلسة مراجعة خفيفة قبل النوم.' }
  }
  if (c.sessionsToday >= 3) return { mood: 'happy', text: `${c.sessionsToday} جلسات اليوم! إيقاعك حلو.` }
  return { mood: 'idle', text: pick(['شغلك ماشي، كمّل على نفس الإيقاع.', 'جاهز للجلسة الجاي؟', 'كل دقيقة بتفرق!'], slot) }
}
