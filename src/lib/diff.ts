export interface DiffLine {
  type: 'same' | 'add' | 'del'
  text: string
}

/** Line diff via longest common subsequence. Fine for config-sized inputs. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n')
  const b = after.split('\n')
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: 'del', text: a[i++] })
    } else {
      out.push({ type: 'add', text: b[j++] })
    }
  }
  while (i < a.length) out.push({ type: 'del', text: a[i++] })
  while (j < b.length) out.push({ type: 'add', text: b[j++] })
  return out
}

export interface DiffSide {
  /** 1-based line number in its own document. */
  no: number
  text: string
}

export interface DiffRow {
  left: DiffSide | null
  right: DiffSide | null
  changed: boolean
}

/**
 * Arranges a line diff in two columns: unchanged lines face each other, and within a changed block the removed
 * lines face the added ones, the longer side continuing against blanks.
 */
export function sideBySide(lines: DiffLine[]): DiffRow[] {
  const rows: DiffRow[] = []
  let leftNo = 0
  let rightNo = 0
  let dels: DiffSide[] = []
  let adds: DiffSide[] = []
  const flush = () => {
    for (let k = 0; k < Math.max(dels.length, adds.length); k++) rows.push({ left: dels[k] ?? null, right: adds[k] ?? null, changed: true })
    dels = []
    adds = []
  }
  for (const l of lines) {
    if (l.type === 'del') dels.push({ no: ++leftNo, text: l.text })
    else if (l.type === 'add') adds.push({ no: ++rightNo, text: l.text })
    else {
      flush()
      rows.push({ left: { no: ++leftNo, text: l.text }, right: { no: ++rightNo, text: l.text }, changed: false })
    }
  }
  flush()
  return rows
}
