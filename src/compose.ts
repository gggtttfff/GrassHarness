import { applyGrowthLog, loadCatalog } from './catalog.ts'
import { DEFAULT_COMPONENTS } from './defaults.ts'
import { GrowthLog } from './growth.ts'
import { readSeedDirectory } from './load.ts'
import type { HarnessComponent } from './types.ts'

export interface ComposedHarness {
  components: HarnessComponent[]
  fallbacks: string[]
  skipped: number
}

/**
 * 默认，然后种子，然后生长日志。
 * 生长在目录合成之后重放，因为 append 不是同 id 覆盖。
 */
export async function composeHarness(options: {
  harnessDir: string
  growthDir: string
  domain: string
}): Promise<ComposedHarness> {
  const seed = await readSeedDirectory(options.harnessDir)
  const growth = await new GrowthLog(options.growthDir).list(options.domain)
  const base = loadCatalog([
    { name: 'defaults', components: DEFAULT_COMPONENTS },
    { name: 'seed', components: seed.components },
  ])

  return {
    components: applyGrowthLog(base, growth.records),
    fallbacks: seed.fallbacks,
    skipped: growth.skipped,
  }
}
