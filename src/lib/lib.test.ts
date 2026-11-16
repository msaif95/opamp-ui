import { describe, expect, it } from 'vitest'
import { groupFailures } from './bulk'
import { diffLines, sideBySide } from './diff'
import { readKeys, readLabels } from './labels'
import { limitText, readLimit } from './limits'
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

describe('sideBySide', () => {
  it('pairs removed lines with added ones and numbers each side', () => {
    expect(sideBySide(diffLines('a\nb\nc', 'a\nx\ny\nc'))).toEqual([
      { left: { no: 1, text: 'a' }, right: { no: 1, text: 'a' }, changed: false },
      { left: { no: 2, text: 'b' }, right: { no: 2, text: 'x' }, changed: true },
      { left: null, right: { no: 3, text: 'y' }, changed: true },
      { left: { no: 3, text: 'c' }, right: { no: 4, text: 'c' }, changed: false },
    ])
  })
  it('leaves the other side blank for pure additions and deletions', () => {
    expect(sideBySide(diffLines('a\nb', 'a'))[1]).toEqual({ left: { no: 2, text: 'b' }, right: null, changed: true })
    expect(sideBySide(diffLines('a', 'a\nb'))[1]).toEqual({ left: null, right: { no: 2, text: 'b' }, changed: true })
  })
})

describe('groupFailures', () => {
  it('groups refusals by reason, most common first, and skips successes', () => {
    const results = [
      { instance_uid: 'a', ok: true },
      { instance_uid: 'b', ok: false, error: 'not connected' },
      { instance_uid: 'c', ok: false, error: 'no config' },
      { instance_uid: 'd', ok: false, error: 'no config' },
      { instance_uid: 'e', ok: false },
    ]
    expect(groupFailures(results, (uid) => `host-${uid}`)).toEqual([
      { reason: 'no config', names: ['host-c', 'host-d'] },
      { reason: 'not connected', names: ['host-b'] },
      { reason: 'failed', names: ['host-e'] },
    ])
  })
})

describe('readLabels', () => {
  it('trims, skips empty rows and returns the labels', () => {
    expect(readLabels([{ key: ' owner ', value: ' alice ' }, { key: '', value: '' }, { key: 'team/on-call', value: 'sre' }])).toEqual({
      labels: { owner: 'alice', 'team/on-call': 'sre' },
    })
  })
  it('explains what is wrong', () => {
    for (const rows of [
      [{ key: 'my key', value: 'x' }],
      [{ key: 'owner', value: '' }],
      [{ key: '', value: 'x' }],
      [{ key: 'a', value: '1' }, { key: 'a', value: '2' }],
      [{ key: 'a', value: 'v'.repeat(129) }],
      Array.from({ length: 21 }, (_, i) => ({ key: `k${i}`, value: 'v' })),
    ]) {
      expect(readLabels(rows)).toHaveProperty('error')
    }
  })
  it('splits names to remove', () => {
    expect(readKeys(' owner, canary  owner ')).toEqual(['owner', 'canary'])
    expect(readKeys('')).toEqual([])
  })
})

describe('rate limit fields', () => {
  it('reads blank as the default, 0 as no limit, and rejects the rest', () => {
    expect(readLimit('  ')).toBeNull()
    expect(readLimit('0')).toBe(0)
    expect(readLimit(' 300 ')).toBe(300)
    for (const bad of ['-1', '1.5', 'abc', '100001']) expect(readLimit(bad), bad).toBeUndefined()
  })
  it('shows the token value or the default it inherits', () => {
    expect(limitText(null, 1200)).toEqual({ text: '1,200', inherited: true })
    expect(limitText(null, 0)).toEqual({ text: 'No limit', inherited: true })
    expect(limitText(0, 1200)).toEqual({ text: 'No limit', inherited: false })
    expect(limitText(300, 1200)).toEqual({ text: '300', inherited: false })
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
