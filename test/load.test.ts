import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as os from 'node:os'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DEFAULT_COMPONENTS } from '../src/defaults.ts'
import { ensureSeedDir, harnessTemplateDir, readSeedDirectory } from '../src/load.ts'
import { loadCatalog } from '../src/catalog.ts'

const templateDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'harness')

test('仓库里的种子和内置默认是同一份正文', async () => {
  const files: Record<string, string> = {
    system: 'system.md',
    guardrails: 'guardrails.md',
    'tool-guidance': 'tools.md',
    memory: 'memory.md',
    'skill:read-before-edit': 'skills/read-before-edit.md',
  }
  for (const [id, relative] of Object.entries(files)) {
    const text = await fs.readFile(path.join(templateDir, relative), 'utf-8')
    const component = DEFAULT_COMPONENTS.find((item) => item.id === id)
    assert.equal(text.trim(), component?.body)
  }
  assert.equal(harnessTemplateDir(), templateDir)
})

test('缺 guardrails 时回退，不把空规则放进目录', async () => {
  const directory = path.join(os.tmpdir(), `grass-seed-${process.pid}`)
  await fs.rm(directory, { recursive: true, force: true })
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path.join(directory, 'system.md'), '自定义系统\n', 'utf-8')

  const seed = await readSeedDirectory(directory)
  assert.ok(seed.fallbacks.includes('guardrails'))
  const catalog = loadCatalog([
    { name: 'defaults', components: DEFAULT_COMPONENTS },
    { name: 'seed', components: seed.components },
  ])
  assert.equal(catalog.find((component) => component.id === 'system')?.body, '自定义系统')
  assert.equal(
    catalog.find((component) => component.id === 'guardrails')?.body,
    DEFAULT_COMPONENTS.find((component) => component.id === 'guardrails')?.body,
  )
})

test('已有 guardrails 时 ensureSeedDir 不覆盖', async () => {
  const directory = path.join(os.tmpdir(), `grass-seed-keep-${process.pid}`)
  await fs.rm(directory, { recursive: true, force: true })
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path.join(directory, 'guardrails.md'), '人写的规则\n', 'utf-8')
  await ensureSeedDir(directory, templateDir)
  const text = await fs.readFile(path.join(directory, 'guardrails.md'), 'utf-8')
  assert.equal(text, '人写的规则\n')
})
