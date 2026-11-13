import * as RadixSelect from '@radix-ui/react-select'
import clsx from 'clsx'
import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

export interface Option {
  value: string
  label: ReactNode
  /** Secondary text shown under the label in the list. */
  hint?: string
  /** Options with the same group are listed together under this heading. */
  group?: string
  disabled?: boolean
}

// Radix reserves the empty string for "nothing selected", but several of our lists have a real empty choice
// ("All projects", "No project"). Those are stored under this stand-in and translated at the edges.
const EMPTY = '__empty__'
const toRadix = (v: string) => (v === '' ? EMPTY : v)
const fromRadix = (v: string) => (v === EMPTY ? '' : v)

function Item({ option }: { option: Option }) {
  return (
    <RadixSelect.Item
      value={toRadix(option.value)}
      disabled={option.disabled}
      className="relative flex cursor-default select-none items-start rounded py-1.5 pl-7 pr-3 text-[13px] outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-accent-soft data-[highlighted]:text-accent"
    >
      <RadixSelect.ItemIndicator className="absolute left-2 top-2">
        <Check size={13} />
      </RadixSelect.ItemIndicator>
      <div className="min-w-0">
        <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
        {option.hint && <div className="text-xs text-muted">{option.hint}</div>}
      </div>
    </RadixSelect.Item>
  )
}

/**
 * Dropdown used everywhere in place of the browser's <select>: keyboard navigation and type-ahead, proper focus
 * handling and screen-reader roles, and a list that follows the console theme in light and dark mode.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className,
  disabled,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
  disabled?: boolean
  'aria-label'?: string
}) {
  const known = options.some((o) => o.value === value)
  const groups = [...new Set(options.map((o) => o.group))]
  return (
    // An unknown value (nothing chosen yet) shows the placeholder.
    <RadixSelect.Root value={known ? toRadix(value) : ''} onValueChange={(v) => onChange(fromRadix(v))} disabled={disabled}>
      <RadixSelect.Trigger
        aria-label={ariaLabel}
        className={clsx('input inline-flex items-center justify-between gap-2 text-left data-[placeholder]:text-faint', className)}
      >
        <span className="min-w-0 truncate">
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon className="shrink-0 text-muted">
          <ChevronDown size={14} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-[min(22rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-panel shadow-lg"
        >
          <RadixSelect.Viewport className="p-1">
            {options.length === 0 && <div className="px-3 py-2 text-xs text-muted">Nothing to choose from</div>}
            {groups.map((group, i) => (
              <RadixSelect.Group key={group ?? ''}>
                {group && (
                  <RadixSelect.Label className={clsx('px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-faint', i > 0 ? 'pt-2' : 'pt-1')}>
                    {group}
                  </RadixSelect.Label>
                )}
                {options
                  .filter((o) => o.group === group)
                  .map((o) => (
                    <Item key={o.value} option={o} />
                  ))}
              </RadixSelect.Group>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}
