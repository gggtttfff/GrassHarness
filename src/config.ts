import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { assertDomain } from './growth.ts'

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

export interface HarnessConfig {
  apiKey?: string
  model: string
  baseUrl: string
  maxTokens: number
  workspace: string
  home: string
  harnessDir: string
  growthDir: string
  domain: string
  sessionDatabasePath: string
  sessionId?: string
  commandTimeoutMs: number
  requestTimeoutMs: number
  maxRetries: number
  retryBaseDelayMs: number
  retryMaxDelayMs: number
  maxConcurrency: number
}

export async function parseEnvFile(filePath: string): Promise<Record<string, string>> {
  let content: string
  try {
    content = await fs.readFile(filePath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw new ConfigError(`读取 ${filePath} 失败: ${(error as Error).message}`)
  }

  const parsed: Record<string, string> = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator <= 0) continue
    const name = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    parsed[name] = value
  }
  return parsed
}

function pick(
  fileValues: Record<string, string>,
  environment: NodeJS.ProcessEnv,
  name: string,
): string | undefined {
  const fromEnvironment = environment[name]
  if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment
  return fileValues[name]
}

function integerOption(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined || value.trim() === '') return fallback
  if (!/^\d+$/.test(value.trim())) throw new ConfigError(`${label} 必须是整数`)
  return Number(value)
}

export async function loadConfig(options: {
  requireApiKey?: boolean
  envFilePath?: string
  environment?: NodeJS.ProcessEnv
} = {}): Promise<HarnessConfig> {
  const environment = options.environment ?? process.env
  const fileValues = await parseEnvFile(options.envFilePath ?? path.join(process.cwd(), '.env'))
  const read = (name: string) => pick(fileValues, environment, name)

  const apiKey = read('GRASSHARNESS_API_KEY')
  if (options.requireApiKey && !apiKey) {
    throw new ConfigError('GRASSHARNESS_API_KEY 不能为空')
  }

  const home = read('GRASSHARNESS_HOME') ?? path.join(os.homedir(), '.grass-harness')
  const domain = assertDomain(read('GRASSHARNESS_DOMAIN') ?? 'general')

  return {
    apiKey,
    model: read('GRASSHARNESS_MODEL') ?? 'gpt-4o-mini',
    baseUrl: read('GRASSHARNESS_BASE_URL') ?? 'https://api.openai.com/v1',
    maxTokens: integerOption(read('GRASSHARNESS_MAX_TOKENS'), 4096, 'GRASSHARNESS_MAX_TOKENS'),
    workspace: read('GRASSHARNESS_WORKSPACE') ?? process.cwd(),
    home,
    harnessDir: read('GRASSHARNESS_HARNESS_DIR') ?? path.join(home, 'harness'),
    growthDir: read('GRASSHARNESS_GROWTH_DIR') ?? path.join(home, 'growth'),
    domain,
    sessionDatabasePath: read('GRASSHARNESS_SESSION_DATABASE_PATH') ?? path.join(home, 'sessions.db'),
    sessionId: read('GRASSHARNESS_SESSION_ID'),
    commandTimeoutMs: integerOption(read('GRASSHARNESS_COMMAND_TIMEOUT_MS'), 3000, 'GRASSHARNESS_COMMAND_TIMEOUT_MS'),
    requestTimeoutMs: integerOption(read('GRASSHARNESS_REQUEST_TIMEOUT_MS'), 120_000, 'GRASSHARNESS_REQUEST_TIMEOUT_MS'),
    maxRetries: integerOption(read('GRASSHARNESS_MAX_RETRIES'), 3, 'GRASSHARNESS_MAX_RETRIES'),
    retryBaseDelayMs: integerOption(read('GRASSHARNESS_RETRY_BASE_DELAY_MS'), 1000, 'GRASSHARNESS_RETRY_BASE_DELAY_MS'),
    retryMaxDelayMs: integerOption(read('GRASSHARNESS_RETRY_MAX_DELAY_MS'), 30_000, 'GRASSHARNESS_RETRY_MAX_DELAY_MS'),
    maxConcurrency: integerOption(read('GRASSHARNESS_MAX_CONCURRENCY'), 4, 'GRASSHARNESS_MAX_CONCURRENCY'),
  }
}
