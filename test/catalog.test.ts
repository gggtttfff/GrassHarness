import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyGrowth, loadCatalog, PinnedGrowthError } from '../src/catalog.ts'
import { assembleSystemPrompt } from '../src/assemble.ts'
import { DEFAULT_COMPONENTS } from '../src/defaults.ts'
import type { GrowthRecord, HarnessComponent } from '../src/types.ts'

const guardrails = DEFAULT_COMPONENTS.find((component) => component.id === 'guardrails')
assert.ok(guardrails)

function record(partial: Partial<GrowthRecord> = {}): GrowthRecord {
  return {
    id: 'skill:check-tests',
    kind: 'context',
    title: '跑测试',
    body: '改完先跑测试。',
    order: 41,
    op: 'append',
    domain: 'general',
    situation: '没跑测试',
    lesson: '先跑测试',
    evidence: { sessionId: 's1', excerpt: '测试是红的' },
    createdAt: 1,
    ...partial,
  }
}

test('后一层盖住同 id，不改其他部件', () => {
  const first: HarnessComponent = {
    id: 'system',
    kind: 'context',
    title: '系统',
    body: '旧',
    order: 10,
  }
  const second: HarnessComponent = { ...first, body: '新' }
  const catalog = loadCatalog([
    { name: 'defaults', components: [first, guardrails] },
    { name: 'seed', components: [second] },
  ])
  assert.equal(catalog.find((component) => component.id === 'system')?.body, '新')
  assert.equal(catalog.find((component) => component.id === 'guardrails')?.body, guardrails.body)
})

test('组装按 order，不按插入顺序', () => {
  const prompt = assembleSystemPrompt([
    { id: 'memory', kind: 'context', title: '记忆', body: '后写', order: 50 },
    guardrails,
    { id: 'system', kind: 'context', title: '系统', body: '先看', order: 10 },
  ])
  assert.ok(prompt.startsWith('## 系统\n先看'))
  assert.ok(prompt.indexOf('## 规则') < prompt.indexOf('## 记忆'))
})

test('没有 pinned 时组装失败', () => {
  assert.throws(
    () => assembleSystemPrompt([{ id: 'system', kind: 'context', title: '系统', body: 'x', order: 1 }]),
    /pinned/,
  )
})

test('append 接在已有正文后面，原目录不变', () => {
  const base = [{ id: 'memory', kind: 'context' as const, title: '记忆', body: '旧', order: 50 }]
  const next = applyGrowth(base, record({ id: 'memory', title: '记忆', body: '新', order: 50 }))
  assert.equal(base[0].body, '旧')
  assert.equal(next[0].body, '旧\n新')
})

test('replace 换掉正文', () => {
  const base = [{ id: 'memory', kind: 'context' as const, title: '记忆', body: '旧', order: 50 }]
  const next = applyGrowth(base, record({ id: 'memory', op: 'replace', title: '记忆', body: '整段换掉', order: 50 }))
  assert.equal(next[0].body, '整段换掉')
})

test('生长写不进 guardrails', () => {
  assert.throws(
    () => applyGrowth(DEFAULT_COMPONENTS, record({ id: 'guardrails', op: 'replace', body: '放宽规则' })),
    PinnedGrowthError,
  )
})
