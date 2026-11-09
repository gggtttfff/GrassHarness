import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as path from 'node:path'
import { guardWriteTools, isInsideRoot } from '../src/protect.ts'

test('路径在根目录里才算受保护', () => {
  const root = path.join('/tmp', 'grass-harness')
  assert.equal(isInsideRoot(root, path.join(root, 'guardrails.md')), true)
  assert.equal(isInsideRoot(root, path.join('/tmp', 'grass-harness-other', 'a.md')), false)
})

test('写工具碰到受保护路径时不调用原来的 execute', async () => {
  let called = false
  const tools = guardWriteTools([
    {
      name: 'write_file',
      async execute(_args: unknown) {
        called = true
        return 'wrote'
      },
    },
    {
      name: 'read_file',
      async execute(_args: unknown) {
        return 'read'
      },
    },
  ], {
    roots: ['/work/harness'],
    resolve: async (requested) => requested,
  })

  const write = tools.find((tool) => tool.name === 'write_file')
  const read = tools.find((tool) => tool.name === 'read_file')
  assert.ok(write && read)
  const refused = await write.execute({ path: '/work/harness/guardrails.md' })
  assert.match(refused, /受保护/)
  assert.equal(called, false)
  assert.equal(await read.execute({ path: '/work/harness/guardrails.md' }), 'read')
  const allowed = await write.execute({ path: '/work/src/app.ts' })
  assert.equal(allowed, 'wrote')
  assert.equal(called, true)
})
