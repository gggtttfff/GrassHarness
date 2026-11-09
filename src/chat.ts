import { createInterface } from 'node:readline'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { assembleSystemPrompt } from './assemble.ts'
import { loadConfig } from './config.ts'
import { composeHarness } from './compose.ts'
import { createRuntime } from './executor.ts'
import { commitGrowth } from './growCommand.ts'
import { ensureSeedDir } from './load.ts'
import { acceptsGrowth, growthInputFromLesson, turnExcerpt } from './sessionGrow.ts'

interface LineQueue {
  push(line: string | null): void
  take(): Promise<string | null>
}

function createLineQueue(): LineQueue & { close(): void } {
  const buffered: (string | null)[] = []
  const waiters: ((line: string | null) => void)[] = []
  let closed = false
  return {
    push(line) {
      if (closed) return
      const waiter = waiters.shift()
      if (waiter) waiter(line)
      else buffered.push(line)
    },
    take() {
      const next = buffered.shift()
      if (next !== undefined) return Promise.resolve(next)
      if (closed) return Promise.resolve(null)
      return new Promise((resolve) => waiters.push(resolve))
    },
    close() {
      closed = true
      while (waiters.length > 0) waiters.shift()?.(null)
    },
  }
}

async function currentPrompt(config: Awaited<ReturnType<typeof loadConfig>>): Promise<string> {
  const composed = await composeHarness({
    harnessDir: config.harnessDir,
    growthDir: config.growthDir,
    domain: config.domain,
  })
  if (composed.fallbacks.length > 0) {
    console.error(`[grass-harness] 种子缺了 ${composed.fallbacks.join(', ')}，用了内置默认`)
  }
  if (composed.skipped > 0) {
    console.error(`[grass-harness] 生长日志有 ${composed.skipped} 行读不懂，已跳过`)
  }
  return assembleSystemPrompt(composed.components)
}

async function adoptInSession(
  text: string,
  lines: LineQueue,
  config: Awaited<ReturnType<typeof loadConfig>>,
  runtime: Awaited<ReturnType<typeof createRuntime>>,
): Promise<'quit' | 'stay'> {
  let lesson = text.slice('/grow'.length).trim()
  if (!lesson) {
    console.log('要记下什么？')
    const typed = await lines.take()
    if (typed === null || typed.trim() === '/quit') return 'quit'
    lesson = typed.trim()
  }
  if (!lesson) {
    console.log('没有记下')
    return 'stay'
  }

  console.log(`记下「${lesson}」？输入 y 确认`)
  const answer = await lines.take()
  if (answer === null || answer.trim() === '/quit') return 'quit'
  if (!acceptsGrowth(answer)) {
    console.log('没有记下')
    return 'stay'
  }

  try {
    const filePath = await commitGrowth({
      harnessDir: config.harnessDir,
      growthDir: config.growthDir,
      domain: config.domain,
      input: growthInputFromLesson(lesson, turnExcerpt(runtime.context.messages, runtime.sessionId)),
    })
    runtime.setSystemPrompt(await currentPrompt(config))
    console.log(`已写入 ${filePath}`)
  } catch (error) {
    console.error(`[grass-harness] ${(error as Error).message}`)
  }
  return 'stay'
}

export async function runChat(environment?: NodeJS.ProcessEnv): Promise<void> {
  const config = await loadConfig({ requireApiKey: true, environment })
  await ensureSeedDir(config.harnessDir)
  await fs.mkdir(config.growthDir, { recursive: true })
  const protectedRoots = await Promise.all(
    [config.harnessDir, config.growthDir].map(async (root) => {
      const absolute = path.resolve(root)
      try {
        return await fs.realpath(absolute)
      } catch {
        return absolute
      }
    }),
  )

  const lines = createLineQueue()
  const runtime = await createRuntime({
    config,
    systemPrompt: await currentPrompt(config),
    protectedRoots,
    ask: async (question, signal) => {
      if (signal?.aborted) return { status: 'aborted' }
      process.stdout.write(`?\n${question}\n`)
      const line = await lines.take()
      if (line === null) return { status: 'unavailable' }
      if (signal?.aborted) return { status: 'aborted' }
      return { status: 'answered', answer: line }
    },
  })

  const input = createInterface({ input: process.stdin, output: process.stdout })
  let busy = false
  let turnAbort = new AbortController()

  input.on('line', (line) => lines.push(line))
  input.on('close', () => lines.close())
  input.on('SIGINT', () => {
    if (busy) turnAbort.abort()
    else {
      runtime.close()
      process.exit(130)
    }
  })

  console.log('GrassHarness。输入后回车，/quit 退出。')
  console.log('/grow 一句话，再输入 y，就把这句话写进生长日志。下一轮会用到。')
  console.log(`种子 ${config.harnessDir}`)
  console.log(`生长 ${config.growthDir}/${config.domain}.jsonl`)

  while (true) {
    const line = await lines.take()
    if (line === null) break
    const text = line.trim()
    if (!text) continue
    if (text === '/quit') break
    if (text === '/grow' || text.startsWith('/grow ')) {
      const wrote = await adoptInSession(text, lines, config, runtime)
      if (wrote === 'quit') break
      continue
    }
    if (text.startsWith('/')) {
      console.log(`没有这个命令: ${text}`)
      continue
    }

    busy = true
    turnAbort = new AbortController()
    try {
      runtime.setSystemPrompt(await currentPrompt(config))
      runtime.context.messages.push({ role: 'user', content: text })
      for await (const event of runtime.runTurn(turnAbort.signal)) {
        if (event.type === 'assistant_text') process.stdout.write(event.delta)
        else if (event.type === 'tool_call') {
          process.stdout.write(`\n[tool] ${event.name} ${JSON.stringify(event.args)}\n`)
        } else if (event.type === 'tool_result') {
          process.stdout.write(`[result] ${event.name}\n${event.result}\n`)
        } else if (event.type === 'turn_end') {
          process.stdout.write('\n')
          if (event.stopReason === 'aborted') console.log('[已打断]')
          if (event.stopReason === 'error') console.log('[执行出错]')
          if (event.stopReason === 'max_tokens') console.log('[输出被 max_tokens 截断]')
        }
      }
      runtime.sync()
    } catch (error) {
      console.error(`[grass-harness] ${(error as Error).message}`)
    } finally {
      busy = false
    }
  }

  runtime.close()
  input.close()
}
