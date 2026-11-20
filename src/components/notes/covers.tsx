import type { CSSProperties } from 'react'
import { Lock } from 'lucide-react'

export interface CoverDef {
  id: string
  label: string
  style: CSSProperties
  ink: string
}

export const COVERS: CoverDef[] = [
  { id: 'sage-dots', label: 'نقاط خضرا', ink: '#27372F', style: { backgroundColor: '#B9D5AE', backgroundImage: 'radial-gradient(#6F9876 2px, transparent 2.5px)', backgroundSize: '18px 18px' } },
  { id: 'butter-stripes', label: 'خطوط زبدية', ink: '#27372F', style: { backgroundColor: '#F9E9A7', backgroundImage: 'repeating-linear-gradient(90deg, rgba(226,199,102,.55) 0 10px, transparent 10px 22px)' } },
  { id: 'peach-waves', label: 'موج خوخي', ink: '#27372F', style: { backgroundColor: '#F8D9C6', backgroundImage: 'radial-gradient(circle at 50% 120%, transparent 12px, rgba(233,156,130,.45) 13px 16px, transparent 17px)', backgroundSize: '28px 18px' } },
  { id: 'lavender-grid', label: 'شبكة بنفسجية', ink: '#27372F', style: { backgroundColor: '#EAE3F6', backgroundImage: 'linear-gradient(rgba(150,128,200,.35) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(150,128,200,.35) 1.5px, transparent 1.5px)', backgroundSize: '20px 20px' } },
  { id: 'sky-check', label: 'كاروهات سماوية', ink: '#27372F', style: { backgroundColor: '#DCEEF4', backgroundImage: 'linear-gradient(45deg, rgba(120,180,200,.3) 25%, transparent 25% 75%, rgba(120,180,200,.3) 75%), linear-gradient(45deg, rgba(120,180,200,.3) 25%, transparent 25% 75%, rgba(120,180,200,.3) 75%)', backgroundSize: '24px 24px', backgroundPosition: '0 0, 12px 12px' } },
  { id: 'forest', label: 'غابة', ink: '#FAF9F6', style: { backgroundColor: '#3E5E4B', backgroundImage: 'radial-gradient(ellipse 6px 12px at 50% 50%, rgba(185,213,174,.45) 98%, transparent), radial-gradient(ellipse 6px 12px at 50% 50%, rgba(185,213,174,.25) 98%, transparent)', backgroundSize: '30px 30px, 30px 30px', backgroundPosition: '0 0, 15px 15px' } },
  { id: 'ink-stars', label: 'ليل ونجوم', ink: '#F9E9A7', style: { backgroundColor: '#27372F', backgroundImage: 'radial-gradient(#F9E9A7 1.2px, transparent 1.6px), radial-gradient(rgba(249,233,167,.5) 1px, transparent 1.4px)', backgroundSize: '34px 34px, 21px 21px', backgroundPosition: '0 0, 9px 13px' } },
  { id: 'rose', label: 'ورد', ink: '#27372F', style: { backgroundColor: '#FBE3EA', backgroundImage: 'radial-gradient(circle, #F4A6B7 3px, transparent 3.5px), radial-gradient(circle, #FFF 1.5px, transparent 2px)', backgroundSize: '26px 26px, 26px 26px', backgroundPosition: '0 0, 0 0' } },
  { id: 'kraft', label: 'ورق كرافت', ink: '#3B2F22', style: { backgroundColor: '#D8BE97', backgroundImage: 'repeating-linear-gradient(0deg, rgba(120,90,50,.08) 0 2px, transparent 2px 5px)' } },
  { id: 'cream', label: 'كريمي سادة', ink: '#27372F', style: { backgroundColor: '#FBF6E9' } },
]
export const coverDef = (id: string) => COVERS.find((c) => c.id === id) ?? COVERS[0]

/** A little hardcover notebook: spine, elastic band and a title label. */
export function NotebookCover({ cover, title, locked, size = 150, pages }: { cover: string; title: string; locked?: boolean; size?: number; pages?: number }) {
  const c = coverDef(cover)
  return (
    <div className="relative" style={{ width: size, height: size * 1.3 }}>
      {/* page edges */}
      <div className="absolute inset-y-1.5 -left-1 right-2 rounded-[10px] border-[1.5px] border-ink bg-white" />
      <div
        className="absolute inset-0 overflow-hidden rounded-[6px_14px_14px_6px] border-[1.5px] border-ink shadow-[3px_4px_0_rgba(39,55,47,.85)]"
        style={c.style}
      >
        {/* spine */}
        <div className="absolute inset-y-0 right-0 w-[11%] border-l-[1.5px] border-ink/60 bg-black/10" />
        {/* elastic */}
        <div className="absolute inset-y-0 left-[16%] w-[5%] bg-ink/80" />
        {/* label */}
        <div className="absolute inset-x-[22%] top-[22%] rounded-md border-[1.5px] border-ink bg-white px-1.5 py-1 text-center shadow-sm" style={{ rotate: '-1.5deg' }}>
          <p className="line-clamp-2 font-display text-[0.8rem] font-bold leading-tight text-ink" style={{ fontSize: Math.max(10, size / 13) }}>
            {title || 'دفتر بدون اسم'}
          </p>
        </div>
        {locked && (
          <div className="absolute bottom-[10%] left-1/2 grid size-8 -translate-x-1/2 place-items-center rounded-full border-[1.5px] border-ink bg-butter">
            <Lock size={15} />
          </div>
        )}
        {pages != null && (
          <span className="absolute bottom-2 right-[15%] rounded-full bg-white/85 px-1.5 text-[0.65rem] font-semibold text-ink">{pages} ص</span>
        )}
      </div>
    </div>
  )
}
