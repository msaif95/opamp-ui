import { describe, expect, it } from 'vitest'
import { diffLines } from './diff'
import { parseSteps } from './steps'
import { timeAgo } from './time'

describe('parseSteps', () => {
  it('accepts increasing percentages ending at 100', () => {
    expect(parseSteps('1, 10, 50, 100')).toEqual([1, 10, 50, 100])
    expect(parseSteps('100')).toEqual([100])
    expect(parseSteps(' 5  25,100 ')).toEqual([5, 25, 100])
  })
  it('rejects everything else', () => {
    for (const bad of ['', '1, 10', '10, 10, 100', '50, 10, 100', '0, 100', '1.5, 100', 'abc, 100', '101', '100, 100']) {
      expect(parseSteps(bad), bad).toBeNull()
    }
    expect(parseSteps(Array.from({ length: 21 }, (_, i) => i + 80).join(','))).toBeNull()
  })
})

describe('diffLines', () => {
  it('marks added and removed lines and keeps the rest', () => {
    expect(diffLines('a\nb\nc', 'a\nx\nc')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'del', text: 'b' },
      { type: 'add', text: 'x' },
      { type: 'same', text: 'c' },
    ])
  })
  it('reports identical input as unchanged', () => {
    expect(diffLines('a\nb', 'a\nb').every((l) => l.type === 'same')).toBe(true)
  })
  it('handles pure additions and deletions', () => {
    expect(diffLines('a', 'a\nb').filter((l) => l.type === 'add')).toEqual([{ type: 'add', text: 'b' }])
    expect(diffLines('a\nb', 'a').filter((l) => l.type === 'del')).toEqual([{ type: 'del', text: 'b' }])
  })
})

describe('timeAgo', () => {
  const ago = (seconds: number) => timeAgo(new Date(Date.now() - seconds * 1000).toISOString())
  it('picks a sensible unit', () => {
    expect(ago(5)).toBe('5s ago')
    expect(ago(125)).toBe('2m ago')
    expect(ago(3 * 3600)).toBe('3h ago')
    expect(ago(2 * 86400)).toBe('2d ago')
  })
  it('never goes negative for clock skew', () => {
    expect(ago(-30)).toBe('0s ago')
  })
})
