import * as Toast from '@radix-ui/react-toast'
import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { currentToasts, dismissToast, subscribeToasts, type ToastMessage } from '../lib/toast'

const look: Record<ToastMessage['tone'], { icon: typeof Info; color: string }> = {
  info: { icon: Info, color: 'text-accent' },
  success: { icon: CheckCircle2, color: 'text-success' },
  warning: { icon: AlertTriangle, color: 'text-warning' },
  danger: { icon: XCircle, color: 'text-danger' },
}

/** Renders the notifications raised with toast(). Mount once, at the root. */
export function ToastHost() {
  const toasts = useSyncExternalStore(subscribeToasts, currentToasts)
  return (
    <Toast.Provider swipeDirection="right" label="Notification">
      {toasts.map((t) => {
        const { icon: Icon, color } = look[t.tone]
        return (
          <Toast.Root
            key={t.id}
            // Problems are announced at once and stay longer; routine news waits its turn.
            type={t.tone === 'danger' || t.tone === 'warning' ? 'foreground' : 'background'}
            duration={t.tone === 'danger' || t.tone === 'warning' ? 12_000 : 7000}
            onOpenChange={(open) => !open && dismissToast(t.id)}
            className="flex items-start gap-3 rounded-lg border border-border bg-panel p-3 shadow-lg"
          >
            <Icon size={16} className={clsx('mt-0.5 shrink-0', color)} aria-hidden />
            <div className="min-w-0 flex-1">
              <Toast.Title className="font-medium">{t.title}</Toast.Title>
              {t.body && <Toast.Description className="mt-0.5 break-words text-xs text-muted">{t.body}</Toast.Description>}
              {t.to && (
                <Toast.Action altText="Open the related page" asChild>
                  <Link to={t.to} className="mt-1 inline-block text-xs font-medium text-accent hover:underline" onClick={() => dismissToast(t.id)}>
                    View
                  </Link>
                </Toast.Action>
              )}
            </div>
            <Toast.Close className="btn btn-ghost btn-sm shrink-0" aria-label="Dismiss">
              <X size={13} />
            </Toast.Close>
          </Toast.Root>
        )
      })}
      <Toast.Viewport className="fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 outline-none" />
    </Toast.Provider>
  )
}
