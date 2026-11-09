import type { HarnessComponent } from './types.ts'

/**
 * 按 order 拼系统提示词。不认识具体 id。
 * 空的 pinned 直接失败，避免规则被空文件悄悄拿掉。
 */
export function assembleSystemPrompt(components: HarnessComponent[]): string {
  const pinned = components.filter((component) => component.kind === 'pinned')
  if (pinned.length === 0 || pinned.some((component) => component.body.trim().length === 0)) {
    throw new Error('pinned 部件不能为空')
  }

  const sorted = [...components].sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order
    return left.id.localeCompare(right.id)
  })

  return sorted
    .filter((component) => component.body.trim().length > 0)
    .map((component) => `## ${component.title}\n${component.body.trim()}`)
    .join('\n\n')
}
