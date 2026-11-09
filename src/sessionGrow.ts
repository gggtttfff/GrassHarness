import type { GrowInput } from './types.ts'

export interface TurnExcerpt {
  situation: string
  excerpt: string
  sessionId: string
}

interface LooseMessage {
  role: string
  content: unknown
}

function flatten(content: unknown): string {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const record = block as { type?: string; text?: string; content?: string }
    if (typeof record.text === 'string' && record.text.trim()) parts.push(record.text.trim())
    else if (record.type === 'tool_result' && typeof record.content === 'string' && record.content.trim()) {
      parts.push(record.content.trim())
    }
  }
  return parts.join('\n')
}

/** 从已经结束的一轮里抽出情境和证据。没有对话时，调用方用记下的那句话本身顶上。 */
export function turnExcerpt(messages: LooseMessage[], sessionId: string): TurnExcerpt {
  let situation = ''
  let excerpt = ''
  for (const message of messages) {
    const text = flatten(message.content)
    if (!text) continue
    if (message.role === 'user') situation = text
    if (message.role === 'assistant') excerpt = text
  }
  return { situation, excerpt, sessionId }
}

export function acceptsGrowth(answer: string): boolean {
  const normalized = answer.trim().toLowerCase()
  return normalized === 'y' || normalized === 'yes' || normalized === '是'
}

/**
 * 会话里只让人写一句话。id 用时间生成，避免中文标题通不过部件 id 的字符限制。
 */
export function growthInputFromLesson(
  lesson: string,
  turn: TurnExcerpt,
  now: number = Date.now(),
  suffix: string = Math.random().toString(36).slice(2, 6),
): GrowInput {
  const text = lesson.trim()
  return {
    id: `note-${now.toString(36)}-${suffix}`,
    title: text.length > 24 ? text.slice(0, 24) : text,
    body: text,
    domain: 'general',
    situation: turn.situation.trim() || text,
    lesson: text,
    sessionId: turn.sessionId.trim() || 'local',
    excerpt: turn.excerpt.trim() || text,
  }
}
