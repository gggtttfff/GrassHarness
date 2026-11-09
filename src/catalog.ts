import type { GrowthRecord, HarnessComponent } from './types.ts'

export interface HarnessLayer {
  name: string
  components: HarnessComponent[]
}

/**
 * 按层合成目录。后一层的同 id 盖住前一层。
 *
 * 这是给种子和以后的补丁层用的。生长日志不是覆盖，
 * append 要把正文接上去，所以不走这里。
 */
export function loadCatalog(layers: HarnessLayer[]): HarnessComponent[] {
  const merged = new Map<string, HarnessComponent>()
  for (const layer of layers) {
    for (const component of layer.components) {
      merged.set(component.id, component)
    }
  }
  return [...merged.values()]
}

/** 生长写不进 pinned。规则只能来自种子。 */
export class PinnedGrowthError extends Error {
  readonly componentId: string

  constructor(componentId: string) {
    super(`生长写不进 ${componentId}`)
    this.name = 'PinnedGrowthError'
    this.componentId = componentId
  }
}

/**
 * 把一条生长记录应用到目录的副本上。
 * 原数组不动：调用方还拿着种子，失败时不能留下半截修改。
 */
export function applyGrowth(
  components: HarnessComponent[],
  record: GrowthRecord,
): HarnessComponent[] {
  if (record.kind !== 'context') {
    throw new PinnedGrowthError(record.id)
  }

  const existing = components.find((component) => component.id === record.id)
  if (existing?.kind === 'pinned') {
    throw new PinnedGrowthError(record.id)
  }

  const body = record.op === 'append' && existing
    ? `${existing.body.trim()}\n${record.body.trim()}`
    : record.body.trim()

  const next: HarnessComponent = {
    id: record.id,
    kind: 'context',
    title: record.title.trim(),
    body,
    order: record.order,
  }

  if (!existing) return [...components, next]
  return components.map((component) => (component.id === record.id ? next : component))
}

export function applyGrowthLog(
  components: HarnessComponent[],
  records: GrowthRecord[],
): HarnessComponent[] {
  return records.reduce(applyGrowth, components)
}
