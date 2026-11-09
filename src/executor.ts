// 执行器适配。这里只调用 GrassAgent 已经有的循环、工具、会话和沙箱。

import { createAskUserTool, type UserReply } from 'grassagent/src/askUser.ts'
import { runAgent, type AgentEvent, type AgentTool } from 'grassagent/src/agent.ts'
import { createLogger } from 'grassagent/src/logger.ts'
import type { Context, Model } from 'grassagent/src/llm.ts'
import { createPathGuard, type PathGuard } from 'grassagent/src/pathGuard.ts'
import { generateSessionId, SessionStore } from 'grassagent/src/sessionStore.ts'
import { builtinTools } from 'grassagent/src/tools.ts'
import { createTransport, type Transport } from 'grassagent/src/transport.ts'
import type { HarnessConfig } from './config.ts'
import { guardWriteTools } from './protect.ts'
import { HarnessRegistry } from './registry.ts'

export interface HarnessRuntime {
  registry: HarnessRegistry
  context: Context
  sessionId: string
  setSystemPrompt(prompt: string): void
  runTurn(signal?: AbortSignal): AsyncGenerator<AgentEvent>
  sync(): void
  close(): void
}

export async function createRuntime(options: {
  config: HarnessConfig
  systemPrompt: string
  protectedRoots: string[]
  ask: (question: string, signal?: AbortSignal) => Promise<UserReply>
}): Promise<HarnessRuntime> {
  if (!options.config.apiKey) {
    throw new Error('GRASSHARNESS_API_KEY 不能为空')
  }

  const logger = createLogger({ level: 'info', format: 'json' })
  const model: Model = {
    apiKey: options.config.apiKey,
    model: options.config.model,
    baseUrl: options.config.baseUrl,
    maxTokens: options.config.maxTokens,
  }
  const transport: Transport = createTransport({
    timeoutMs: options.config.requestTimeoutMs,
    maxRetries: options.config.maxRetries,
    retryBaseDelayMs: options.config.retryBaseDelayMs,
    retryMaxDelayMs: options.config.retryMaxDelayMs,
    maxConcurrency: options.config.maxConcurrency,
    logger,
  })
  const pathGuard: PathGuard = await createPathGuard(options.config.workspace)
  const sessionStore = new SessionStore({
    databasePath: options.config.sessionDatabasePath,
    sessionId: options.config.sessionId ?? generateSessionId(),
  })

  const fileTools = await builtinTools({
    workspace: options.config.workspace,
    commandTimeoutMs: options.config.commandTimeoutMs,
  })
  const guarded = guardWriteTools(fileTools, {
    roots: options.protectedRoots,
    resolve: (requestedPath) => pathGuard.resolve(requestedPath),
  })
  const tools: AgentTool[] = [
    ...guarded,
    createAskUserTool({ ask: options.ask, logger }),
  ]

  const registry = new HarnessRegistry()
  registry.register('llm', { model, transport })
  registry.register('fs', pathGuard)
  registry.register('sessions', sessionStore)
  for (const tool of tools) {
    registry.register('tools', tool, { many: true, key: (item) => item.name })
  }

  const context: Context = {
    systemPrompt: options.systemPrompt,
    messages: sessionStore.load(),
  }

  return {
    registry,
    context,
    sessionId: sessionStore.sessionId,
    setSystemPrompt(prompt: string) {
      context.systemPrompt = prompt
    },
    async *runTurn(signal?: AbortSignal) {
      const bound = registry.require<{ model: Model; transport: Transport }>('llm')
      const boundTools = registry.require<AgentTool[]>('tools')
      yield* runAgent(bound.model, context, boundTools, signal, {
        transport: bound.transport,
        logger,
      })
    },
    sync() {
      sessionStore.sync(context.messages)
    },
    close() {
      sessionStore.close()
    },
  }
}
