import { applyGrowth } from './catalog.ts'
import { composeHarness } from './compose.ts'
import { loadConfig } from './config.ts'
import { createGrowthRecord, GrowthLog } from './growth.ts'
import { ensureSeedDir } from './load.ts'
import type { GrowthOp } from './types.ts'

function readFlag(argv: string[], index: number): { name: string; value: string; next: number } {
  const token = argv[index]
  if (!token.startsWith('--')) throw new Error(`无法识别的参数 ${token}`)
  const name = token.slice(2)
  const value = argv[index + 1]
  if (value === undefined || value.startsWith('--')) throw new Error(`--${name} 缺少值`)
  return { name, value, next: index + 2 }
}

export function parseGrowArgs(argv: string[]): {
  id: string
  title: string
  body: string
  situation: string
  lesson: string
  excerpt: string
  domain?: string
  sessionId: string
  op?: GrowthOp
  order?: number
} {
  const flags = new Map<string, string>()
  for (let index = 0; index < argv.length;) {
    const flag = readFlag(argv, index)
    flags.set(flag.name, flag.value)
    index = flag.next
  }

  const need = (name: string): string => {
    const value = flags.get(name)
    if (!value) throw new Error(`缺少 --${name}`)
    return value
  }

  const orderText = flags.get('order')
  const order = orderText === undefined ? undefined : Number(orderText)
  if (order !== undefined && !Number.isInteger(order)) throw new Error('--order 必须是整数')

  const op = flags.get('op')
  return {
    id: need('id'),
    title: need('title'),
    body: need('body'),
    situation: need('situation'),
    lesson: need('lesson'),
    excerpt: need('excerpt'),
    domain: flags.get('domain'),
    sessionId: flags.get('session') ?? 'local',
    op: op as GrowthOp | undefined,
    order,
  }
}

/** 先在内存里试一次，成功才追加到日志。失败时文件保持原样。 */
export async function commitGrowth(options: {
  harnessDir: string
  growthDir: string
  domain: string
  input: {
    id: string
    title: string
    body: string
    situation: string
    lesson: string
    sessionId: string
    excerpt: string
    order?: number
    op?: GrowthOp
  }
}): Promise<string> {
  const record = createGrowthRecord({ ...options.input, domain: options.domain })
  await ensureSeedDir(options.harnessDir)
  const composed = await composeHarness({
    harnessDir: options.harnessDir,
    growthDir: options.growthDir,
    domain: options.domain,
  })
  applyGrowth(composed.components, record)
  return new GrowthLog(options.growthDir).append(record)
}

export async function runGrow(argv: string[], environment?: NodeJS.ProcessEnv): Promise<string> {
  const input = parseGrowArgs(argv)
  const config = await loadConfig({
    requireApiKey: false,
    environment,
    envFilePath: environment ? '/dev/null' : undefined,
  })
  return commitGrowth({
    harnessDir: config.harnessDir,
    growthDir: config.growthDir,
    domain: input.domain ?? config.domain,
    input,
  })
}
