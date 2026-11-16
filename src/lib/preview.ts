export interface AttributeChange {
  /** Where the attribute lives: on the resource, or on the record itself. */
  scope: 'resource' | 'record'
  key: string
  kind: 'added' | 'removed' | 'changed' | 'same'
  before?: string
  after?: string
}

interface Snapshot {
  resource: Record<string, string>
  attributes: Record<string, string>
}

const ORDER = { removed: 0, changed: 1, added: 2, same: 3 }

/** How a record's attributes differ between the two ends of a pipeline: changes first, then what stayed the same. */
export function attributeChanges(before: Snapshot, after: Snapshot): AttributeChange[] {
  const out: AttributeChange[] = []
  for (const [scope, a, b] of [
    ['resource', before.resource, after.resource],
    ['record', before.attributes, after.attributes],
  ] as const) {
    for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      const kind = !(key in a) ? 'added' : !(key in b) ? 'removed' : a[key] !== b[key] ? 'changed' : 'same'
      out.push({ scope, key, kind, before: a[key], after: b[key] })
    }
  }
  return out.sort((x, y) => ORDER[x.kind] - ORDER[y.kind])
}
