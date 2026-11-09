// 接缝按 id 注册。已有的四个和以后的 shell、sandbox 走同一套函数。

export class SeamOccupiedError extends Error {
  constructor(id: string) {
    super(`接缝 ${id} 已经注册过`)
    this.name = 'SeamOccupiedError'
  }
}

export class DuplicateItemError extends Error {
  constructor(id: string, key: string) {
    super(`接缝 ${id} 里已有 ${key}`)
    this.name = 'DuplicateItemError'
  }
}

export class MissingSeamError extends Error {
  constructor(id: string) {
    super(`接缝 ${id} 还没有注册`)
    this.name = 'MissingSeamError'
  }
}

interface OneSlot {
  cardinality: 'one'
  value: unknown
}

interface ManySlot {
  cardinality: 'many'
  items: unknown[]
  key?: (item: unknown) => string
}

export interface RegisterOptions<T> {
  /** 同一 id 可以追加多条。不设则只能注册一次。 */
  many?: boolean
  /** many 时用来拒绝重复项，比如工具名。 */
  key?: (item: T) => string
}

export class HarnessRegistry {
  private readonly slots = new Map<string, OneSlot | ManySlot>()

  register<T>(id: string, value: T, options: RegisterOptions<T> = {}): void {
    const current = this.slots.get(id)
    if (!current) {
      if (options.many) {
        this.slots.set(id, {
          cardinality: 'many',
          items: [value],
          key: options.key as ((item: unknown) => string) | undefined,
        })
      } else {
        this.slots.set(id, { cardinality: 'one', value })
      }
      return
    }

    if (current.cardinality === 'one' || !options.many) {
      throw new SeamOccupiedError(id)
    }

    if (current.key) {
      const itemKey = current.key(value)
      if (current.items.some((item) => current.key?.(item) === itemKey)) {
        throw new DuplicateItemError(id, itemKey)
      }
    }
    current.items.push(value)
  }

  require<T>(id: string): T {
    const slot = this.slots.get(id)
    if (!slot) throw new MissingSeamError(id)
    if (slot.cardinality === 'one') return slot.value as T
    return slot.items as T
  }
}

export interface HarnessPlugin {
  name: string
  register(registry: HarnessRegistry): void
}

export function applyPlugins(registry: HarnessRegistry, plugins: HarnessPlugin[]): void {
  for (const plugin of plugins) plugin.register(registry)
}
