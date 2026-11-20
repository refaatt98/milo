import { Sheet } from './Sheet'
import { Button } from './Button'
import Milo from '../character/Milo'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function Confirm({ open, title, message, confirmLabel = 'أكيد', onConfirm, onCancel }: Props) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <div className="flex items-center gap-4">
        <Milo mood="encouraging" size={84} still />
        <p className="text-ink-soft">{message}</p>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="ghost" onClick={onCancel}>لا، رجّعني</Button>
        <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Sheet>
  )
}
