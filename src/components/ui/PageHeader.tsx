import type { ReactNode } from 'react'

export function PageHeader({ eyebrow, title, children, art }: { eyebrow?: string; title: ReactNode; children?: ReactNode; art?: ReactNode }) {
  return (
    <header className="relative mb-6 flex items-end justify-between gap-4 pt-2">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-sm font-semibold text-sage">{eyebrow}</p>}
        <h1 className="text-[2rem] font-extrabold leading-tight sm:text-[2.4rem]">{title}</h1>
        {children && <div className="mt-2 max-w-xl text-ink-soft">{children}</div>}
      </div>
      {art && <div className="shrink-0">{art}</div>}
    </header>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-xl font-bold">{children}</h2>
      {action}
    </div>
  )
}
