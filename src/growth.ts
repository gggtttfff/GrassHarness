// 生长日志按领域分文件。坏行跳过；写进 pinned 的记录要当场失败，不能当坏行吞掉。

import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import type { GrowInput, GrowthRecord } from './types.ts'

const DOMAIN_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
const ID_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,63}$/

export function assertDomain(domain: string): string {
  if (!DOMAIN_PATTERN.test(domain)) throw new Error(`非法的领域: ${domain}`)
  return domain
}

function requireText(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`采纳时必须写明${label}`)
  return trimmed
}

/** 做成一条记录。kind 固定是 context，pinned 不从这条路径产生。 */
export function createGrowthRecord(input: GrowInput, now: number = Date.now()): GrowthRecord {
  const id = requireText(input.id, '部件 id')
  if (!ID_PATTERN.test(id)) throw new Error(`非法的部件 id: ${id}`)
  if (input.op !== undefined && input.op !== 'append' && input.op !== 'replace') {
    throw new Error('op 只能是 append 或 replace')
  }

  return {
    id,
    kind: 'context',
    title: requireText(input.title, '标题'),
    body: requireText(input.body, '正文'),
    order: input.order ?? 60,
    op: input.op ?? 'append',
    domain: assertDomain(requireText(input.domain, '领域')),
    situation: requireText(input.situation, '情境'),
    lesson: requireText(input.lesson, '教训'),
    evidence: {
      sessionId: requireText(input.sessionId, '会话'),
      excerpt: requireText(input.excerpt, '证据'),
    },
    createdAt: now,
  }
}

function isRecord(value: unknown, domain: string): value is GrowthRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<GrowthRecord>
  const evidence = record.evidence
  return record.kind === 'context'
    && (record.op === 'append' || record.op === 'replace')
    && typeof record.id === 'string'
    && typeof record.title === 'string'
    && typeof record.body === 'string'
    && typeof record.order === 'number'
    && record.domain === domain
    && typeof record.situation === 'string'
    && typeof record.lesson === 'string'
    && typeof record.createdAt === 'number'
    && !!evidence
    && typeof evidence.sessionId === 'string'
    && typeof evidence.excerpt === 'string'
}

export interface GrowthPage {
  records: GrowthRecord[]
  skipped: number
}

export class GrowthLog {
  private readonly directory: string

  constructor(directory: string) {
    this.directory = directory
  }

  private filePath(domain: string): string {
    return path.join(this.directory, `${assertDomain(domain)}.jsonl`)
  }

  async append(record: GrowthRecord): Promise<string> {
    const filePath = this.filePath(record.domain)
    await fs.mkdir(this.directory, { recursive: true })
    await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf-8')
    return filePath
  }

  /** 不存在的领域是空日志，不是错误。 */
  async list(domain: string): Promise<GrowthPage> {
    let content: string
    try {
      content = await fs.readFile(this.filePath(domain), 'utf-8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { records: [], skipped: 0 }
      }
      throw error
    }

    const records: GrowthRecord[] = []
    let skipped = 0
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue
      try {
        const parsed: unknown = JSON.parse(line)
        if (!isRecord(parsed, domain)) {
          skipped += 1
          continue
        }
        records.push(parsed)
      } catch {
        skipped += 1
      }
    }
    return { records, skipped }
  }
}
