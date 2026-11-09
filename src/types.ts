// 部件是 harness 里的一块文字。
// pinned 只能来自种子。生长记录不允许带这个 kind。

export type ComponentKind = 'context' | 'pinned'

export interface HarnessComponent {
  id: string
  kind: ComponentKind
  title: string
  body: string
  order: number
}

export type GrowthOp = 'append' | 'replace'

/** 一行生长日志。正文会进入下次的系统提示词，情境和教训留给打开文件的人看。 */
export interface GrowthRecord {
  id: string
  kind: 'context'
  title: string
  body: string
  order: number
  op: GrowthOp
  domain: string
  situation: string
  lesson: string
  evidence: {
    sessionId: string
    excerpt: string
  }
  createdAt: number
}

export interface GrowInput {
  id: string
  title: string
  body: string
  order?: number
  op?: GrowthOp
  domain: string
  situation: string
  lesson: string
  sessionId: string
  excerpt: string
}
