import { KeyRound, Loader2, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { useCelebrate } from '../components/ui/Celebration'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { formatDuration } from '../lib/time'

interface Row {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
  ui_mode: string
  created_at: string
  last_seen_at: string
  last_sign_in_at: string | null
  study_ms: number
  sessions: number
  topics_done: number
  topics_total: number
  notebooks: number
  pages: number
}

const fmt = new Intl.DateTimeFormat('ar', { timeZone: 'Asia/Hebron', dateStyle: 'medium', timeStyle: 'short', numberingSystem: 'latn' })
const when = (s?: string | null) => (s ? fmt.format(new Date(s)) : '—')

export default function AdminPage() {
  const { isAdmin, status } = useAuth()
  const celebrate = useCelebrate()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Row | null>(null)
  const [sending, setSending] = useState(false)

  const load = async () => {
    setError(null)
    const { data, error } = await supabase.rpc('admin_users')
    if (error) setError('ما قدرنا نجيب المستخدمين. تأكد من الإنترنت.')
    else setRows(data as Row[])
  }
  useEffect(() => {
    if (isAdmin) void load()
  }, [isAdmin])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (rows ?? []).filter((r) => !s || r.email.toLowerCase().includes(s) || r.name.toLowerCase().includes(s))
  }, [rows, q])

  if (status === 'ready' && !isAdmin) return <Navigate to="/" replace />

  const totals = {
    users: rows?.length ?? 0,
    active7: rows?.filter((r) => Date.now() - new Date(r.last_seen_at).getTime() < 7 * 86400e3).length ?? 0,
    hours: (rows ?? []).reduce((a, r) => a + Number(r.study_ms), 0),
    notebooks: (rows ?? []).reduce((a, r) => a + r.notebooks, 0),
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="للإدارة فقط" title="لوحة الإدارة" art={<ShieldCheck size={56} className="text-sage" />}>
        كل المستخدمين المسجّلين بـ MiloNote ونشاطهم الحقيقي.
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="المستخدمين" value={String(totals.users)} />
        <Tile label="نشطين آخر 7 أيام" value={String(totals.active7)} />
        <Tile label="ساعات دراسة (الكل)" value={(totals.hours / 3600e3).toFixed(1)} />
        <Tile label="دفاتر" value={String(totals.notebooks)} />
      </div>

      <div className="flex gap-2">
        <label className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-ink-faint" />
          <input className="field ps-10" placeholder="دوّر بالاسم أو الإيميل…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث" />
        </label>
        <Button variant="ghost" onClick={load} icon={<RefreshCw size={18} />} aria-label="تحديث">
          <span className="hidden sm:inline">تحديث</span>
        </Button>
      </div>

      {error && <p className="rounded-2xl bg-peach px-3 py-2 text-sm">{error}</p>}
      {!rows && !error && (
        <div className="grid place-items-center py-16 text-ink-soft">
          <Loader2 className="animate-spin" />
        </div>
      )}

      {rows && (
        <div className="sheet overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-paper text-start text-xs text-ink-soft">
                <tr>
                  <th className="px-4 py-3 text-start font-semibold">المستخدم</th>
                  <th className="px-3 py-3 text-start font-semibold">الإيميل</th>
                  <th className="px-3 py-3 text-start font-semibold">ساعات الدراسة</th>
                  <th className="px-3 py-3 text-start font-semibold">الدروس</th>
                  <th className="px-3 py-3 text-start font-semibold">الدفاتر</th>
                  <th className="px-3 py-3 text-start font-semibold">آخر نشاط</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((r) => (
                  <tr key={r.id} onClick={() => setSel(r)} className="cursor-pointer hover:bg-paper">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 font-semibold">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-mint text-xs font-bold">{(r.name || r.email)[0]?.toUpperCase()}</span>
                        {r.name || '—'}
                        {r.role === 'admin' && <span className="rounded-full bg-ink px-2 py-0.5 text-[0.65rem] text-white">أدمن</span>}
                      </span>
                    </td>
                    <td className="px-3 py-3" dir="ltr">{r.email}</td>
                    <td className="num px-3 py-3">{(Number(r.study_ms) / 3600e3).toFixed(1)}</td>
                    <td className="num px-3 py-3">{r.topics_done}/{r.topics_total}</td>
                    <td className="num px-3 py-3">{r.notebooks}</td>
                    <td className="px-3 py-3 text-xs text-ink-soft">{when(r.last_seen_at)}</td>
                  </tr>
                ))}
                {!list.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-ink-soft">
                      <Users className="mx-auto mb-2" /> ما في نتائج.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="rounded-2xl bg-sky/60 px-4 py-3 text-sm">
        🔒 كلمات السر مش ظاهرة هون لأنها بتنحفظ <strong>مشفّرة باتجاه واحد</strong> (hash) — ما حدا بقدر يقرأها، ولا حتى الإدارة. إذا مستخدم نسي كلمة السر، ابعتله رابط تغيير من صفحته.
      </p>

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.name || sel?.email}>
        {sel && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <Info k="الإيميل" v={<span dir="ltr">{sel.email}</span>} />
              <Info k="الدور" v={sel.role === 'admin' ? 'أدمن' : 'مستخدم'} />
              <Info k="انضم" v={when(sel.created_at)} />
              <Info k="آخر دخول" v={when(sel.last_sign_in_at)} />
              <Info k="وقت الدراسة" v={formatDuration(Number(sel.study_ms))} />
              <Info k="الجلسات" v={String(sel.sessions)} />
              <Info k="الدروس المنجزة" v={`${sel.topics_done}/${sel.topics_total}`} />
              <Info k="الدفاتر / الصفحات" v={`${sel.notebooks} / ${sel.pages}`} />
              <Info k="الشكل" v={sel.ui_mode === 'serious' ? 'جدّي' : 'مرح'} />
              <Info k="المعرّف" v={<span className="break-all text-[0.7rem]" dir="ltr">{sel.id}</span>} />
            </dl>
            <Button
              className="w-full"
              variant="ghost"
              disabled={sending}
              icon={sending ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
              onClick={async () => {
                setSending(true)
                const { error } = await supabase.auth.resetPasswordForEmail(sel.email, { redirectTo: `${location.origin}/settings` })
                setSending(false)
                celebrate(error ? { size: 'small', mood: 'encouraging', title: 'ما انبعت الرابط', message: 'جرّب بعد شوي.' } : { size: 'small', mood: 'happy', title: 'انبعت رابط تغيير كلمة السر', message: sel.email })
              }}
            >
              ابعت رابط تغيير كلمة السر
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="sheet p-4">
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <p className="num mt-1 text-3xl font-bold leading-none">{value}</p>
    </div>
  )
}

function Info({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-line">
      <dt className="text-xs text-ink-soft">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  )
}
