export const MAX_TOKEN_LIMIT = 100_000

/** Reads a rate-limit field: blank is "use the default" (null), 0 is "no limit". Returns undefined for anything else that is not a whole number in range. */
export function readLimit(text: string): number | null | undefined {
  const t = text.trim()
  if (t === '') return null
  if (!/^\d+$/.test(t)) return undefined
  const n = Number(t)
  return n <= MAX_TOKEN_LIMIT ? n : undefined
}

/** How a budget reads in a table: the token's own value, or the default it falls back to. */
export function limitText(own: number | null, fallback: number): { text: string; inherited: boolean } {
  const value = own ?? fallback
  return { text: value === 0 ? 'No limit' : value.toLocaleString(), inherited: own === null }
}
