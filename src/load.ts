// 从种子目录读部件。缺文件时记一笔，正文仍由默认层提供。

import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_COMPONENTS } from './defaults.ts'
import type { HarnessComponent } from './types.ts'

const DEFAULT_TITLES = new Map(DEFAULT_COMPONENTS.map((component) => [component.id, component.title]))

interface SeedFile {
  file: string
  id: string
  kind: HarnessComponent['kind']
  title: string
  order: number
}

const SEED_FILES: SeedFile[] = [
  { file: 'system.md', id: 'system', kind: 'context', title: '系统', order: 10 },
  { file: 'guardrails.md', id: 'guardrails', kind: 'pinned', title: '规则', order: 20 },
  { file: 'tools.md', id: 'tool-guidance', kind: 'context', title: '工具', order: 30 },
  { file: 'memory.md', id: 'memory', kind: 'context', title: '记忆', order: 50 },
]

export function harnessTemplateDir(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'harness')
}

async function readOptional(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

export interface SeedLoad {
  components: HarnessComponent[]
  /** 用了默认正文的 id。调用方要记日志。 */
  fallbacks: string[]
}

/** 还没有 guardrails.md 时，从模板种一份。已有的规则文件不覆盖。 */
export async function ensureSeedDir(
  targetDir: string,
  templateDir: string = harnessTemplateDir(),
): Promise<void> {
  try {
    await fs.access(path.join(targetDir, 'guardrails.md'))
    return
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  await fs.mkdir(path.join(targetDir, 'skills'), { recursive: true })
  try {
    await fs.access(path.join(templateDir, 'guardrails.md'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await writeDefaultSeed(targetDir)
    return
  }

  for (const seed of SEED_FILES) {
    await fs.copyFile(path.join(templateDir, seed.file), path.join(targetDir, seed.file))
  }
  const skillNames = await fs.readdir(path.join(templateDir, 'skills'))
  for (const name of skillNames) {
    if (!name.endsWith('.md')) continue
    await fs.copyFile(
      path.join(templateDir, 'skills', name),
      path.join(targetDir, 'skills', name),
    )
  }
}

async function writeDefaultSeed(targetDir: string): Promise<void> {
  const byId = new Map(DEFAULT_COMPONENTS.map((component) => [component.id, component]))
  for (const seed of SEED_FILES) {
    const component = byId.get(seed.id)
    if (!component) continue
    await fs.writeFile(path.join(targetDir, seed.file), `${component.body}\n`, 'utf-8')
  }
  for (const component of DEFAULT_COMPONENTS) {
    if (!component.id.startsWith('skill:')) continue
    const name = component.id.slice('skill:'.length)
    await fs.writeFile(path.join(targetDir, 'skills', `${name}.md`), `${component.body}\n`, 'utf-8')
  }
}

export async function readSeedDirectory(directory: string): Promise<SeedLoad> {
  const components: HarnessComponent[] = []
  const fallbacks: string[] = []

  for (const seed of SEED_FILES) {
    const text = await readOptional(path.join(directory, seed.file))
    if (text === undefined || (seed.kind === 'pinned' && text.trim().length === 0)) {
      fallbacks.push(seed.id)
      continue
    }
    components.push({
      id: seed.id,
      kind: seed.kind,
      title: seed.title,
      order: seed.order,
      body: text.trim(),
    })
  }

  const skillsDir = path.join(directory, 'skills')
  let names: string[]
  try {
    names = await fs.readdir(skillsDir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    fallbacks.push('skills')
    return { components, fallbacks }
  }

  const skillFiles = names.filter((name) => name.endsWith('.md')).sort()
  for (let index = 0; index < skillFiles.length; index++) {
    const name = skillFiles[index]
    const text = await fs.readFile(path.join(skillsDir, name), 'utf-8')
    if (!text.trim()) continue
    const id = `skill:${path.basename(name, '.md')}`
    components.push({
      id,
      kind: 'context',
      title: DEFAULT_TITLES.get(id) ?? path.basename(name, '.md'),
      order: 40 + index,
      body: text.trim(),
    })
  }

  return { components, fallbacks }
}
