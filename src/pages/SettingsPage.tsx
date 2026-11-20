import { Download, Upload, RotateCcw, ShieldAlert } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import Milo from '../components/character/Milo'
import { PageHeader, SectionTitle } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Confirm } from '../components/ui/Confirm'
import { useCelebrate } from '../components/ui/Celebration'
import { useSettings } from '../hooks/useData'
import { db, saveSettings } from '../lib/db'
import { downloadBackup, importData, resetAll } from '../lib/backup'
import { formatClock, formatDayShort, dayKey, TZ } from '../lib/time'

export default function SettingsPage() {
  const settings = useSettings()
  const celebrate = useCelebrate()
  const file = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const lastBackup = useLiveQuery(() => db.kv.get('last-backup'), [])
  const counts = useLiveQuery(async () => ({ sessions: await db.sessions.count(), tasks: await db.tasks.count(), topics: await db.topics.count() }), [])

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="ترتيبات صغيرة" title="الإعدادات" art={<Milo mood="idle" size={92} />} />

      <section className="sheet space-y-5 p-5">
        <SectionTitle>الهدف والمؤقت</SectionTitle>
        <label className="block">
          <span className="mb-1 flex justify-between text-sm font-semibold">
            <span>هدف الدراسة اليومي</span>
            <span className="num">{settings.dailyGoalHours} ساعات</span>
          </span>
          <input
            type="range"
            min={1}
            max={14}
            step={0.5}
            value={settings.dailyGoalHours}
            onChange={(e) => saveSettings({ dailyGoalHours: Number(e.target.value) })}
            className="w-full accent-[#6F9876]"
          />
        </label>
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span>
            <span className="block font-semibold">بومودورو 50/10 افتراضيًا</span>
            <span className="text-xs text-ink-soft">كل جلسة جديدة بتبلّش بوضع البومودورو</span>
          </span>
          <input type="checkbox" className="size-6 accent-[#6F9876]" checked={settings.pomodoroDefault} onChange={(e) => saveSettings({ pomodoroDefault: e.target.checked })} />
        </label>
        <p className="rounded-2xl bg-sky/60 px-3 py-2 text-sm">
          كل الأيام والحسابات بتوقيت فلسطين ({TZ}). هلأ عندك: <span className="num font-bold">{formatDayShort(dayKey())} · {formatClock(Date.now())}</span>
        </p>
      </section>

      <section className="sheet space-y-4 p-5">
        <SectionTitle>النسخ الاحتياطي</SectionTitle>
        <p className="text-sm text-ink-soft">
          بياناتك محفوظة بس على هاد الجهاز وهاد المتصفح (IndexedDB). <strong className="text-ink">ما في مزامنة تلقائية بين الأجهزة.</strong> إذا بدك تنقلها لجهاز ثاني أو تحميها، نزّل نسخة JSON واستوردها هناك.
        </p>
        {counts && (
          <p className="text-sm">
            محفوظ هلأ: <span className="num font-bold">{counts.sessions}</span> جلسة · <span className="num font-bold">{counts.topics}</span> درس · <span className="num font-bold">{counts.tasks}</span> مهمة
          </p>
        )}
        <p className="text-xs text-ink-faint">
          آخر نسخة: {lastBackup ? `${formatDayShort(dayKey(lastBackup.value as number))} ${formatClock(lastBackup.value as number)}` : 'ولا مرة لسا'}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            icon={<Download size={18} />}
            onClick={async () => {
              await downloadBackup()
              celebrate({ size: 'small', mood: 'happy', title: 'نزلت النسخة الاحتياطية', message: 'خبّيها بمكان آمن 📦' })
            }}
          >
            نزّل نسخة (JSON)
          </Button>
          <Button variant="ghost" icon={<Upload size={18} />} onClick={() => file.current?.click()}>
            استورد نسخة
          </Button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              setError(null)
              setPending(await f.text())
            }}
          />
        </div>
        {error && (
          <p className="flex items-center gap-2 rounded-2xl bg-peach px-3 py-2 text-sm" role="alert">
            <ShieldAlert size={18} /> {error}
          </p>
        )}
      </section>

      <section className="sheet space-y-3 p-5">
        <SectionTitle>البداية من جديد</SectionTitle>
        <p className="text-sm text-ink-soft">بيمسح كل الجلسات والمهام والعلامات وبيرجّع الجدول الأصلي. نزّل نسخة احتياطية قبل.</p>
        <Button variant="danger" icon={<RotateCcw size={18} />} onClick={() => setConfirmReset(true)}>
          امسح كل البيانات
        </Button>
      </section>

      <p className="pb-4 text-center text-xs text-ink-faint">
        <span className="font-num italic">milo.</span> — يعمل بدون تسجيل دخول وبدون إنترنت بعد أول تحميل.
      </p>

      <Confirm
        open={!!pending}
        title="نستبدل البيانات؟"
        message="الاستيراد رح يستبدل كل البيانات الموجودة على هاد الجهاز بمحتوى الملف."
        confirmLabel="استورد"
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          const text = pending!
          setPending(null)
          try {
            await importData(text)
            celebrate({ size: 'small', mood: 'happy', title: 'رجعت بياناتك ✓', message: 'الاستيراد تم بنجاح' })
          } catch (err) {
            setError((err as Error).message)
          }
        }}
      />
      <Confirm
        open={confirmReset}
        title="متأكد تمسح كل شي؟"
        message="هاي الخطوة ما بترجع. كل الجلسات والتقدم رح يروحوا."
        confirmLabel="امسح"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => resetAll()}
      />
    </div>
  )
}
