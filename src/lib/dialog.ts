// Confirmations and prompts, requested from anywhere and rendered by <DialogHost /> (components/Dialogs.tsx).

export interface ConfirmOptions {
  title: string
  /** Consequences, in a sentence or two. */
  body?: string
  /** Label of the confirming button. */
  action?: string
  /** Style the confirming button as destructive. */
  danger?: boolean
}

interface PromptOptions {
  title: string
  label: string
  placeholder?: string
  action?: string
}

export type DialogRequest =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void }

// One dialog at a time, requested from anywhere and rendered by <DialogHost /> at the root of the app.
let current: DialogRequest | null = null
export const currentDialog = () => current
const listeners = new Set<() => void>()
export const subscribeDialog = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export function showDialog(request: DialogRequest | null) {
  current = request
  listeners.forEach((fn) => fn())
}

const DESTRUCTIVE = /^(delete|revoke|remove|abort|roll back|stop|switch off|move)\b/i

/** Splits "Delete group x? Past pushes keep their record." into a title and the consequences. */
function fromMessage(message: string): ConfirmOptions {
  const cut = message.indexOf('?')
  const title = cut === -1 ? message : message.slice(0, cut + 1)
  const body = cut === -1 ? '' : message.slice(cut + 1).trim()
  const verb = title.match(/^(switch off|roll back|[A-Za-z]+)/i)?.[0] ?? 'Confirm'
  return { title, body: body || undefined, action: verb.charAt(0).toUpperCase() + verb.slice(1), danger: DESTRUCTIVE.test(title) }
}

/**
 * Asks the user to confirm an action and resolves to their answer. Accepts a full description, or a plain
 * message of the form "Question? Consequences." from which the title, button label and styling are derived.
 */
export function confirmDialog(options: ConfirmOptions | string): Promise<boolean> {
  return new Promise((resolve) => {
    // A second request while one is open replaces it; the first is answered "no".
    if (current?.kind === 'confirm') current.resolve(false)
    if (current?.kind === 'prompt') current.resolve(null)
    showDialog({ kind: 'confirm', options: typeof options === 'string' ? fromMessage(options) : options, resolve })
  })
}

/** Asks for one line of text; resolves to null if cancelled. */
export function promptDialog(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    if (current?.kind === 'confirm') current.resolve(false)
    if (current?.kind === 'prompt') current.resolve(null)
    showDialog({ kind: 'prompt', options, resolve })
  })
}
