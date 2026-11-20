import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'soft' | 'ghost' | 'danger' | 'butter'

const styles: Record<Variant, string> = {
  primary: 'bg-sage text-white shadow-[0_3px_0_#557c5d] hover:bg-sage-deep active:shadow-[0_1px_0_#557c5d]',
  soft: 'bg-mint text-ink hover:bg-[#d7e6cc]',
  ghost: 'bg-white text-ink ring-1 ring-line hover:bg-paper',
  danger: 'bg-peach text-[#8a3b22] hover:bg-[#f4c9b0]',
  butter: 'bg-butter text-ink shadow-[0_3px_0_#e2cf7f] hover:bg-[#f5e08f]',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  icon?: ReactNode
  size?: 'md' | 'lg' | 'sm'
}

export function Button({ variant = 'primary', icon, size = 'md', className = '', children, ...rest }: Props) {
  const sz = size === 'lg' ? 'min-h-14 px-6 text-lg' : size === 'sm' ? 'min-h-9 px-3 text-sm' : 'min-h-12 px-5'
  return (
    <button
      {...rest}
      className={`btn-press inline-flex items-center justify-center gap-2 rounded-2xl font-semibold disabled:pointer-events-none disabled:opacity-45 ${sz} ${styles[variant]} ${className}`}
    >
      {icon}
      {children}
    </button>
  )
}
