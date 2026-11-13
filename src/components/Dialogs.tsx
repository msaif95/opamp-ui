import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as Dialog from '@radix-ui/react-dialog'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { currentDialog, showDialog, subscribeDialog, type DialogRequest } from '../lib/dialog'

const overlay = 'fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]'
const panel =
  'fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-panel p-5 shadow-xl focus:outline-none'

function PromptForm({ request }: { request: Extract<DialogRequest, { kind: 'prompt' }> }) {
  const [value, setValue] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    request.resolve(value.trim())
    showDialog(null)
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Dialog.Title className="text-base font-semibold">{request.options.title}</Dialog.Title>
      <label className="block space-y-1">
        <span className="block text-xs text-muted">{request.options.label}</span>
        <input className="input w-full" value={value} onChange={(e) => setValue(e.target.value)} placeholder={request.options.placeholder} autoFocus />
      </label>
      <div className="flex justify-end gap-2">
        <Dialog.Close asChild>
          <button type="button" className="btn">
            Cancel
          </button>
        </Dialog.Close>
        <button className="btn btn-primary" disabled={!value.trim()}>
          {request.options.action ?? 'Save'}
        </button>
      </div>
    </form>
  )
}

/** Renders whichever confirmation or prompt is currently requested. Mount once, at the root. */
export function DialogHost() {
  const request = useSyncExternalStore(subscribeDialog, currentDialog)
  // Leaving the page with a dialog open must not leave its promise hanging.
  useEffect(
    () => () => {
      const open = currentDialog()
      if (open?.kind === 'confirm') open.resolve(false)
      else open?.resolve(null)
    },
    [],
  )

  if (request?.kind === 'prompt') {
    const cancel = () => {
      request.resolve(null)
      showDialog(null)
    }
    return (
      <Dialog.Root open onOpenChange={(open) => !open && cancel()}>
        <Dialog.Portal>
          <Dialog.Overlay className={overlay} />
          <Dialog.Content className={panel} aria-describedby={undefined}>
            <PromptForm request={request} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }

  const answer = (ok: boolean) => {
    if (request?.kind === 'confirm') request.resolve(ok)
    showDialog(null)
  }
  const o = request?.kind === 'confirm' ? request.options : null
  return (
    <AlertDialog.Root open={o !== null} onOpenChange={(open) => !open && answer(false)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlay} />
        <AlertDialog.Content className={panel}>
          <AlertDialog.Title className="text-base font-semibold">{o?.title}</AlertDialog.Title>
          {o?.body ? (
            <AlertDialog.Description className="mt-2 text-muted">{o.body}</AlertDialog.Description>
          ) : (
            <AlertDialog.Description className="sr-only">Confirm or cancel.</AlertDialog.Description>
          )}
          <div className="mt-5 flex justify-end gap-2">
            {/* Cancel takes focus first, so Enter on a destructive dialog does not confirm it by accident. */}
            <AlertDialog.Cancel asChild>
              <button className="btn">Cancel</button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button className={clsx('btn', o?.danger ? 'btn-danger' : 'btn-primary')} onClick={() => answer(true)}>
                {o?.action ?? 'Confirm'}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

/** A modal for a small form. Closes on Escape, on the overlay, and with its close button. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlay} />
        <Dialog.Content className={panel} aria-describedby={undefined}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
              {description && <p className="mt-1 text-xs text-muted">{description}</p>}
            </div>
            <Dialog.Close asChild>
              <button className="btn btn-ghost btn-sm" aria-label="Close">
                <X size={14} />
              </button>
            </Dialog.Close>
          </div>
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
