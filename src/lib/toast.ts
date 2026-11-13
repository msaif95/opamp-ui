// In-app notifications, raised from anywhere and rendered by <ToastHost /> (components/Toasts.tsx).

export interface ToastMessage {
  id: number
  title: string
  body?: string
  tone: 'info' | 'success' | 'warning' | 'danger'
  /** Where "View" takes the user. */
  to?: string
}

let toasts: ToastMessage[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())

export const subscribeToasts = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export const currentToasts = () => toasts

/** Shows a notification. At most five are kept on screen; older ones give way. */
export function toast(message: Omit<ToastMessage, 'id'>) {
  toasts = [...toasts, { ...message, id: nextId++ }].slice(-5)
  emit()
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}
