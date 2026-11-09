import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyPlugins,
  DuplicateItemError,
  HarnessRegistry,
  SeamOccupiedError,
} from '../src/registry.ts'

test('单次接缝不能注册第二次', () => {
  const registry = new HarnessRegistry()
  registry.register('llm', { model: 'a' })
  assert.throws(() => registry.register('llm', { model: 'b' }), SeamOccupiedError)
  assert.deepEqual(registry.require('llm'), { model: 'a' })
})

test('工具可追加，同名拒绝', () => {
  const registry = new HarnessRegistry()
  const key = (tool: { name: string }) => tool.name
  registry.register('tools', { name: 'read_file' }, { many: true, key })
  registry.register('tools', { name: 'edit' }, { many: true, key })
  assert.throws(
    () => registry.register('tools', { name: 'edit' }, { many: true, key }),
    DuplicateItemError,
  )
  assert.deepEqual(registry.require('tools'), [{ name: 'read_file' }, { name: 'edit' }])
})

test('插件往已有注册表上加接缝', () => {
  const registry = new HarnessRegistry()
  applyPlugins(registry, [{
    name: 'shell',
    register(target) {
      target.register('shell', { kind: 'local' })
    },
  }])
  assert.deepEqual(registry.require('shell'), { kind: 'local' })
})
