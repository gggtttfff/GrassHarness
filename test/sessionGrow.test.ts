import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acceptsGrowth, growthInputFromLesson, turnExcerpt } from '../src/sessionGrow.ts'

test('只有 y、yes、是 才算确认', () => {
  assert.equal(acceptsGrowth('y'), true)
  assert.equal(acceptsGrowth('YES'), true)
  assert.equal(acceptsGrowth('是'), true)
  assert.equal(acceptsGrowth(''), false)
  assert.equal(acceptsGrowth('n'), false)
  assert.equal(acceptsGrowth('改完先跑测试'), false)
})

test('一句话变成生长输入，证据来自上一轮', () => {
  const turn = turnExcerpt([
    { role: 'user', content: '存储改完了' },
    { role: 'assistant', content: [{ type: 'text', text: '测试还是红的' }] },
  ], 's1')
  const input = growthInputFromLesson('改完先跑测试。', turn, 1_700_000_000_000, 'ab12')
  assert.equal(input.id, 'note-loyw3v28-ab12')
  assert.equal(input.body, '改完先跑测试。')
  assert.equal(input.situation, '存储改完了')
  assert.equal(input.excerpt, '测试还是红的')
  assert.equal(input.sessionId, 's1')
})

test('还没有对话时，用这句话本身当情境和证据', () => {
  const input = growthInputFromLesson('先读再改', turnExcerpt([], 's1'), 10, 'abcd')
  assert.equal(input.situation, '先读再改')
  assert.equal(input.excerpt, '先读再改')
})
