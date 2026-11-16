/** Refused items of a bulk action, grouped by the reason given, most common reason first. */
export function groupFailures(results: { instance_uid: string; ok: boolean; error?: string }[], nameOf: (uid: string) => string): { reason: string; names: string[] }[] {
  const byReason = new Map<string, string[]>()
  for (const r of results) {
    if (r.ok) continue
    const reason = r.error || 'failed'
    byReason.set(reason, [...(byReason.get(reason) ?? []), nameOf(r.instance_uid)])
  }
  return [...byReason].map(([reason, names]) => ({ reason, names })).sort((a, b) => b.names.length - a.names.length)
}
