/** Where a label's key appears among a collector's attributes: label `owner` is attribute `label.owner`. */
export const LABEL_PREFIX = 'label.'
export const MAX_LABELS = 20

const KEY = /^[A-Za-z0-9]([A-Za-z0-9._/-]{0,61}[A-Za-z0-9])?$/

/** Turns the rows of a label form into labels, or says what is wrong with them. Wholly empty rows are ignored. */
export function readLabels(rows: { key: string; value: string }[]): { labels: Record<string, string> } | { error: string } {
  const labels: Record<string, string> = {}
  for (const row of rows) {
    const key = row.key.trim()
    const value = row.value.trim()
    if (!key && !value) continue
    if (!KEY.test(key)) return { error: `"${key}" is not a usable name: use letters, digits and . _ / - (at most 63 characters, starting and ending with a letter or digit).` }
    if (!value) return { error: `Give "${key}" a value.` }
    if (value.length > 128) return { error: `The value of "${key}" is longer than 128 characters.` }
    if (key in labels) return { error: `"${key}" is listed twice.` }
    labels[key] = value
  }
  if (Object.keys(labels).length > MAX_LABELS) return { error: `A collector can carry at most ${MAX_LABELS} labels.` }
  return { labels }
}

/** Splits "a, b c" into label names. */
export const readKeys = (text: string) => [...new Set(text.split(/[\s,]+/).filter(Boolean))]
