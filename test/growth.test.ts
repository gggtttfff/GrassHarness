import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as os from 'node:os'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'
import { createGrowthRecord, GrowthLog } from '../src/growth.ts'
import { applyGrowthLog } from '../src/catalog.ts'
import { DEFAULT_COMPONENTS } from '../src/defaults.ts'
import { runGrow } from '../src/growCommand.ts'

test('坏行跳过，完整的行留下', async () => {
  const directory = path.join(os.tmpdir(), `grass-growth-${process.pid}`)
  await fs.rm(directory, { recursive: true, force: true })
  const log = new GrowthLog(directory)
  const record = createGrowthRecord({
    id: 'skill:check-tests',
    title: '跑测试',
    body: '改完先跑测试。',
    domain: 'general',
    situation: '没跑',
    lesson: '要跑',
    sessionId: 's1',
    excerpt: '红的',
  }, 10)
  await log.append(record)
  await fs.appendFile(path.join(directory, 'general.jsonl'), '{不是json\n', 'utf-8')

  const page = await log.list('general')
  assert.equal(page.skipped, 1)
  assert.equal(page.records.length, 1)
  assert.equal(page.records[0].lesson, '要跑')
})

test('领域名带斜杠会被拒绝', () => {
  assert.throws(() => createGrowthRecord({
    id: 'skill:check-tests',
    title: '跑测试',
    body: '正文',
    domain: '../etc',
    situation: '情境',
    lesson: '教训',
    sessionId: 's1',
    excerpt: '证据',
  }), /领域/)
})

test('grow 拒绝 guardrails，并且不写文件', async () => {
  const home = path.join(os.tmpdir(), `grass-grow-pin-${process.pid}`)
  await fs.rm(home, { recursive: true, force: true })
  await assert.rejects(
    runGrow([
      '--id', 'guardrails',
      '--title', '规则',
      '--body', '放宽',
      '--situation', '想改规则',
      '--lesson', '不行',
      '--excerpt', '无',
    ], {
      GRASSHARNESS_HOME: home,
      GRASSHARNESS_DOMAIN: 'general',
    }),
    /guardrails/,
  )
  await assert.rejects(fs.access(path.join(home, 'growth', 'general.jsonl')))
})

test('grow 写入的记录下次能装进目录', async () => {
  const home = path.join(os.tmpdir(), `grass-grow-ok-${process.pid}`)
  await fs.rm(home, { recursive: true, force: true })
  const filePath = await runGrow([
    '--id', 'skill:check-tests',
    '--title', '跑测试',
    '--body', '改完先跑测试。',
    '--situation', '没跑测试',
    '--lesson', '先跑测试',
    '--excerpt', '测试是红的',
  ], { GRASSHARNESS_HOME: home })

  assert.equal(filePath, path.join(home, 'growth', 'general.jsonl'))
  const page = await new GrowthLog(path.join(home, 'growth')).list('general')
  const catalog = applyGrowthLog(DEFAULT_COMPONENTS, page.records)
  const grown = catalog.find((component) => component.id === 'skill:check-tests')
  assert.equal(grown?.body, '改完先跑测试。')
  assert.equal(catalog.find((component) => component.id === 'guardrails')?.kind, 'pinned')
})
