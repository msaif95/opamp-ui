/** Parses "1, 10, 50, 100" into increasing whole percentages ending at 100; null if invalid. */
export function parseSteps(text: string): number[] | null {
  const steps = text
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
  const valid =
    steps.length > 0 &&
    steps.length <= 20 &&
    steps.every((s, i) => Number.isInteger(s) && s > (steps[i - 1] ?? 0) && s <= 100) &&
    steps[steps.length - 1] === 100
  return valid ? steps : null
}
