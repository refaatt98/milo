import { Minus, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { asciiDigits, parseNum } from '../../lib/num'

interface Props {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  label: string
  /** show −/+ buttons */
  stepper?: boolean
  className?: string
}

/** Integer field that accepts Arabic-Indic digits (٦) as well as 6. */
export function NumberField({ value, onChange, min = 0, max = 999, label, stepper = false, className = '' }: Props) {
  const [text, setText] = useState(String(value))
  useEffect(() => {
    if (parseNum(text) !== value) setText(String(value))
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)))
  const input = (
    <input
      type="text"
      inputMode="numeric"
      dir="ltr"
      aria-label={label}
      className={`field num text-center ${stepper ? 'w-16 px-1' : ''} ${className}`}
      value={text}
      onChange={(e) => {
        const t = asciiDigits(e.target.value).replace(/[^\d]/g, '').slice(0, 4)
        setText(t)
        const n = parseNum(t)
        if (!Number.isNaN(n)) onChange(clamp(n))
      }}
      onBlur={() => setText(String(clamp(Number.isNaN(parseNum(text)) ? min : parseNum(text))))}
    />
  )
  if (!stepper) return input
  return (
    <div className="flex items-center gap-1" dir="ltr">
      <button type="button" aria-label={`${label}: أقل`} disabled={value <= min} onClick={() => onChange(clamp(value - 1))} className="btn-press grid size-10 place-items-center rounded-xl bg-white ring-1 ring-line disabled:opacity-40">
        <Minus size={16} />
      </button>
      {input}
      <button type="button" aria-label={`${label}: أكثر`} disabled={value >= max} onClick={() => onChange(clamp(value + 1))} className="btn-press grid size-10 place-items-center rounded-xl bg-white ring-1 ring-line disabled:opacity-40">
        <Plus size={16} />
      </button>
    </div>
  )
}
