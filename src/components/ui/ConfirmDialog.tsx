import type { ReactNode } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            icon={destructive ? <Trash2 size={14} /> : undefined}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: 'var(--radius)',
            display: 'grid',
            placeItems: 'center',
            background: destructive ? 'var(--danger-bg)' : 'var(--warning-bg)',
            color: destructive ? 'var(--danger)' : 'var(--warning)',
          }}
        >
          <AlertTriangle size={16} />
        </span>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6, paddingTop: 4 }}>
          {message}
        </div>
      </div>
    </Modal>
  )
}