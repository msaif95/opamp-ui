import { useState } from 'react'
import type { BuilderField, BuilderType, BuilderValue } from '../../api-client/client'
import { Select } from '../../components/Select'

/** One text line per entry: "value" for lists, "key=value" for maps. */
function LinesField({ field, value, onChange }: { field: BuilderField; value: BuilderValue | undefined; onChange: (v: BuilderValue) => void }) {
  const isMap = field.type === 'map'
  const initial = isMap
    ? Object.entries((value as Record<string, string>) ?? {})
        .map(([k, v]) => `${k}=${v}`)
        .join('\n')
    : ((value as string[]) ?? []).join('\n')
  // Kept as text while typing so half-typed lines are not thrown away.
  const [text, setText] = useState(initial)
  const update = (t: string) => {
    setText(t)
    const lines = t
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (!isMap) return onChange(lines)
    const map: Record<string, string> = {}
    for (const l of lines) {
      const i = l.indexOf('=')
      if (i > 0) map[l.slice(0, i).trim()] = l.slice(i + 1).trim()
    }
    onChange(map)
  }
  return (
    <textarea
      className="input h-20 w-full py-1.5 font-mono text-xs"
      value={text}
      onChange={(e) => update(e.target.value)}
      placeholder={isMap ? 'one key=value per line' : 'one per line'}
      spellCheck={false}
    />
  )
}

function FieldInput({ field, value, onChange }: { field: BuilderField; value: BuilderValue | undefined; onChange: (v: BuilderValue) => void }) {
  switch (field.type) {
    case 'bool':
      return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
    case 'enum':
      return (
        <Select className="w-56" value={String(value ?? '')} onChange={onChange} options={(field.options ?? []).map((o) => ({ value: o, label: o }))} />
      )
    case 'multi': {
      const chosen = (value as string[]) ?? []
      return (
        <div className="flex flex-wrap gap-1.5">
          {field.options?.map((o) => {
            const on = chosen.includes(o)
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                className={`chip ${on ? 'border-accent bg-accent-soft text-accent' : 'hover:bg-hover'}`}
                onClick={() => onChange(on ? chosen.filter((x) => x !== o) : [...chosen, o])}
              >
                {o}
              </button>
            )
          })}
        </div>
      )
    }
    case 'list':
    case 'map':
      return <LinesField field={field} value={value} onChange={onChange} />
    case 'int':
    case 'number':
      return (
        <input
          className="input w-40"
          type="number"
          min={0}
          step={field.type === 'int' ? 1 : 'any'}
          value={value === undefined ? '' : Number(value)}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
      )
    default:
      return <input className="input w-full max-w-md" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
  }
}

/** The settings form for one component, generated from its catalog type. */
export function ComponentForm({
  type,
  params,
  onChange,
}: {
  type: BuilderType
  params: Record<string, BuilderValue>
  onChange: (p: Record<string, BuilderValue>) => void
}) {
  if (type.fields.length === 0) return <p className="text-xs text-muted">Nothing to configure.</p>
  return (
    <div className="space-y-3">
      {type.fields.map((f) => (
        <label key={f.key} className="block space-y-1">
          <span className="block text-xs text-muted">
            {f.label}
            {f.required && <span className="text-danger"> *</span>}
          </span>
          <FieldInput field={f} value={params[f.key] ?? f.default} onChange={(v) => onChange({ ...params, [f.key]: v })} />
          {f.help && <span className="block text-xs text-faint">{f.help}</span>}
        </label>
      ))}
    </div>
  )
}
