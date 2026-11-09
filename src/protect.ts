// 写工具在执行前先看路径。种子目录和生长日志即使用工作区包住了，也不让模型改。

import * as path from 'node:path'

const WRITE_TOOLS = new Set(['write_file', 'edit', 'edit_batch'])

export function isInsideRoot(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target))
  if (relative === '') return true
  if (relative === '..' || relative.startsWith(`..${path.sep}`)) return false
  if (path.isAbsolute(relative)) return false
  return true
}

interface ToolLike {
  name: string
  execute: (args: unknown, signal?: AbortSignal) => Promise<string>
}

function requestedPath(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') return undefined
  const value = (args as { path?: unknown }).path
  return typeof value === 'string' && value.trim() ? value : undefined
}

export function guardWriteTools<T extends ToolLike>(
  tools: T[],
  options: {
    roots: string[]
    resolve: (requestedPath: string) => Promise<string>
  },
): T[] {
  return tools.map((tool) => {
    if (!WRITE_TOOLS.has(tool.name)) return tool
    return {
      ...tool,
      execute: async (args: unknown, signal?: AbortSignal) => {
        const requested = requestedPath(args)
        if (requested) {
          let resolved: string
          try {
            resolved = await options.resolve(requested)
          } catch (error) {
            return `error: ${(error as Error).message}`
          }
          if (options.roots.some((root) => isInsideRoot(root, resolved))) {
            return `error: 拒绝写入受保护路径 ${resolved}。种子和生长日志只能由人改。`
          }
        }
        return tool.execute(args, signal)
      },
    }
  })
}
